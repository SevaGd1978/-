import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { debtOf, expenseWithVat, isOverdue, parseMoney, payMark, sumAmounts, sumExpenses } from '../calc'
import {
  dateRu,
  expenseCategories,
  expenseCategoryLabel,
  expenseEntryHint,
  money,
  todayIso,
  tripStatusLabel,
  tripStatuses,
  tripTone,
} from '../format'
import { CopyTripDrawer, TripForm } from '../forms'
import { RoadMap } from '../RoadMap'
import { useAuth } from '../auth'
import { federalLabel, legKey, roadDetail, roadKm } from '../roads'
import { uid, useData } from '../store'
import { useRoadRoutes } from '../useRoutes'
import type { ExpenseCategory, Trip, TripExpense, TripStatus } from '../types'
import { Badge, ConfirmDialog, Drawer, Empty, ExpenseAmount } from '../ui'

export function TripList({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, saveTrip } = useData()
  const { can } = useAuth()
  const allowed = can('trips')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<TripStatus | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const [copySource, setCopySource] = useState<Trip | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [previewBox, setPreviewBox] = useState<{ top: number; left: number; width: number } | null>(null)
  const previewRow = useRef<HTMLTableRowElement | null>(null)
  const hidePreviewTimer = useRef<number | null>(null)
  const today = todayIso()

  function beginCopy(trip: Trip) {
    if (hidePreviewTimer.current) window.clearTimeout(hidePreviewTimer.current)
    setPreviewId(null)
    setPreviewBox(null)
    setCreating(false)
    setCopySource(trip)
  }
  const routePairs = useMemo(
    () => state.trips.map((trip) => ({ from: trip.from, to: trip.to })),
    [state.trips],
  )
  const { routes, ready } = useRoadRoutes(routePairs)

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...state.trips]
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
      .map((trip) => {
        const vehicle = state.vehicles.find((item) => item.id === trip.vehicleId)
        const driver = state.drivers.find((item) => item.id === trip.driverId)
        const tripExpenses = state.expenses.filter((expense) => expense.tripId === trip.id)
        const expenses = sumExpenses(tripExpenses)
        const paid = sumAmounts(state.payments.filter((payment) => payment.tripId === trip.id))
        const debt = debtOf(trip, paid)
        return {
          trip,
          vehicle,
          driver,
          expenses,
          expenseCount: tripExpenses.length,
          paid,
          debt,
          overdue: isOverdue(trip, debt, today),
        }
      })
      .filter((row) => (status === 'all' ? true : row.trip.status === status))
      .filter((row) => {
        if (!needle) return true
        const haystack = [
          row.trip.number,
          row.trip.from,
          row.trip.to,
          row.trip.customer,
          row.trip.cargo,
          row.driver?.name ?? '',
          row.vehicle?.plate ?? '',
          row.vehicle?.model ?? '',
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(needle)
      })
  }, [query, state, status, today])

  const selected =
    selectedId === '' ? null : (rows.find((row) => row.trip.id === selectedId) ?? rows[0] ?? null)
  const preview = rows.find((row) => row.trip.id === previewId) ?? null

  useEffect(() => {
    if (!previewId) return
    function place() {
      const row = previewRow.current
      if (!row) return
      const rect = row.getBoundingClientRect()
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        setPreviewId(null)
        return
      }
      setPreviewBox(previewBoxFor(rect))
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [previewId])

  useEffect(() => {
    return () => {
      if (hidePreviewTimer.current) window.clearTimeout(hidePreviewTimer.current)
    }
  }, [])

  function showPreview(id: string, row: HTMLTableRowElement) {
    if (hidePreviewTimer.current) window.clearTimeout(hidePreviewTimer.current)
    previewRow.current = row
    setPreviewId(id)
    setPreviewBox(previewBoxFor(row.getBoundingClientRect()))
  }

  function queueHidePreview() {
    if (hidePreviewTimer.current) window.clearTimeout(hidePreviewTimer.current)
    hidePreviewTimer.current = window.setTimeout(() => {
      setPreviewId(null)
      previewRow.current = null
    }, 160)
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <input
          className="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Номер, город, заказчик, машина"
          aria-label="Поиск рейсов"
        />
        <select
          className="toolbar-select"
          aria-label="Состояние рейса"
          value={status}
          onChange={(event) => setStatus(event.target.value as TripStatus | 'all')}
        >
          <option value="all">Все рейсы</option>
          {tripStatuses.map((item) => (
            <option key={item} value={item}>
              {tripStatusLabel[item]}
            </option>
          ))}
        </select>
        {allowed && selected ? (
          <button type="button" className="btn ghost" onClick={() => beginCopy(selected.trip)}>
            Копировать
          </button>
        ) : null}
        {allowed ? (
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              setCopySource(null)
              setCreating(true)
            }}
          >
            Новый рейс
          </button>
        ) : null}
      </div>
      {allowed ? null : <p className="hint">Просмотр. Менять рейсы может тот, у кого есть это право.</p>}
      <p className="muted">
        Показано {rows.length} из {state.trips.length}
      </p>
      {rows.length === 0 ? (
        <Empty title="Рейсов не найдено" text="Измените фильтр или создайте новый рейс." />
      ) : (
        <div className="trip-board">
          <section className="card">
            <div className="table-wrap">
              <table className="trip-sheet">
                <thead>
                  <tr>
                    <th className="pay-col" title="Красный — не оплачен, жёлтый — частично, зелёный — оплачен">
                      <span className="sr">Оплата</span>
                    </th>
                    <th>Дата</th>
                    <th>Номер</th>
                    <th>Маршрут</th>
                    <th>Машина</th>
                    <th>Водитель</th>
                    <th className="num">Км</th>
                    <th>Состояние</th>
                    <th>Заказчик</th>
                    <th className="num">Сумма</th>
                    <th className="num">Оплачено</th>
                    <th className="num">% оплаты</th>
                    <th>Дата оплаты</th>
                    <th className="num">К оплате</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const active = selected?.trip.id === row.trip.id
                    return (
                      <tr
                        key={row.trip.id}
                        className={row.trip.status === 'cancelled' ? 'is-cancelled' : undefined}
                        aria-selected={active}
                        onClick={() => setSelectedId(row.trip.id)}
                        onDoubleClick={() => onOpen(row.trip.id)}
                        onMouseEnter={(event) => showPreview(row.trip.id, event.currentTarget)}
                        onMouseLeave={queueHidePreview}
                      >
                        <td className="pay-col">
                          <PayDot status={row.trip.status} rate={row.trip.rate} paid={row.paid} />
                        </td>
                        <td>{dateRu(row.trip.date)}</td>
                        <td>
                          <button
                            type="button"
                            className="linkish trip-no"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpen(row.trip.id)
                            }}
                          >
                            {row.trip.number}
                          </button>
                        </td>
                        <td>
                          {row.trip.from} — {row.trip.to}
                        </td>
                        <td title={row.vehicle ? `${row.vehicle.plate} · ${row.vehicle.model}` : undefined}>
                          {row.vehicle?.plate || '—'}
                        </td>
                        <td>{row.driver?.name || '—'}</td>
                        <td className="num">{roadKm(routes[legKey(row.trip.from, row.trip.to)], ready)}</td>
                        <td>
                          <Badge tone={tripTone(row.trip.status)}>{tripStatusLabel[row.trip.status]}</Badge>
                        </td>
                        <td>{row.trip.customer}</td>
                        <td className="num">{money(row.trip.rate)}</td>
                        <td className="num">{money(row.paid)}</td>
                        <td className="num">{payPercent(row.trip.rate, row.paid)}</td>
                        <td className={row.overdue ? 'is-overdue' : undefined}>
                          {row.trip.payDue ? dateRu(row.trip.payDue) : '—'}
                        </td>
                        <td className={row.debt > 0 ? 'num is-overdue' : 'num'}>{money(row.debt)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <aside className="card trip-side" aria-label="Карточка рейса">
            {selected ? (
              <>
                <TripCard
                  number={selected.trip.number}
                  customer={selected.trip.customer}
                  route={`${selected.trip.from} — ${selected.trip.to}`}
                  distance={roadDetail(routes[legKey(selected.trip.from, selected.trip.to)], ready)}
                  federal={federalLabel(routes[legKey(selected.trip.from, selected.trip.to)]?.federalKm)}
                  geometry={routes[legKey(selected.trip.from, selected.trip.to)]?.geometry ?? null}
                  cargo={selected.trip.cargo}
                  vehicle={
                    selected.vehicle ? `${selected.vehicle.model} · ${selected.vehicle.plate}` : 'Машина не указана'
                  }
                  driver={selected.driver?.name ?? 'Водитель не указан'}
                  phone={selected.driver?.phone || 'Телефон не указан'}
                  rate={selected.trip.rate}
                  paid={selected.paid}
                  debt={selected.debt}
                  status={selected.trip.status}
                  onOpen={() => onOpen(selected.trip.id)}
                  onCopy={allowed ? () => beginCopy(selected.trip) : undefined}
                />
                <TripExpenses trip={selected.trip} total={selected.expenses} count={selected.expenseCount} />
              </>
            ) : (
              <p className="muted">Выберите рейс в списке.</p>
            )}
          </aside>
        </div>
      )}
      {preview && previewBox
        ? createPortal(
            <aside
              className="trip-preview"
              style={{ top: previewBox.top, left: previewBox.left, width: previewBox.width }}
              aria-label={`Предпросмотр ${preview.trip.number}`}
              onMouseEnter={() => {
                if (hidePreviewTimer.current) window.clearTimeout(hidePreviewTimer.current)
              }}
              onMouseLeave={queueHidePreview}
            >
              <TripCard
                number={preview.trip.number}
                customer={preview.trip.customer}
                route={`${preview.trip.from} — ${preview.trip.to}`}
                distance={roadDetail(routes[legKey(preview.trip.from, preview.trip.to)], ready)}
                federal={federalLabel(routes[legKey(preview.trip.from, preview.trip.to)]?.federalKm)}
                geometry={null}
                cargo={preview.trip.weightTons ? `${preview.trip.cargo} · ${preview.trip.weightTons} т` : preview.trip.cargo}
                vehicle={preview.vehicle ? `${preview.vehicle.model} · ${preview.vehicle.plate}` : 'Машина не указана'}
                driver={preview.driver?.name ?? 'Водитель не указан'}
                phone={preview.driver?.phone || 'Телефон не указан'}
                rate={preview.trip.rate}
                paid={preview.paid}
                debt={preview.debt}
                status={preview.trip.status}
                onOpen={() => onOpen(preview.trip.id)}
                onCopy={allowed ? () => beginCopy(preview.trip) : undefined}
              />
            </aside>,
            document.body,
          )
        : null}
      {creating ? (
        <Drawer title="Новый рейс" onClose={() => setCreating(false)}>
          <TripForm
            onCancel={() => setCreating(false)}
            onSubmit={async (trip) => {
              if (await saveTrip(trip)) {
                setSelectedId(trip.id)
                setCreating(false)
              }
            }}
          />
        </Drawer>
      ) : null}
      {copySource ? (
        <CopyTripDrawer
          source={copySource}
          onClose={() => setCopySource(null)}
          onSaved={(trip) => {
            setSelectedId(trip.id)
            setCopySource(null)
          }}
        />
      ) : null}
    </div>
  )
}

