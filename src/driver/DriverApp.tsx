import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { tripStatusLabel } from '../format'
import { tripRouteKindLabel, tripRouteLabel } from '../tripRoute'
import type { Trip, TripExpense } from '../types'
import {
  applyFuelLocal,
  applyOdometerLocal,
  clearDriverLocal,
  enqueue,
  isProbablyOffline,
  loadCache,
  loadCachedSession,
  loadQueue,
  newLocalId,
  ODOMETER_LABELS,
  overlayPending,
  removeQueueItem,
  saveCache,
  saveCachedSession,
  type DriverHome,
  type DriverSession,
  type OdometerField,
  type PendingItem,
} from './offline'

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
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const [pendingCount, setPendingCount] = useState(() => loadQueue().length)
  const [syncing, setSyncing] = useState(false)
  const [fromCache, setFromCache] = useState(false)

  const refreshPending = useCallback(() => setPendingCount(loadQueue().length), [])

  const applyHome = useCallback((body: DriverHome, opts?: { cache?: boolean; cached?: boolean }) => {
    setHome(body)
    setSession(body.vehicle)
    setFromCache(Boolean(opts?.cached))
    setSelectedTripId((current) => {
      if (current && body.trips.some((trip) => trip.id === current)) return current
      return body.activeTripId || body.trips[0]?.id || null
    })
    if (opts?.cache !== false) saveCache(body.vehicle, body)
  }, [])

  const loadHome = useCallback(async () => {
    try {
      const response = await fetch('/api/driver/home')
      if (!response.ok) {
        if (response.status === 401) {
          clearDriverLocal()
          setSession(null)
          setHome(null)
          return null
        }
        throw new Error('home')
      }
      // Рейсы приходят только из основной программы (их вносит менеджер).
      const body = overlayPending((await response.json()) as DriverHome)
      applyHome(body, { cached: false })
      refreshPending()
      return body
    } catch (error) {
      const cached = loadCache()
      if (cached) {
        const merged = overlayPending(cached.home)
        applyHome(merged, { cache: false, cached: true })
        setSession(cached.session)
        refreshPending()
        return merged
      }
      if (isProbablyOffline(error)) {
        setError('Нет сети и нет сохранённых данных на телефоне')
      }
      return null
    }
  }, [applyHome, refreshPending])

  const flushQueue = useCallback(async () => {
    if (!navigator.onLine) return
    const queue = loadQueue()
    if (!queue.length) {
      refreshPending()
      return
    }
    setSyncing(true)
    try {
      for (const item of queue) {
        const ok = await sendPending(item)
        if (!ok) break
        removeQueueItem(item.id)
      }
      await loadHome()
      refreshPending()
      if (!loadQueue().length) setNotice('Данные с телефона отправлены в программу')
    } finally {
      setSyncing(false)
      refreshPending()
    }
  }, [loadHome, refreshPending])

  useEffect(() => {
    function onOnline() {
      setOnline(true)
      void flushQueue()
      void loadHome()
    }
    function onOffline() {
      setOnline(false)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [flushQueue, loadHome])

  // Пока есть сеть — подтягиваем рейсы, которые менеджер завёл в основной программе.
  useEffect(() => {
    if (!session || !online) return
    const timer = window.setInterval(() => {
      void loadHome()
    }, 12_000)
    return () => window.clearInterval(timer)
  }, [session, online, loadHome])

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/driver/session')
        const body = await readJson(response)
        const next = body?.session as DriverSession | null | undefined
        if (next) {
          saveCachedSession(next)
          setSession(next)
          await loadHome()
          await flushQueue()
        } else {
          const cachedSession = loadCachedSession()
          const cached = loadCache()
          if (cachedSession && cached) {
            setSession(cachedSession)
            applyHome(cached.home, { cache: false, cached: true })
          }
        }
      } catch {
        const cachedSession = loadCachedSession()
        const cached = loadCache()
        if (cachedSession && cached) {
          setSession(cachedSession)
          applyHome(cached.home, { cache: false, cached: true })
          setError('')
        }
      } finally {
        setReady(true)
        refreshPending()
      }
    })()
  }, [applyHome, flushQueue, loadHome, refreshPending])

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
      await flushQueue()
    } catch (error) {
      setError(isProbablyOffline(error) ? 'Нет интернета — войдите, когда появится связь' : 'Не удалось войти')
    } finally {
      setBusy(false)
    }
  }

  async function logout() {
    try {
      await fetch('/api/driver/logout', { method: 'POST' })
    } catch {
      /* offline logout clears local only */
    }
    clearDriverLocal()
    setSession(null)
    setHome(null)
    setSelectedTripId(null)
    setPendingCount(0)
  }

  async function saveOdometerField(field: OdometerField, value: number | null) {
    if (!trip || !home || !session) return
    setBusy(true)
    setError('')
    setNotice('')
    const localHome = applyOdometerLocal(home, trip.id, field, value)
    applyHome(localHome)

    const pending: PendingItem = {
      id: newLocalId('odo'),
      type: 'odometer',
      tripId: trip.id,
      field,
      value,
      createdAt: new Date().toISOString(),
    }

    try {
      if (!navigator.onLine) throw new TypeError('offline')
      const response = await fetch('/api/driver/odometer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, [field]: value }),
      })
      const body = await readJson(response)
      if (!response.ok) {
        setError(typeof body?.error === 'string' ? body.error : 'Не удалось сохранить одометр')
        await loadHome()
        return
      }
      applyHome(body as unknown as DriverHome)
      setNotice(`${ODOMETER_LABELS[field].round}: сохранено`)
    } catch (error) {
      if (!isProbablyOffline(error)) {
        setError('Ошибка сохранения одометра')
        return
      }
      enqueue(pending)
      refreshPending()
      setNotice(`${ODOMETER_LABELS[field].round}: сохранено на телефоне, уйдёт при связи`)
    } finally {
      setBusy(false)
    }
  }

  async function saveFuel(amount: number, date: string, comment: string) {
    if (!trip || !home) return
    setBusy(true)
    setError('')
    setNotice('')
    const expenseId = newLocalId('e')
    const expense: TripExpense = {
      id: expenseId,
      vehicleId: '',
      tripId: trip.id,
      date,
      category: 'fuel',
      amount,
      vat: 0,
      comment: comment.trim() || 'Соляра, чек от водителя',
    }
    applyHome(applyFuelLocal(home, expense))

    const pending: PendingItem = {
      id: newLocalId('fuel'),
      type: 'fuel',
      tripId: trip.id,
      amount,
      date,
      comment: expense.comment,
      expenseId,
      createdAt: new Date().toISOString(),
    }

    try {
      if (!navigator.onLine) throw new TypeError('offline')
      const response = await fetch('/api/driver/fuel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tripId: trip.id, amount, date, comment: expense.comment, expenseId }),
      })
      const body = await readJson(response)
      if (!response.ok) {
        setError(typeof body?.error === 'string' ? body.error : 'Не удалось записать чек')
        await loadHome()
        return
      }
      applyHome(body as unknown as DriverHome)
      setNotice('Чек на соляру записан')
    } catch (error) {
      if (!isProbablyOffline(error)) {
        setError('Ошибка записи чека')
        return
      }
      enqueue(pending)
      refreshPending()
      setNotice('Чек сохранён на телефоне, уйдёт при связи')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) {
    return (
      <div className="mobile-shell">
        <p className="mobile-muted">Загрузка…</p>
      </div>
    )
  }

  if (!session || !home) {
    return (
      <div className="mobile-shell">
        <div className="mobile-brand">
          <strong>Путевой</strong>
          <span>Вход водителя по госномеру машины</span>
        </div>
        <LoginCard busy={busy} error={error} onSubmit={login} />
      </div>
    )
  }

  return (
    <div className="mobile-shell">
      <div className="mobile-brand">
        <strong>{session.plate}</strong>
        <span>
          {session.kind} · {session.model}
          {driverName ? ` · ${driverName}` : ''}
        </span>
      </div>
      <div className="mobile-status-row">
        <span className={online ? 'mobile-online' : 'mobile-offline'}>
          {online ? (syncing ? 'Синхронизация…' : 'Сеть есть') : 'Без сети — данные на телефоне'}
        </span>
        {pendingCount > 0 ? <span className="mobile-pending">В очереди: {pendingCount}</span> : null}
        {fromCache && online ? <span className="mobile-muted">Показан кэш, обновляем…</span> : null}
      </div>
      <div className="mobile-actions" style={{ marginBottom: 14 }}>
        <button type="button" className="mobile-btn ghost" onClick={() => void flushQueue()} disabled={!online || syncing}>
          Синхронизировать
        </button>
        <button type="button" className="mobile-btn ghost" onClick={() => void logout()}>
          Выйти
        </button>
      </div>
      {error ? <div className="mobile-error">{error}</div> : null}
      {notice ? <div className="mobile-ok">{notice}</div> : null}

      <section className="mobile-card">
        <h2>Рейсы машины</h2>
        <p className="mobile-muted">
          Рейсы появляются здесь после того, как менеджер заведёт их в основной программе на эту машину.
        </p>
        {home.trips.length === 0 ? (
          <p className="mobile-muted">Пока менеджер не назначил рейсов на эту машину.</p>
        ) : (
          <ul className="mobile-list">
            {home.trips.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => setSelectedTripId(item.id)}>
                  <div className="mobile-chip">{tripStatusLabel[item.status]}</div>
                  <strong>
                    {item.number} · {dateRu(item.date)}
                  </strong>
                  <div className="mobile-muted">{tripRouteLabel(item)}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {trip ? (
        <>
          <TripCard trip={trip} driverName={driverName} />
          <OdometerCard trip={trip} busy={busy} onSaveField={saveOdometerField} />
          <FuelCard fuel={fuel} busy={busy} onSave={saveFuel} />
        </>
      ) : null}
    </div>
  )
}

async function sendPending(item: PendingItem) {
  try {
    if (item.type === 'odometer') {
      const response = await fetch('/api/driver/odometer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tripId: item.tripId, [item.field]: item.value }),
      })
      if (response.status === 401) return false
      if (!response.ok) {
        // Конфликт порядка одометра — оставляем в очереди до правки
        return response.status >= 500
      }
      return true
    }
    const response = await fetch('/api/driver/fuel', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tripId: item.tripId,
        amount: item.amount,
        date: item.date,
        comment: item.comment,
        expenseId: item.expenseId,
      }),
    })
    if (response.status === 401) return false
    return response.ok || response.status === 409
  } catch {
    return false
  }
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
    <form className="mobile-card" onSubmit={submit}>
      <h2>Вход</h2>
      <p className="mobile-muted">Код выдаёт диспетчер в карточке машины (парк). Для демо: 1234.</p>
      {error ? <div className="mobile-error">{error}</div> : null}
      <label className="mobile-field">
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
      <label className="mobile-field">
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
      <div className="mobile-actions">
        <button type="submit" className="mobile-btn primary" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>
      </div>
    </form>
  )
}

