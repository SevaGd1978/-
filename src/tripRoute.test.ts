import assert from 'node:assert/strict'
import {
  finalizeTripRoute,
  tripOdometerKm,
  tripRoadPairs,
  tripRouteLabel,
  tripRouteReportLabel,
  validateTripRoute,
} from './tripRoute.ts'
import type { Trip } from './types.ts'

const round1: Trip = {
  id: 't1',
  number: 'Р-1',
  date: '2026-11-01',
  from: 'Казань',
  to: '',
  routeKind: 'round1',
  load1: 'Нижний Новгород',
  unload1: 'Самара',
  load2: '',
  unload2: '',
  returnCity: '',
  odometerLoad1: 100_000,
  odometerUnload1: 100_400,
  odometerLoad2: null,
  odometerUnload2: null,
  vehicleId: 'v1',
  driverId: 'd1',
  customer: 'Заказчик',
  cargo: 'Груз',
  weightTons: 10,
  rate: 50_000,
  payDue: '',
  status: 'planned',
  note: '',
}

assert.equal(validateTripRoute(round1), null)
const done = finalizeTripRoute(round1)
assert.equal(done.to, 'Казань')
assert.equal(tripRoadPairs(done).length, 3)
assert.match(tripRouteLabel(done), /погр\. Нижний Новгород/)
assert.equal(tripOdometerKm(done), 400)

const round2 = finalizeTripRoute({
  ...round1,
  routeKind: 'round2',
  load2: 'Уфа',
  unload2: 'Челябинск',
  odometerLoad2: 100_500,
  odometerUnload2: 100_900,
})
assert.equal(tripRoadPairs(round2).length, 5)
assert.equal(tripOdometerKm(round2), 900)
assert.match(tripRouteReportLabel(round2), /Кругорейс · 2 загрузки и 2 выгрузки/)
assert.match(tripRouteReportLabel(round2), /погр\. Уфа/)
assert.match(tripRouteReportLabel(round2), /выгр\. Челябинск/)
assert.equal(tripRouteLabel(round2), tripRouteReportLabel(round2).split(': ')[1])

console.log('tripRoute tests ok')
