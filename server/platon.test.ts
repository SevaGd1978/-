import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, readResult, saveExpense, saveRepair } from './db.ts'

const dir = mkdtempSync(join(tmpdir(), 'putevoy-platon-'))
const file = join(dir, 'putevoy.sqlite')

try {
  const db = openDatabase(file)
  const before = readResult(db)
  assert.equal(before.version, 1)
  assert.equal(before.state.expenses.find((expense) => expense.id === 'e1')?.vehicleId, '')
  assert.equal(before.state.expenses.find((expense) => expense.id === 'e1')?.category, 'fuel')
  assert.equal(before.state.expenses.find((expense) => expense.id === 'e8')?.category, 'platon')
  assert.equal(before.state.expenses.find((expense) => expense.id === 'e8')?.vehicleId, '')
  db.prepare(
    `INSERT INTO expenses (id, trip_id, vehicle_id, date, category, amount, comment, position)
     VALUES ('platon_t1', 't1', 'v1', '2026-10-16', 'platon', 1131.42, 'авто', 100)`,
  ).run()
  db.prepare(
    `INSERT INTO expenses (id, trip_id, vehicle_id, date, category, amount, comment, position)
     VALUES ('e_manual_platon', '', 'v1', '2026-10-20', 'platon', 500, 'Ручной Платон', 101)`,
  ).run()
  db.prepare(`UPDATE expenses SET vehicle_id = 'v1' WHERE id = 'e1'`).run()
  db.prepare(`UPDATE expenses SET vehicle_id = 'v1' WHERE id = 'e2'`).run()
  db.prepare(`UPDATE repairs SET vehicle_id = 'v4', odometer = 10 WHERE id = 'r4'`).run()
  db.close()

  const again = openDatabase(file)
  const state = readResult(again).state
  assert.equal(
    state.expenses.some((expense) => expense.id === 'platon_t1'),
    false,
  )
  const manual = state.expenses.find((expense) => expense.id === 'e_manual_platon')
  assert.equal(manual?.category, 'platon')
  assert.equal(manual?.vehicleId, '')
  assert.equal(manual?.amount, 500)
  assert.equal(state.expenses.find((expense) => expense.id === 'e2')?.vehicleId, '')
  assert.equal(state.expenses.find((expense) => expense.id === 'e2')?.category, 'toll')
  assert.equal(state.expenses.find((expense) => expense.id === 'e1')?.vehicleId, '')
  const parts = state.repairs.find((job) => job.id === 'r4')
  assert.equal(parts?.kind, 'parts')
  assert.equal(parts?.vehicleId, '')
  assert.equal(parts?.odometer, null)
  const version = readResult(again).version
  again.close()

  const third = openDatabase(file)
  assert.equal(readResult(third).version, version)
  assert.equal(readResult(third).state.expenses.some((expense) => expense.id === 'e_manual_platon'), true)
  const toll = saveExpense(third, {
    id: 'e_toll',
    vehicleId: 'v1',
    tripId: '',
    date: '2026-10-21',
    category: 'toll',
    amount: 100,
    comment: 'М-12',
  })
  assert.equal(toll.ok, true)
  if (!toll.ok) throw new Error('toll')
  assert.equal(toll.state.expenses.find((expense) => expense.id === 'e_toll')?.vehicleId, '')
  assert.equal(toll.state.expenses.find((expense) => expense.id === 'e_toll')?.vat ?? null, null)
  const taxed = saveExpense(third, {
    id: 'e_toll',
    vehicleId: 'v1',
    tripId: '',
    date: '2026-10-21',
    category: 'toll',
    amount: 1000,
    vat: 50,
    comment: 'М-12',
  })
  assert.equal(taxed.ok, true)
  if (!taxed.ok) throw new Error('vat')
  assert.equal(taxed.state.expenses.find((expense) => expense.id === 'e_toll')?.vat, 50)
  assert.equal(taxed.state.expenses.find((expense) => expense.id === 'e2')?.vat ?? null, null)
  const fuel = saveExpense(third, {
    id: 'e_fuel',
    vehicleId: 'v1',
    tripId: '',
    date: '2026-10-21',
    category: 'fuel',
    amount: 100,
    comment: '',
  })
  assert.equal(fuel.ok, true)
  if (!fuel.ok) throw new Error('fuel')
  assert.equal(fuel.state.expenses.find((expense) => expense.id === 'e_fuel')?.vehicleId, '')
  const general = saveExpense(third, {
    id: 'e_general',
    vehicleId: '',
    tripId: '',
    date: '2026-10-21',
    category: 'parking',
    amount: 400,
    comment: 'Стоянка',
  })
  assert.equal(general.ok, true)
  if (!general.ok) throw new Error('general')
  assert.equal(general.state.expenses.find((expense) => expense.id === 'e_general')?.vehicleId, '')
  const missing = saveExpense(third, {
    id: 'e_missing',
    vehicleId: 'no-such',
    tripId: '',
    date: '2026-10-21',
    category: 'driver',
    amount: 100,
    comment: '',
  })
  assert.equal(missing.ok, false)
  const job = saveRepair(third, {
    id: 'r_parts',
    vehicleId: 'v1',
    date: '2026-10-21',
    kind: 'parts',
    description: 'Фильтр',
    partsCost: 800,
    laborCost: 0,
    status: 'queued',
    odometer: 1200,
  })
  assert.equal(job.ok, true)
  if (!job.ok) throw new Error('parts')
  const saved = job.state.repairs.find((item) => item.id === 'r_parts')
  assert.equal(saved?.vehicleId, '')
  assert.equal(saved?.odometer, null)
  third.close()
  console.log('platon db tests ok')
} finally {
  rmSync(dir, { recursive: true, force: true })
}
