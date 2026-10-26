import { useMemo, useState } from 'react'
import { debtOf, isOverdue, payMark, sumAmounts } from '../calc'
import {
  dateRu,
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
        const paid = sumAmounts(state.payments.filter((payment) => payment.tripId === trip.id))
        const debt = debtOf(trip, paid)
        return {
          trip,
          vehicle,
          driver,
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
