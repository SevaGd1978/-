import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createSeed } from './seed'
import type { Driver, Payment, RepairJob, State, Trip, TripExpense, Vehicle } from './types'

const STORAGE_KEY = 'putevoy.v1'

interface DataApi {
  state: State
  notice: string | null
  saveTrip: (trip: Trip) => void
  deleteTrip: (id: string) => void
  saveExpense: (expense: TripExpense) => void
  deleteExpense: (id: string) => void
  saveRepair: (job: RepairJob) => void
  deleteRepair: (id: string) => void
  savePayment: (payment: Payment) => void
  deletePayment: (id: string) => void
  saveVehicle: (vehicle: Vehicle) => void
  deleteVehicle: (id: string) => boolean
  saveDriver: (driver: Driver) => void
  deleteDriver: (id: string) => boolean
  resetDemo: () => void
}

const DataContext = createContext<DataApi | null>(null)

function isState(value: unknown): value is State {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<State>
  return (
    Array.isArray(record.vehicles) &&
    Array.isArray(record.drivers) &&
    Array.isArray(record.trips) &&
    Array.isArray(record.expenses) &&
    Array.isArray(record.repairs) &&
    Array.isArray(record.payments)
  )
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createSeed()
    const parsed: unknown = JSON.parse(raw)
    if (!isState(parsed)) return createSeed()
    return parsed
  } catch {
    return createSeed()
  }
}

function upsert<T extends { id: string }>(list: T[], item: T) {
  const index = list.findIndex((row) => row.id === item.id)
  if (index === -1) return [item, ...list]
  const next = list.slice()
  next[index] = item
  return next
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(loadState)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  function flash(message: string) {
    setNotice(message)
  }

  const api: DataApi = {
    state,
    notice,
    saveTrip(trip) {
      setState((current) => ({ ...current, trips: upsert(current.trips, trip) }))
      flash('Рейс сохранён')
    },
    deleteTrip(id) {
      setState((current) => ({
        ...current,
        trips: current.trips.filter((trip) => trip.id !== id),
        expenses: current.expenses.filter((expense) => expense.tripId !== id),
        payments: current.payments.filter((payment) => payment.tripId !== id),
      }))
      flash('Рейс удалён')
    },
    saveExpense(expense) {
      setState((current) => ({ ...current, expenses: upsert(current.expenses, expense) }))
      flash('Расход сохранён')
    },
    deleteExpense(id) {
      setState((current) => ({
        ...current,
        expenses: current.expenses.filter((expense) => expense.id !== id),
      }))
      flash('Расход удалён')
    },
    saveRepair(job) {
      setState((current) => ({ ...current, repairs: upsert(current.repairs, job) }))
      flash('Заявка в ремзону сохранена')
    },
    deleteRepair(id) {
      setState((current) => ({
        ...current,
        repairs: current.repairs.filter((job) => job.id !== id),
      }))
      flash('Заявка удалена')
    },
    savePayment(payment) {
      setState((current) => ({ ...current, payments: upsert(current.payments, payment) }))
      flash('Оплата сохранена')
    },
    deletePayment(id) {
      setState((current) => ({
        ...current,
        payments: current.payments.filter((payment) => payment.id !== id),
      }))
      flash('Оплата удалена')
    },
    saveVehicle(vehicle) {
      setState((current) => ({ ...current, vehicles: upsert(current.vehicles, vehicle) }))
      flash('Машина сохранена')
    },
    deleteVehicle(id) {
      if (state.trips.some((trip) => trip.vehicleId === id) || state.repairs.some((job) => job.vehicleId === id)) {
        flash('Нельзя удалить машину: она есть в рейсе или в ремзоне')
        return false
      }
      setState((current) => ({
        ...current,
        vehicles: current.vehicles.filter((vehicle) => vehicle.id !== id),
      }))
      flash('Машина удалена')
      return true
    },
    saveDriver(driver) {
      setState((current) => ({ ...current, drivers: upsert(current.drivers, driver) }))
      flash('Водитель сохранён')
    },
    deleteDriver(id) {
      if (state.trips.some((trip) => trip.driverId === id)) {
        flash('Нельзя удалить водителя: он назначен на рейс')
        return false
      }
      setState((current) => ({
        ...current,
        drivers: current.drivers.filter((driver) => driver.id !== id),
      }))
      flash('Водитель удалён')
      return true
    },
    resetDemo() {
      setState(createSeed())
      flash('Демо-данные восстановлены')
    },
  }

  return (
    <DataContext.Provider value={api}>
      {children}
      {notice ? (
        <div className="toast" role="status">
          {notice}
        </div>
      ) : null}
    </DataContext.Provider>
  )
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData вызван вне DataProvider')
  return context
}

export function uid(prefix: string) {
  const bytes = crypto.randomUUID().slice(0, 8)
  return `${prefix}_${bytes}`
}
