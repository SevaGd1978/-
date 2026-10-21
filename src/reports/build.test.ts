import assert from 'node:assert/strict'
import { unzipSync } from 'fflate'
import { readFileSync } from 'node:fs'
import writeXlsxFile from 'write-excel-file/node'
import { createSeed } from '../seed'
import { buildReport } from './build'
import { reportSheet, sheetOptions } from './excel'
import { renderPdf } from './pdf'

const october = { from: '2026-10-01', to: '2026-10-31' }
const now = new Date(2026, 9, 18, 12, 0)
const state = createSeed()

function section(kind: Parameters<typeof buildReport>[1]['kind'], title?: string) {
  const report = buildReport(state, { kind, ...october }, now)
  const found = title ? report.sections.find((item) => item.title === title) : report.sections[0]
  if (!found) throw new Error(`Нет секции ${title ?? kind}`)
  return { report, section: found }
}

function rowNumber(rows: (string | number | null)[][], marker: string, index: number) {
  const row = rows.find((item) => item.includes(marker))
  assert.ok(row, marker)
  return row[index]
}

const trips = section('trips')
assert.equal(trips.section.rows.length, 6)
assert.equal(rowNumber(trips.section.rows, 'Р-1034', 9), 86000)
assert.equal(rowNumber(trips.section.rows, 'Р-1034', 10), 20000)
assert.equal(rowNumber(trips.section.rows, 'Р-1034', 11), 66000)
assert.deepEqual(trips.section.totals?.slice(9), [403000, 144000, 220000])

const expenses = section('expenses')
assert.equal(expenses.section.rows.length, 12)
assert.equal(expenses.section.totals?.at(-1), 101736)

const repairs = section('repairs')
assert.equal(repairs.section.rows.length, 3)
assert.equal(repairs.section.totals?.at(-1), 91100)

const payments = section('payments')
assert.equal(payments.section.rows.length, 4)
assert.equal(payments.section.totals?.at(-1), 242000)

const debts = section('debts')
assert.equal(debts.section.rows.length, 4)
assert.equal(rowNumber(debts.section.rows, 'Р-1037', 8), 'Да')
assert.equal(rowNumber(debts.section.rows, 'Р-1034', 8), 'Нет')
assert.equal(debts.section.totals?.[7], 220000)

const summary = buildReport(state, { kind: 'summary', ...october }, now)
const indicators = summary.sections[0].rows
assert.deepEqual(
  indicators.map((row) => row[1]),
  [242000, 101736, 91100, 49164, 220000],
)
assert.equal(summary.periodLabel, 'С 01.10.2026 по 31.10.2026')
assert.equal(summary.filename, 'putevoy-svodka-2026-10-01_2026-10-31')

const outside = buildReport(state, { kind: 'trips', from: '2026-01-01', to: '2026-01-31' }, now)
assert.equal(outside.sections[0].rows.length, 0)
assert.equal(outside.sections[0].totals, null)

const sheet = reportSheet(trips.report)
const buffer = await writeXlsxFile(sheet, sheetOptions(trips.report)).toBuffer()
const files = unzipSync(new Uint8Array(buffer))
const shared = new TextDecoder().decode(files['xl/sharedStrings.xml'])
const worksheet = new TextDecoder().decode(files['xl/worksheets/sheet1.xml'])
assert.match(shared, /Реестр рейсов/)
assert.match(shared, /Р-1034/)
assert.match(worksheet, /86000/)
assert.match(worksheet, /66000/)

const fonts = {
  regular: readFileSync(new URL('../../public/fonts/Roboto-Regular.ttf', import.meta.url)),
  bold: readFileSync(new URL('../../public/fonts/Roboto-Bold.ttf', import.meta.url)),
}
const pdf = await renderPdf(trips.report, fonts)
assert.equal(String.fromCharCode(...pdf.slice(0, 5)), '%PDF-')
assert.ok(pdf.byteLength > 20_000)

console.log('reports ok')
