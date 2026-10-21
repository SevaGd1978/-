import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, readResult } from './db.ts'
import { syncPlaton } from './platon.ts'

const dir = mkdtempSync(join(tmpdir(), 'putevoy-platon-'))
const file = join(dir, 'putevoy.sqlite')

try {
  const db = openDatabase(file)
  db.prepare(
    `INSERT INTO road_cache (pair_key, km, federal_km, minutes, geometry, ok, fetched_at) VALUES (?, 590, 218, 564, NULL, 1, ?)`,
  ).run('казань\nпермь', Date.now())
  db.prepare(
    `INSERT INTO road_cache (pair_key, km, federal_km, minutes, geometry, ok, fetched_at) VALUES (?, 557, 400, 492, NULL, 1, ?)`,
  ).run('ижевск\nсамара', Date.now())
  assert.equal(syncPlaton(db), true)
  const state = readResult(db).state
  const kazan = state.expenses.find((expense) => expense.id === 'platon_t1')
  assert.equal(kazan?.category, 'platon')
  assert.equal(kazan?.vehicleId, 'v1')
  assert.equal(kazan?.tripId, 't1')
  assert.equal(kazan?.amount, 1131.42)
  assert.equal(kazan?.comment, 'Платон · 218 км федеральных дорог × 5,19 ₽/км')
  assert.equal(
    state.expenses.some((expense) => expense.id === 'platon_t3'),
    false,
  )
  assert.equal(syncPlaton(db), false)
  console.log('platon db tests ok')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
