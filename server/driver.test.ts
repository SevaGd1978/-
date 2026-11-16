import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase, readResult, resetDemo } from './db.ts'
import { addDriverFuel, driverHome, loginDriver, updateDriverOdometer } from './driver.ts'

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
