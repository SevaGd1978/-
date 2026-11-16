import assert from 'node:assert/strict'
import { applyFuelLocal, applyOdometerLocal, overlayPending, type DriverHome, type PendingItem } from './offline.ts'
import type { Trip } from '../types.ts'

const trip = {
  id: 't1',
  number: 'Р-1',
  date: '2026-11-16',
  from: 'А',
  to: 'Б',
  routeKind: 'direct',
  load1: '',
  unload1: '',
  load2: '',
  unload2: '',
  returnCity: '',
  odometerLoad1: null,
  odometerUnload1: null,
  odometerLoad2: null,
  odometerUnload2: null,
  vehicleId: 'v1',
  driverId: 'd1',
  customer: 'X',
  cargo: '',
  weightTons: 1,
  rate: 1,
  payDue: '',
  customer2: '',
  cargo2: '',
  rate2: 0,
  payDue2: '',
  status: 'in_transit',
  note: '',
} satisfies Trip

const home: DriverHome = {
  vehicle: { vehicleId: 'v1', plate: 'А1', model: 'M', kind: 'K' },
  activeTripId: 't1',
  trips: [trip],
  fuel: [],
  drivers: {},
}

const withLoad = applyOdometerLocal(home, 't1', 'odometerLoad1', 1000)
assert.equal(withLoad.trips[0]?.odometerLoad1, 1000)
assert.equal(withLoad.trips[0]?.odometerUnload1, null)

const withUnload = applyOdometerLocal(withLoad, 't1', 'odometerUnload1', 1200)
assert.equal(withUnload.trips[0]?.odometerLoad1, 1000)
assert.equal(withUnload.trips[0]?.odometerUnload1, 1200)

const withFuel = applyFuelLocal(withUnload, {
  id: 'e1',
  vehicleId: '',
  tripId: 't1',
  date: '2026-11-16',
  category: 'fuel',
  amount: 5000,
  vat: 0,
  comment: 'чек',
})
assert.equal(withFuel.fuel.length, 1)
assert.equal(withFuel.fuel[0]?.amount, 5000)

const queue: PendingItem[] = [
  {
    id: 'q1',
    type: 'odometer',
    tripId: 't1',
    field: 'odometerUnload1',
    value: 1500,
    createdAt: '2026-11-16T00:00:00.000Z',
  },
]
const overlaid = overlayPending(home, queue)
assert.equal(overlaid.trips[0]?.odometerUnload1, 1500)
assert.equal(overlaid.trips[0]?.odometerLoad1, null)

console.log('offline tests ok')
