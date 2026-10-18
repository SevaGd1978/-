import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

mkdirSync('data', { recursive: true })

const node = process.execPath
const api = spawn(node, ['--experimental-sqlite', '--experimental-strip-types', 'server/index.ts'], {
  stdio: 'inherit',
  env: { ...process.env, PORT: '8787', PUTEVOY_DB: resolve('data/dev.sqlite') },
})
const vite = spawn(node, [resolve('node_modules/vite/bin/vite.js')], { stdio: 'inherit' })

function stop() {
  api.kill('SIGTERM')
  vite.kill('SIGTERM')
}

process.on('SIGINT', () => {
  stop()
  process.exit(0)
})
process.on('SIGTERM', () => {
  stop()
  process.exit(0)
})

api.on('exit', (code) => {
  if (code) {
    vite.kill('SIGTERM')
    process.exit(code)
  }
})
vite.on('exit', (code) => {
  api.kill('SIGTERM')
  process.exit(code ?? 0)
})
