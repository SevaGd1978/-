import { createHash, randomBytes } from 'node:crypto'
import type { DatabaseSync } from 'node:sqlite'
import { normalizePlateKey } from '../src/plates.ts'
import type { Trip, TripExpense } from '../src/types.ts'
import { readResult, saveExpense, saveTrip } from './db.ts'
import { parseExpense, parseTrip } from '../src/records.ts'

const SESSION_MS = 30 * 24 * 60 * 60 * 1000

export type DriverSession = {
  vehicleId: string
  plate: string
  model: string
  kind: string
}

export function ensureDriverAuth(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS driver_sessions (
      token_hash TEXT PRIMARY KEY,
      vehicle_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `)
  const columns = db.prepare(`PRAGMA table_info(vehicles)`).all() as { name: string }[]
  if (!columns.some((column) => column.name === 'driver_pin')) {
    db.exec(`ALTER TABLE vehicles ADD COLUMN driver_pin TEXT NOT NULL DEFAULT ''`)
  }
}

export function driverByToken(db: DatabaseSync, token: string | null): DriverSession | null {
  if (!token) return null
  const now = Date.now()
  db.prepare(`DELETE FROM driver_sessions WHERE expires_at <= ?`).run(now)
  const row = db
    .prepare(
      `SELECT s.vehicle_id AS vehicleId, v.plate AS plate, v.model AS model, v.kind AS kind
       FROM driver_sessions s
       JOIN vehicles v ON v.id = s.vehicle_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), now) as DriverSession | undefined
  return row ?? null
}

export function loginDriver(db: DatabaseSync, plate: string, pin: string) {
  const key = normalizePlateKey(plate)
  const pinTrim = pin.trim()
  if (!key || pinTrim.length < 4 || pinTrim.length > 8) return null
  const vehicles = db.prepare(`SELECT id, plate, model, kind, driver_pin AS driverPin FROM vehicles`).all() as {
    id: string
    plate: string
    model: string
    kind: string
    driverPin: string
  }[]
  const vehicle = vehicles.find((item) => normalizePlateKey(item.plate) === key)
  if (!vehicle || !vehicle.driverPin || vehicle.driverPin !== pinTrim) return null
  const token = randomBytes(24).toString('hex')
  db.prepare(`INSERT INTO driver_sessions (token_hash, vehicle_id, expires_at) VALUES (?, ?, ?)`).run(
    hashToken(token),
    vehicle.id,
    Date.now() + SESSION_MS,
  )
  return {
    token,
    session: {
      vehicleId: vehicle.id,
      plate: vehicle.plate,
      model: vehicle.model,
      kind: vehicle.kind,
    } satisfies DriverSession,
  }
}

export function logoutDriver(db: DatabaseSync, token: string | null) {
  if (!token) return
  db.prepare(`DELETE FROM driver_sessions WHERE token_hash = ?`).run(hashToken(token))
}

export function driverHome(db: DatabaseSync, session: DriverSession) {
  const { state } = readResult(db)
  const trips = state.trips
    .filter((trip) => trip.vehicleId === session.vehicleId && trip.status !== 'cancelled')
    .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
    .slice(0, 12)
  const active =
    trips.find((trip) => trip.status === 'loading' || trip.status === 'in_transit') ||
    trips.find((trip) => trip.status === 'planned') ||
    trips[0] ||
    null
  const tripIds = new Set(trips.map((trip) => trip.id))
  const fuel = state.expenses
    .filter((expense) => tripIds.has(expense.tripId) && expense.category === 'fuel')
    .sort((a, b) => b.date.localeCompare(a.date))
  const drivers = Object.fromEntries(state.drivers.map((driver) => [driver.id, driver.name]))
  return {
    vehicle: {
      id: session.vehicleId,
      plate: session.plate,
      model: session.model,
      kind: session.kind,
    },
    activeTripId: active?.id ?? null,
    trips,
    fuel,
    drivers,
  }
}

