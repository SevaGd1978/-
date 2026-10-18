import { useMemo, useState } from 'react'
import { debtOf, inPeriod, isOverdue, repairCost, sumAmounts } from '../calc'
import {
  currentPeriod,
  dateRu,
  expenseCategories,
  expenseCategoryLabel,
  money,
  periodTitle,
  repairKinds,
  repairKindLabel,
  todayIso,
  tripStatusLabel,
  tripTone,
  tripsAwaitingPayment,
} from '../format'
import { useData } from '../store'
import { Badge, Empty } from '../ui'

export function Dashboard({ onOpenTrip }: { onOpenTrip: (id: string) => void }) {
  const { state } = useData()
  const [period, setPeriod] = useState(currentPeriod())
  const today = todayIso()

  const periods = useMemo(() => {
    const keys = new Set<string>([currentPeriod()])
    for (const trip of state.trips) keys.add(trip.date.slice(0, 7))
    for (const expense of state.expenses) keys.add(expense.date.slice(0, 7))
    for (const job of state.repairs) keys.add(job.date.slice(0, 7))
    for (const payment of state.payments) keys.add(payment.date.slice(0, 7))
    return [...keys].sort().reverse()
  }, [state])

  const rows = state.trips.map((trip) => {
    const expenses = sumAmounts(state.expenses.filter((expense) => expense.tripId === trip.id))
    const paid = sumAmounts(state.payments.filter((payment) => payment.tripId === trip.id))
    const debt = debtOf(trip, paid)
    return { trip, expenses, paid, debt, overdue: isOverdue(trip, debt, today) }
  })

  const debtNow = sumAmounts(rows.map((row) => ({ amount: row.debt })))
  const debtTrips = rows.filter((row) => row.debt > 0).length
  const onRoad = state.trips.filter((trip) => trip.status === 'in_transit' || trip.status === 'loading').length
  const tripSpend = sumAmounts(state.expenses.filter((expense) => inPeriod(expense.date, period)))
  const workshop = sumAmounts(
    state.repairs.filter((job) => inPeriod(job.date, period)).map((job) => ({ amount: repairCost(job) })),
  )
  const received = sumAmounts(state.payments.filter((payment) => inPeriod(payment.date, period)))
  const result = received - tripSpend - workshop

  const active = rows
    .filter((row) => row.trip.status === 'planned' || row.trip.status === 'loading' || row.trip.status === 'in_transit')
    .sort((a, b) => a.trip.date.localeCompare(b.trip.date))

  const byCustomer = new Map<string, number>()
  for (const row of rows) {
    if (row.debt <= 0) continue
    byCustomer.set(row.trip.customer, (byCustomer.get(row.trip.customer) ?? 0) + row.debt)
  }
  const customers = [...byCustomer.entries()].sort((a, b) => b[1] - a[1])

  const byCategory = expenseCategories
    .map((category) => ({
      category,
      amount: sumAmounts(
        state.expenses.filter((expense) => expense.category === category && inPeriod(expense.date, period)),
      ),
    }))
    .filter((row) => row.amount > 0)
  const categoryMax = Math.max(1, ...byCategory.map((row) => row.amount))

  const byRepair = repairKinds
    .map((kind) => ({
      kind,
      amount: sumAmounts(
        state.repairs
          .filter((job) => job.kind === kind && inPeriod(job.date, period))
          .map((job) => ({ amount: repairCost(job) })),
      ),
    }))
    .filter((row) => row.amount > 0)

  const recentPayments = [...state.payments]
    .filter((payment) => inPeriod(payment.date, period))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  return (
    <div className="stack">
      <div className="toolbar">
        <p className="muted toolbar-note">
          Долг считается по всем незакрытым суммам. Остальные карточки — {period === 'all' ? 'за всё время' : `за ${periodTitle(period).toLowerCase()}`}.
        </p>
        <select aria-label="Период" value={period} onChange={(event) => setPeriod(event.target.value)}>
          <option value="all">Всё время</option>
          {periods.map((item) => (
            <option key={item} value={item}>
              {periodTitle(item)}
            </option>
          ))}
        </select>
      </div>

      <section className="kpi-grid">
        <article className="kpi kpi-accent">
          <span>Долг сейчас</span>
          <strong className="num">{money(debtNow)}</strong>
          <em>{debtTrips === 0 ? 'Все рейсы оплачены' : tripsAwaitingPayment(debtTrips)}</em>
        </article>
        <article className="kpi">
          <span>Сейчас на линии</span>
          <strong className="num">{onRoad}</strong>
          <em>Погрузка и рейсы в пути</em>
        </article>
        <article className="kpi">
          <span>Получено</span>
          <strong className="num">{money(received)}</strong>
          <em>Оплаты за рейсы</em>
        </article>
        <article className="kpi">
          <span>Расходы рейсов</span>
          <strong className="num">{money(tripSpend)}</strong>
          <em>Топливо, дороги, суточные</em>
        </article>
        <article className="kpi">
          <span>Ремзона</span>
          <strong className="num">{money(workshop)}</strong>
          <em>Запчасти и работа</em>
        </article>
        <article className="kpi">
          <span>Результат</span>
          <strong className={result < 0 ? 'num neg' : 'num pos'}>{money(result)}</strong>
          <em>Получено минус рейсы и ремзона</em>
        </article>
      </section>

      <div className="dash-grid">
        <section className="card">
          <div className="section-head">
            <h2>Активные рейсы</h2>
          </div>
          {active.length === 0 ? (
            <Empty title="Нет рейсов в работе" text="Запланированные, на погрузке и в пути появятся здесь." />
          ) : (
            active.map((row) => (
              <button key={row.trip.id} type="button" className="mini" onClick={() => onOpenTrip(row.trip.id)}>
                <div className="card-top">
                  <strong>{row.trip.number}</strong>
                  <Badge tone={tripTone(row.trip.status)}>{tripStatusLabel[row.trip.status]}</Badge>
                </div>
                <div>
                  {row.trip.from} → {row.trip.to}
                </div>
                <div className="muted">
                  {dateRu(row.trip.date)} · {row.trip.customer} · долг {money(row.debt)}
                  {row.overdue ? ' · просрочено' : ''}
                </div>
              </button>
            ))
          )}
        </section>

        <div className="stack">
          <section className="card">
            <div className="section-head">
              <h2>Кто должен</h2>
            </div>
            {customers.length === 0 ? (
              <Empty title="Долгов нет" />
            ) : (
              customers.map(([customer, amount]) => (
                <div key={customer} className="bar-row">
                  <span>{customer}</span>
                  <strong className="num">{money(amount)}</strong>
                </div>
              ))
            )}
          </section>

          <section className="card">
            <div className="section-head">
              <h2>Расходы рейсов</h2>
            </div>
            {byCategory.length === 0 ? (
              <Empty title="За период расходов нет" />
            ) : (
              byCategory.map((row) => (
                <div key={row.category} className="bar-row">
                  <span>{expenseCategoryLabel[row.category]}</span>
                  <div className="bar-track">
                    <div className="bar-fill" style={{ width: `${(row.amount / categoryMax) * 100}%` }} />
                  </div>
                  <strong className="num">{money(row.amount)}</strong>
                </div>
              ))
            )}
          </section>
        </div>
      </div>

      <div className="dash-grid">
        <section className="card">
          <div className="section-head">
            <h2>Последние оплаты</h2>
          </div>
          {recentPayments.length === 0 ? (
            <Empty title="Оплат за период нет" />
          ) : (
            recentPayments.map((payment) => {
              const trip = state.trips.find((item) => item.id === payment.tripId)
              return (
                <button key={payment.id} type="button" className="mini" onClick={() => trip && onOpenTrip(trip.id)}>
                  <div className="card-top">
                    <strong>{trip?.number ?? 'Рейс удалён'}</strong>
                    <span className="num">{money(payment.amount)}</span>
                  </div>
                  <div className="muted">
                    {dateRu(payment.date)} · {payment.counterparty}
                  </div>
                </button>
              )
            })
          )}
        </section>
        <section className="card">
          <div className="section-head">
            <h2>Ремзона по видам</h2>
          </div>
          {byRepair.length === 0 ? (
            <Empty title="Заявок за период нет" />
          ) : (
            byRepair.map((row) => (
              <div key={row.kind} className="bar-row">
                <span>{repairKindLabel[row.kind]}</span>
                <strong className="num">{money(row.amount)}</strong>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  )
}
