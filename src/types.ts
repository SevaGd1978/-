export type TripStatus = 'planned' | 'loading' | 'in_transit' | 'delivered' | 'closed' | 'cancelled'

export type ExpenseCategory = 'fuel' | 'toll' | 'platon' | 'workshop' | 'driver' | 'salary' | 'loading' | 'parking' | 'other'

export type RepairKind = 'maintenance' | 'repair' | 'tires' | 'parts' | 'body'

export type RepairStatus = 'queued' | 'in_progress' | 'done'

export type PayMethod = 'bank' | 'cash' | 'card'

export type ParkStatus = 'available' | 'repair' | 'downtime'
export type VehicleStatus = ParkStatus | 'on_trip' | 'loading'

export interface Vehicle {
  id: string
  plate: string
  model: string
  kind: string
  status: ParkStatus
  sts: string
}

export interface Driver {
  id: string
  name: string
  phone: string
}

export interface Trip {
  id: string
  number: string
  date: string
  from: string
  to: string
  vehicleId: string
  driverId: string
  customer: string
  cargo: string
  weightTons: number
  rate: number
  payDue: string
  status: TripStatus
  note: string
}

export interface TripExpense {
  id: string
  vehicleId: string
  tripId: string
  date: string
  category: ExpenseCategory
  amount: number
  /** Ручной НДС. Пустое значение считает 22% само, на топливе ноль. */
  vat?: number | null
  comment: string
}

export interface RepairJob {
  id: string
  vehicleId: string
  date: string
  kind: RepairKind
  description: string
  partsCost: number
  laborCost: number
  status: RepairStatus
  odometer: number | null
}

export interface Payment {
  id: string
  tripId: string
  date: string
  amount: number
  method: PayMethod
  counterparty: string
  comment: string
}

export interface State {
  vehicles: Vehicle[]
  drivers: Driver[]
  trips: Trip[]
  expenses: TripExpense[]
  repairs: RepairJob[]
  payments: Payment[]
  customers: string[]
}
