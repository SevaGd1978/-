/** Публичный сервис Госавтоинспекции, тот же, что открывает сайт проверки штрафов. */
export const GIBDD_ORIGIN = 'https://xn--b1afk4ade.xn--90adear.xn--p1ai'
export const GIBDD_FINES_URL = `${GIBDD_ORIGIN}/proxy/check/fines`
export const GIBDD_CAPTCHA_URL = `${GIBDD_ORIGIN}/captcha`
export const GIBDD_SITE = 'https://госавтоинспекция.рф/check/fines'

const PLATE_LETTERS = 'АВЕКМНОРСТУХ'
const LATIN_TO_CYRILLIC: Record<string, string> = {
  A: 'А',
  B: 'В',
  E: 'Е',
  K: 'К',
  M: 'М',
  H: 'Н',
  O: 'О',
  P: 'Р',
  C: 'С',
  T: 'Т',
  Y: 'У',
  X: 'Х',
}

export interface GibddFine {
  number: string
  date: string
  amount: number
  article: string
  division: string
  discount: string
}

export type GibddAnswer =
  | { ok: true; fines: GibddFine[] }
  | { ok: false; error: string; retryCaptcha: boolean }

export function normalizeSts(value: string) {
  return value.toUpperCase().replace(/\s+/g, '')
}

export function stsLooksValid(value: string) {
  return /^[0-9A-ZА-ЯЁ]{8,12}$/.test(normalizeSts(value))
}

export function splitPlate(plate: string): { regnum: string; regreg: string } | null {
  const compact = plate
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[ABEKMHOPCTYX]/g, (letter) => LATIN_TO_CYRILLIC[letter] ?? letter)
  const match = compact.match(new RegExp(`^([${PLATE_LETTERS}]\\d{3}[${PLATE_LETTERS}]{2})(\\d{2,3})$`))
  if (!match) return null
  return { regnum: match[1], regreg: match[2] }
}

export function finesForm(input: {
  regnum: string
  regreg: string
  sts: string
  captchaWord: string
  captchaToken: string
}) {
  return {
    regnum: input.regnum,
    regreg: input.regreg,
    stsnum: normalizeSts(input.sts),
    captchaWord: input.captchaWord.trim(),
    captchaToken: input.captchaToken,
  }
}

export function parseGibddPayload(body: unknown): GibddAnswer {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Госавтоинспекция ответила в неожиданном виде.', retryCaptcha: false }
  }
  const record = body as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message.trim() : ''
  if (/капч/i.test(message)) {
    return { ok: false, error: 'Код с картинки не подошёл. Запросите новую картинку.', retryCaptcha: true }
  }
  const rows = Array.isArray(record.data) ? record.data : Array.isArray(record.fines) ? record.fines : null
  const code = Number(record.code ?? record.status)
  const missing = /не найден|нет сведений|отсутств/i.test(message)
  if (rows) return { ok: true, fines: rows.map((row) => readFine(row, record.divisions)) }
  if (missing || code === 404) return { ok: true, fines: [] }
  if (code === 200) return { ok: true, fines: [] }
  return {
    ok: false,
    error: message || 'Госавтоинспекция не отдала список штрафов.',
    retryCaptcha: false,
  }
}

function readFine(value: unknown, divisions: unknown): GibddFine {
  const row = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const divisionId = text(row, ['Division', 'division'])
  const named = text(row, ['Division_name', 'division_name', 'divisionName'])
  const fromCatalog = divisionName(divisions, divisionId)
  const discountDate = isoDate(text(row, ['DateDiscount', 'date_discount', 'dateDiscount']))
  const discountOn = row.enableDiscount === true || row.EnableDiscount === true || row.enable_discount === true
  return {
    number: text(row, ['NumPost', 'num_post', 'SupplierBillID', 'supplierBillId', 'uin']),
    date: isoDate(text(row, ['DatePost', 'DateDecis', 'date_post', 'date'])),
    amount: amount(row.Summa ?? row.sum ?? row.amount),
    article: text(row, ['KoAPtext', 'KoAPcode', 'koap', 'article']),
    division: named || fromCatalog,
    discount: discountOn && discountDate ? `до ${discountDate.split('-').reverse().join('.')}` : '',
  }
}

function divisionName(divisions: unknown, id: string) {
  if (!id || !divisions || typeof divisions !== 'object' || Array.isArray(divisions)) return ''
  const entry = (divisions as Record<string, unknown>)[id]
  if (!entry || typeof entry !== 'object') return ''
  const name = (entry as { name?: unknown }).name
  return typeof name === 'string' ? name.trim() : ''
}

function text(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

function amount(value: unknown) {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(',', '.')) : NaN
  if (!Number.isFinite(number)) return 0
  return Math.round(number * 100) / 100
}

function isoDate(value: string) {
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const ru = value.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (ru) return `${ru[3]}-${ru[2]}-${ru[1]}`
  return ''
}