function previewBoxFor(rect: DOMRect) {
  const margin = 8
  const width = Math.min(340, window.innerWidth - margin * 2)
  const height = Math.min(560, window.innerHeight - margin * 2)
  let left = window.innerWidth - margin - width
  if (rect.right + margin + width <= window.innerWidth - margin) left = rect.right + margin
  let top = Math.min(rect.top, window.innerHeight - margin - height)
  if (top < margin) top = margin
  return { top, left, width }
}

function TripCard({
  number,
  customer,
  route,
  distance,
  federal,
  geometry,
  cargo,
  vehicle,
  driver,
  phone,
  rate,
  paid,
  debt,
  status,
  onOpen,
  onCopy,
}: {
  number: string
  customer: string
  route: string
  distance: string
  federal: string
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null
  cargo: string
  vehicle: string
  driver: string
  phone: string
  rate: number
  paid: number
  debt: number
  status: TripStatus
  onOpen: () => void
  onCopy?: () => void
}) {
  return (
    <>
      <div className="section-head">
        <h2>{number}</h2>
        <Badge tone={tripTone(status)}>{tripStatusLabel[status]}</Badge>
      </div>
      <dl className="trip-facts">
        <div>
          <dt>Заказчик</dt>
          <dd>{customer}</dd>
        </div>
        <div>
          <dt>Маршрут</dt>
          <dd>{route}</dd>
        </div>
        <div>
          <dt>Расстояние</dt>
          <dd>
            {distance}
            {federal ? <small className="muted">{federal}</small> : null}
          </dd>
        </div>
        {geometry ? <RoadMap geometry={geometry} /> : null}
        {geometry ? <p className="road-note">Километраж по автодорогам OpenStreetMap, карта © OpenStreetMap.</p> : null}
        <div>
          <dt>Груз</dt>
          <dd>{cargo}</dd>
        </div>
        <div>
          <dt>Машина</dt>
          <dd>{vehicle}</dd>
        </div>
        <div>
          <dt>Водитель</dt>
          <dd>{driver}</dd>
        </div>
        <div>
          <dt>Телефон</dt>
          <dd>{phone}</dd>
        </div>
      </dl>
      <ul className="trip-sums">
        <li>
          <span>Сумма</span>
          <strong className="num">{money(rate)}</strong>
        </li>
        <li>
          <span>Оплачено</span>
          <strong className="num">{money(paid)}</strong>
        </li>
        <li>
          <span>К оплате</span>
          <strong className="num">{money(debt)}</strong>
        </li>
      </ul>
      <div className="trip-actions">
        <button type="button" className="btn small" onClick={onOpen}>
          Открыть рейс
        </button>
        {onCopy ? (
          <button type="button" className="btn small" onClick={onCopy}>
            Копировать
          </button>
        ) : null}
      </div>
    </>
  )
}

