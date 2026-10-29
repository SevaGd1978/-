import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { DatabaseSync } from 'node:sqlite'
import { createSeed } from '../src/seed.ts'
import { deleteTrip, deleteVehicle, openDatabase, readResult, resetDemo, saveExpense, saveTrip } from './db.ts'
import { handleRequest } from './http.ts'

const legacyDir = mkdtempSync(join(tmpdir(), 'putevoy-legacy-'))
const legacyFile = join(legacyDir, 'old.sqlite')
const legacy = new DatabaseSync(legacyFile)
legacy.exec(`
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE trips (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL,
    date TEXT NOT NULL,
    from_city TEXT NOT NULL,
    to_city TEXT NOT NULL,
    vehicle_id TEXT NOT NULL,
    driver_id TEXT NOT NULL,
    customer TEXT NOT NULL,
    cargo TEXT NOT NULL,
    weight_tons REAL NOT NULL,
    rate REAL NOT NULL,
    pay_due TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT NOT NULL,
    position INTEGER NOT NULL
  );
  INSERT INTO meta (key, value) VALUES ('seeded', '1'), ('version', '4');
  INSERT INTO trips (
    id, number, date, from_city, to_city, vehicle_id, driver_id, customer, cargo,
    weight_tons, rate, pay_due, status, note, position
  ) VALUES ('t_old', 'Р-1', '2026-10-01', 'Казань', 'Пермь', 'v1', 'd1', 'Заказчик', 'Труба', 1, 1000, '', 'planned', '', 1);
`)
legacy.close()

const dir = mkdtempSync(join(tmpdir(), 'putevoy-db-'))
const file = join(dir, 'putevoy.sqlite')

