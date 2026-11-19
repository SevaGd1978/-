import { useMemo, useState } from 'react'
import { debtOf, isOverdue, legDebt, sumAmounts, tripTotalRate } from '../calc'
import {
  dateRu,
  money,
  payMethodLabel,
  todayIso,
  tons,
  tripStatusLabel,
  tripStatuses,
  tripTone,
} from '../format'
import { CopyTripDrawer, PaymentForm, TripForm } from '../forms'
import { RoadMap } from '../RoadMap'
import { useAuth } from '../auth'
import { federalLabel, legKey } from '../roads'
import {
  formatOdometer,
  paymentLegLabel,
  tripOdometerKm,
  tripRoadPairs,
  tripRouteKindLabel,
  tripRouteLabel,
} from '../tripRoute.ts'
import { tripRouteDetail } from '../tripRouteRoad.ts'
import { useData } from '../store'
import { useRoadRoutes } from '../useRoutes'
import type { Payment, Trip, TripStatus } from '../types'
import { Badge, ConfirmDialog, Drawer, Empty } from '../ui'

export function TripDetail({ id, onBack, onOpen }: { id: string; onBack: () => void; onOpen: (id: string) => void }) {
  const { state, saveTrip, deleteTrip, savePayment, deletePayment } = useData()
  const { can } = useAuth()
  const editTrip = can('trips')
  const editPayment = can('payments')
  const trip = state.trips.find((item) => item.id === id)
  const [editing, setEditing] = useState(false)
  const [copying, setCopying] = useState(false)
  const [paymentEditor, setPaymentEditor] = useState<Payment | 'new' | null>(null)
  const [confirm, setConfirm] = useState<{ text: string; confirmLabel: string; run: () => void } | null>(null)
  const routePairs = useMemo(() => (trip ? tripRoadPairs(trip) : []), [trip])
  const { routes, ready } = useRoadRoutes(routePairs)

  if (!trip) {
    return (
      <Empty title="Рейс не найден" text="Возможно, его уже удалили." />
    )
  }

  const vehicle = state.vehicles.find((item) => item.id === trip.vehicleId)
  const driver = state.drivers.find((item) => item.id === trip.driverId)
  const payments = state.payments
    .filter((payment) => payment.tripId === trip.id)
    .sort((a, b) => b.date.localeCompare(a.date))
  const paid = sumAmounts(payments)
  const debt = debtOf(trip, paid)
  const overdue = isOverdue(trip, debt, todayIso())
  const firstLeg = routePairs[0] ? routes[legKey(routePairs[0].from, routePairs[0].to)] : undefined
  const odometerRun = tripOdometerKm(trip)

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
          <button type="button" className="btn ghost" onClick={() => setCopying(true)}>
            Копировать
          </button>
        ) : null}
        {editTrip ? (
          <button
          type="button"
          className="btn danger"
          onClick={() =>
            setConfirm({
              text: `Удалить рейс ${trip.number}? Вместе с ним исчезнут оплаты (${payments.length}). Расходы машины останутся.`,
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
          <div className="route route-hero route-hero-long">
            <span className="route-text">{tripRouteLabel(trip)}</span>
          </div>
          <Badge tone={tripTone(trip.status)}>{tripStatusLabel[trip.status]}</Badge>
        </div>
        {(trip.routeKind ?? 'direct') !== 'direct' ? (
          <p className="muted">{tripRouteKindLabel(trip.routeKind ?? 'direct')}</p>
        ) : null}
        <p className="muted">
          {dateRu(trip.date)}
          {(trip.routeKind ?? 'direct') === 'round2'
            ? ` · плечо 1: ${trip.customer} · ${trip.cargo}${
                trip.customer2 || trip.cargo2 || trip.load2 || trip.unload2 || trip.rate2
                  ? ` · плечо 2: ${trip.customer2 || 'заказчик позже'} · ${trip.cargo2 || 'груз позже'}`
                  : ' · плечо 2 позже'
              }`
            : ` · ${trip.customer} · ${trip.cargo}`}
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
          По автодорогам: {tripRouteDetail(routes, ready, trip)}
          {federalLabel(firstLeg?.federalKm) ? ` · ${federalLabel(firstLeg?.federalKm)}` : ''}
        </p>
        <p className="muted">
          Одометр: погрузка {formatOdometer(trip.odometerLoad1)}, выгрузка {formatOdometer(trip.odometerUnload1)}
          {(trip.routeKind ?? 'direct') === 'round2' && (trip.load2 || trip.unload2 || trip.odometerLoad2 != null || trip.odometerUnload2 != null)
            ? ` · погрузка 2 ${formatOdometer(trip.odometerLoad2)}, выгрузка 2 ${formatOdometer(trip.odometerUnload2)}`
            : ''}
          {odometerRun != null ? ` · пробег ${odometerRun.toLocaleString('ru-RU')} км` : ''}
        </p>
        {firstLeg?.geometry ? <RoadMap geometry={firstLeg.geometry} /> : null}
        {firstLeg?.geometry ? (
          <p className="road-note">
            Карта первого плеча. Километраж по OpenStreetMap, © OpenStreetMap.
            {routePairs.length > 1 ? ` Всего плеч: ${routePairs.length}.` : ''}
          </p>
        ) : null}
      </section>

      <section className="econ">
        <article>
          <span>{(trip.routeKind ?? 'direct') === 'round2' ? 'Ставка всего' : 'Ставка'}</span>
          <strong className="num">{money(tripTotalRate(trip))}</strong>
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
      {(trip.routeKind ?? 'direct') === 'round2' ? (
        <p className="muted">
          Плечо 1 · {trip.customer}: ставка {money(trip.rate)}, оплачено{' '}
          {money(sumAmounts(payments.filter((payment) => (payment.leg ?? 0) === 1)))}, долг{' '}
          {money(legDebt(trip, 1, sumAmounts(payments.filter((payment) => (payment.leg ?? 0) === 1))))}
          {trip.payDue ? `, срок ${dateRu(trip.payDue)}` : ''}. Плечо 2 · {trip.customer2 || 'заказчик позже'}:
          ставка {trip.rate2 > 0 ? money(trip.rate2) : 'позже'}, оплачено{' '}
          {money(sumAmounts(payments.filter((payment) => (payment.leg ?? 0) === 2)))}, долг{' '}
          {money(legDebt(trip, 2, sumAmounts(payments.filter((payment) => (payment.leg ?? 0) === 2))))}
          {trip.payDue2 ? `, срок ${dateRu(trip.payDue2)}` : ''}.
        </p>
      ) : (
        <p className="muted">
          Срок оплаты: {trip.payDue ? dateRu(trip.payDue) : 'не задан'}. Топливо, Платон и платные дороги записываются
          отдельно, без машины. Суточные можно провести по машине или в общие расходы.
        </p>
      )}

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
                    <th>Плечо</th>
                    <th>Откуда</th>
                    <th className="num">Сумма</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{dateRu(payment.date)}</td>
                      <td>{(trip.routeKind ?? 'direct') === 'round2' ? paymentLegLabel(payment.leg ?? 0) : '—'}</td>
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

      {copying ? (
        <CopyTripDrawer
          source={trip}
          onClose={() => setCopying(false)}
          onSaved={(next) => {
            setCopying(false)
            onOpen(next.id)
          }}
        />
      ) : null}

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
                text: `Удалить рейс ${trip.number}? Вместе с ним исчезнут оплаты. Расходы машины останутся.`,
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