function TripExpenses({ trip, total, count }: { trip: Trip; total: number; count: number }) {
  const { state, saveExpense, deleteExpense } = useData()
  const { can } = useAuth()
  const canEdit = can('expenses')
  const expenses = state.expenses
    .filter((expense) => expense.tripId === trip.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const [date, setDate] = useState(trip.date)
  const [category, setCategory] = useState<ExpenseCategory>('salary')
  const [amount, setAmount] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState<TripExpense | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDate(trip.date)
    setAmount('')
    setComment('')
    setError('')
  }, [trip.id, trip.date])

  async function add(event: FormEvent) {
    event.preventDefault()
    const parsed = parseMoney(amount)
    if (!date) {
      setError('Укажите дату расхода.')
      return
    }
    if (parsed === null || parsed <= 0) {
      setError('Сумма расхода должна быть больше нуля.')
      return
    }
    const saved = await saveExpense({
      id: uid('e'),
      tripId: trip.id,
      date,
      category,
      amount: parsed,
      comment: comment.trim(),
    })
    if (!saved) return
    setAmount('')
    setComment('')
    setError('')
    amountRef.current?.focus()
  }

  return (
    <div className="trip-expenses">
      <div className="section-head">
        <h3>Расходы по рейсу</h3>
        <span className="muted">{count === 0 ? 'Пока нет' : `${count} на ${money(total)}`}</span>
      </div>
      <p className="road-note">
        Платон пишется в расходы только за федеральные дороги из перечня Правительства: их километры × тариф. С 1 марта 2026 года это 5,19 ₽/км. Ко всем расходам, кроме топлива, добавляется НДС 22%.
      </p>
      {expenses.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Статья</th>
                <th className="num">Сумма</th>
                <th>Комментарий</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id}>
                  <td>{dateRu(expense.date)}</td>
                  <td>{expenseCategoryLabel[expense.category]}</td>
                  <td className="num">
                    <ExpenseAmount category={expense.category} amount={expense.amount} />
                  </td>
                  <td>{expense.comment || '—'}</td>
                  <td className="row-actions">
                    {canEdit ? (
                      <button type="button" className="text-btn danger-text" onClick={() => setPending(expense)}>
                        Удалить
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {canEdit ? (
        <form className="trip-expense-form" onSubmit={(event) => void add(event)}>
          <input type="date" value={date} aria-label="Дата расхода" onChange={(event) => setDate(event.target.value)} required />
          <select
            aria-label="Статья расхода"
            value={category}
            onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
          >
            {expenseCategories.map((item) => (
              <option key={item} value={item}>
                {expenseCategoryLabel[item]}
              </option>
            ))}
          </select>
          <input
            ref={amountRef}
            inputMode="decimal"
            value={amount}
            aria-label="Сумма расхода"
            placeholder={category === 'fuel' ? 'Сумма' : 'Сумма без НДС'}
            onChange={(event) => setAmount(event.target.value)}
          />
          <input
            value={comment}
            aria-label="Комментарий к расходу"
            placeholder={category === 'salary' ? 'Зарплата за рейс' : 'Комментарий'}
            onChange={(event) => setComment(event.target.value)}
          />
          <button type="submit" className="btn small primary">
            Добавить расход
          </button>
          <p className="hint">{expenseEntryHint(category, parseMoney(amount))}</p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="hint">Добавлять расходы может тот, у кого есть это право.</p>
      )}
      {pending ? (
        <ConfirmDialog
          text={`Удалить ${expenseCategoryLabel[pending.category].toLowerCase()} ${money(expenseWithVat(pending.category, pending.amount))}?`}
          confirmLabel="Удалить"
          onNo={() => setPending(null)}
          onYes={() => {
            void deleteExpense(pending.id)
            setPending(null)
          }}
        />
      ) : null}
    </div>
  )
}

const payDotLabel = {
  paid: 'Оплачен',
  partial: 'Оплачен частично',
  unpaid: 'Не оплачен',
  cancelled: 'Отменён',
} as const

function PayDot({ status, rate, paid }: { status: TripStatus; rate: number; paid: number }) {
  const mark = payMark(status, rate, paid)
  const label = payDotLabel[mark]
  return <span className={`pay-dot pay-dot-${mark}`} title={label} aria-label={label} />
}

function payPercent(rate: number, paid: number) {
  if (rate <= 0) return '—'
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format((paid / rate) * 100)
}
