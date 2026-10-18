import type {
  Driver,
  ExpenseCategory,
  PayMethod,
  Payment,
  RepairJob,
  RepairKind,
  RepairStatus,
  Trip,
  TripExpense,
  TripStatus,
  Vehicle,
} from './types'

const TRIP_STATUS = new Set<TripStatus>(['planned', 'loading', 'in_transit', 'delivered', 'closed', 'cancelled'])
const EXPENSE_CATEGORY = new Set<ExpenseCategory>(['fuel', 'toll', 'driver', 'loading', 'parking', 'other'])
const REPAIR_KIND = new Set<RepairKind>(['maintenance', 'repair', 'tires', 'parts', 'body'])
const REPAIR_STATUS = new Set<RepairStatus>(['queued', 'in_progress', 'done'])
const PAY_METHOD = new Set<PayMethod>(['bank', 'cash', 'card'])

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return null
  return trimmed
}

function optionalText(value: unknown, max: number): string | null {
  if (value == null) return ''
  if (typeof value !== 'string' || value.length > max) return null
  return value.trim()
}

function id(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(value)) return null
  return value
}

function day(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

function money(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000_000) return null
  return Math.round(value * 100) / 100
}

function tons(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1000) return null
  return Math.round(value * 1000) / 1000
}

export function parseVehicle(value: unknown): Vehicle | null {
  const row = record(value)
  if (!row) return null
  const parsed = {
    id: id(row.id),
    plate: text(row.plate, 32),
    model: text(row.model, 80),
    kind: text(row.kind, 80),
  }
  if (!parsed.id || !parsed.plate || !parsed.model || !parsed.kind) return null
  return { id: parsed.id, plate: parsed.plate, model: parsed.model, kind: parsed.kind }
}

export function parseDriver(value: unknown): Driver | null {
  const row = record(value)
  if (!row) return null
  const parsed = {
    id: id(row.id),
    name: text(row.name, 120),
    phone: text(row.phone, 40),
  }
  if (!parsed.id || !parsed.name || !parsed.phone) return null
  return { id: parsed.id, name: parsed.name, phone: parsed.phone }
}

export function parseTrip(value: unknown): Trip | null {
  const row = record(value)
  if (!row) return null
  const status = row.status
  const note = optionalText(row.note, 2000)
  const parsed = {
    id: id(row.id),
    number: text(row.number, 32),
    date: day(row.date),
    from: text(row.from, 80),
    to: text(row.to, 80),
    vehicleId: id(row.vehicleId),
    driverId: id(row.driverId),
    customer: text(row.customer, 160),
    cargo: text(row.cargo, 160),
    weightTons: tons(row.weightTons),
    rate: money(row.rate),
    payDue: day(row.payDue),
    status: typeof status === 'string' && TRIP_STATUS.has(status as TripStatus) ? (status as TripStatus) : null,
    note,
  }
  if (
    !parsed.id ||
    !parsed.number ||
    !parsed.date ||
    !parsed.from ||
    !parsed.to ||
    !parsed.vehicleId ||
    !parsed.driverId ||
    !parsed.customer ||
    !parsed.cargo ||
    parsed.weightTons == null ||
    parsed.rate == null ||
    !parsed.payDue ||
    !parsed.status ||
    parsed.note == null
  ) {
    return null
  }
  return {
    id: parsed.id,
    number: parsed.number,
    date: parsed.date,
    from: parsed.from,
    to: parsed.to,
    vehicleId: parsed.vehicleId,
    driverId: parsed.driverId,
    customer: parsed.customer,
    cargo: parsed.cargo,
    weightTons: parsed.weightTons,
    rate: parsed.rate,
    payDue: parsed.payDue,
    status: parsed.status,
    note: parsed.note,
  }
}

export function parseExpense(value: unknown): TripExpense | null {
  const row = record(value)
  if (!row) return null
  const category = row.category
  const comment = optionalText(row.comment, 500)
  const parsed = {
    id: id(row.id),
    tripId: id(row.tripId),
    date: day(row.date),
    category:
      typeof category === 'string' && EXPENSE_CATEGORY.has(category as ExpenseCategory)
        ? (category as ExpenseCategory)
        : null,
    amount: money(row.amount),
    comment,
  }
  if (!parsed.id || !parsed.tripId || !parsed.date || !parsed.category || parsed.amount == null || parsed.comment == null) {
    return null
  }
  return {
    id: parsed.id,
    tripId: parsed.tripId,
    date: parsed.date,
    category: parsed.category,
    amount: parsed.amount,
    comment: parsed.comment,
  }
}

export function parseRepair(value: unknown): RepairJob | null {
  const row = record(value)
  if (!row) return null
  const kind = row.kind
  const status = row.status
  let odometer: number | null = null
  if (row.odometer != null) {
    if (typeof row.odometer !== 'number' || !Number.isFinite(row.odometer) || row.odometer < 0 || row.odometer > 10_000_000) {
      return null
    }
    odometer = Math.round(row.odometer)
  }
  const parsed = {
    id: id(row.id),
    vehicleId: id(row.vehicleId),
    date: day(row.date),
    kind: typeof kind === 'string' && REPAIR_KIND.has(kind as RepairKind) ? (kind as RepairKind) : null,
    description: text(row.description, 300),
    partsCost: money(row.partsCost),
    laborCost: money(row.laborCost),
    status: typeof status === 'string' && REPAIR_STATUS.has(status as RepairStatus) ? (status as RepairStatus) : null,
    odometer,
  }
  if (
    !parsed.id ||
    !parsed.vehicleId ||
    !parsed.date ||
    !parsed.kind ||
    !parsed.description ||
    parsed.partsCost == null ||
    parsed.laborCost == null ||
    !parsed.status
  ) {
    return null
  }
  return {
    id: parsed.id,
    vehicleId: parsed.vehicleId,
    date: parsed.date,
    kind: parsed.kind,
    description: parsed.description,
    partsCost: parsed.partsCost,
    laborCost: parsed.laborCost,
    status: parsed.status,
    odometer: parsed.odometer,
  }
}

export function parsePayment(value: unknown): Payment | null {
  const row = record(value)
  if (!row) return null
  const method = row.method
  const comment = optionalText(row.comment, 500)
  const parsed = {
    id: id(row.id),
    tripId: id(row.tripId),
    date: day(row.date),
    amount: money(row.amount),
    method: typeof method === 'string' && PAY_METHOD.has(method as PayMethod) ? (method as PayMethod) : null,
    counterparty: text(row.counterparty, 160),
    comment,
  }
  if (
    !parsed.id ||
    !parsed.tripId ||
    !parsed.date ||
    parsed.amount == null ||
    !parsed.method ||
    !parsed.counterparty ||
    parsed.comment == null
  ) {
    return null
  }
  return {
    id: parsed.id,
    tripId: parsed.tripId,
    date: parsed.date,
    amount: parsed.amount,
    method: parsed.method,
    counterparty: parsed.counterparty,
    comment: parsed.comment,
  }
}
