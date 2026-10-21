import { useState } from 'react'
import { debtOf, isOverdue, sumAmounts } from '../calc'
import { dateRu, money, payMethodLabel, todayIso } from '../format'
import { PaymentForm } from '../forms'
import { useAuth } from '../auth'
import { useData } from '../store'
import type { Payment } from '../types'
import { Badge, ConfirmDialog, Drawer, Empty } from '../ui'

export function PaymentsPage({ onOpenTrip }: { onOpenTrip: (id: string) => void }) {
  const { state, savePayment, deletePayment } = useData()
  const { can } = useAuth()
  const allowed = can('payments')
  const [onlyDebt, setOnlyDebt] = useState(true)
  const [editor, setEditor] = useState<{ payment?: Payment; tripId?: string } | null>(null)
  const [confirm, setConfirm] = useState<{ text: string; run: () => void } | null>(null)
  const today = todayIso()

  const tripRows = [...state.trips]
    .map((trip) => {
      const paid = sumAmounts(state.payments.filter((payment) => payment.tripId === trip.id))
      const debt = debtOf(trip, paid)
      return { trip, paid, debt, overdue: isOverdue(trip, debt, today) }
    })
    .filter((row) => (onlyDebt ? row.debt > 0 : true))
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1
      return (a.trip.payDue || '9999').localeCompare(b.trip.payDue || '9999')
    })

  const journal = [...state.payments].sort((a, b) => b.date.localeCompare(a.date))
  const debtTotal = sumAmounts(
    state.trips.map((trip) => ({
      amount: debtOf(
        trip,
        sumAmounts(state.payments.filter((payment) => payment.tripId === trip.id)),
      ),
    })),
  )

  return (
    <div className="stack">
      <section className="kpi-grid kpi-grid-compact">
        <article className="kpi kpi-accent">
          <span>К получению</span>
          <strong className="num">{money(debtTotal)}</strong>
          <em>По всем незакрытым рейсам</em>
        </article>
        <article className="kpi">
          <span>Записей об оплате</span>
          <strong className="num">{state.payments.length}</strong>
          <em>Авансы и закрывающие платежи</em>
        </article>
      </section>
      <div className="toolbar">
        <div className="chips">
          <button type="button" className="chip" aria-pressed={onlyDebt} onClick={() => setOnlyDebt(true)}>
            Только долги
          </button>
          <button type="button" className="chip" aria-pressed={!onlyDebt} onClick={() => setOnlyDebt(false)}>
            Все рейсы
          </button>
        </div>
        {allowed ? (
          <button type="button" className="btn primary" onClick={() => setEditor({})}>
            Принять оплату
          </button>
        ) : null}
      </div>
      {allowed ? null : <p className="hint">Просмотр. Принимать оплату может тот, у кого есть это право.</p>}

      <section className="card">
        <div className="section-head">
          <h2>Оплата за рейсы</h2>
        </div>
        {tripRows.length === 0 ? (
          <Empty title={onlyDebt ? 'Неоплаченных рейсов нет' : 'Рейсов нет'} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Рейс</th>
                  <th>Заказчик</th>
                  <th>Срок</th>
                  <th className="num">Ставка</th>
                  <th className="num">Оплачено</th>
                  <th className="num">Долг</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tripRows.map((row) => (
                  <tr key={row.trip.id}>
                    <td>
                      <button type="button" className="linkish" onClick={() => onOpenTrip(row.trip.id)}>
                        {row.trip.number}
                      </button>
                      <small className="muted">
                        {row.trip.from} → {row.trip.to}
                      </small>
                    </td>
                    <td>{row.trip.customer}</td>
                    <td>
                      {row.trip.payDue ? dateRu(row.trip.payDue) : '—'}
                      {row.overdue ? <Badge tone="bad">Просрочено</Badge> : null}
                    </td>
                    <td className="num">{money(row.trip.rate)}</td>
                    <td className="num">{money(row.paid)}</td>
                    <td className="num">{money(row.debt)}</td>
                    <td className="row-actions">
                      {allowed && row.trip.status !== 'cancelled' ? (
                        <button type="button" className="text-btn" onClick={() => setEditor({ tripId: row.trip.id })}>
                          Принять
                        </button>
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
          <h2>Журнал оплат</h2>
        </div>
        {journal.length === 0 ? (
          <Empty title="Оплат ещё не было" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Рейс</th>
                  <th>Плательщик</th>
                  <th>Способ</th>
                  <th className="num">Сумма</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {journal.map((payment) => {
                  const trip = state.trips.find((item) => item.id === payment.tripId)
                  return (
                    <tr key={payment.id}>
                      <td>{dateRu(payment.date)}</td>
                      <td>
                        {trip ? (
                          <button type="button" className="linkish" onClick={() => onOpenTrip(trip.id)}>
                            {trip.number}
                          </button>
                        ) : (
                          '—'
                        )}
                        {payment.comment ? <small className="muted">{payment.comment}</small> : null}
                      </td>
                      <td>{payment.counterparty}</td>
                      <td>{payMethodLabel[payment.method]}</td>
                      <td className="num">{money(payment.amount)}</td>
                      <td className="row-actions">
                        {allowed ? (
                          <>
                            <button type="button" className="text-btn" onClick={() => setEditor({ payment })}>
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="text-btn danger-text"
                              onClick={() =>
                                setConfirm({
                                  text: `Удалить оплату ${money(payment.amount)}?`,
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
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editor ? (
        <Drawer title={editor.payment ? 'Изменить оплату' : 'Оплата за рейс'} onClose={() => setEditor(null)}>
          <PaymentForm
            initial={editor.payment}
            fixedTripId={editor.payment ? undefined : editor.tripId}
            onCancel={() => setEditor(null)}
            onSubmit={async (payment) => {
              if (await savePayment(payment)) setEditor(null)
            }}
          />
        </Drawer>
      ) : null}
      {confirm ? (
        <ConfirmDialog
          text={confirm.text}
          confirmLabel="Удалить"
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
