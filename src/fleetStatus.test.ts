import assert from 'node:assert/strict'
import { activeTrip, latestFinishedTrip, openRepair, vehicleDuty } from './fleetStatus.ts'
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

const dated = [
  { id: 'plan-late', status: 'planned' as const, date: '2026-10-20' },
  { id: 'plan-soon', status: 'planned' as const, date: '2026-10-12' },
  { id: 'done', status: 'closed' as const, date: '2026-10-18' },
  { id: 'older', status: 'delivered' as const, date: '2026-09-01' },
]
assert.equal(activeTrip(dated)?.id, 'plan-soon')
assert.equal(activeTrip([...dated, { id: 'load', status: 'loading', date: '2026-10-01' }])?.id, 'load')
assert.equal(
  activeTrip([
    { id: 'old-road', status: 'in_transit', date: '2026-10-01' },
    { id: 'new-road', status: 'in_transit', date: '2026-10-16' },
  ])?.id,
  'new-road',
)
assert.equal(latestFinishedTrip(dated)?.id, 'done')
assert.equal(activeTrip([{ id: 'gone', status: 'cancelled', date: '2026-10-01' }]), null)
assert.equal(openRepair([{ status: 'done', date: '2026-10-01', id: 'a' }, { status: 'in_progress', date: '2026-10-02', id: 'b' }])?.id, 'b')
assert.equal(openRepair([{ status: 'done', date: '2026-10-01' }]), null)

console.log('fleet status tests ok')
