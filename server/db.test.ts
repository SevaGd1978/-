import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { createSeed } from '../src/seed.ts'
import { deleteTrip, deleteVehicle, openDatabase, resetDemo, saveExpense, saveTrip } from './db.ts'
import { handleRequest } from './http.ts'

const dir = mkdtempSync(join(tmpdir(), 'putevoy-db-'))
const file = join(dir, 'putevoy.sqlite')

try {
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

  const again = openDatabase(file)
  const shared = again.prepare(`SELECT number FROM trips WHERE id = 't_new'`).get() as { number: string }
  assert.equal(shared.number, 'Р-2000')

  const blocked = deleteVehicle(again, 'v1')
  assert.equal(blocked.ok, false)
  if (blocked.ok) throw new Error('blocked')
  assert.equal(blocked.status, 409)

  const expense = saveExpense(again, {
    id: 'e_new',
    tripId: 't_new',
    date: '2026-10-18',
    category: 'fuel',
    amount: 1500,
    comment: 'АЗС',
  })
  assert.equal(expense.ok, true)
  const removed = deleteTrip(again, 't_new')
  assert.equal(removed.ok, true)
  if (!removed.ok) throw new Error('removed')
  assert.equal(
    removed.state.expenses.some((item) => item.id === 'e_new'),
    false,
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
}
