import type { Trip, TripExpense } from '../types'

const CACHE_KEY = 'putevoy_driver_cache_v1'
const QUEUE_KEY = 'putevoy_driver_queue_v1'
const SESSION_KEY = 'putevoy_driver_session_v1'

export type DriverSession = {
  vehicleId: string
  plate: string
  model: string
  kind: string
}

export type DriverHome = {
  vehicle: DriverSession
  activeTripId: string | null
  trips: Trip[]
  fuel: TripExpense[]
  drivers: Record<string, string>
}

export type OdometerField = 'odometerLoad1' | 'odometerUnload1' | 'odometerLoad2' | 'odometerUnload2'

export type PendingOdometer = {
  id: string
  type: 'odometer'
  tripId: string
  field: OdometerField
  value: number | null
  createdAt: string
}

export type PendingFuel = {
  id: string
  type: 'fuel'
  tripId: string
  amount: number
  date: string
  comment: string
  expenseId: string
  createdAt: string
}

export type PendingItem = PendingOdometer | PendingFuel

export type DriverCache = {
  session: DriverSession
  home: DriverHome
  savedAt: string
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadCachedSession(): DriverSession | null {
  return readJson<DriverSession | null>(SESSION_KEY, null)
}

export function saveCachedSession(session: DriverSession | null) {
  if (!session) {
    localStorage.removeItem(SESSION_KEY)
    return
  }
  writeJson(SESSION_KEY, session)
}

export function loadCache(): DriverCache | null {
  return readJson<DriverCache | null>(CACHE_KEY, null)
}

export function saveCache(session: DriverSession, home: DriverHome) {
  writeJson(CACHE_KEY, { session, home, savedAt: new Date().toISOString() } satisfies DriverCache)
  saveCachedSession(session)
}

export function clearDriverLocal() {
  localStorage.removeItem(CACHE_KEY)
  localStorage.removeItem(QUEUE_KEY)
  localStorage.removeItem(SESSION_KEY)
}

export function loadQueue(): PendingItem[] {
  return readJson<PendingItem[]>(QUEUE_KEY, [])
}

export function saveQueue(queue: PendingItem[]) {
  writeJson(QUEUE_KEY, queue)
}

export function enqueue(item: PendingItem) {
  const queue = loadQueue()
  if (item.type === 'odometer') {
    const withoutSame = queue.filter(
      (entry) => !(entry.type === 'odometer' && entry.tripId === item.tripId && entry.field === item.field),
    )
    saveQueue([...withoutSame, item])
    return
  }
  saveQueue([...queue, item])
}

export function removeQueueItem(id: string) {
  saveQueue(loadQueue().filter((item) => item.id !== id))
}

export function newLocalId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function applyOdometerLocal(home: DriverHome, tripId: string, field: OdometerField, value: number | null): DriverHome {
  return {
    ...home,
    trips: home.trips.map((trip) => (trip.id === tripId ? { ...trip, [field]: value } : trip)),
  }
}

export function applyFuelLocal(
  home: DriverHome,
  expense: TripExpense,
): DriverHome {
  const without = home.fuel.filter((item) => item.id !== expense.id)
  return {
    ...home,
    fuel: [expense, ...without].sort((a, b) => b.date.localeCompare(a.date)),
  }
}

/** Накладывает ещё не отправленные правки водителя поверх свежих рейсов от менеджера. */
export function overlayPending(home: DriverHome, queue: PendingItem[] = loadQueue()): DriverHome {
  let next = home
  for (const item of queue) {
    if (item.type === 'odometer') {
      next = applyOdometerLocal(next, item.tripId, item.field, item.value)
      continue
    }
    next = applyFuelLocal(next, {
      id: item.expenseId,
      vehicleId: '',
      tripId: item.tripId,
      date: item.date,
      category: 'fuel',
      amount: item.amount,
      vat: 0,
      comment: item.comment,
    })
  }
  return next
}

export function isProbablyOffline(error?: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (error instanceof TypeError) return true
  return false
}

export const ODOMETER_LABELS: Record<OdometerField, { direct: string; round: string }> = {
  odometerLoad1: { direct: 'Погрузка', round: 'Погрузка 1' },
  odometerUnload1: { direct: 'Выгрузка', round: 'Выгрузка 1' },
  odometerLoad2: { direct: 'Погрузка 2', round: 'Погрузка 2' },
  odometerUnload2: { direct: 'Выгрузка 2', round: 'Выгрузка 2' },
}
