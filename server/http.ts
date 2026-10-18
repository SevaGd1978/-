import { createReadStream, existsSync, statSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'
import type { DatabaseSync } from 'node:sqlite'
import { parseDriver, parseExpense, parsePayment, parseRepair, parseTrip, parseVehicle } from '../src/records.ts'
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
  try {
    if (method === 'GET' && pathname === '/api/state') {
      sendJson(res, 200, readResult(db))
      return
    }
    if (method === 'POST' && pathname === '/api/reset') {
      sendResult(res, resetDemo(db))
      return
    }
    if (parts.length === 2 && method === 'POST') {
      const body = await readJson(req)
      const result = writeOne(db, parts[1], body)
      sendResult(res, result)
      return
    }
    if (parts.length === 3 && method === 'DELETE') {
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
