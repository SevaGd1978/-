import type { DatabaseSync } from 'node:sqlite'
import { foldPlace } from '../src/cities.ts'
import { platonCharge, platonComment, platonExpenseId } from '../src/platon.ts'
import { cachedFederalKm } from './roads.ts'

type Sql = DatabaseSync

type TripRow = { id: string; date: string; from_city: string; to_city: string }
type ExpenseRow = { id: string; category: string; amount: number; comment: string }

export function syncPlaton(db: Sql): boolean {
  const trips = db.prepare(`SELECT id, date, from_city, to_city FROM trips`).all() as unknown as TripRow[]
  let changed = false
  for (const trip of trips) {
    if (writeTripPlaton(db, trip)) changed = true
  }
  if (!changed) return false
  const next = readVersion(db) + 1
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('version', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(String(next))
  return true
}

function writeTripPlaton(db: Sql, trip: TripRow) {
  const km = cachedFederalKm(db, trip.from_city, trip.to_city)
  const systemId = platonExpenseId(trip.id)
  if (km == null) return false
  const charge = platonCharge(km, trip.date)
  if (!charge) {
    const existing = db.prepare(`SELECT id FROM expenses WHERE id = ?`).get(systemId)
    if (!existing) return false
    db.prepare(`DELETE FROM expenses WHERE id = ?`).run(systemId)
    return true
  }
  const expenses = db
    .prepare(`SELECT id, category, amount, comment FROM expenses WHERE trip_id = ?`)
    .all(trip.id) as unknown as ExpenseRow[]
  if (expenses.some((expense) => expense.id !== systemId && mentionsPlaton(expense))) return false
  const comment = platonComment(km, charge.perKm)
  const current = expenses.find((expense) => expense.id === systemId)
  if (current && current.category === 'platon' && current.amount === charge.amount && current.comment === comment) return false
  const position = current ? null : nextPosition(db, systemId)
  if (current) {
    db.prepare(`UPDATE expenses SET date = ?, category = 'platon', amount = ?, comment = ? WHERE id = ?`).run(
      trip.date,
      charge.amount,
      comment,
      systemId,
    )
  } else {
    db.prepare(
      `INSERT INTO expenses (id, trip_id, date, category, amount, comment, position) VALUES (?, ?, ?, 'platon', ?, ?, ?)`,
    ).run(systemId, trip.id, trip.date, charge.amount, comment, position)
  }
  return true
}

function mentionsPlaton(expense: ExpenseRow) {
  if (expense.category === 'platon') return true
  return foldPlace(expense.comment).includes('платон')
}

function nextPosition(db: Sql, id: string) {
  const existing = db.prepare(`SELECT position FROM expenses WHERE id = ?`).get(id) as { position: number } | undefined
  if (existing) return existing.position
  const max = db.prepare(`SELECT COALESCE(MAX(position), 0) AS n FROM expenses`).get() as { n: number }
  return max.n + 1
}

function readVersion(db: Sql) {
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'version'`).get() as { value: string } | undefined
  return row ? Number(row.value) : 0
}
