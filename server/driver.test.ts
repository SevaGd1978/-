import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, readResult, resetDemo, saveTrip } from './db.ts'
import { addDriverFuel, driverHome, loginDriver, updateDriverOdometer } from './driver.ts'
import type { Trip } from '../src/types.ts'

const dir = mkdtempSync(join(tmpdir(), 'putevoy-driver-'))
const db = openDatabase(join(dir, 'putevoy.sqlite'))
resetDemo(db)

const failed = loginDriver(db, 'А123ВС 116', '0000')
assert.equal(failed, null)

const session = loginDriver(db, 'А123ВС 116', '1234')
assert.ok(session)
assert.equal(session!.session.plate, 'А123ВС 116')

const home = driverHome(db, session!.session)
assert.ok(home.trips.length > 0)
const trip = home.trips[0]
assert.ok(trip)

// Раньше API отдавал только 12 рейсов — старые «пропадали» у водителя.
for (let i = 0; i < 20; i += 1) {
  const day = String(i + 1).padStart(2, '0')
  const extra: Trip = {
    id: `bulk_${i}`,
    number: `Р-BULK-${i}`,
    date: `2026-09-${day}`,
    from: 'Казань',
    to: 'Пермь',
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
    vehicleId: session!.session.vehicleId,
    driverId: 'd1',
    customer: 'ООО «Тест»',
    cargo: 'Труба',
    weightTons: 10,
    rate: 50000,
    payDue: `2026-09-${day}`,
    customer2: '',
    cargo2: '',
    rate2: 0,
    payDue2: '',
    status: i === 0 ? 'cancelled' : 'delivered',
    note: '',
  }
  const saved = saveTrip(db, extra)
  assert.equal(saved.ok, true)
}

const many = driverHome(db, session!.session)
const onVehicle = readResult(db).state.trips.filter(
  (item) => item.vehicleId === session!.session.vehicleId && item.status !== 'cancelled',
)
assert.equal(many.trips.length, onVehicle.length)
assert.ok(many.trips.length > 12)
assert.ok(!many.trips.some((item) => item.status === 'cancelled'))
assert.ok(many.trips.some((item) => item.number === 'Р-BULK-19'))

const odo = updateDriverOdometer(db, session!.session, trip.id, {
  odometerLoad1: 100000,
  odometerUnload1: 100450,
})
assert.equal(odo.ok, true)
if (odo.ok) {
  const updated = odo.home.trips.find((item) => item.id === trip.id)
  assert.equal(updated?.odometerLoad1, 100000)
  assert.equal(updated?.odometerUnload1, 100450)
}

const fuel = addDriverFuel(db, session!.session, {
  tripId: trip.id,
  amount: 18500,
  date: '2026-11-16',
  comment: 'Татнефть 420 л',
})
assert.equal(fuel.ok, true)
if (fuel.ok) {
  assert.ok(fuel.home.fuel.some((item) => item.amount === 18500 && item.tripId === trip.id))
}

const state = readResult(db).state
assert.ok(state.expenses.some((item) => item.category === 'fuel' && item.comment.includes('Татнефть')))

console.log('driver tests ok')
