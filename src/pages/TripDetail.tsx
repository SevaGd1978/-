import { useMemo, useState } from 'react'
import { debtOf, isOverdue, marginOf, sumAmounts } from '../calc'
import {
  dateRu,
  expenseCategoryLabel,
  money,
  payMethodLabel,
  todayIso,
  tons,
  tripStatusLabel,
  tripStatuses,
  tripTone,
} from '../format'
import { ExpenseForm, PaymentForm, TripForm } from '../forms'
import { RoadMap } from '../RoadMap'
import { useAuth } from '../auth'
import { legKey, roadDetail } from '../roads'
import { useData } from '../store'
import { useRoadRoutes } from '../useRoutes'
import type { Payment, Trip, TripExpense, TripStatus } from '../types'
import { Badge, ConfirmDialog, Drawer, Empty } from '../ui'

export function TripDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { state, saveTrip, deleteTrip, saveExpense, deleteExpense, savePayment, deletePayment } = useData()
  const { can } = useAuth()
  const editTrip = can('trips')
  const editExpense = can('expenses')
  const editPayment = can('payments')
  const trip = state.trips.find((item) => item.id === id)
  const [editing, setEditing] = useState(false)
  const [expenseEditor, setExpenseEditor] = useState<TripExpense | 'new' | null>(null)
  const [paymentEditor, setPaymentEditor] = useState<Payment | 'new' | null>(null)
  const [confirm, setConfirm] = useState<{ text: string; confirmLabel: string; run: () => void } | null>(null)
  const routePairs = useMemo(
    () => (trip ? [{ from: trip.from, to: trip.to }] : []),
    [trip],
  )
  const { routes, ready } = useRoadRoutes(routePairs)

  if (!trip) {
    return (
      <Empty title="Рейс не найден" text="Возможно, его уже удалили." />
    )
  }

  const vehicle = state.vehicles.find((item) => item.id === trip.vehicleId)
  const driver = state.drivers.find((item) => item.id === trip.driverId)
  const expenses = state.expenses
    .filter((expense) => expense.tripId === trip.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const payments = state.payments
    .filter((payment) => payment.tripId === trip.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const expenseTotal = sumAmounts(expenses)
  const paid = sumAmounts(payments)
  const debt = debtOf(trip, paid)
  const margin = marginOf(trip, expenseTotal)
  const overdue = isOverdue(trip, debt, todayIso())
  const leg = routes[legKey(trip.from, trip.to)]

  function changeStatus(status: TripStatus) {
    void saveTrip({ ...trip!, status })
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <button type="button" className="btn ghost" onClick={onBack}>
          К рейсам
        </button>
        {editTrip ? (
          <button type="button" className="btn ghost" onClick={() => setEditing(true)}>
            Редактировать
          </button>
        ) : null}
        {editTrip ? (
          <button
          type="button"
          className="btn danger"
          onClick={() =>
            setConfirm({
              text: `Удалить рейс ${trip.number}? Вместе с ним исчезнут расходы (${expenses.length}) и оплаты (${payments.length}).`,
              confirmLabel: 'Удалить',
              run: () => {
                void deleteTrip(trip.id).then((ok) => {
                  if (ok) onBack()
                })
              },
            })
          }
        >
          Удалить
        </button>
        ) : null}
      </div>

      <section className="card hero">
        <div className="card-top">
          <div className="route route-hero">
            <span>{trip.from}</span>
            <span className="route-line" />
            <span>{trip.to}</span>
          </div>
          <Badge tone={tripTone(trip.status)}>{tripStatusLabel[trip.status]}</Badge>
        </div>
        <p className="muted">
          {dateRu(trip.date)} · {trip.customer} · {trip.cargo}
          {trip.weightTons ? ` · ${tons(trip.weightTons)}` : ''}
        </p>
        <p>
          {vehicle ? `${vehicle.kind} ${vehicle.model}, ${vehicle.plate}` : 'Машина не найдена'}
          {' · '}
          {driver ? `${driver.name}${driver.phone ? `, ${driver.phone}` : ''}` : 'Водитель не найден'}
        </p>
        <label className="status-line">
          <span>Статус рейса</span>
          <select
            value={trip.status}
            disabled={!editTrip}
            onChange={(event) => changeStatus(event.target.value as TripStatus)}
          >
            {tripStatuses.map((item) => (
              <option key={item} value={item}>
                {tripStatusLabel[item]}
              </option>
            ))}
          </select>
        </label>
        {trip.note ? <p className="note">{trip.note}</p> : null}
        {trip.status === 'cancelled' ? (
          <p className="banner">Рейс отменён. Долг не начисляется, уже понесённые расходы остаются в учёте.</p>
        ) : null}
        {overdue ? <p className="banner banner-bad">Срок оплаты {dateRu(trip.payDue)} прошёл, к оплате {money(debt)}.</p> : null}
        <p>
          По автодорогам: {roadDetail(leg, ready)}
        </p>
        {leg?.geometry ? <RoadMap geometry={leg.geometry} /> : null}
        {leg?.geometry ? <p className="road-note">Километраж по автодорогам OpenStreetMap, карта © OpenStreetMap.</p> : null}
      </section>

      <section className="econ">
        <article>
          <span>Ставка</span>
          <strong className="num">{money(trip.rate)}</strong>
        </article>
        <article>
          <span>Расходы</span>
          <strong className="num">{money(expenseTotal)}</strong>
        </article>
        <article>
          <span>Оплачено</span>
          <strong className="num">{money(paid)}</strong>
        </article>
        <article className="is-debt">
          <span>К оплате</span>
          <strong className="num">{money(debt)}</strong>
        </article>
      </section>
      <p className="muted">
        Маржа по ставке {money(margin)} — ставка минус расходы этого рейса. Срок оплаты: {trip.payDue ? dateRu(trip.payDue) : 'не задан'}.
      </p>

      <div className="split">
        <section className="card">
          <div className="section-head">
            <h2>Расходы</h2>
            {editExpense ? (
              <button type="button" className="btn small primary" onClick={() => setExpenseEditor('new')}>
                Добавить расход
              </button>
            ) : null}
          </div>
          {expenses.length === 0 ? (
            <Empty title="Расходов пока нет" text="Топливо, зарплата, дороги и погрузка." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Статья</th>
                    <th className="num">Сумма</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr key={expense.id}>
                      <td>{dateRu(expense.date)}</td>
                      <td>
                        {expenseCategoryLabel[expense.category]}
                        {expense.comment ? <small className="muted">{expense.comment}</small> : null}
                      </td>
                      <td className="num">{money(expense.amount)}</td>
                      <td className="row-actions">
                        {editExpense ? (
                          <>
                            <button type="button" className="text-btn" onClick={() => setExpenseEditor(expense)}>
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="text-btn danger-text"
                              onClick={() =>
                                setConfirm({
                                  text: `Удалить расход ${money(expense.amount)}?`,
                                  confirmLabel: 'Удалить',
                                  run: () => void deleteExpense(expense.id),
                                })
                              }
                            >
                              Удалить
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="section-head">
            <h2>Оплаты</h2>
            {editPayment ? (
              <button type="button" className="btn small primary" onClick={() => setPaymentEditor('new')}>
                Принять оплату
              </button>
            ) : null}
          </div>
          {payments.length === 0 ? (
            <Empty title="Оплат пока нет" />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Откуда</th>
                    <th className="num">Сумма</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{dateRu(payment.date)}</td>
                      <td>
                        {payment.counterparty}
                        <small className="muted">
                          {payMethodLabel[payment.method]}
                          {payment.comment ? ` · ${payment.comment}` : ''}
                        </small>
                      </td>
                      <td className="num">{money(payment.amount)}</td>
                      <td className="row-actions">
                        {editPayment ? (
                          <>
                            <button type="button" className="text-btn" onClick={() => setPaymentEditor(payment)}>
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="text-btn danger-text"
                              onClick={() =>
                                setConfirm({
                                  text: `Удалить оплату ${money(payment.amount)}?`,
                                  confirmLabel: 'Удалить',
                                  run: () => void deletePayment(payment.id),
                                })
                              }
                            >
                              Удалить
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {editing ? (
        <Drawer title={`Рейс ${trip.number}`} onClose={() => setEditing(false)}>
          <TripForm
            initial={trip}
            onCancel={() => setEditing(false)}
            onSubmit={async (next: Trip) => {
              if (await saveTrip(next)) setEditing(false)
            }}
            onDelete={() =>
              setConfirm({
                text: `Удалить рейс ${trip.number}? Вместе с ним исчезнут расходы и оплаты.`,
                confirmLabel: 'Удалить',
                run: () => {
                  void deleteTrip(trip.id).then((ok) => {
                    if (ok) onBack()
                  })
                },
              })
            }
          />
        </Drawer>
      ) : null}

      {expenseEditor ? (
        <Drawer title={expenseEditor === 'new' ? 'Расход по рейсу' : 'Изменить расход'} onClose={() => setExpenseEditor(null)}>
          <ExpenseForm
            fixedTripId={trip.id}
            initial={expenseEditor === 'new' ? undefined : expenseEditor}
            onCancel={() => setExpenseEditor(null)}
            onSubmit={async (expense) => {
              if (await saveExpense(expense)) setExpenseEditor(null)
            }}
            onDelete={
              expenseEditor === 'new'
                ? undefined
                : () => {
                    const current = expenseEditor
                    setConfirm({
                      text: `Удалить расход ${money(current.amount)}?`,
                      confirmLabel: 'Удалить',
                      run: () => {
                        void deleteExpense(current.id).then((ok) => {
                          if (ok) setExpenseEditor(null)
                        })
                      },
                    })
                  }
            }
          />
        </Drawer>
      ) : null}

      {paymentEditor ? (
        <Drawer title={paymentEditor === 'new' ? 'Оплата за рейс' : 'Изменить оплату'} onClose={() => setPaymentEditor(null)}>
          <PaymentForm
            fixedTripId={trip.id}
            initial={paymentEditor === 'new' ? undefined : paymentEditor}
            onCancel={() => setPaymentEditor(null)}
            onSubmit={async (payment) => {
              if (await savePayment(payment)) setPaymentEditor(null)
            }}
            onDelete={
              paymentEditor === 'new'
                ? undefined
                : () => {
                    const current = paymentEditor
                    setConfirm({
                      text: `Удалить оплату ${money(current.amount)}?`,
                      confirmLabel: 'Удалить',
                      run: () => {
                        void deletePayment(current.id).then((ok) => {
                          if (ok) setPaymentEditor(null)
                        })
                      },
                    })
                  }
            }
          />
        </Drawer>
      ) : null}

      {confirm ? (
        <ConfirmDialog
          text={confirm.text}
          confirmLabel={confirm.confirmLabel}
          onNo={() => setConfirm(null)}
          onYes={() => {
            confirm.run()
            setConfirm(null)
          }}
        />
      ) : null}
    </div>
  )
}
