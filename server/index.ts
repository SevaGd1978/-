import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import { openDatabase } from './db.ts'
import { handleRequest } from './http.ts'

const port = Number(process.env.PORT || 3000)
const dbFile = process.env.PUTEVOY_DB || (existsSync('/data') ? '/data/putevoy.sqlite' : resolve('data/putevoy.sqlite'))
const staticDir = process.env.STATIC_DIR || resolve(dirname(fileURLToPath(import.meta.url)), '../dist')
const db = openDatabase(dbFile)

const server = createServer((req, res) => {
  void handleRequest(db, req, res, staticDir)
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Путевой слушает :${port}, база ${dbFile}`)
})
