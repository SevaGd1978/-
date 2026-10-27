import { createReadStream, existsSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import type { PublicUser, Right } from '../src/access.ts'
import { parseDriver, parseExpense, parsePayment, parseRepair, parseTrip, parseVehicle } from '../src/records.ts'
import {
  createUser,
  deleteUser,
  listUsers,
  login,
  logout,
  needsSetup,
  parseRights,
  updateUser,
  userByToken,
} from './accounts.ts'
import {
  deleteDriver,
  deleteExpense,
  deletePayment,
  deleteRepair,
  deleteTrip,
  deleteVehicle,
  readResult,
  resetDemo,
  saveDriver,
  saveExpense,
  savePayment,
  saveRepair,
  saveTrip,
  saveVehicle,
  type DbResult,
} from './db.ts'
import { checkGibddFines, issueCaptcha } from './gibdd.ts'
import { cityCatalog, lookupRoutes } from './roads.ts'
import { splitPlate, stsLooksValid } from '../src/gibdd.ts'

const WRITE_RIGHT: Record<string, Right> = {
  trips: 'trips',
  expenses: 'expenses',
  repairs: 'repairs',
  payments: 'payments',
  vehicles: 'fleet',
  drivers: 'fleet',
}

const loginFailures = new Map<string, { count: number; until: number }>()

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
}

export async function handleRequest(
  db: DatabaseSync,
  req: IncomingMessage,
  res: ServerResponse,
  staticDir: string,
) {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  if (url.pathname.startsWith('/api/')) {
    await handleApi(db, req, res, url.pathname)
    return
  }
  serveStatic(req, res, staticDir, url.pathname)
}

async function handleApi(db: DatabaseSync, req: IncomingMessage, res: ServerResponse, pathname: string) {
  const method = req.method || 'GET'
  const parts = pathname.split('/').filter(Boolean)
  const token = readCookie(req, 'putevoy_session')
  const actor = userByToken(db, token)
  const secure = secureRequest(req)
  try {
    if (method === 'GET' && pathname === '/api/session') {
      sendJson(res, 200, { user: actor, needsSetup: needsSetup(db) })
      return
    }
    if (method === 'POST' && pathname === '/api/login') {
      await handleLogin(db, req, res, secure)
      return
    }
    if (method === 'POST' && pathname === '/api/logout') {
      logout(db, token)
      clearSessionCookie(res, secure)
      sendJson(res, 200, { ok: true })
      return
    }
    if (pathname === '/api/users' && method === 'GET') {
      if (!actor) return deny(res)
      if (!actor.rights.includes('users')) return forbid(res)
      sendJson(res, 200, { users: listUsers(db) })
      return
    }
    if (pathname === '/api/users' && method === 'POST') {
      const body = await readJson(req)
      const created = await createFromBody(db, body, actor, secure, res)
      if (created) return
      return
    }
    if (parts[0] === 'api' && parts[1] === 'users' && parts[2] && method === 'PATCH') {
      if (!actor) return deny(res)
      if (!actor.rights.includes('users')) return forbid(res)
      const body = await readJson(req)
      const parsed = accountBody(body)
      if (!parsed) return sendJson(res, 400, { error: 'Проверьте поля учётной записи' })
      const updated = updateUser(db, decodeURIComponent(parts[2]), parsed, token)
      if (!updated.ok) return sendJson(res, 400, { error: updated.error })
      sendJson(res, 200, { user: freshActor(db, token, actor, updated.user) })
      return
    }
    if (parts[0] === 'api' && parts[1] === 'users' && parts[2] && method === 'DELETE') {
      if (!actor) return deny(res)
      if (!actor.rights.includes('users')) return forbid(res)
      const removed = deleteUser(db, decodeURIComponent(parts[2]))
      if (!removed.ok) return sendJson(res, 400, { error: removed.error })
      sendJson(res, 200, { users: listUsers(db) })
      return
    }
    if (!actor) return deny(res)
    if (method === 'GET' && pathname === '/api/cities') {
      sendJson(res, 200, { cities: cityCatalog() })
      return
    }
    if (method === 'POST' && pathname === '/api/routes') {
      const body = await readJson(req)
      const pairs = parseRoutePairs(body)
      if (!pairs) return sendJson(res, 400, { error: 'Укажите города маршрута' })
      const routes = await lookupRoutes(db, pairs)
      sendJson(res, 200, { routes })
      return
    }
    if (method === 'GET' && pathname === '/api/gibdd/captcha') {
      const captcha = await issueCaptcha()
      if ('error' in captcha) return sendJson(res, 502, captcha)
      sendJson(res, 200, captcha)
      return
    }
    if (method === 'POST' && pathname === '/api/gibdd/fines') {
      const body = await readJson(req)
      const parsed = finesBody(body)
      if (!parsed) return sendJson(res, 400, { error: 'Укажите госномер, СТС и код с картинки.' })
      const answer = await checkGibddFines(parsed)
      sendJson(res, answer.ok ? 200 : 422, answer)
      return
    }
    if (method === 'GET' && pathname === '/api/state') {
      sendJson(res, 200, readResult(db))
      return
    }
    if (method === 'POST' && pathname === '/api/reset') {
      if (!actor.rights.includes('reset')) return forbid(res)
      sendResult(res, resetDemo(db))
      return
    }
    if (parts.length === 2 && method === 'POST') {
      const right = WRITE_RIGHT[parts[1]]
      if (!right) return sendJson(res, 404, { error: 'Неизвестный запрос' })
      if (!actor.rights.includes(right)) return forbid(res)
      const body = await readJson(req)
      const result = writeOne(db, parts[1], body)
      sendResult(res, result)
      return
    }
    if (parts.length === 3 && method === 'DELETE') {
      const right = WRITE_RIGHT[parts[1]]
      if (!right) return sendJson(res, 404, { error: 'Неизвестный запрос' })
      if (!actor.rights.includes(right)) return forbid(res)
      const result = removeOne(db, parts[1], decodeURIComponent(parts[2]))
      sendResult(res, result)
      return
    }
    sendJson(res, 404, { error: 'Неизвестный запрос' })
  } catch (error) {
    const message = error instanceof Error && error.message === 'too big' ? 'Слишком большой запрос' : 'Некорректный запрос'
    sendJson(res, 400, { error: message })
  }
}

