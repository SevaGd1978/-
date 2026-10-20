import type { ParkStatus, TripStatus, VehicleStatus } from './types'

type DutyTrip = { vehicleId: string; status: TripStatus }

export function vehicleDuty(stored: ParkStatus, trips: DutyTrip[], vehicleId: string): VehicleStatus {
  let loading = false
  for (const trip of trips) {
    if (trip.vehicleId !== vehicleId) continue
    if (trip.status === 'in_transit') return 'on_trip'
    if (trip.status === 'loading') loading = true
  }
  return loading ? 'loading' : stored
}
