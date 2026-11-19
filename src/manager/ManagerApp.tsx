import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { nextTripNumber, parseMoney, parseWeight } from '../calc'
import {
  currentPeriod,
  expenseCategories,
  expenseCategoryLabel,
  expenseSkipsVehicle,
  todayIso,
  tripStatusLabel,
  tripStatuses,
} from '../format'
import { buildReport, monthBounds, reportCatalog, type ReportKind } from '../reports/build'
import { uid, useData } from '../store'
import { finalizeTripRoute, tripRouteLabel, validateTripRoute } from '../tripRoute'
import type { ExpenseCategory, State, Trip, TripExpense, TripRouteKind, TripStatus } from '../types'

type Tab = 'trips' | 'expenses' | 'reports'

function dateRu(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function money(value: number) {
  return `${value.toLocaleString('ru-RU')} ₽`
}

function shiftMonth(period: string, delta: number) {
  const [year, month] = period.split('-').map(Number)
  const date = new Date(year, month - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function ManagerApp() {
  const { user, ready: authReady, can, login, logout } = useAuth()
  const { state, ready, offline, saveTrip, saveExpense } = useData()
  const [tab, setTab] = useState<Tab>('trips')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const availableTabs = useMemo(() => {
    const tabs: { id: Tab; label: string }[] = []
    if (can('trips')) tabs.push({ id: 'trips', label: 'Рейсы' })
    if (can('expenses')) tabs.push({ id: 'expenses', label: 'Расходы' })
    if (can('reports')) tabs.push({ id: 'reports', label: 'Отчёты' })
    return tabs
  }, [can])

  const activeTab = availableTabs.some((item) => item.id === tab) ? tab : availableTabs[0]?.id

  if (!authReady || (user && !ready)) {
    return (
      <div className="mobile-shell">
        <p className="mobile-muted">Загрузка…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mobile-shell">
        <div className="mobile-brand">
          <strong>Путевой</strong>
          <span>Менеджер и админ — рейсы, расходы, отчёты с телефона</span>
        </div>
        <LoginCard
          onLogin={async (username, password) => {
            setError('')
            const message = await login(username, password)
            if (message) setError(message)
          }}
          error={error}
        />
        <p className="mobile-muted" style={{ marginTop: 16 }}>
          Водитель: <a href="/driver.html">приложение по госномеру</a>
        </p>
      </div>
    )
  }

  if (!availableTabs.length) {
    return (
      <div className="mobile-shell">
        <div className="mobile-brand">
          <strong>{user.name}</strong>
          <span>Нет прав на рейсы, расходы или отчёты</span>
        </div>
        <button type="button" className="mobile-btn ghost" onClick={() => void logout()}>
          Выйти
        </button>
      </div>
    )
  }

  return (
    <div className="mobile-shell">
      <div className="mobile-brand">
        <strong>{user.name}</strong>
        <span>
          {user.username}
          {offline ? ' · нет сети' : ''}
        </span>
      </div>
      <div className="mobile-actions" style={{ marginBottom: 14 }}>
        <button type="button" className="mobile-btn ghost" onClick={() => void logout()}>
          Выйти
        </button>
      </div>
      {error ? <div className="mobile-error">{error}</div> : null}
      {notice ? <div className="mobile-ok">{notice}</div> : null}

      <div className="mobile-tabs">
        {availableTabs.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={activeTab === item.id}
            onClick={() => {
              setTab(item.id)
              setError('')
              setNotice('')
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === 'trips' ? (
        <TripsPanel
          state={state}
          onSave={async (trip) => {
            setError('')
            setNotice('')
            const ok = await saveTrip(trip)
            if (ok) setNotice('Рейс сохранён — появится у водителя этой машины')
            else setError('Не удалось сохранить рейс')
            return ok
          }}
        />
      ) : null}
      {activeTab === 'expenses' ? (
        <ExpensesPanel
          state={state}
          onSave={async (expense) => {
            setError('')
            setNotice('')
            const ok = await saveExpense(expense)
            if (ok) setNotice('Расход сохранён')
            else setError('Не удалось сохранить расход')
            return ok
          }}
        />
      ) : null}
      {activeTab === 'reports' ? (
        <ReportsPanel
          state={state}
          onNotice={setNotice}
          onError={setError}
        />
      ) : null}
    </div>
  )
}

function LoginCard({
  onLogin,
  error,
}: {
  onLogin: (username: string, password: string) => Promise<void>
  error: string
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await onLogin(username, password)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="mobile-card" onSubmit={(event) => void submit(event)}>
      <h2>Вход</h2>
      <p className="mobile-muted">Та же учётная запись, что в основной программе.</p>
      {error ? <div className="mobile-error">{error}</div> : null}
      <label className="mobile-field">
        <span>Логин</span>
        <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
      </label>
      <label className="mobile-field">
        <span>Пароль</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
          minLength={8}
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

function TripsPanel({
  state,
  onSave,
}: {
  state: State
  onSave: (trip: Trip) => Promise<boolean>
}) {
  const [editing, setEditing] = useState<Trip | 'new' | null>(null)
  const trips = useMemo(
    () => [...state.trips].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)).slice(0, 30),
    [state.trips],
  )

  return (
    <>
      <section className="mobile-card">
        <div className="mobile-actions" style={{ marginBottom: 8 }}>
          <button type="button" className="mobile-btn primary" onClick={() => setEditing('new')}>
            Новый рейс
          </button>
        </div>
        <p className="mobile-muted">После сохранения рейс увидит водитель выбранной машины.</p>
        {trips.length === 0 ? (
          <p className="mobile-muted">Рейсов пока нет.</p>
        ) : (
          <ul className="mobile-list">
            {trips.map((trip) => {
              const vehicle = state.vehicles.find((item) => item.id === trip.vehicleId)
              return (
                <li key={trip.id}>
                  <button type="button" onClick={() => setEditing(trip)}>
                    <div className="mobile-chip">{tripStatusLabel[trip.status]}</div>
                    <strong>
                      {trip.number} · {dateRu(trip.date)}
                    </strong>
                    <div className="mobile-muted">
                      {tripRouteLabel(trip)}
                      {vehicle ? ` · ${vehicle.plate}` : ''}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {editing ? (
        <MobileTripForm
          state={state}
          initial={editing === 'new' ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSubmit={async (trip) => {
            const ok = await onSave(trip)
            if (ok) setEditing(null)
          }}
        />
      ) : null}
    </>
  )
}

function MobileTripForm({
  state,
  initial,
  onSubmit,
  onCancel,
}: {
  state: State
  initial?: Trip
  onSubmit: (trip: Trip) => Promise<void>
  onCancel: () => void
}) {
  const [number, setNumber] = useState(initial?.number ?? nextTripNumber(state.trips))
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [routeKind, setRouteKind] = useState<TripRouteKind>(initial?.routeKind ?? 'direct')
  const [from, setFrom] = useState(initial?.from ?? '')
  const [to, setTo] = useState(initial?.to ?? '')
  const [load1, setLoad1] = useState(initial?.load1 ?? '')
  const [unload1, setUnload1] = useState(initial?.unload1 ?? '')
  const [load2, setLoad2] = useState(initial?.load2 ?? '')
  const [unload2, setUnload2] = useState(initial?.unload2 ?? '')
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? state.vehicles[0]?.id ?? '')
  const [driverId, setDriverId] = useState(initial?.driverId ?? state.drivers[0]?.id ?? '')
  const [customer, setCustomer] = useState(initial?.customer ?? '')
  const [cargo, setCargo] = useState(initial?.cargo ?? '')
  const [weight, setWeight] = useState(initial ? String(initial.weightTons || '') : '')
  const [rate, setRate] = useState(initial ? String(initial.rate) : '')
  const [customer2, setCustomer2] = useState(initial?.customer2 ?? '')
  const [cargo2, setCargo2] = useState(initial?.cargo2 ?? '')
  const [rate2, setRate2] = useState(initial?.rate2 ? String(initial.rate2) : '')
  const [status, setStatus] = useState<TripStatus>(initial?.status ?? 'planned')
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsedRate = parseMoney(rate)
    const parsedRate2 = parseMoney(rate2)
    const parsedWeight = parseWeight(weight)
    if (!number.trim() || !date || !customer.trim() || !cargo.trim()) {
      setError('Заполните номер, дату, заказчика и груз.')
      return
    }
    const routeError = validateTripRoute({ routeKind, from, to, load1, unload1, load2, unload2 })
    if (routeError) {
      setError(routeError)
      return
    }
    if (!vehicleId || !driverId) {
      setError('Выберите машину и водителя.')
      return
    }
    if (parsedRate === null || parsedRate <= 0) {
      setError('Укажите ставку больше нуля.')
      return
    }
    if (routeKind === 'round2' && rate2.trim() && (parsedRate2 === null || parsedRate2 < 0)) {
      setError('Ставку второго плеча укажите числом или оставьте пустой.')
      return
    }
    if (parsedWeight === null) {
      setError('Вес укажите числом.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit(
        finalizeTripRoute({
          id: initial?.id || uid('t'),
          number: number.trim(),
          date,
          from: from.trim(),
          to: to.trim(),
          routeKind,
          load1: load1.trim(),
          unload1: unload1.trim(),
          load2: load2.trim(),
          unload2: unload2.trim(),
          returnCity: '',
          odometerLoad1: initial?.odometerLoad1 ?? null,
          odometerUnload1: initial?.odometerUnload1 ?? null,
          odometerLoad2: initial?.odometerLoad2 ?? null,
          odometerUnload2: initial?.odometerUnload2 ?? null,
          vehicleId,
          driverId,
          customer: customer.trim(),
          cargo: cargo.trim(),
          weightTons: parsedWeight,
          rate: parsedRate,
          payDue: initial?.payDue ?? '',
          customer2: customer2.trim(),
          cargo2: cargo2.trim(),
          rate2: rate2.trim() ? parsedRate2 ?? 0 : 0,
          payDue2: initial?.payDue2 ?? '',
          status,
          note: note.trim(),
        }),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="mobile-card" onSubmit={(event) => void submit(event)}>
      <h2>{initial ? `Рейс ${initial.number}` : 'Новый рейс'}</h2>
      {error ? <div className="mobile-error">{error}</div> : null}
      <label className="mobile-field">
        <span>Номер</span>
        <input value={number} onChange={(event) => setNumber(event.target.value)} required />
      </label>
      <label className="mobile-field">
        <span>Дата</span>
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </label>
      <div className="mobile-chips">
        {(
          [
            ['direct', 'Прямой'],
            ['round1', 'Круг ×1'],
            ['round2', 'Круг ×2'],
          ] as const
        ).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={routeKind === value} onClick={() => setRouteKind(value)}>
            {label}
          </button>
        ))}
      </div>
      {routeKind === 'direct' ? (
        <div className="mobile-grid">
          <label className="mobile-field">
            <span>Откуда</span>
            <input value={from} onChange={(event) => setFrom(event.target.value)} required />
          </label>
          <label className="mobile-field">
            <span>Куда</span>
            <input value={to} onChange={(event) => setTo(event.target.value)} required />
          </label>
        </div>
      ) : (
        <>
          <div className="mobile-grid">
            <label className="mobile-field">
              <span>Погрузка 1</span>
              <input value={load1} onChange={(event) => setLoad1(event.target.value)} />
            </label>
            <label className="mobile-field">
              <span>Выгрузка 1</span>
              <input value={unload1} onChange={(event) => setUnload1(event.target.value)} />
            </label>
          </div>
          {routeKind === 'round2' ? (
            <div className="mobile-grid">
              <label className="mobile-field">
                <span>Погрузка 2</span>
                <input value={load2} onChange={(event) => setLoad2(event.target.value)} placeholder="можно позже" />
              </label>
              <label className="mobile-field">
                <span>Выгрузка 2</span>
                <input value={unload2} onChange={(event) => setUnload2(event.target.value)} placeholder="можно позже" />
              </label>
            </div>
          ) : null}
          <label className="mobile-field">
            <span>База выезда</span>
            <input value={from} onChange={(event) => setFrom(event.target.value)} required />
          </label>
        </>
      )}
      <label className="mobile-field">
        <span>Машина</span>
        <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} required>
          <option value="">Выберите</option>
          {state.vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicle.plate} · {vehicle.model}
            </option>
          ))}
        </select>
      </label>
      <label className="mobile-field">
        <span>Водитель</span>
        <select value={driverId} onChange={(event) => setDriverId(event.target.value)} required>
          <option value="">Выберите</option>
          {state.drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
      </label>
      <label className="mobile-field">
        <span>Заказчик</span>
        <input value={customer} onChange={(event) => setCustomer(event.target.value)} list="mobile-customers" required />
        <datalist id="mobile-customers">
          {state.customers.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </label>
      <label className="mobile-field">
        <span>Груз</span>
        <input value={cargo} onChange={(event) => setCargo(event.target.value)} required />
      </label>
      <div className="mobile-grid">
        <label className="mobile-field">
          <span>Вес, т</span>
          <input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} />
        </label>
        <label className="mobile-field">
          <span>{routeKind === 'round2' ? 'Ставка 1, ₽' : 'Ставка, ₽'}</span>
          <input inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} required />
        </label>
      </div>
      {routeKind === 'round2' ? (
        <>
          <label className="mobile-field">
            <span>Заказчик 2</span>
            <input value={customer2} onChange={(event) => setCustomer2(event.target.value)} placeholder="можно позже" />
          </label>
          <label className="mobile-field">
            <span>Груз 2</span>
            <input value={cargo2} onChange={(event) => setCargo2(event.target.value)} placeholder="можно позже" />
          </label>
          <label className="mobile-field">
            <span>Ставка 2, ₽</span>
            <input inputMode="decimal" value={rate2} onChange={(event) => setRate2(event.target.value)} placeholder="можно позже" />
          </label>
        </>
      ) : null}
      <label className="mobile-field">
        <span>Статус</span>
        <select value={status} onChange={(event) => setStatus(event.target.value as TripStatus)}>
          {tripStatuses.map((item) => (
            <option key={item} value={item}>
              {tripStatusLabel[item]}
            </option>
          ))}
        </select>
      </label>
      <label className="mobile-field">
        <span>Заметка</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="mobile-actions">
        <button type="button" className="mobile-btn ghost" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="mobile-btn primary" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить рейс'}
        </button>
      </div>
    </form>
  )
}

function ExpensesPanel({
  state,
  onSave,
}: {
  state: State
  onSave: (expense: TripExpense) => Promise<boolean>
}) {
  const [open, setOpen] = useState(false)
  const expenses = useMemo(
    () => [...state.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40),
    [state.expenses],
  )

  return (
    <>
      <section className="mobile-card">
        <div className="mobile-actions" style={{ marginBottom: 8 }}>
          <button type="button" className="mobile-btn primary" onClick={() => setOpen(true)}>
            Новый расход
          </button>
        </div>
        {expenses.length === 0 ? (
          <p className="mobile-muted">Расходов пока нет.</p>
        ) : (
          <ul className="mobile-list">
            {expenses.map((expense) => {
              const trip = state.trips.find((item) => item.id === expense.tripId)
              return (
                <li key={expense.id}>
                  <div>
                    <strong>
                      {money(expense.amount)} · {expenseCategoryLabel[expense.category]}
                    </strong>
                    <div className="mobile-muted">
                      {dateRu(expense.date)}
                      {trip ? ` · ${trip.number}` : ''}
                      {expense.comment ? ` · ${expense.comment}` : ''}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
      {open ? (
        <MobileExpenseForm
          state={state}
          onCancel={() => setOpen(false)}
          onSubmit={async (expense) => {
            const ok = await onSave(expense)
            if (ok) setOpen(false)
          }}
        />
      ) : null}
    </>
  )
}

function MobileExpenseForm({
  state,
  onSubmit,
  onCancel,
}: {
  state: State
  onSubmit: (expense: TripExpense) => Promise<void>
  onCancel: () => void
}) {
  const [category, setCategory] = useState<ExpenseCategory>('fuel')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayIso())
  const [tripId, setTripId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const skipVehicle = expenseSkipsVehicle(category)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseMoney(amount)
    if (parsed === null || parsed <= 0) {
      setError('Укажите сумму больше нуля.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit({
        id: uid('e'),
        vehicleId: skipVehicle ? '' : vehicleId,
        tripId,
        date,
        category,
        amount: parsed,
        vat: category === 'fuel' ? 0 : null,
        comment: comment.trim(),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="mobile-card" onSubmit={(event) => void submit(event)}>
      <h2>Новый расход</h2>
      {error ? <div className="mobile-error">{error}</div> : null}
      <label className="mobile-field">
        <span>Статья</span>
        <select value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)}>
          {expenseCategories.map((item) => (
            <option key={item} value={item}>
              {expenseCategoryLabel[item]}
            </option>
          ))}
        </select>
      </label>
      <div className="mobile-grid">
        <label className="mobile-field">
          <span>Сумма, ₽</span>
          <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </label>
        <label className="mobile-field">
          <span>Дата</span>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </label>
      </div>
      <label className="mobile-field">
        <span>Рейс</span>
        <select value={tripId} onChange={(event) => setTripId(event.target.value)}>
          <option value="">Без рейса</option>
          {state.trips
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 40)
            .map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.number} · {dateRu(trip.date)}
              </option>
            ))}
        </select>
      </label>
      {!skipVehicle ? (
        <label className="mobile-field">
          <span>Машина</span>
          <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
            <option value="">Без машины</option>
            {state.vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="mobile-field">
        <span>Комментарий</span>
        <input value={comment} onChange={(event) => setComment(event.target.value)} />
      </label>
      <div className="mobile-actions">
        <button type="button" className="mobile-btn ghost" onClick={onCancel}>
          Отмена
        </button>
        <button type="submit" className="mobile-btn primary" disabled={busy}>
          {busy ? 'Сохраняем…' : 'Сохранить расход'}
        </button>
      </div>
    </form>
  )
}

function ReportsPanel({
  state,
  onNotice,
  onError,
}: {
  state: State
  onNotice: (text: string) => void
  onError: (text: string) => void
}) {
  const initial = monthBounds(currentPeriod())
  const [kind, setKind] = useState<ReportKind>('summary')
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null)

  function setPreset(preset: 'month' | 'prev' | 'all') {
    if (preset === 'all') {
      setFrom('')
      setTo('')
      return
    }
    const bounds = monthBounds(preset === 'prev' ? shiftMonth(currentPeriod(), -1) : currentPeriod())
    setFrom(bounds.from)
    setTo(bounds.to)
  }

  async function exportReport(format: 'excel' | 'pdf') {
    if (from && to && from > to) {
      onError('Дата «с» позже даты «по».')
      return
    }
    setBusy(format)
    onError('')
    try {
      const report = buildReport(state, { kind, from, to })
      if (format === 'excel') {
        const { downloadExcel } = await import('../reports/excel')
        await downloadExcel(report)
        onNotice(`Excel: ${report.filename}.xlsx`)
      } else {
        const { downloadPdf } = await import('../reports/pdf')
        await downloadPdf(report)
        onNotice(`PDF: ${report.filename}.pdf`)
      }
    } catch (reason) {
      onError(reason instanceof Error && reason.message ? reason.message : 'Не удалось выгрузить отчёт')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="mobile-card">
      <h2>Отчёты</h2>
      <p className="mobile-muted">Соберите отчёт и выгрузите Excel или PDF на телефон.</p>
      <div className="mobile-chips">
        {reportCatalog.map((item) => (
          <button key={item.kind} type="button" aria-pressed={kind === item.kind} onClick={() => setKind(item.kind)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="mobile-chips">
        <button type="button" onClick={() => setPreset('month')}>
          Этот месяц
        </button>
        <button type="button" onClick={() => setPreset('prev')}>
          Прошлый
        </button>
        <button type="button" onClick={() => setPreset('all')}>
          Все даты
        </button>
      </div>
      <div className="mobile-grid">
        <label className="mobile-field">
          <span>С</span>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="mobile-field">
          <span>По</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
      </div>
      <div className="mobile-actions">
        <button type="button" className="mobile-btn primary" disabled={busy !== null} onClick={() => void exportReport('excel')}>
          {busy === 'excel' ? 'Excel…' : 'Выгрузить Excel'}
        </button>
        <button type="button" className="mobile-btn ghost" disabled={busy !== null} onClick={() => void exportReport('pdf')}>
          {busy === 'pdf' ? 'PDF…' : 'Выгрузить PDF'}
        </button>
      </div>
    </section>
  )
}
