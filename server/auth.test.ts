import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { PublicUser } from '../src/access.ts'
import { openDatabase } from './db.ts'
import { handleRequest } from './http.ts'

const dir = mkdtempSync(join(tmpdir(), 'putevoy-auth-'))
const db = openDatabase(join(dir, 'putevoy.sqlite'))
const server = createServer((req, res) => {
  void handleRequest(db, req, res, dir)
})

function cookieOf(response: Response) {
  const raw = response.headers.getSetCookie()[0]
  assert.ok(raw)
  return raw.split(';')[0]
}

try {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  const session = await fetch(`${base}/api/session`)
  const empty = (await session.json()) as { user: null; needsSetup: boolean }
  assert.equal(empty.needsSetup, true)

  const created = await fetch(`${base}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'Иван', name: 'Иван Петров', password: 'secret123', rights: ['trips'] }),
  })
  const adminBody = (await created.json()) as { user: PublicUser }
  assert.equal(created.status, 200)
  assert.equal(adminBody.user.rights.includes('users'), true)
  assert.equal(adminBody.user.rights.includes('reset'), true)
  const adminCookie = cookieOf(created)

  const second = await fetch(`${base}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: adminCookie },
    body: JSON.stringify({
      username: 'dispatcher',
      name: 'Диспетчер',
      password: 'secret123',
      rights: ['trips', 'expenses', 'reports'],
    }),
  })
  assert.equal(second.status, 200)
  const users = (await (await fetch(`${base}/api/users`, { headers: { cookie: adminCookie } })).json()) as {
    users: PublicUser[]
  }
  assert.equal(JSON.stringify(users).includes('password'), false)
  const dispatcher = users.users.find((item) => item.username === 'dispatcher')
  assert.ok(dispatcher)
  assert.deepEqual(dispatcher.rights, ['trips', 'expenses', 'reports'])

  const logged = await fetch(`${base}/api/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'dispatcher', password: 'secret123' }),
  })
  const dispatcherCookie = cookieOf(logged)
  const payment = await fetch(`${base}/api/payments`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: dispatcherCookie },
    body: JSON.stringify({
      id: 'p_x',
      tripId: 't1',
      date: '2026-10-18',
      amount: 100,
      method: 'cash',
      counterparty: 'Касса',
      comment: '',
    }),
  })
  assert.equal(payment.status, 403)
  const reset = await fetch(`${base}/api/reset`, { method: 'POST', headers: { cookie: dispatcherCookie } })
  assert.equal(reset.status, 403)

  const removed = await fetch(`${base}/api/users/${adminBody.user.id}`, {
    method: 'DELETE',
    headers: { cookie: adminCookie },
  })
  assert.equal(removed.status, 400)

  const stranger = await fetch(`${base}/api/users`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'hacker', name: 'Чужой', password: 'secret123', rights: ['users'] }),
  })
  assert.equal(stranger.status, 401)

  console.log('auth tests ok')
} finally {
  server.close()
  rmSync(dir, { recursive: true, force: true })
}