try {
  const migrated = openDatabase(legacyFile)
  const oldTrip = readResult(migrated).state.trips.find((item) => item.id === 't_old')
  assert.equal(oldTrip?.odometerStart, null)
  assert.equal(oldTrip?.odometerEnd, null)
  const columns = migrated.prepare(`PRAGMA table_info(trips)`).all() as { name: string }[]
  assert.equal(columns.some((column) => column.name === 'odometer_start'), true)
  assert.equal(columns.some((column) => column.name === 'odometer_end'), true)

  const db = openDatabase(file)
  const seed = createSeed()
  const first = db.prepare(`SELECT value FROM meta WHERE key = 'version'`).get() as { value: string }
  assert.equal(first.value, '1')
  const opened = openDatabase(file)
  const trips = opened.prepare(`SELECT COUNT(*) AS n FROM trips`).get() as { n: number }
  assert.equal(trips.n, seed.trips.length)
  const kazan = opened.prepare(`SELECT from_city, to_city, rate FROM trips WHERE id = 't1'`).get() as {
    from_city: string
    to_city: string
    rate: number
  }
  assert.equal(kazan.from_city, 'Казань')
  assert.equal(kazan.to_city, 'Пермь')
  assert.equal(kazan.rate, 86000)

  const saved = saveTrip(opened, {
    ...seed.trips[0],
    id: 't_new',
    number: 'Р-2000',
    from: 'Москва',
    to: 'Тула',
    rate: 12000.5,
  })
  assert.equal(saved.ok, true)
  if (!saved.ok) throw new Error('save')
  assert.equal(saved.state.trips[0]?.number, 'Р-2000')
  assert.equal(saved.state.trips[0]?.from, 'Москва')
  assert.equal(saved.state.trips[0]?.to, 'Тула')
  assert.equal(saved.version, 2)
  assert.equal(saved.state.customers.includes('ООО «Теплосеть»'), true)
  const named = saveTrip(opened, { ...seed.trips[0], id: 't_customer', number: 'Р-2001', customer: 'ЗАО «Север»' })
  const withReading = saveTrip(opened, {
    ...seed.trips[0],
    id: 't_odo',
    number: 'Р-2002',
    odometerStart: 812400,
    odometerEnd: 813050,
  })
  assert.equal(withReading.ok, true)
  if (!withReading.ok) throw new Error('odometer')
  const stored = withReading.state.trips.find((item) => item.id === 't_odo')
  assert.equal(stored?.odometerStart, 812400)
  assert.equal(stored?.odometerEnd, 813050)
  assert.equal(named.ok, true)
  if (!named.ok) throw new Error('customer')
  assert.equal(named.state.customers.includes('ЗАО «Север»'), true)
  const dropped = deleteTrip(opened, 't_customer')
  assert.equal(dropped.ok, true)
  if (!dropped.ok) throw new Error('drop customer trip')
  assert.equal(dropped.state.customers.includes('ЗАО «Север»'), true)

  const again = openDatabase(file)
  const shared = again.prepare(`SELECT number FROM trips WHERE id = 't_new'`).get() as { number: string }
  assert.equal(shared.number, 'Р-2000')

  const blocked = deleteVehicle(again, 'v1')
  assert.equal(blocked.ok, false)
  if (blocked.ok) throw new Error('blocked')
  assert.equal(blocked.status, 409)

  const expense = saveExpense(again, {
    id: 'e_new',
    vehicleId: 'v1',
    tripId: '',
    date: '2026-10-18',
    category: 'fuel',
    amount: 1500,
    comment: 'АЗС',
  })
  assert.equal(expense.ok, true)
  if (!expense.ok) throw new Error('expense')
  assert.equal(expense.state.expenses.find((item) => item.id === 'e_new')?.vehicleId, '')
  const removed = deleteTrip(again, 't_new')
  assert.equal(removed.ok, true)
  if (!removed.ok) throw new Error('removed')
  assert.equal(
    removed.state.expenses.some((item) => item.id === 'e_new'),
    true,
  )

  const restored = resetDemo(again)
  assert.equal(restored.ok, true)
  if (!restored.ok) throw new Error('restored')
  assert.equal(restored.state.trips.some((item) => item.id === 't_new'), false)
  assert.equal(restored.state.trips.length, seed.trips.length)

  const server = createServer((req, res) => {
    void handleRequest(again, req, res, dir)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const port = (server.address() as AddressInfo).port
  const base = `http://127.0.0.1:${port}`

  const locked = await fetch(`${base}/api/state`)
  assert.equal(locked.status, 401)

  const setup = await fetch(`${base}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin', name: 'Админ', password: 'password1', rights: [] }),
  })
  assert.equal(setup.status, 200)
  const cookie = setup.headers.getSetCookie()[0]?.split(';')[0]
  assert.ok(cookie)
  const auth = { cookie, 'content-type': 'application/json' }

  const listed = await fetch(`${base}/api/state`, { headers: { cookie } })
  const snapshot = (await listed.json()) as { state: { trips: { id: string }[] } }
  assert.equal(listed.status, 200)
  assert.equal(snapshot.state.trips.some((item) => item.id === 't1'), true)

  const bad = await fetch(`${base}/api/trips`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ id: 'nope' }),
  })
  assert.equal(bad.status, 400)

  const backwards = await fetch(`${base}/api/trips`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ ...seed.trips[0], id: 't_back', number: 'Р-2003', odometerStart: 500, odometerEnd: 100 }),
  })
  assert.equal(backwards.status, 400)

  const posted = await fetch(`${base}/api/trips`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ ...seed.trips[0], id: 't_http_odo', number: 'Р-2004', odometerStart: 1000, odometerEnd: 1480 }),
  })
  const postedBody = (await posted.json()) as { state: { trips: { id: string; odometerStart: number | null; odometerEnd: number | null }[] } }
  assert.equal(posted.status, 200)
  const postedTrip = postedBody.state.trips.find((item) => item.id === 't_http_odo')
  assert.equal(postedTrip?.odometerStart, 1000)
  assert.equal(postedTrip?.odometerEnd, 1480)

  const created = await fetch(`${base}/api/vehicles`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ id: 'v_http', plate: 'А000АА 77', model: 'МАЗ', kind: 'Фура' }),
  })
  const createdBody = (await created.json()) as { state: { vehicles: { id: string; status: string }[] }; version: number }
  assert.equal(created.status, 200)
  assert.equal(createdBody.state.vehicles.find((item) => item.id === 'v_http')?.status, 'available')

  const duty = await fetch(`${base}/api/vehicles`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ id: 'v_duty', plate: 'В111ВВ 77', model: 'МАЗ', kind: 'Фура', status: 'on_trip' }),
  })
  assert.equal(duty.status, 400)

  const refused = await fetch(`${base}/api/vehicles/v1`, { method: 'DELETE', headers: { cookie } })
  assert.equal(refused.status, 409)

  server.close()
  console.log('db tests ok')
} finally {
  rmSync(dir, { recursive: true, force: true })
  rmSync(legacyDir, { recursive: true, force: true })
}