function TripCard({ trip, driverName }: { trip: Trip; driverName: string }) {
  return (
    <section className="mobile-card">
      <div className="mobile-chip">{tripStatusLabel[trip.status]}</div>
      <h2>
        {trip.number} · {dateRu(trip.date)}
      </h2>
      <p>{tripRouteLabel(trip)}</p>
      <p className="mobile-muted">{tripRouteKindLabel(trip.routeKind ?? 'direct')}</p>
      <p>
        {trip.customer}
        {trip.cargo ? ` · ${trip.cargo}` : ''}
        {trip.weightTons ? ` · ${trip.weightTons} т` : ''}
      </p>
      {driverName ? <p className="mobile-muted">Водитель в рейсе: {driverName}</p> : null}
      {trip.note ? <p className="mobile-muted">{trip.note}</p> : null}
    </section>
  )
}

function OdometerCard({
  trip,
  busy,
  onSaveField,
}: {
  trip: Trip
  busy: boolean
  onSaveField: (field: OdometerField, value: number | null) => Promise<void>
}) {
  const kind = trip.routeKind ?? 'direct'
  const fields: OdometerField[] =
    kind === 'round2'
      ? ['odometerLoad1', 'odometerUnload1', 'odometerLoad2', 'odometerUnload2']
      : ['odometerLoad1', 'odometerUnload1']

  return (
    <section className="mobile-card">
      <h2>Одометр</h2>
      <p className="mobile-muted">Каждая строка сохраняется отдельно — на погрузке и на разгрузке.</p>
      {fields.map((field) => (
        <OdometerRow
          key={`${trip.id}-${field}`}
          label={kind === 'direct' ? ODOMETER_LABELS[field].direct : ODOMETER_LABELS[field].round}
          value={trip[field]}
          busy={busy}
          onSave={(value) => onSaveField(field, value)}
        />
      ))}
    </section>
  )
}

