import { useMemo, useState } from 'react'
import { debtOf, isOverdue, sumAmounts } from '../calc'
import { dateRu, money, todayIso, tons, tripStatusLabel, tripStatuses, tripTone } from '../format'
import { TripForm } from '../forms'
import { useAuth } from '../auth'
import { useData } from '../store'
import type { TripStatus } from '../types'
import { Badge, Drawer, Empty } from '../ui'

export function TripList({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, saveTrip } = useData()
  const { can } = useAuth()
  const allowed = can('trips')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<TripStatus | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const today = todayIso()

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return [...state.trips]
      .sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number))
      .map((trip) => {
        const vehicle = state.vehicles.find((item) => item.id === trip.vehicleId)
        const driver = state.drivers.find((item) => item.id === trip.driverId)
        const expenses = sumAmounts(state.expenses.filter((expense) => expense.tripId === trip.id))
        const paid = sumAmounts(state.payments.filter((payment) => payment.tripId === trip.id))
        const debt = debtOf(trip, paid)
        return { trip, vehicle, driver, expenses, paid, debt, overdue: isOverdue(trip, debt, today) }
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
        {allowed ? (
          <button type="button" className="btn primary" onClick={() => setCreating(true)}>
            Новый рейс
          </button>
        ) : null}
      </div>
      {allowed ? null : <p className="hint">Просмотр. Менять рейсы может тот, у кого есть это право.</p>}
      <div className="chips">
        <button type="button" className="chip" aria-pressed={status === 'all'} onClick={() => setStatus('all')}>
          Все
        </button>
        {tripStatuses.map((item) => (
          <button
            key={item}
            type="button"
            className="chip"
            aria-pressed={status === item}
            onClick={() => setStatus(item)}
          >
            {tripStatusLabel[item]}
          </button>
        ))}
      </div>
      <p className="muted">
        Показано {rows.length} из {state.trips.length}
      </p>
      {rows.length === 0 ? (
        <Empty title="Рейсов не найдено" text="Измените фильтр или создайте новый рейс." />
      ) : (
        <section className="card">
          <div className="table-wrap">
            <table className="trip-list">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Рейс</th>
                  <th>Маршрут</th>
                  <th>Статус</th>
                  <th>Машина</th>
                  <th className="num">Ставка</th>
                  <th className="num">Расходы</th>
                  <th className="num">Долг</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.trip.id} className={row.trip.status === 'cancelled' ? 'is-cancelled' : undefined}>
                    <td>{dateRu(row.trip.date)}</td>
                    <td>
                      <button type="button" className="linkish trip-no" onClick={() => onOpen(row.trip.id)}>
                        {row.trip.number}
                      </button>
                    </td>
                    <td>
                      {row.trip.from} → {row.trip.to}
                      <small className="muted">
                        {row.trip.cargo}
                        {row.trip.weightTons ? ` · ${tons(row.trip.weightTons)}` : ''} · {row.trip.customer}
                      </small>
                    </td>
                    <td>
                      <Badge tone={tripTone(row.trip.status)}>{tripStatusLabel[row.trip.status]}</Badge>
                    </td>
                    <td>
                      {row.vehicle ? `${row.vehicle.model} · ${row.vehicle.plate}` : 'Машина не указана'}
                      <small className="muted">{row.driver?.name ?? 'Водитель не указан'}</small>
                    </td>
                    <td className="num">{money(row.trip.rate)}</td>
                    <td className="num">{money(row.expenses)}</td>
                    <td className="num">
                      {money(row.debt)}
                      {row.overdue ? <small className="overdue-line">с {dateRu(row.trip.payDue)}</small> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {creating ? (
        <Drawer title="Новый рейс" onClose={() => setCreating(false)}>
          <TripForm
            onCancel={() => setCreating(false)}
            onSubmit={async (trip) => {
              if (await saveTrip(trip)) setCreating(false)
            }}
          />
        </Drawer>
      ) : null}
    </div>
  )
}
