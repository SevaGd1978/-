import assert from 'node:assert/strict'
import { vehicleDuty } from './fleetStatus.ts'
import type { TripStatus } from './types.ts'

function trip(vehicleId: string, status: TripStatus) {
  return { vehicleId, status }
}

assert.equal(vehicleDuty('available', [], 'v1'), 'available')
assert.equal(vehicleDuty('repair', [trip('v1', 'planned'), trip('v1', 'delivered')], 'v1'), 'repair')
assert.equal(vehicleDuty('downtime', [trip('v1', 'cancelled'), trip('v1', 'closed')], 'v1'), 'downtime')
assert.equal(vehicleDuty('available', [trip('v1', 'loading')], 'v1'), 'loading')
assert.equal(vehicleDuty('repair', [trip('v1', 'in_transit')], 'v1'), 'on_trip')
assert.equal(vehicleDuty('available', [trip('v1', 'loading'), trip('v1', 'in_transit')], 'v1'), 'on_trip')
assert.equal(vehicleDuty('repair', [trip('v2', 'in_transit')], 'v1'), 'repair')

console.log('fleet status tests ok')
