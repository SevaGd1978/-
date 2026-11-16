import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { tripStatusLabel } from '../format'
import { tripRouteKindLabel, tripRouteLabel } from '../tripRoute'
import type { Trip, TripExpense } from '../types'

type DriverSession = {
  vehicleId: string
  plate: string
  model: string
  kind: string
}

type DriverHome = {
  vehicle: DriverSession
  activeTripId: string | null
  trips: Trip[]
  fuel: TripExpense[]
  drivers: Record<string, string>
}

function todayIso() {
  const now = new Date()
  const offset = now.getTimezoneOffset()
  const local = new Date(now.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 10)
}

function money(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`
}

function dateRu(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as Record<string, unknown> | null
}

export function DriverApp() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<DriverSession | null>(null)
  const [home, setHome] = useState<DriverHome | null>(null)
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const applyHome = useCallback((body: DriverHome) => {
    setHome(body)
    setSession(body.vehicle)
    setSelectedTripId((current) => {
      if (current && body.trips.some((trip) => trip.id === current)) return current
      return body.activeTripId || body.trips[0]?.id || null
    })
  }, [])

  const loadHome = useCallback(async () => {
    const response = await fetch('/api/driver/home')
    if (!response.ok) {
      setSession(null)
      setHome(null)
      return null
    }
    const body = (await response.json()) as DriverHome
    applyHome(body)
    return body
  }, [applyHome])

  useEffect(() => {
    void (async () => {
      const response = await fetch('/api/driver/session')
      const body = await readJson(response)
      const next = body?.session as DriverSession | null | undefined
      if (next) {
        setSession(next)
        await loadHome()
      }
      setReady(true)
    })()
  }, [loadHome])

  const trip = useMemo(
    () => home?.trips.find((item) => item.id === selectedTripId) || home?.trips[0] || null,
    [home, selectedTripId],
  )
  const fuel = useMemo(
    () => (trip ? home?.fuel.filter((item) => item.tripId === trip.id) || [] : []),
    [home, trip],
  )
  const driverName = trip ? home?.drivers[trip.driverId] || '' : ''

  async function login(plate: string, pin: string) {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/driver/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plate, pin }),
      })
      const body = await readJson(response)
      if (!response.ok) {
        setError(typeof body?.error === 'string' ? body.error : 'Не удалось войти')
        return
      }
      await loadHome()
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    await fetch('/api/driver/logout', { method: 'POST' })
    setSession(null)
    setHome(null)
    setSelectedTripId(null)
  }

  async function saveOdometer(fields: Record<string, number | null>) {
    if (!trip) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/driver/odometer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, ...fields }),
      })
      const body = await readJson(response)
      if (!response.ok) {
        setError(typeof body?.error === 'string' ? body.error : 'Не удалось сохранить одометр')
        return
      }
      applyHome(body as unknown as DriverHome)
      setNotice('Одометр сохранён')
    } finally {
      setBusy(false)
    }
  }

  async function saveFuel(amount: number, date: string, comment: string) {
    if (!trip) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await fetch('/api/driver/fuel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, amount, date, comment }),
      })
      const body = await readJson(response)
      if (!response.ok) {
        setError(typeof body?.error === 'string' ? body.error : 'Не удалось записать чек')
        return
      }
      applyHome(body as unknown as DriverHome)
      setNotice('Чек на соляру записан')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="driver-shell">
        <p className="driver-muted">Загрузка…</p>
      </div>
    )
  }

  if (!session || !home) {
    return (
      <div className="driver-shell">
        <div className="driver-brand">
          <strong>Путевой</strong>
          <span>Вход водителя по госномеру машины</span>
        </div>
        <LoginCard busy={busy} error={error} onSubmit={login} />
      </div>
    )
  }

  return (
    <div className="driver-shell">
      <div className="driver-brand">
        <strong>{session.plate}</strong>
        <span>
          {session.kind} · {session.model}
          {driverName ? ` · ${driverName}` : ''}
        </span>
      </div>
      <div className="driver-actions" style={{ marginBottom: 14 }}>
        <button type="button" className="driver-btn ghost" onClick={() => void logout()}>
          Выйти
        </button>
      </div>
      {error ? <div className="driver-error">{error}</div> : null}
      {notice ? <div className="driver-ok">{notice}</div> : null}

      <section className="driver-card">
        <h2>Рейсы машины</h2>
        {home.trips.length === 0 ? (
          <p className="driver-muted">Пока нет рейсов на эту машину.</p>
        ) : (
          <ul className="driver-list">
            {home.trips.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setSelectedTripId(item.id)}>
                  <div className="driver-chip">{tripStatusLabel[item.status]}</div>
                  <strong>
                    {item.number} · {dateRu(item.date)}
                  </strong>
                  <div className="driver-muted">{tripRouteLabel(item)}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {trip ? (
        <>
          <TripCard trip={trip} driverName={driverName} />
          <OdometerCard trip={trip} busy={busy} onSave={saveOdometer} />
          <FuelCard fuel={fuel} busy={busy} onSave={saveFuel} />
        </>
      ) : null}
    </div>
  )
}

function LoginCard({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean
  error: string
  onSubmit: (plate: string, pin: string) => Promise<void>
}) {
  const [plate, setPlate] = useState('')
  const [pin, setPin] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    void onSubmit(plate, pin)
  }

  return (
    <form className="driver-card" onSubmit={submit}>
      <h2>Вход</h2>
      <p className="driver-muted">Код выдаёт диспетчер в карточке машины (парк). Для демо: 1234.</p>
      {error ? <div className="driver-error">{error}</div> : null}
      <label className="driver-field">
        <span>Госномер</span>
        <input
          value={plate}
          onChange={(event) => setPlate(event.target.value)}
          placeholder="А123ВС 116"
          autoCapitalize="characters"
          autoComplete="username"
          required
        />
      </label>
      <label className="driver-field">
        <span>Код</span>
        <input
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="1234"
          inputMode="numeric"
          autoComplete="current-password"
          required
        />
      </label>
      <div className="driver-actions">
        <button type="submit" className="driver-btn primary" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </div>
    </form>
  )
}

function TripCard({ trip, driverName }: { trip: Trip; driverName: string }) {
  return (
    <section className="driver-card">
      <div className="driver-chip">{tripStatusLabel[trip.status]}</div>
      <h2>
        {trip.number} · {dateRu(trip.date)}
      </h2>
      <p>{tripRouteLabel(trip)}</p>
      <p className="driver-muted">{tripRouteKindLabel(trip.routeKind ?? 'direct')}</p>
      <p>
        {trip.customer}
        {trip.cargo ? ` · ${trip.cargo}` : ''}
        {trip.weightTons ? ` · ${trip.weightTons} т` : ''}
      </p>
      {driverName ? <p className="driver-muted">Водитель в рейсе: {driverName}</p> : null}
      {trip.note ? <p className="driver-muted">{trip.note}</p> : null}
    </section>
  )
}

function OdometerCard({
  trip,
  busy,
  onSave,
}: {
  trip: Trip
  busy: boolean
  onSave: (fields: Record<string, number | null>) => Promise<void>
}) {
  const kind = trip.routeKind ?? 'direct'
  const [load1, setLoad1] = useState(trip.odometerLoad1 == null ? '' : String(trip.odometerLoad1))
  const [unload1, setUnload1] = useState(trip.odometerUnload1 == null ? '' : String(trip.odometerUnload1))
  const [load2, setLoad2] = useState(trip.odometerLoad2 == null ? '' : String(trip.odometerLoad2))
  const [unload2, setUnload2] = useState(trip.odometerUnload2 == null ? '' : String(trip.odometerUnload2))

  useEffect(() => {
    setLoad1(trip.odometerLoad1 == null ? '' : String(trip.odometerLoad1))
    setUnload1(trip.odometerUnload1 == null ? '' : String(trip.odometerUnload1))
    setLoad2(trip.odometerLoad2 == null ? '' : String(trip.odometerLoad2))
    setUnload2(trip.odometerUnload2 == null ? '' : String(trip.odometerUnload2))
  }, [trip.id, trip.odometerLoad1, trip.odometerUnload1, trip.odometerLoad2, trip.odometerUnload2])

  function parseField(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return null
    const number = Number(trimmed.replace(/\s/g, ''))
    if (!Number.isFinite(number) || number < 0 || Math.floor(number) !== number) return undefined
    return number
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedLoad1 = parseField(load1)
    const parsedUnload1 = parseField(unload1)
    if (parsedLoad1 === undefined || parsedUnload1 === undefined) return
    const fields: Record<string, number | null> = {
      odometerLoad1: parsedLoad1,
      odometerUnload1: parsedUnload1,
    }
    if (kind === 'round2') {
      const parsedLoad2 = parseField(load2)
      const parsedUnload2 = parseField(unload2)
      if (parsedLoad2 === undefined || parsedUnload2 === undefined) return
      fields.odometerLoad2 = parsedLoad2
      fields.odometerUnload2 = parsedUnload2
    }
    void onSave(fields)
  }

  return (
    <form className="driver-card" onSubmit={submit}>
      <h2>Одометр</h2>
      <p className="driver-muted">Введите километраж на погрузке и выгрузке.</p>
      <div className="driver-grid">
        <label className="driver-field">
          <span>{kind === 'direct' ? 'Погрузка, км' : 'Погрузка 1, км'}</span>
          <input inputMode="numeric" value={load1} onChange={(event) => setLoad1(event.target.value)} />
        </label>
        <label className="driver-field">
          <span>{kind === 'direct' ? 'Выгрузка, км' : 'Выгрузка 1, км'}</span>
          <input inputMode="numeric" value={unload1} onChange={(event) => setUnload1(event.target.value)} />
        </label>
        {kind === 'round2' ? (
          <>
            <label className="driver-field">
              <span>Погрузка 2, км</span>
              <input inputMode="numeric" value={load2} onChange={(event) => setLoad2(event.target.value)} />
            </label>
            <label className="driver-field">
              <span>Выгрузка 2, км</span>
              <input inputMode="numeric" value={unload2} onChange={(event) => setUnload2(event.target.value)} />
            </label>
          </>
        ) : null}
      </div>
      <div className="driver-actions">
        <button type="submit" className="driver-btn primary" disabled={busy}>
          Сохранить одометр
        </button>
      </div>
    </form>
  )
}

function FuelCard({
  fuel,
  busy,
  onSave,
}: {
  fuel: TripExpense[]
  busy: boolean
  onSave: (amount: number, date: string, comment: string) => Promise<void>
}) {
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [comment, setComment] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = Number(amount.replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(value) || value <= 0) return
    void onSave(value, date, comment).then(() => {
      setAmount('')
      setComment('')
    })
  }

  return (
    <section className="driver-card">
      <h2>Чеки на соляру</h2>
      <p className="driver-muted">Сумма с чека АЗС по выбранному рейсу.</p>
      {fuel.length === 0 ? (
        <p className="driver-muted">Пока нет записей.</p>
      ) : (
        <ul className="driver-list">
          {fuel.map((item) => (
            <li key={item.id}>
              <div>
                <strong>
                  {money(item.amount)} · {dateRu(item.date)}
                </strong>
                <div className="driver-muted">{item.comment || 'Соляра'}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} style={{ marginTop: 12 }}>
        <div className="driver-grid">
          <label className="driver-field">
            <span>Сумма чека, ₽</span>
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <label className="driver-field">
            <span>Дата</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
        </div>
        <label className="driver-field">
          <span>Комментарий</span>
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="АЗС, литры, номер чека"
          />
        </label>
        <div className="driver-actions">
          <button type="submit" className="driver-btn primary" disabled={busy}>
            Записать чек
          </button>
        </div>
      </form>
    </section>
  )
}