async function handleLogin(db: DatabaseSync, req: IncomingMessage, res: ServerResponse, secure: boolean) {
  const address = clientAddress(req)
  const blocked = loginFailures.get(address)
  if (blocked && blocked.until > Date.now()) {
    sendJson(res, 429, { error: 'Слишком много попыток. Подождите минуту.' })
    return
  }
  const body = await readJson(req)
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  const username = record && typeof record.username === 'string' ? record.username : ''
  const password = record && typeof record.password === 'string' ? record.password : ''
  const session = login(db, username, password)
  if (!session) {
    const next = (blocked?.count ?? 0) + 1
    loginFailures.set(address, next >= 8 ? { count: 0, until: Date.now() + 60_000 } : { count: next, until: 0 })
    sendJson(res, 401, { error: 'Неверный логин или пароль' })
    return
  }
  loginFailures.delete(address)
  setSessionCookie(res, session.token, secure)
  sendJson(res, 200, { user: session.user })
}

async function createFromBody(
  db: DatabaseSync,
  body: unknown,
  actor: PublicUser | null,
  secure: boolean,
  res: ServerResponse,
) {
  const bootstrap = needsSetup(db)
  if (!bootstrap && !actor) {
    deny(res)
    return true
  }
  if (!bootstrap && !actor?.rights.includes('users')) {
    forbid(res)
    return true
  }
  const parsed = accountBody(body)
  if (!parsed) {
    sendJson(res, 400, { error: 'Проверьте поля учётной записи' })
    return true
  }
  const created = createUser(db, parsed, bootstrap)
  if (!created.ok) {
    sendJson(res, 400, { error: created.error })
    return true
  }
  if (created.token) setSessionCookie(res, created.token, secure)
  sendJson(res, 200, { user: created.user, users: listUsers(db) })
  return true
}

function accountBody(body: unknown) {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>
  if (typeof record.username !== 'string' || typeof record.name !== 'string' || typeof record.password !== 'string') return null
  const rights = parseRights(record.rights)
  if (!rights) return null
  return { username: record.username, name: record.name, password: record.password, rights }
}

function freshActor(db: DatabaseSync, token: string | null, actor: PublicUser, updated: PublicUser) {
  if (updated.id !== actor.id) return updated
  return userByToken(db, token) ?? updated
}

function deny(res: ServerResponse) {
  sendJson(res, 401, { error: 'Войдите в учётную запись' })
}

function forbid(res: ServerResponse) {
  sendJson(res, 403, { error: 'Недостаточно прав' })
}

