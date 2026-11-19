import type { State } from './types'

/** Номера учебных рейсов из `createSeed()`. */
const SEED_TRIP_NUMBERS = new Set([
  'Р-1034',
  'Р-1035',
  'Р-1036',
  'Р-1037',
  'Р-1038',
  'Р-1039',
  'Р-1040',
  'Р-1041',
])

/**
 * true, если в базе сейчас только демо-набор (или его урезанная копия).
 * После «Вернуть демо-данные» или первого запуска на пустом диске.
 */
export function looksLikeDemoSeed(state: Pick<State, 'trips' | 'vehicles'>) {
  if (state.trips.length === 0) return false
  if (state.trips.length > SEED_TRIP_NUMBERS.size) return false
  const allSeedNumbers = state.trips.every((trip) => SEED_TRIP_NUMBERS.has(trip.number))
  const hasDemoPlate = state.vehicles.some((vehicle) => vehicle.plate === 'А123ВС 116')
  return allSeedNumbers && hasDemoPlate
}
