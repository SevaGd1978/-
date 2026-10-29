import type { Trip } from './types'

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

/** НДС с 2026 года. Пустое значение — 22% от суммы, в том числе на топливо. */
export const VAT_PERCENT = 22

/** Зарплата рейса: столько рублей за километр пробега по одометру. */
export const SALARY_PER_KM = 10

export function expenseVat(_category: string, amount: number, manual?: number | null) {
  if (manual != null) return round2(manual)
  return round2((amount * VAT_PERCENT) / 100)
}

/** Пробег рейса по одометру. Пусто, пока нет обоих показаний или конец меньше начала. */
export function tripDistanceKm(trip: { odometerStart: number | null; odometerEnd: number | null }) {
  if (trip.odometerStart == null || trip.odometerEnd == null) return null
  if (trip.odometerEnd < trip.odometerStart) return null
  return round2(trip.odometerEnd - trip.odometerStart)
}

/** Зарплата рейса: 10 ₽ за километр разницы показаний одометра. */
export function tripSalary(trip: { odometerStart: number | null; odometerEnd: number | null }) {
  const km = tripDistanceKm(trip)
  if (km == null) return null
  return round2(km * SALARY_PER_KM)
}

export function expenseWithVat(category: string, amount: number, manual?: number | null) {
  return round2(amount + expenseVat(category, amount, manual))
}

export function sumAmounts(rows: { amount: number }[]) {
  return round2(rows.reduce((total, row) => total + row.amount, 0))
}

export function sumExpenses(rows: { category: string; amount: number; vat?: number | null }[]) {
  return round2(rows.reduce((total, row) => total + expenseWithVat(row.category, row.amount, row.vat), 0))
}

export function debtOf(trip: Trip, paid: number) {
  if (trip.status === 'cancelled') return 0
  return Math.max(0, round2(trip.rate - paid))
}

export type PayMark = 'paid' | 'partial' | 'unpaid' | 'cancelled'

export function payMark(status: Trip['status'], rate: number, paid: number): PayMark {
  if (status === 'cancelled') return 'cancelled'
  if (rate > 0 && paid + 0.001 >= rate) return 'paid'
  if (paid > 0) return 'partial'
  return 'unpaid'
}

export function marginOf(trip: Trip, expenses: number) {
  if (trip.status === 'cancelled') return round2(-expenses)
  return round2(trip.rate - expenses)
}

export function repairCost(job: { partsCost: number; laborCost: number }) {
  return round2(job.partsCost + job.laborCost)
}

export function inPeriod(iso: string, period: string) {
  if (period === 'all') return true
  return iso.slice(0, 7) === period
}

export function inRange(iso: string, from: string, to: string) {
  if (!iso) return false
  if (from && iso < from) return false
  if (to && iso > to) return false
  return true
}

export function isOverdue(trip: Trip, debt: number, today: string) {
  return trip.status !== 'cancelled' && debt > 0 && trip.payDue !== '' && trip.payDue < today
}

export function nextTripNumber(trips: { number: string }[]) {
  let max = 1000
  for (const trip of trips) {
    const match = trip.number.match(/(\d+)/)
    if (match) max = Math.max(max, Number(match[1]))
  }
  return `Р-${String(max + 1).padStart(4, '0')}`
}

/** Новый рейс по образцу: коммерческие поля те же, учётные — свои. Расходы и оплаты не входят в рейс. */
export function copiedTrip(source: Trip, trips: { number: string }[], today: string): Trip {
  return {
    id: '',
    number: nextTripNumber(trips),
    date: today,
    from: source.from,
    to: source.to,
    vehicleId: source.vehicleId,
    driverId: source.driverId,
    customer: source.customer,
    cargo: source.cargo,
    weightTons: source.weightTons,
    rate: source.rate,
    payDue: '',
    status: 'planned',
    note: source.note,
    odometerStart: null,
    odometerEnd: null,
  }
}

export function parseMoney(raw: string) {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.').trim()
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return round2(Number(cleaned))
}

export function parseWeight(raw: string) {
  if (!raw.trim()) return 0
  const cleaned = raw.replace(',', '.').trim()
  if (!/^\d+(\.\d{1,3})?$/.test(cleaned)) return null
  return Math.round(Number(cleaned) * 1000) / 1000
}

export function parseOdometer(raw: string) {
  if (!raw.trim()) return null
  if (!/^\d+$/.test(raw.trim())) return null
  return Number(raw.trim())
}
