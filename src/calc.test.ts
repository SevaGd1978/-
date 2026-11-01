import assert from 'node:assert/strict'
import {
  debtOf,
  expenseVat,
  expenseWithVat,
  inPeriod,
  isOverdue,
  marginOf,
  copiedTrip,
  nextTripNumber,
  parseMoney,
  payMark,
  repairCost,
  round2,
  sumExpenses,
} from './calc.ts'
import type { Trip } from './types.ts'

function trip(partial: Partial<Trip> = {}): Trip {
  return {
    id: 't',
    number: 'Р-1',
    date: '2026-10-01',
    from: 'Казань',
    to: 'Пермь',
    vehicleId: 'v',
    driverId: 'd',
    customer: 'Заказчик',
    cargo: 'Труба',
    weightTons: 1,
    rate: 1000,
    payDue: '2026-10-10',
    status: 'planned',
    note: '',
    ...partial,
  }
}

assert.equal(round2(10.126), 10.13)
assert.equal(debtOf(trip({ rate: 86000 }), 20000), 66000)
assert.equal(debtOf(trip({ status: 'cancelled', rate: 39000 }), 0), 0)
assert.equal(debtOf(trip({ rate: 1000 }), 1500), 0)
assert.equal(payMark('delivered', 64000, 64000), 'paid')
assert.equal(payMark('delivered', 86000, 20000), 'partial')
assert.equal(payMark('planned', 54000, 0), 'unpaid')
assert.equal(payMark('cancelled', 39000, 0), 'cancelled')
assert.equal(payMark('delivered', 1000, 1500), 'paid')
assert.equal(marginOf(trip({ rate: 86000 }), 26900), 59100)
assert.equal(marginOf(trip({ status: 'cancelled', rate: 39000 }), 3100), -3100)
assert.equal(repairCost({ partsCost: 42000, laborCost: 6000 }), 48000)
assert.equal(inPeriod('2026-10-18', '2026-10'), true)
assert.equal(inPeriod('2026-09-18', '2026-10'), false)
assert.equal(inPeriod('2026-09-18', 'all'), true)
assert.equal(isOverdue(trip({ payDue: '2026-10-12' }), 100, '2026-10-18'), true)
assert.equal(isOverdue(trip({ payDue: '2026-10-20' }), 100, '2026-10-18'), false)
assert.equal(isOverdue(trip({ status: 'cancelled', payDue: '2026-10-01' }), 100, '2026-10-18'), false)
assert.equal(nextTripNumber([trip({ number: 'Р-1034' }), trip({ number: 'Р-1041' })]), 'Р-1042')
assert.equal(nextTripNumber([]), 'Р-1001')
const source = trip({
  id: 't9',
  number: 'Р-1038',
  date: '2026-09-01',
  status: 'delivered',
  payDue: '2026-09-15',
  customer: 'АО «Строй»',
  note: 'срочно',
  rate: 54000,
})
const copy = copiedTrip(source, [source, trip({ number: 'Р-1041' })], '2026-10-21')
assert.equal(copy.id, '')
assert.equal(copy.number, 'Р-1042')
assert.equal(copy.date, '2026-10-21')
assert.equal(copy.status, 'planned')
assert.equal(copy.payDue, '')
assert.equal(copy.customer, 'АО «Строй»')
assert.equal(copy.from, 'Казань')
assert.equal(copy.to, 'Пермь')
assert.equal(copy.rate, 54000)
assert.equal(copy.note, 'срочно')
assert.equal(copy.vehicleId, source.vehicleId)
assert.equal(source.status, 'delivered')
assert.equal(source.payDue, '2026-09-15')
assert.equal(parseMoney('1 200,50'), 1200.5)
assert.equal(parseMoney('0'), 0)
assert.equal(parseMoney('-5'), null)
assert.equal(parseMoney(''), null)
assert.equal(expenseVat('fuel', 18500), 0)
assert.equal(expenseWithVat('fuel', 18500), 18500)
assert.equal(expenseVat('toll', 2400), 528)
assert.equal(expenseWithVat('toll', 2400), 2928)
assert.equal(expenseWithVat('salary', 100), 122)
assert.equal(expenseVat('platon', 1129.86), 248.57)
assert.equal(expenseWithVat('platon', 1129.86), 1378.43)
assert.equal(expenseVat('toll', 1000, 50), 50)
assert.equal(expenseWithVat('toll', 1000, 50), 1050)
assert.equal(expenseVat('fuel', 1000, 180), 180)
assert.equal(expenseVat('toll', 1000, null), 220)
assert.equal(expenseVat('toll', 1000, 0), 0)
assert.equal(expenseWithVat('toll', 1000, 0), 1000)
assert.equal(
  sumExpenses([
    { category: 'fuel', amount: 18500 },
    { category: 'toll', amount: 2400 },
    { category: 'driver', amount: 6000 },
  ]),
  28748,
)

console.log('calc ok')