function readCookie(req: IncomingMessage, name: string) {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

function setSessionCookie(res: ServerResponse, token: string, secure: boolean) {
  const pieces = [
    `putevoy_session=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${14 * 24 * 60 * 60}`,
  ]
  if (secure) pieces.push('Secure')
  res.setHeader('set-cookie', pieces.join('; '))
}

function clearSessionCookie(res: ServerResponse, secure: boolean) {
  const pieces = ['putevoy_session=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secure) pieces.push('Secure')
  res.setHeader('set-cookie', pieces.join('; '))
}

function secureRequest(req: IncomingMessage) {
  const forwarded = req.headers['x-forwarded-proto']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return value?.split(',')[0]?.trim() === 'https'
}

function clientAddress(req: IncomingMessage) {
  const forwarded = req.headers['x-forwarded-for']
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return value?.split(',')[0]?.trim() || req.socket.remoteAddress || 'local'
}

function writeOne(db: DatabaseSync, kind: string, body: unknown): DbResult {
  if (kind === 'trips') {
    const trip = parseTrip(body)
    return trip ? saveTrip(db, trip) : fail('Проверьте поля рейса')
  }
  if (kind === 'expenses') {
    const expense = parseExpense(body)
    return expense ? saveExpense(db, expense) : fail('Проверьте поля расхода')
  }
  if (kind === 'repairs') {
    const job = parseRepair(body)
    return job ? saveRepair(db, job) : fail('Проверьте поля заявки в ремзону')
  }
  if (kind === 'payments') {
    const payment = parsePayment(body)
    return payment ? savePayment(db, payment) : fail('Проверьте поля оплаты')
  }
  if (kind === 'vehicles') {
    const vehicle = parseVehicle(body)
    return vehicle ? saveVehicle(db, vehicle) : fail('Проверьте поля машины')
  }
  if (kind === 'drivers') {
    const driver = parseDriver(body)
    return driver ? saveDriver(db, driver) : fail('Проверьте поля водителя')
  }
  return { ok: false, status: 404, error: 'Неизвестный запрос' }
}

function removeOne(db: DatabaseSync, kind: string, id: string): DbResult {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return fail('Некорректный идентификатор')
  if (kind === 'trips') return deleteTrip(db, id)
  if (kind === 'expenses') return deleteExpense(db, id)
  if (kind === 'repairs') return deleteRepair(db, id)
  if (kind === 'payments') return deletePayment(db, id)
  if (kind === 'vehicles') return deleteVehicle(db, id)
  if (kind === 'drivers') return deleteDriver(db, id)
  return { ok: false, status: 404, error: 'Неизвестный запрос' }
}

function parseRoutePairs(body: unknown): { from: string; to: string }[] | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const pairs = (body as { pairs?: unknown }).pairs
  if (!Array.isArray(pairs) || pairs.length > 40) return null
  const parsed: { from: string; to: string }[] = []
  for (const item of pairs) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const from = place((item as { from?: unknown }).from)
    const to = place((item as { to?: unknown }).to)
    if (!from || !to) return null
    parsed.push({ from, to })
  }
  return parsed
}

function place(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (!trimmed || trimmed.length > 80) return null
  return trimmed
}

function finesBody(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const row = body as Record<string, unknown>
  const plate = typeof row.plate === 'string' ? splitPlate(row.plate) : null
  const sts = typeof row.sts === 'string' && stsLooksValid(row.sts) ? row.sts : ''
  const sessionId = typeof row.sessionId === 'string' && /^[a-f0-9]{32}$/.test(row.sessionId) ? row.sessionId : ''
  const captchaWord = typeof row.captchaWord === 'string' ? row.captchaWord.trim() : ''
  if (!plate || !sts || !sessionId || captchaWord.length < 3 || captchaWord.length > 12) return null
  return { sessionId, captchaWord, regnum: plate.regnum, regreg: plate.regreg, sts }
}

function fail(error: string): DbResult {
  return { ok: false, status: 400, error }
}

function sendResult(res: ServerResponse, result: DbResult) {
  if (result.ok) sendJson(res, 200, { version: result.version, state: result.state })
  else sendJson(res, result.status, { error: result.error })
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 1_000_000) throw new Error('too big')
    chunks.push(buffer)
  }
  if (size === 0) return null
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

function serveStatic(req: IncomingMessage, res: ServerResponse, staticDir: string, pathname: string) {
  const safe = safePath(staticDir, pathname)
  if (safe && existsSync(safe) && statSync(safe).isFile()) {
    sendFile(req, res, safe)
    return
  }
  if (pathname.includes('.')) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Не найдено')
    return
  }
  const index = join(staticDir, 'index.html')
  if (!existsSync(index)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Сборка интерфейса не найдена')
    return
  }
  sendFile(req, res, index)
}

function safePath(root: string, pathname: string) {
  const decoded = decodeURIComponent(pathname)
  if (decoded.includes('\0')) return null
  const full = normalize(join(root, decoded))
  if (full !== root && !full.startsWith(root + sep)) return null
  return full
}

function sendFile(req: IncomingMessage, res: ServerResponse, file: string) {
  const type = TYPES[extname(file)] || 'application/octet-stream'
  const cache = file.endsWith('index.html') ? 'no-cache' : 'public, max-age=86400'
  res.writeHead(req.method === 'HEAD' ? 200 : 200, { 'content-type': type, 'cache-control': cache })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(file).pipe(res)
}
