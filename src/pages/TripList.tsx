import { useMemo, useState } from 'react'
import { debtOf, isOverdue, payMark, sumAmounts } from '../calc'
import {
  dateRu,
  kmReading,
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
import { useData } from '../store'
import { useRoadRoutes } from '../useRoutes'
import type { Trip, TripStatus } from '../types'
import { Badge, Drawer, Empty } from '../ui'

export function TripList({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, saveTrip } = useData()
  const { can } = useAuth()
  const allowed = can('trips')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<TripStatus | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const [copySource, setCopySource] = useState<Trip | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const today = todayIso()

  function beginCopy(trip: Trip) {
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
        const payments = state.payments.filter((payment) => payment.tripId === trip.id)
        const paid = sumAmounts(payments)
        const debt = debtOf(trip, paid)
        const paidOn = payments.reduce((latest, payment) => (payment.date > latest ? payment.date : latest), '')
        return {
          trip,
          vehicle,
          driver,
          paid,
          debt,
          paidOn,
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
          row.trip.odometerStart == null ? '' : String(row.trip.odometerStart),
          row.trip.odometerEnd == null ? '' : String(row.trip.odometerEnd),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(needle)
      })
  }, [query, state, status, today])

  const selected =
    selectedId === '' ? null : (rows.find((row) => row.trip.id === selectedId) ?? rows[0] ?? null)

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
            <div className="trip-sheet">
              <div className="trip-row trip-head">
                <span className="pay-col" title="Красный — не оплачен, жёлтый — частично, зелёный — оплачен">
                  <span className="sr">Оплата</span>
                </span>
                <span className="trip-cell">
                  <span className="trip-main">Дата</span>
                  <span className="trip-sub">Дата оплаты</span>
                </span>
                <span className="trip-cell">
                  <span className="trip-main">Номер</span>
                  <span className="trip-sub">Заказчик</span>
                </span>
                <span className="trip-cell">
                  <span className="trip-main">Маршрут</span>
                  <span className="trip-sub">Одометр, км</span>
                </span>
                <span className="trip-cell">
                  <span className="trip-main">Машина</span>
                  <span className="trip-sub">Сумма</span>
                </span>
                <span className="trip-cell">
                  <span className="trip-main">Водитель</span>
                  <span className="trip-sub">Оплачено</span>
                </span>
                <span className="trip-cell trip-money">
                  <span className="trip-main">Км</span>
                  <span className="trip-sub">%</span>
                </span>
                <span className="trip-cell">
                  <span className="trip-main">Состояние</span>
                  <span className="trip-sub">Срок</span>
                </span>
                <span className="trip-cell trip-money">
                  <span className="trip-main trip-blank" aria-hidden="true">
                    .
                  </span>
                  <span className="trip-sub">К оплате</span>
                </span>
              </div>
              {rows.map((row) => {
                const active = selected?.trip.id === row.trip.id
                const route = `${row.trip.from} — ${row.trip.to}`
                const vehicleTitle = row.vehicle ? `${row.vehicle.plate} · ${row.vehicle.model}` : undefined
                return (
                  <div
                    key={row.trip.id}
                    className={row.trip.status === 'cancelled' ? 'trip-row trip-pair is-cancelled' : 'trip-row trip-pair'}
                    aria-selected={active}
                    onClick={() => setSelectedId(row.trip.id)}
                    onDoubleClick={() => onOpen(row.trip.id)}
                  >
                    <span className="pay-col">
                      <PayDot status={row.trip.status} rate={row.trip.rate} paid={row.paid} />
                    </span>
                    <span className="trip-cell">
                      <span className="trip-main">{dateRu(row.trip.date)}</span>
                      <span className="trip-sub pay-when" title={row.paidOn ? 'Дата последнего поступления' : 'Оплат ещё нет'}>
                        {row.paidOn ? dateRu(row.paidOn) : '—'}
                      </span>
                    </span>
                    <span className="trip-cell">
                      <button
                        type="button"
                        className="linkish trip-no trip-main"
                        onClick={(event) => {
                          event.stopPropagation()
                          onOpen(row.trip.id)
                        }}
                      >
                        {row.trip.number}
                      </button>
                      <span className="trip-sub trip-clip" title={row.trip.customer}>
                        {row.trip.customer}
                      </span>
                    </span>
                    <span className="trip-cell">
                      <span className="trip-main trip-clip" title={route}>
                        {route}
                      </span>
                      <span className="trip-sub trip-odo" title="Показание одометра в начале и в конце рейса">
                        <span>{kmReading(row.trip.odometerStart)}</span>
                        <span className="trip-odo-arrow" aria-hidden="true">
                          →
                        </span>
                        <span>{kmReading(row.trip.odometerEnd)}</span>
                      </span>
                    </span>
                    <span className="trip-cell">
                      <span className="trip-main trip-clip" title={vehicleTitle}>
                        {row.vehicle?.plate || '—'}
                      </span>
                      <span className="trip-sub num">{money(row.trip.rate)}</span>
                    </span>
                    <span className="trip-cell">
                      <span className="trip-main trip-clip" title={row.driver?.name}>
                        {row.driver?.name || '—'}
                      </span>
                      <span className="trip-sub num">{money(row.paid)}</span>
                    </span>
                    <span className="trip-cell trip-money">
                      <span className="trip-main num">{roadKm(routes[legKey(row.trip.from, row.trip.to)], ready)}</span>
                      <span className="trip-sub num">{payPercent(row.trip.rate, row.paid)}</span>
                    </span>
                    <span className="trip-cell">
                      <Badge tone={tripTone(row.trip.status)}>{tripStatusLabel[row.trip.status]}</Badge>
                      <span className={row.overdue ? 'trip-sub is-overdue' : 'trip-sub'}>
                        {row.trip.payDue ? dateRu(row.trip.payDue) : '—'}
                      </span>
                    </span>
                    <span className={row.debt > 0 ? 'trip-cell trip-money is-overdue' : 'trip-cell trip-money'}>
                      <span className="trip-main trip-blank" aria-hidden="true">
                        .
                      </span>
                      <span className="trip-sub num">{money(row.debt)}</span>
                    </span>
                  </div>
                )
              })}
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
                  odometerStart={selected.trip.odometerStart}
                  odometerEnd={selected.trip.odometerEnd}
                  rate={selected.trip.rate}
                  paid={selected.paid}
                  debt={selected.debt}
                  status={selected.trip.status}
                  onOpen={() => onOpen(selected.trip.id)}
                  onCopy={allowed ? () => beginCopy(selected.trip) : undefined}
                />
              </>
            ) : (
              <p className="muted">Выберите рейс в списке.</p>
            )}
          </aside>
        </div>
      )}
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
  odometerStart,
  odometerEnd,
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
  odometerStart: number | null
  odometerEnd: number | null
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
        <div>
          <dt>Одометр</dt>
          <dd>
            {kmReading(odometerStart)} → {kmReading(odometerEnd)}
          </dd>
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
