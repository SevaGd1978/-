import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { ALL_RIGHTS, isRight, type PublicUser, type Right } from '../src/access.ts'

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const
const SESSION_MS = 14 * 24 * 60 * 60 * 1000

export function ensureAccounts(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      username_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      rights TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `)
}

export function needsSetup(db: DatabaseSync) {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }
  return row.n === 0
}

export function userByToken(db: DatabaseSync, token: string | null): PublicUser | null {
  if (!token) return null
  const now = Date.now()
  db.prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(now)
  const session = db.prepare(`SELECT user_id FROM sessions WHERE token_hash = ? AND expires_at > ?`).get(
    hashToken(token),
    now,
  ) as { user_id: string } | undefined
  if (!session) return null
  return readUser(db, session.user_id)
}

export function login(db: DatabaseSync, username: string, password: string) {
  const row = db.prepare(`SELECT * FROM users WHERE username_key = ?`).get(normalizeUsername(username)) as UserRow | undefined
  if (!row || !passwordMatches(password, row)) return null
  return { token: openSession(db, row.id), user: toPublic(row) }
}

export function logout(db: DatabaseSync, token: string | null) {
  if (!token) return
  db.prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(hashToken(token))
}

export function listUsers(db: DatabaseSync): PublicUser[] {
  const rows = db.prepare(`SELECT * FROM users ORDER BY created_at, username_key`).all() as unknown as UserRow[]
  return rows.map(toPublic)
}

export function createUser(
  db: DatabaseSync,
  input: { username: string; name: string; password: string; rights: Right[] },
  bootstrap: boolean,
): { ok: true; user: PublicUser; token: string | null } | { ok: false; error: string } {
  const username = validateUsername(input.username)
  if (!username) return { ok: false, error: 'Логин: 3–32 буквы, цифры или знаки _ . -' }
  const name = validateName(input.name)
  if (!name) return { ok: false, error: 'Укажите имя, от 2 до 80 символов' }
  if (!validPassword(input.password)) return { ok: false, error: 'Пароль не короче 8 символов' }
  const rights = bootstrap ? ALL_RIGHTS : input.rights
  if (!rights) return { ok: false, error: 'Неизвестное право' }
  const key = normalizeUsername(username)
  if (db.prepare(`SELECT id FROM users WHERE username_key = ?`).get(key)) {
    return { ok: false, error: 'Такой логин уже есть' }
  }
  const id = `u_${randomBytes(4).toString('hex')}`
  const password = hashPassword(input.password)
  db.prepare(
    `INSERT INTO users (id, username, username_key, name, password_hash, password_salt, rights, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, username, key, name, password.hash, password.salt, JSON.stringify(rights), new Date().toISOString())
  const user = readUser(db, id)
  if (!user) return { ok: false, error: 'Не удалось создать учётную запись' }
  return { ok: true, user, token: bootstrap ? openSession(db, id) : null }
}

export function updateUser(
  db: DatabaseSync,
  id: string,
  input: { username: string; name: string; password: string; rights: Right[] },
  keepToken: string | null,
): { ok: true; user: PublicUser } | { ok: false; error: string } {
  const current = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined
  if (!current) return { ok: false, error: 'Учётная запись не найдена' }
  const username = validateUsername(input.username)
  if (!username) return { ok: false, error: 'Логин: 3–32 буквы, цифры или знаки _ . -' }
  const name = validateName(input.name)
  if (!name) return { ok: false, error: 'Укажите имя, от 2 до 80 символов' }
  if (input.password && !validPassword(input.password)) return { ok: false, error: 'Пароль не короче 8 символов' }
  if (!input.rights) return { ok: false, error: 'Неизвестное право' }
  if (hasRight(current, 'users') && !input.rights.includes('users') && countAdmins(db) <= 1) {
    return { ok: false, error: 'Нельзя снять право учётных записей с последнего администратора' }
  }
  const key = normalizeUsername(username)
  const taken = db.prepare(`SELECT id FROM users WHERE username_key = ? AND id <> ?`).get(key, id) as { id: string } | undefined
  if (taken) return { ok: false, error: 'Такой логин уже есть' }
  const password = input.password ? hashPassword(input.password) : { hash: current.password_hash, salt: current.password_salt }
  db.prepare(
    `UPDATE users SET username = ?, username_key = ?, name = ?, password_hash = ?, password_salt = ?, rights = ? WHERE id = ?`,
  ).run(username, key, name, password.hash, password.salt, JSON.stringify(input.rights), id)
  if (input.password) {
    const keep = keepToken ? hashToken(keepToken) : ''
    db.prepare(`DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?`).run(id, keep)
  }
  const user = readUser(db, id)
  if (!user) return { ok: false, error: 'Учётная запись не найдена' }
  return { ok: true, user }
}

export function deleteUser(db: DatabaseSync, id: string): { ok: true } | { ok: false; error: string } {
  const current = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined
  if (!current) return { ok: false, error: 'Учётная запись не найдена' }
  if (hasRight(current, 'users') && countAdmins(db) <= 1) {
    return { ok: false, error: 'Нельзя удалить последнего администратора' }
  }
  db.prepare(`DELETE FROM sessions WHERE user_id = ?`).run(id)
  db.prepare(`DELETE FROM users WHERE id = ?`).run(id)
  return { ok: true }
}

export function parseRights(value: unknown): Right[] | null {
  if (!Array.isArray(value) || value.length > ALL_RIGHTS.length) return null
  const rights: Right[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !isRight(item) || rights.includes(item)) return null
    rights.push(item)
  }
  return rights
}

interface UserRow {
  id: string
  username: string
  username_key: string
  name: string
  password_hash: string
  password_salt: string
  rights: string
  created_at: string
}

function readUser(db: DatabaseSync, id: string) {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined
  return row ? toPublic(row) : null
}

function toPublic(row: UserRow): PublicUser {
  const parsed: unknown = JSON.parse(row.rights)
  const rights = Array.isArray(parsed) ? parsed.filter((item): item is Right => typeof item === 'string' && isRight(item)) : []
  return { id: row.id, username: row.username, name: row.name, rights }
}

function hasRight(row: UserRow, right: Right) {
  return toPublic(row).rights.includes(right)
}

function countAdmins(db: DatabaseSync) {
  return listUsers(db).filter((user) => user.rights.includes('users')).length
}

function openSession(db: DatabaseSync, userId: string) {
  const token = randomBytes(32).toString('hex')
  db.prepare(`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)`).run(
    hashToken(token),
    userId,
    Date.now() + SESSION_MS,
  )
  return token
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

function hashPassword(password: string) {
  const salt = randomBytes(16)
  const hash = scryptSync(password, salt, 32, SCRYPT)
  return { salt: salt.toString('hex'), hash: hash.toString('hex') }
}

function passwordMatches(password: string, row: UserRow) {
  const actual = scryptSync(password, Buffer.from(row.password_salt, 'hex'), 32, SCRYPT)
  const expected = Buffer.from(row.password_hash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

function normalizeUsername(username: string) {
  return username.trim().toLocaleLowerCase('ru-RU')
}

function validateUsername(value: string) {
  const username = value.trim()
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_.-]{2,31}$/u.test(username)) return null
  return username
}

function validateName(value: string) {
  const name = value.trim()
  if (name.length < 2 || name.length > 80) return null
  return name
}

function validPassword(password: string) {
  return password.length >= 8 && password.length <= 72
}