function OdometerRow({
  label,
  value,
  busy,
  onSave,
}: {
  label: string
  value: number | null
  busy: boolean
  onSave: (value: number | null) => Promise<void>
}) {
  const [text, setText] = useState(value == null ? '' : String(value))

  useEffect(() => {
    setText(value == null ? '' : String(value))
  }, [value])

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) {
      void onSave(null)
      return
    }
    const number = Number(trimmed.replace(/\s/g, ''))
    if (!Number.isFinite(number) || number < 0 || Math.floor(number) !== number) return
    void onSave(number)
  }

  return (
    <form className="mobile-odo-row" onSubmit={submit}>
      <label className="mobile-field">
        <span>{label}, км</span>
        <input inputMode="numeric" value={text} onChange={(event) => setText(event.target.value)} />
      </label>
      <button type="submit" className="mobile-btn primary" disabled={busy}>
        Сохранить
      </button>
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
    <section className="mobile-card">
      <h2>Чеки на соляру</h2>
      <p className="mobile-muted">Без сети чек остаётся на телефоне и уйдёт при появлении связи.</p>
      {fuel.length === 0 ? (
        <p className="mobile-muted">Пока нет записей.</p>
      ) : (
        <ul className="mobile-list">
          {fuel.map((item) => (
            <li key={item.id}>
              <div>
                <strong>
                  {money(item.amount)} · {dateRu(item.date)}
                </strong>
                <div className="mobile-muted">{item.comment || 'Соляра'}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={submit} style={{ marginTop: 12 }}>
        <div className="mobile-grid">
          <label className="mobile-field">
            <span>Сумма чека, ₽</span>
            <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <label className="mobile-field">
            <span>Дата</span>
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
        </div>
        <label className="mobile-field">
          <span>Комментарий</span>
          <input
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="АЗС, литры, номер чека"
          />
        </label>
        <div className="mobile-actions">
          <button type="submit" className="mobile-btn primary" disabled={busy}>
            Записать чек
          </button>
        </div>
      </form>
    </section>
  )
}
