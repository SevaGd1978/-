import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { ensureAccounts } from './accounts.ts'
import { ensureRoadCache } from './roads.ts'
import { createSeed } from '../src/seed.ts'
import type { Driver, Payment, RepairJob, State, Trip, TripExpense, Vehicle } from '../src/types.ts'

export type DbResult = { ok: true; version: number; state: State } | { ok: false; status: number; error: string }

type Sql = DatabaseSync

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  plate TEXT NOT NULL,
  model TEXT NOT NULL,
  kind TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL,
  date TEXT NOT NULL,
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,
  driver_id TEXT NOT NULL,
  customer TEXT NOT NULL,
  cargo TEXT NOT NULL,
  weight_tons REAL NOT NULL,
  rate REAL NOT NULL,
  pay_due TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  comment TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS repairs (
  id TEXT PRIMARY KEY,
  vehicle_id TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT NOT NULL,
  description TEXT NOT NULL,
  parts_cost REAL NOT NULL,
  labor_cost REAL NOT NULL,
  status TEXT NOT NULL,
  odometer REAL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  counterparty TEXT NOT NULL,
  comment TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS customers (
  name TEXT PRIMARY KEY,
  seen_at INTEGER NOT NULL
);
`

export function openDatabase(file: string): Sql {
  mkdirSync(dirname(file), { recursive: true })
  const db = new DatabaseSync(file)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA busy_timeout = 5000')
  db.exec(SCHEMA)
  ensureVehicleStatus(db)
  ensureVehicleSts(db)
  ensureRoadCache(db)
  ensureAccounts(db)
  rememberTripCustomers(db)
  const seeded = db.prepare(`SELECT value FROM meta WHERE key = 'seeded'`).get() as { value: string } | undefined
  if (!seeded) {
    transaction(db, () => {
      writeState(db, createSeed(), 1)
      db.prepare(`INSERT INTO meta (key, value) VALUES ('seeded', '1')`).run()
    })
  }
  return db
}

export function readResult(db: Sql): { version: number; state: State } {
  return { version: readVersion(db), state: readState(db) }
}

export function saveVehicle(db: Sql, vehicle: Vehicle): DbResult {
  return transaction(db, () => {
    const position = nextPosition(db, 'vehicles', vehicle.id)
    db.prepare(
      `INSERT INTO vehicles (id, plate, model, kind, status, sts, position) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET plate = excluded.plate, model = excluded.model, kind = excluded.kind, status = excluded.status, sts = excluded.sts`,
    ).run(vehicle.id, vehicle.plate, vehicle.model, vehicle.kind, vehicle.status, vehicle.sts, position)
    return done(db)
  })
}

export function deleteVehicle(db: Sql, id: string): DbResult {
  return transaction(db, () => {
    const trips = count(db, `SELECT COUNT(*) AS n FROM trips WHERE vehicle_id = ?`, id)
    const repairs = count(db, `SELECT COUNT(*) AS n FROM repairs WHERE vehicle_id = ?`, id)
    if (trips || repairs) return fail(409, 'Нельзя удалить машину: она есть в рейсе или в ремзоне')
    db.prepare(`DELETE FROM vehicles WHERE id = ?`).run(id)
    return done(db)
  })
}

export function saveDriver(db: Sql, driver: Driver): DbResult {
  return transaction(db, () => {
    const position = nextPosition(db, 'drivers', driver.id)
    db.prepare(
      `INSERT INTO drivers (id, name, phone, position) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, phone = excluded.phone`,
    ).run(driver.id, driver.name, driver.phone, position)
    return done(db)
  })
}

export function deleteDriver(db: Sql, id: string): DbResult {
  return transaction(db, () => {
    if (count(db, `SELECT COUNT(*) AS n FROM trips WHERE driver_id = ?`, id)) {
      return fail(409, 'Нельзя удалить водителя: он назначен на рейс')
    }
    db.prepare(`DELETE FROM drivers WHERE id = ?`).run(id)
    return done(db)
  })
}

export function saveTrip(db: Sql, trip: Trip): DbResult {
  return transaction(db, () => {
    if (!count(db, `SELECT COUNT(*) AS n FROM vehicles WHERE id = ?`, trip.vehicleId)) {
      return fail(400, 'Выберите машину из парка')
    }
    if (!count(db, `SELECT COUNT(*) AS n FROM drivers WHERE id = ?`, trip.driverId)) {
      return fail(400, 'Выберите водителя из парка')
    }
    const position = nextPosition(db, 'trips', trip.id)
    db.prepare(
      `INSERT INTO trips (
         id, number, date, from_city, to_city, vehicle_id, driver_id, customer, cargo,
         weight_tons, rate, pay_due, status, note, position
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         number = excluded.number, date = excluded.date, from_city = excluded.from_city,
         to_city = excluded.to_city, vehicle_id = excluded.vehicle_id, driver_id = excluded.driver_id,
         customer = excluded.customer, cargo = excluded.cargo, weight_tons = excluded.weight_tons,
         rate = excluded.rate, pay_due = excluded.pay_due, status = excluded.status, note = excluded.note`,
    ).run(
      trip.id,
      trip.number,
      trip.date,
      trip.from,
      trip.to,
      trip.vehicleId,
      trip.driverId,
      trip.customer,
      trip.cargo,
      trip.weightTons,
      trip.rate,
      trip.payDue,
      trip.status,
      trip.note,
      position,
    )
    rememberCustomer(db, trip.customer)
    return done(db)
  })
}

export function deleteTrip(db: Sql, id: string): DbResult {
  return transaction(db, () => {
    db.prepare(`DELETE FROM expenses WHERE trip_id = ?`).run(id)
    db.prepare(`DELETE FROM payments WHERE trip_id = ?`).run(id)
    db.prepare(`DELETE FROM trips WHERE id = ?`).run(id)
    return done(db)
  })
}

export function saveExpense(db: Sql, expense: TripExpense): DbResult {
  return transaction(db, () => {
    if (!count(db, `SELECT COUNT(*) AS n FROM trips WHERE id = ?`, expense.tripId)) {
      return fail(400, 'Расход привязан к несуществующему рейсу')
    }
    const position = nextPosition(db, 'expenses', expense.id)
    db.prepare(
      `INSERT INTO expenses (id, trip_id, date, category, amount, comment, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         trip_id = excluded.trip_id, date = excluded.date, category = excluded.category,
         amount = excluded.amount, comment = excluded.comment`,
    ).run(expense.id, expense.tripId, expense.date, expense.category, expense.amount, expense.comment, position)
    return done(db)
  })
}

export function deleteExpense(db: Sql, id: string): DbResult {
  return transaction(db, () => {
    db.prepare(`DELETE FROM expenses WHERE id = ?`).run(id)
    return done(db)
  })
}

export function saveRepair(db: Sql, job: RepairJob): DbResult {
  return transaction(db, () => {
    if (!count(db, `SELECT COUNT(*) AS n FROM vehicles WHERE id = ?`, job.vehicleId)) {
      return fail(400, 'Заявка привязана к несуществующей машине')
    }
    const position = nextPosition(db, 'repairs', job.id)
    db.prepare(
      `INSERT INTO repairs (
         id, vehicle_id, date, kind, description, parts_cost, labor_cost, status, odometer, position
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         vehicle_id = excluded.vehicle_id, date = excluded.date, kind = excluded.kind,
         description = excluded.description, parts_cost = excluded.parts_cost, labor_cost = excluded.labor_cost,
         status = excluded.status, odometer = excluded.odometer`,
    ).run(
      job.id,
      job.vehicleId,
      job.date,
      job.kind,
      job.description,
      job.partsCost,
      job.laborCost,
      job.status,
      job.odometer,
      position,
    )
    return done(db)
  })
}

export function deleteRepair(db: Sql, id: string): DbResult {
  return transaction(db, () => {
    db.prepare(`DELETE FROM repairs WHERE id = ?`).run(id)
    return done(db)
  })
}

export function savePayment(db: Sql, payment: Payment): DbResult {
  return transaction(db, () => {
    if (!count(db, `SELECT COUNT(*) AS n FROM trips WHERE id = ?`, payment.tripId)) {
      return fail(400, 'Оплата привязана к несуществующему рейсу')
    }
    const position = nextPosition(db, 'payments', payment.id)
    db.prepare(
      `INSERT INTO payments (id, trip_id, date, amount, method, counterparty, comment, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         trip_id = excluded.trip_id, date = excluded.date, amount = excluded.amount, method = excluded.method,
         counterparty = excluded.counterparty, comment = excluded.comment`,
    ).run(
      payment.id,
      payment.tripId,
      payment.date,
      payment.amount,
      payment.method,
      payment.counterparty,
      payment.comment,
      position,
    )
    return done(db)
  })
}

export function deletePayment(db: Sql, id: string): DbResult {
  return transaction(db, () => {
    db.prepare(`DELETE FROM payments WHERE id = ?`).run(id)
    return done(db)
  })
}

export function resetDemo(db: Sql): DbResult {
  return transaction(db, () => {
    writeState(db, createSeed(), readVersion(db) + 1)
    return ok(db)
  })
}

function ok(db: Sql): DbResult {
  return { ok: true, ...readResult(db) }
}

function done(db: Sql): DbResult {
  const next = readVersion(db) + 1
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(String(next))
  return ok(db)
}

function fail(status: number, error: string): DbResult {
  return { ok: false, status, error }
}

function transaction<T>(db: Sql, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = fn()
    if (isFailure(result)) db.exec('ROLLBACK')
    else db.exec('COMMIT')
    return result
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      // The transaction is already closed.
    }
    throw error
  }
}

function isFailure(value: unknown): value is { ok: false } {
  return Boolean(value && typeof value === 'object' && 'ok' in value && value.ok === false)
}

function writeState(db: Sql, state: State, version: number) {
  db.exec(`DELETE FROM payments; DELETE FROM expenses; DELETE FROM repairs; DELETE FROM trips; DELETE FROM drivers; DELETE FROM vehicles;`)
  insertVehicles(db, state.vehicles)
  insertDrivers(db, state.drivers)
  insertTrips(db, state.trips)
  replaceCustomers(db, state.trips.map((trip) => trip.customer))
  insertExpenses(db, state.expenses)
  insertRepairs(db, state.repairs)
  insertPayments(db, state.payments)
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(String(version))
}

function insertVehicles(db: Sql, rows: Vehicle[]) {
  const stmt = db.prepare(
    `INSERT INTO vehicles (id, plate, model, kind, status, sts, position) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  rows.forEach((row, index) =>
    stmt.run(row.id, row.plate, row.model, row.kind, row.status, row.sts, rank(index, rows.length)),
  )
}

function insertDrivers(db: Sql, rows: Driver[]) {
  const stmt = db.prepare(`INSERT INTO drivers (id, name, phone, position) VALUES (?, ?, ?, ?)`)
  rows.forEach((row, index) => stmt.run(row.id, row.name, row.phone, rank(index, rows.length)))
}

function insertTrips(db: Sql, rows: Trip[]) {
  const stmt = db.prepare(
    `INSERT INTO trips (
       id, number, date, from_city, to_city, vehicle_id, driver_id, customer, cargo,
       weight_tons, rate, pay_due, status, note, position
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  rows.forEach((row, index) =>
    stmt.run(
      row.id,
      row.number,
      row.date,
      row.from,
      row.to,
      row.vehicleId,
      row.driverId,
      row.customer,
      row.cargo,
      row.weightTons,
      row.rate,
      row.payDue,
      row.status,
      row.note,
      rank(index, rows.length),
    ),
  )
}

function insertExpenses(db: Sql, rows: TripExpense[]) {
  const stmt = db.prepare(
    `INSERT INTO expenses (id, trip_id, date, category, amount, comment, position) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  rows.forEach((row, index) =>
    stmt.run(row.id, row.tripId, row.date, row.category, row.amount, row.comment, rank(index, rows.length)),
  )
}

function insertRepairs(db: Sql, rows: RepairJob[]) {
  const stmt = db.prepare(
    `INSERT INTO repairs (
       id, vehicle_id, date, kind, description, parts_cost, labor_cost, status, odometer, position
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  rows.forEach((row, index) =>
    stmt.run(
      row.id,
      row.vehicleId,
      row.date,
      row.kind,
      row.description,
      row.partsCost,
      row.laborCost,
      row.status,
      row.odometer,
      rank(index, rows.length),
    ),
  )
}

function insertPayments(db: Sql, rows: Payment[]) {
  const stmt = db.prepare(
    `INSERT INTO payments (id, trip_id, date, amount, method, counterparty, comment, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  rows.forEach((row, index) =>
    stmt.run(
      row.id,
      row.tripId,
      row.date,
      row.amount,
      row.method,
      row.counterparty,
      row.comment,
      rank(index, rows.length),
    ),
  )
}

function rank(index: number, total: number) {
  return total - index
}

const POSITION: Record<string, { current: string; max: string }> = {
  vehicles: {
    current: `SELECT position FROM vehicles WHERE id = ?`,
    max: `SELECT COALESCE(MAX(position), 0) AS n FROM vehicles`,
  },
  drivers: {
    current: `SELECT position FROM drivers WHERE id = ?`,
    max: `SELECT COALESCE(MAX(position), 0) AS n FROM drivers`,
  },
  trips: {
    current: `SELECT position FROM trips WHERE id = ?`,
    max: `SELECT COALESCE(MAX(position), 0) AS n FROM trips`,
  },
  expenses: {
    current: `SELECT position FROM expenses WHERE id = ?`,
    max: `SELECT COALESCE(MAX(position), 0) AS n FROM expenses`,
  },
  repairs: {
    current: `SELECT position FROM repairs WHERE id = ?`,
    max: `SELECT COALESCE(MAX(position), 0) AS n FROM repairs`,
  },
  payments: {
    current: `SELECT position FROM payments WHERE id = ?`,
    max: `SELECT COALESCE(MAX(position), 0) AS n FROM payments`,
  },
}

function nextPosition(db: Sql, table: string, id: string): number {
  const sql = POSITION[table]
  const existing = db.prepare(sql.current).get(id) as { position: number } | undefined
  if (existing) return existing.position
  const max = db.prepare(sql.max).get() as { n: number }
  return max.n + 1
}

function count(db: Sql, sql: string, id: string) {
  const row = db.prepare(sql).get(id) as { n: number }
  return row.n
}

function ensureVehicleStatus(db: Sql) {
  const columns = db.prepare(`PRAGMA table_info(vehicles)`).all() as { name: string }[]
  if (columns.some((column) => column.name === 'status')) return
  db.exec(`ALTER TABLE vehicles ADD COLUMN status TEXT NOT NULL DEFAULT 'available'`)
}

function ensureVehicleSts(db: Sql) {
  const columns = db.prepare(`PRAGMA table_info(vehicles)`).all() as { name: string }[]
  if (columns.some((column) => column.name === 'sts')) return
  db.exec(`ALTER TABLE vehicles ADD COLUMN sts TEXT NOT NULL DEFAULT ''`)
}

function readVersion(db: Sql) {
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'version'`).get() as { value: string } | undefined
  return row ? Number(row.value) : 0
}

function readState(db: Sql): State {
  return {
    vehicles: db
      .prepare(
        `SELECT id, plate, model, kind, COALESCE(status, 'available') AS status, COALESCE(sts, '') AS sts FROM vehicles ORDER BY position DESC`,
      )
      .all() as unknown as Vehicle[],
    drivers: db.prepare(`SELECT id, name, phone FROM drivers ORDER BY position DESC`).all() as unknown as Driver[],
    trips: db
      .prepare(
        `SELECT id, number, date, from_city AS "from", to_city AS "to", vehicle_id AS vehicleId, driver_id AS driverId,
                customer, cargo, weight_tons AS weightTons, rate, pay_due AS payDue, status, note
         FROM trips ORDER BY position DESC`,
      )
      .all() as unknown as Trip[],
    expenses: db
      .prepare(`SELECT id, trip_id AS tripId, date, category, amount, comment FROM expenses ORDER BY position DESC`)
      .all() as unknown as TripExpense[],
    repairs: db
      .prepare(
        `SELECT id, vehicle_id AS vehicleId, date, kind, description, parts_cost AS partsCost,
                labor_cost AS laborCost, status, odometer
         FROM repairs ORDER BY position DESC`,
      )
      .all() as unknown as RepairJob[],
    payments: db
      .prepare(
        `SELECT id, trip_id AS tripId, date, amount, method, counterparty, comment FROM payments ORDER BY position DESC`,
      )
      .all() as unknown as Payment[],
    customers: (
      db.prepare(`SELECT name FROM customers ORDER BY seen_at DESC, name`).all() as { name: string }[]
    ).map((row) => row.name),
  }
}

function rememberCustomer(db: Sql, name: string) {
  const trimmed = name.trim().replace(/\s+/g, ' ')
  if (!trimmed) return
  db.prepare(
    `INSERT INTO customers (name, seen_at) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET seen_at = excluded.seen_at`,
  ).run(trimmed, Date.now())
}

function rememberTripCustomers(db: Sql) {
  const rows = db.prepare(`SELECT DISTINCT customer FROM trips`).all() as { customer: string }[]
  for (const row of rows) {
    const name = row.customer.trim().replace(/\s+/g, ' ')
    if (!name) continue
    db.prepare(`INSERT INTO customers (name, seen_at) VALUES (?, 0) ON CONFLICT(name) DO NOTHING`).run(name)
  }
}

function replaceCustomers(db: Sql, names: string[]) {
  db.exec(`DELETE FROM customers`)
  for (const name of names) rememberCustomer(db, name)
}
