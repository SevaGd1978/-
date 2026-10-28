const http = require('node:http')
const https = require('node:https')
const fs = require('node:fs')
const path = require('node:path')

const DEFAULT_UPSTREAM = 'https://putevoy-sevagd1978.msk1.amvera.tech'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function rewriteSetCookie(cookie) {
  return cookie
    .replace(/;\s*Domain=[^;]*/gi, '')
    .replace(/;\s*Secure/gi, '')
    .replace(/;\s*SameSite=[^;]*/gi, '; SameSite=Lax')
}

function insideDir(root, file) {
  const base = path.resolve(root)
  const resolved = path.resolve(file)
  return resolved === base || resolved.startsWith(base + path.sep)
}

function staticFile(staticDir, pathname) {
  let decoded = pathname
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  if (decoded.includes('..') || decoded.includes('\\') || decoded.includes('\0')) return null
  const relative = decoded.replace(/^\/+/, '')
  const file = path.resolve(staticDir, relative)
  if (!insideDir(staticDir, file)) return null
  return file
}

function sendFile(res, file) {
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream'
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-cache' })
  fs.createReadStream(file).pipe(res)
}

function serveStatic(res, staticDir, pathname) {
  const file = staticFile(staticDir, pathname)
  if (!file) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('Некорректный путь')
    return
  }
  fs.stat(file, (error, stat) => {
    if (!error && stat.isFile()) {
      sendFile(res, file)
      return
    }
    const index = path.join(staticDir, 'index.html')
    if (path.extname(pathname) || !fs.existsSync(index)) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('Файл не найден')
      return
    }
    sendFile(res, index)
  })
}

function proxy(req, res, origin, client, url) {
  const headers = { ...req.headers }
  delete headers.host
  delete headers.connection
  delete headers.origin
  delete headers.referer
  headers.host = origin.host
  headers.origin = origin.origin
  headers.referer = `${origin.origin}/`
  const upstream = client.request(
    {
      protocol: origin.protocol,
      hostname: origin.hostname,
      port: origin.port || undefined,
      method: req.method,
      path: `${url.pathname}${url.search}`,
      headers,
    },
    (incoming) => {
      const responseHeaders = { ...incoming.headers }
      delete responseHeaders.connection
      delete responseHeaders['transfer-encoding']
      const cookies = incoming.headers['set-cookie']
      if (cookies) responseHeaders['set-cookie'] = cookies.map(rewriteSetCookie)
      res.writeHead(incoming.statusCode || 502, responseHeaders)
      incoming.pipe(res)
    },
  )
  upstream.setTimeout(30_000, () => upstream.destroy(new Error('timeout')))
  upstream.on('error', () => {
    if (res.headersSent) {
      res.destroy()
      return
    }
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ error: 'Нет связи с сервером Amvera' }))
  })
  req.pipe(upstream)
}

function createPutevoyDesktopServer({ staticDir, upstream = DEFAULT_UPSTREAM }) {
  const origin = new URL(upstream)
  const client = origin.protocol === 'https:' ? https : http
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      proxy(req, res, origin, client, url)
      return
    }
    serveStatic(res, staticDir, url.pathname)
  })
  return {
    server,
    listen() {
      return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const address = server.address()
          resolve(`http://127.0.0.1:${address.port}`)
        })
      })
    },
    close() {
      return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
    },
  }
}

module.exports = {
  DEFAULT_UPSTREAM,
  rewriteSetCookie,
  createPutevoyDesktopServer,
}
