import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { checkpointDatabase } from './db.ts'

const DEFAULT_TZ = 'Asia/Yekaterinburg'
const DEFAULT_HOUR = 2
const DEFAULT_KEEP_DAYS = 14
const FILE_RE = /^putevoy-(\d{4}-\d{2}-\d{2})\.sqlite$/

export interface BackupInfo {
  name: string
  date: string
  size: number
  mtime: string
}

export function backupDir(dbFile: string) {
  const configured = process.env.PUTEVOY_BACKUP_DIR?.trim()
  if (configured) return configured
  return join(dirname(dbFile), 'backups')
}

export function backupKeepDays() {
  const raw = Number(process.env.PUTEVOY_BACKUP_KEEP_DAYS || DEFAULT_KEEP_DAYS)
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_KEEP_DAYS
  return Math.min(365, Math.floor(raw))
}

export function backupHour() {
  const raw = Number(process.env.PUTEVOY_BACKUP_HOUR || DEFAULT_HOUR)
  if (!Number.isFinite(raw) || raw < 0 || raw > 23) return DEFAULT_HOUR
  return Math.floor(raw)
}

export function backupTimeZone() {
  return process.env.PUTEVOY_BACKUP_TZ?.trim() || DEFAULT_TZ
}

/** Локальная календарная дата YYYY-MM-DD в часовом поясе бэкапов. */
export function localDateKey(now = new Date(), timeZone = backupTimeZone()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function localHour(now = new Date(), timeZone = backupTimeZone()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  return Number(parts.find((part) => part.type === 'hour')?.value ?? '0')
}

export function backupFileName(dateKey: string) {
  return `putevoy-${dateKey}.sqlite`
}

export function isSafeBackupName(name: string) {
  return FILE_RE.test(name) && !name.includes('/') && !name.includes('\\') && !name.includes('..')
}

export function listBackups(dir: string): BackupInfo[] {
  if (!existsSync(dir)) return []
  const rows: BackupInfo[] = []
  for (const name of readdirSync(dir)) {
    const match = name.match(FILE_RE)
    if (!match) continue
    const path = join(dir, name)
    const stat = statSync(path)
    if (!stat.isFile()) continue
    rows.push({
      name,
      date: match[1],
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    })
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date))
}

/** Оставляет последние keepDays снимков (по дате в имени), остальные удаляет. */
export function pruneBackups(dir: string, keepDays = backupKeepDays()) {
  const removed: string[] = []
  for (const item of listBackups(dir).slice(keepDays)) {
    unlinkSync(join(dir, item.name))
    removed.push(item.name)
  }
  return removed
}

/** Снимок текущей базы: checkpoint + копия файла. */
export function createBackup(db: DatabaseSync, dbFile: string, dateKey = localDateKey()) {
  if (!existsSync(dbFile)) throw new Error('Файл базы не найден')
  const dir = backupDir(dbFile)
  mkdirSync(dir, { recursive: true })
  const name = backupFileName(dateKey)
  const target = join(dir, name)
  const temp = `${target}.partial`
  checkpointDatabase(db)
  copyFileSync(dbFile, temp)
  copyFileSync(temp, target)
  try {
    unlinkSync(temp)
  } catch {
    /* ignore */
  }
  pruneBackups(dir)
  const stat = statSync(target)
  return {
    name,
    date: dateKey,
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    path: target,
  } satisfies BackupInfo & { path: string }
}

/**
 * Если наступило время дневного снимка и файла за сегодня ещё нет — создать.
 * После простоя Amvera (spin-down) догонит бэкап при следующем запуске/тике.
 */
export function maybeRunDailyBackup(db: DatabaseSync, dbFile: string, now = new Date()) {
  const hour = backupHour()
  const today = localDateKey(now)
  if (localHour(now) < hour) {
    return { ran: false as const, reason: 'too-early' as const, date: today }
  }
  const dir = backupDir(dbFile)
  const path = join(dir, backupFileName(today))
  if (existsSync(path)) {
    pruneBackups(dir)
    return { ran: false as const, reason: 'already' as const, date: today }
  }
  const backup = createBackup(db, dbFile, today)
  return { ran: true as const, backup }
}

export function startBackupScheduler(db: DatabaseSync, dbFile: string) {
  const tick = () => {
    try {
      const result = maybeRunDailyBackup(db, dbFile)
      if (result.ran) {
        console.log(`Путевой: дневной бэкап ${result.backup.name} (${result.backup.size} байт)`)
      }
    } catch (error) {
      console.error('Путевой: не удалось сделать дневной бэкап', error)
    }
  }
  tick()
  const timer = setInterval(tick, 60_000)
  timer.unref?.()
  console.log(
    `Путевой: автобэкап каждый день после ${backupHour()}:00 ${backupTimeZone()}, каталог ${backupDir(dbFile)}, хранить ${backupKeepDays()} дн.`,
  )
  return () => clearInterval(timer)
}

export function resolveBackupPath(dbFile: string, name: string) {
  if (!isSafeBackupName(name)) return null
  const path = join(backupDir(dbFile), name)
  if (!existsSync(path)) return null
  if (basename(path) !== name) return null
  return path
}
