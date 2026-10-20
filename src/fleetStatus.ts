import type { ParkStatus, TripStatus, VehicleStatus } from './types'

type DutyTrip = { vehicleId: string; status: TripStatus }
type DatedTrip = { status: TripStatus; date: string }

export function vehicleDuty(stored: ParkStatus, trips: DutyTrip[], vehicleId: string): VehicleStatus {
  let loading = false
  for (const trip of trips) {
    if (trip.vehicleId !== vehicleId) continue
    if (trip.status === 'in_transit') return 'on_trip'
    if (trip.status === 'loading') loading = true
  }
  return loading ? 'loading' : stored
}

export function activeTrip<T extends DatedTrip>(trips: T[]): T | null {
  const rank: Partial<Record<TripStatus, number>> = { in_transit: 0, loading: 1, planned: 2 }
  const open = trips.filter((trip) => rank[trip.status] !== undefined)
  open.sort((left, right) => {
    const byStatus = rank[left.status]! - rank[right.status]!
    if (byStatus) return byStatus
    if (left.status === 'planned') return left.date.localeCompare(right.date)
    return right.date.localeCompare(left.date)
  })
  return open[0] ?? null
}

export function latestFinishedTrip<T extends DatedTrip>(trips: T[]): T | null {
  const done = trips.filter((trip) => trip.status === 'delivered' || trip.status === 'closed')
  done.sort((left, right) => right.date.localeCompare(left.date))
  return done[0] ?? null
}

export function openRepair<T extends { status: string; date: string }>(jobs: T[]): T | null {
  const open = jobs.filter((job) => job.status === 'queued' || job.status === 'in_progress')
  open.sort((left, right) => right.date.localeCompare(left.date))
  return open[0] ?? null
}
