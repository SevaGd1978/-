import { useMemo, useState } from 'react'
import { debtOf, isOverdue, sumAmounts } from '../calc'
import { dateRu, money, todayIso, tons, tripStatusLabel, tripStatuses, tripTone } from '../format'
import { TripForm } from '../forms'
import { useData } from '../store'
import type { TripStatus } from '../types'
import { Badge, Drawer, Empty } from '../ui'

export function TripList({ onOpen }: { onOpen: (id: string) => void }) {
  const { state, saveTrip } = useData()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<TripStatus | 'all'>('all')
  const [creating, setCreating] = useState(false)
  const today = todayIso()

  const cards = useMemo(() => {
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
        <button type="button" className="btn primary" onClick={() => setCreating(true)}>
          Новый рейс
        </button>
      </div>
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
        Показано {cards.length} из {state.trips.length}
      </p>
      {cards.length === 0 ? (
        <Empty title="Рейсов не найдено" text="Измените фильтр или создайте новый рейс." />
      ) : (
        <div className="trip-grid">
          {cards.map((row) => (
            <article key={row.trip.id} className={row.trip.status === 'cancelled' ? 'trip-card is-cancelled' : 'trip-card'}>
              <button type="button" className="stretch" onClick={() => onOpen(row.trip.id)} aria-label={`Открыть рейс ${row.trip.number}`}>
                <div className="card-top">
                  <span className="trip-no">{row.trip.number}</span>
                  <Badge tone={tripTone(row.trip.status)}>{tripStatusLabel[row.trip.status]}</Badge>
                </div>
                <div className="muted">{dateRu(row.trip.date)}</div>
                <div className="route">
                  <span>{row.trip.from}</span>
                  <span className="route-line" />
                  <span>{row.trip.to}</span>
                </div>
                <div className="muted">
                  {row.vehicle ? `${row.vehicle.model} · ${row.vehicle.plate}` : 'Машина не указана'}
                  {' · '}
                  {row.driver?.name ?? 'Водитель не указан'}
                </div>
                <div>
                  {row.trip.cargo}
                  {row.trip.weightTons ? ` · ${tons(row.trip.weightTons)}` : ''} · {row.trip.customer}
                </div>
                <div className="money-row">
                  <div>
                    <span>Ставка</span>
                    <strong className="num">{money(row.trip.rate)}</strong>
                  </div>
                  <div>
                    <span>Расходы</span>
                    <strong className="num">{money(row.expenses)}</strong>
                  </div>
                  <div>
                    <span>Долг</span>
                    <strong className="num">{money(row.debt)}</strong>
                  </div>
                </div>
                {row.overdue ? <div className="overdue-line">Оплата просрочена с {dateRu(row.trip.payDue)}</div> : null}
              </button>
            </article>
          ))}
        </div>
      )}
      {creating ? (
        <Drawer title="Новый рейс" onClose={() => setCreating(false)}>
          <TripForm
            onCancel={() => setCreating(false)}
            onSubmit={(trip) => {
              saveTrip(trip)
              setCreating(false)
            }}
          />
        </Drawer>
      ) : null}
    </div>
  )
}
