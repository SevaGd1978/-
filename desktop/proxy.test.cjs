const assert = require('node:assert/strict')
const http = require('node:http')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')
const { createPutevoyDesktopServer, rewriteSetCookie } = require('./proxy.cjs')

test('session cookie from Amvera is stored by the local window', () => {
  const rewritten = rewriteSetCookie(
    'putevoy_session=abc; Path=/; HttpOnly; SameSite=None; Secure; Domain=putevoy-sevagd1978.msk1.amvera.tech',
  )
  assert.equal(rewritten.includes('Secure'), false)
  assert.equal(rewritten.includes('Domain='), false)
  assert.match(rewritten, /SameSite=Lax/)
  assert.match(rewritten, /putevoy_session=abc/)
})

test('desktop window serves the app and forwards API calls to the server', async () => {
  const upstream = http.createServer((req, res) => {
    if (req.url === '/api/session') {
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'set-cookie': 'putevoy_session=token; Path=/; HttpOnly; Secure; Domain=amvera.tech',
      })
      res.end('{"user":null,"needsSetup":false}')
      return
    }
    if (req.url === '/api/login' && req.method === 'POST') {
      const chunks = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(Buffer.concat(chunks).toString())
      })
      return
    }
    res.writeHead(404)
    res.end()
  })
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const port = upstream.address().port
  const staticDir = fs.mkdtempSync(path.join(os.tmpdir(), 'putevoy-desktop-'))
  fs.writeFileSync(path.join(staticDir, 'index.html'), '<title>Путевой</title>')
  fs.mkdirSync(path.join(staticDir, 'fonts'))
  fs.writeFileSync(path.join(staticDir, 'fonts', 'Roboto-Regular.ttf'), 'font')

  const desktop = createPutevoyDesktopServer({
    staticDir,
    upstream: `http://127.0.0.1:${port}`,
  })
  const base = await desktop.listen()
  try {
    const page = await fetch(base)
    assert.equal(page.status, 200)
    assert.match(await page.text(), /Путевой/)
    const font = await fetch(`${base}/fonts/Roboto-Regular.ttf`)
    assert.equal(font.status, 200)
    const hidden = await new Promise((resolve, reject) => {
      const request = http.get(`${base}/%2e%2e%2fpackage.json`, resolve)
      request.on('error', reject)
    })
    const hiddenBody = await new Promise((resolve) => {
      const chunks = []
      hidden.on('data', (chunk) => chunks.push(chunk))
      hidden.on('end', () => resolve(Buffer.concat(chunks).toString()))
    })
    assert.equal(hidden.statusCode, 400)
    assert.equal(hiddenBody.includes('package'), false)
    const session = await fetch(`${base}/api/session`)
    assert.equal(session.status, 200)
    assert.equal(await session.json().then((body) => body.needsSetup), false)
    const cookie = session.headers.get('set-cookie') || ''
    assert.match(cookie, /putevoy_session=token/)
    assert.equal(/Secure/i.test(cookie), false)
    const login = await fetch(`${base}/api/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"username":"admin"}',
    })
    assert.equal((await login.json()).username, 'admin')
  } finally {
    await desktop.close()
    await new Promise((resolve) => upstream.close(resolve))
    fs.rmSync(staticDir, { recursive: true, force: true })
  }
})
