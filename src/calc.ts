import type { Trip } from './types'

export function round2(value: number) {
  return Math.round(value * 100) / 100
}

export function sumAmounts(rows: { amount: number }[]) {
  return round2(rows.reduce((total, row) => total + row.amount, 0))
}

export function debtOf(trip: Trip, paid: number) {
  if (trip.status === 'cancelled') return 0
  return Math.max(0, round2(trip.rate - paid))
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
