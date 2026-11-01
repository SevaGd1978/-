import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './auth'
import { unauthorized } from './session'
import type { Driver, Payment, RepairJob, State, Trip, TripExpense, Vehicle } from './types'

interface DataApi {
  state: State
  ready: boolean
  offline: boolean
  notice: string | null
  reload: () => Promise<void>
  saveTrip: (trip: Trip) => Promise<boolean>
  deleteTrip: (id: string) => Promise<boolean>
  saveExpense: (expense: TripExpense) => Promise<boolean>
  deleteExpense: (id: string) => Promise<boolean>
  saveRepair: (job: RepairJob) => Promise<boolean>
  deleteRepair: (id: string) => Promise<boolean>
  savePayment: (payment: Payment) => Promise<boolean>
  deletePayment: (id: string) => Promise<boolean>
  saveVehicle: (vehicle: Vehicle) => Promise<boolean>
  deleteVehicle: (id: string) => Promise<boolean>
  saveDriver: (driver: Driver) => Promise<boolean>
  deleteDriver: (id: string) => Promise<boolean>
  resetDemo: () => Promise<boolean>
}

const EMPTY: State = { vehicles: [], drivers: [], trips: [], expenses: [], repairs: [], payments: [], customers: [] }

const DataContext = createContext<DataApi | null>(null)

interface Snapshot {
  version: number
  state: State
}

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

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<Snapshot>
  return typeof record.version === 'number' && isState(record.state)
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [state, setState] = useState<State>(EMPTY)
  const [ready, setReady] = useState(false)
  const [offline, setOffline] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const versionRef = useRef(0)
  const epochRef = useRef(0)
  const readyRef = useRef(false)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(null), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  function flash(message: string) {
    setNotice(message)
  }

  const apply = useCallback((snapshot: Snapshot) => {
    versionRef.current = snapshot.version
    readyRef.current = true
    setState(snapshot.state)
    setReady(true)
    setOffline(false)
  }, [])

  const refresh = useCallback(async () => {
    const ticket = epochRef.current
    try {
      const response = await fetch('/api/state')
      if (response.status === 401) {
        unauthorized()
        return
      }
      if (!response.ok) throw new Error(String(response.status))
      const body: unknown = await response.json()
      if (ticket !== epochRef.current) return
      if (!isSnapshot(body)) throw new Error('bad')
      if (!readyRef.current || body.version !== versionRef.current) apply(body)
      else setOffline(false)
    } catch {
      if (ticket === epochRef.current) setOffline(true)
    }
  }, [apply])

  useEffect(() => {
    if (!user) {
      readyRef.current = false
      versionRef.current = 0
      setState(EMPTY)
      setReady(false)
      return
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 4000)
    return () => window.clearInterval(timer)
  }, [user, refresh])

  async function write(method: string, path: string, okMessage: string, body?: unknown) {
    epochRef.current += 1
    try {
      const response = await fetch(path, {
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const payload: unknown = await response.json().catch(() => null)
      epochRef.current += 1
      if (response.status === 401) {
        unauthorized()
        return false
      }
      if (!response.ok || !isSnapshot(payload)) {
        const error =
          payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
            ? payload.error
            : 'Не удалось записать в базу'
        flash(error)
        return false
      }
      apply(payload)
      flash(okMessage)
      return true
    } catch {
      epochRef.current += 1
      flash('Нет связи с базой')
      setOffline(true)
      return false
    }
  }

  const api: DataApi = {
    state,
    ready,
    offline,
    notice,
    reload: refresh,
    saveTrip: (trip) => write('POST', '/api/trips', 'Рейс сохранён', trip),
    deleteTrip: (id) => write('DELETE', `/api/trips/${id}`, 'Рейс удалён'),
    saveExpense: (expense) => write('POST', '/api/expenses', 'Расход сохранён', expense),
    deleteExpense: (id) => write('DELETE', `/api/expenses/${id}`, 'Расход удалён'),
    saveRepair: (job) => write('POST', '/api/repairs', 'Заявка в ремзону сохранена', job),
    deleteRepair: (id) => write('DELETE', `/api/repairs/${id}`, 'Заявка удалена'),
    savePayment: (payment) => write('POST', '/api/payments', 'Оплата сохранена', payment),
    deletePayment: (id) => write('DELETE', `/api/payments/${id}`, 'Оплата удалена'),
    saveVehicle: (vehicle) => write('POST', '/api/vehicles', 'Машина сохранена', vehicle),
    deleteVehicle: (id) => write('DELETE', `/api/vehicles/${id}`, 'Машина удалена'),
    saveDriver: (driver) => write('POST', '/api/drivers', 'Водитель сохранён', driver),
    deleteDriver: (id) => write('DELETE', `/api/drivers/${id}`, 'Водитель удалён'),
    resetDemo: () => write('POST', '/api/reset', 'Демо-данные восстановлены'),
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
