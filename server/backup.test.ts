import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from './db.ts'
import {
  backupFileName,
  createBackup,
  isSafeBackupName,
  listBackups,
  localDateKey,
  maybeRunDailyBackup,
  pruneBackups,
  resolveBackupPath,
} from './backup.ts'

const dir = mkdtempSync(join(tmpdir(), 'putevoy-backup-'))
const dbFile = join(dir, 'putevoy.sqlite')
process.env.PUTEVOY_BACKUP_DIR = join(dir, 'backups')
process.env.PUTEVOY_BACKUP_KEEP_DAYS = '3'
process.env.PUTEVOY_BACKUP_HOUR = '0'
process.env.PUTEVOY_BACKUP_TZ = 'Asia/Yekaterinburg'

const db = openDatabase(dbFile)
const today = localDateKey()

assert.equal(isSafeBackupName('putevoy-2026-11-19.sqlite'), true)
assert.equal(isSafeBackupName('../etc/passwd'), false)
assert.equal(isSafeBackupName('putevoy-2026-11-19.sqlite.bak'), false)

const first = createBackup(db, dbFile, today)
assert.equal(first.name, backupFileName(today))
assert.ok(first.size > 0)
assert.equal(listBackups(process.env.PUTEVOY_BACKUP_DIR!).length, 1)

const again = maybeRunDailyBackup(db, dbFile)
assert.equal(again.ran, false)
assert.equal(again.reason, 'already')

writeFileSync(join(process.env.PUTEVOY_BACKUP_DIR!, 'putevoy-2026-11-01.sqlite'), 'old')
writeFileSync(join(process.env.PUTEVOY_BACKUP_DIR!, 'putevoy-2026-11-02.sqlite'), 'old')
writeFileSync(join(process.env.PUTEVOY_BACKUP_DIR!, 'putevoy-2026-11-03.sqlite'), 'old')
writeFileSync(join(process.env.PUTEVOY_BACKUP_DIR!, 'putevoy-2026-11-04.sqlite'), 'old')
const removed = pruneBackups(process.env.PUTEVOY_BACKUP_DIR!, 3)
assert.ok(removed.includes('putevoy-2026-11-01.sqlite'))
assert.equal(listBackups(process.env.PUTEVOY_BACKUP_DIR!).length, 3)

assert.ok(resolveBackupPath(dbFile, first.name))
assert.equal(resolveBackupPath(dbFile, '../secret.sqlite'), null)

console.log('backup tests ok')