export function updateDriverOdometer(
  db: DatabaseSync,
  session: DriverSession,
  tripId: string,
  fields: {
    odometerLoad1?: number | null
    odometerUnload1?: number | null
    odometerLoad2?: number | null
    odometerUnload2?: number | null
  },
) {
  const { state } = readResult(db)
  const trip = state.trips.find((item) => item.id === tripId)
  if (!trip) return { ok: false as const, status: 404, error: 'Рейс не найден' }
  if (trip.vehicleId !== session.vehicleId) {
    return { ok: false as const, status: 403, error: 'Этот рейс не вашей машины' }
  }
  if (trip.status === 'cancelled' || trip.status === 'closed') {
    return { ok: false as const, status: 400, error: 'По закрытому или отменённому рейсу одометр не меняем' }
  }
  const next: Trip = {
    ...trip,
    odometerLoad1: fields.odometerLoad1 !== undefined ? fields.odometerLoad1 : trip.odometerLoad1,
    odometerUnload1: fields.odometerUnload1 !== undefined ? fields.odometerUnload1 : trip.odometerUnload1,
    odometerLoad2: fields.odometerLoad2 !== undefined ? fields.odometerLoad2 : trip.odometerLoad2,
    odometerUnload2: fields.odometerUnload2 !== undefined ? fields.odometerUnload2 : trip.odometerUnload2,
  }
  const sequence = [next.odometerLoad1, next.odometerUnload1, next.odometerLoad2, next.odometerUnload2].filter(
    (value): value is number => value != null,
  )
  for (let index = 1; index < sequence.length; index += 1) {
    if (sequence[index]! < sequence[index - 1]!) {
      return { ok: false as const, status: 400, error: 'Показания одометра должны идти по возрастанию' }
    }
  }
  const parsed = parseTrip(next)
  if (!parsed) return { ok: false as const, status: 400, error: 'Некорректные показания одометра' }
  const saved = saveTrip(db, parsed)
  if (!saved.ok) return saved
  return { ok: true as const, home: driverHome(db, session) }
}

export function addDriverFuel(
  db: DatabaseSync,
  session: DriverSession,
  input: { tripId: string; amount: number; date: string; comment: string; expenseId?: string },
) {
  const { state } = readResult(db)
  const trip = state.trips.find((item) => item.id === input.tripId)
  if (!trip) return { ok: false as const, status: 404, error: 'Рейс не найден' }
  if (trip.vehicleId !== session.vehicleId) {
    return { ok: false as const, status: 403, error: 'Этот рейс не вашей машины' }
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false as const, status: 400, error: 'Сумма чека должна быть больше нуля' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
    return { ok: false as const, status: 400, error: 'Укажите дату чека' }
  }
  const expenseId =
    input.expenseId && /^[A-Za-z0-9_-]{1,64}$/.test(input.expenseId)
      ? input.expenseId
      : `e_${randomBytes(4).toString('hex')}`
  const expense: TripExpense = {
    id: expenseId,
    vehicleId: '',
    tripId: trip.id,
    date: input.date,
    category: 'fuel',
    amount: Math.round(input.amount * 100) / 100,
    vat: 0,
    comment: input.comment.trim() || 'Соляра, чек от водителя',
  }
  const parsed = parseExpense(expense)
  if (!parsed) return { ok: false as const, status: 400, error: 'Проверьте сумму и комментарий' }
  const saved = saveExpense(db, parsed)
  if (!saved.ok) return saved
  return { ok: true as const, home: driverHome(db, session) }
}

export function setVehicleDriverPin(db: DatabaseSync, vehicleId: string, pin: string) {
  const trimmed = pin.trim()
  if (trimmed && (trimmed.length < 4 || trimmed.length > 8 || !/^\d+$/.test(trimmed))) {
    return { ok: false as const, error: 'Код водителя: 4–8 цифр' }
  }
  db.prepare(`UPDATE vehicles SET driver_pin = ? WHERE id = ?`).run(trimmed, vehicleId)
  return { ok: true as const }
}

export function readVehicleDriverPin(db: DatabaseSync, vehicleId: string) {
  const row = db.prepare(`SELECT driver_pin AS driverPin FROM vehicles WHERE id = ?`).get(vehicleId) as
    | { driverPin: string }
    | undefined
  return row?.driverPin ?? ''
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}
