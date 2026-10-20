import { useState, type FormEvent } from 'react'
import { debtOf, nextTripNumber, parseMoney, parseOdometer, parseWeight, round2, sumAmounts } from './calc'
import {
  dateRu,
  expenseCategories,
  expenseCategoryLabel,
  money,
  payMethodLabel,
  payMethods,
  repairKindLabel,
  repairKinds,
  repairStatusLabel,
  repairStatuses,
  parkStatuses,
  todayIso,
  tripStatusLabel,
  tripStatuses,
  vehicleStatusLabel,
} from './format'
import { vehicleDuty } from './fleetStatus'
import { uid, useData } from './store'
import type { Driver, Payment, RepairJob, Trip, TripExpense, Vehicle } from './types'
import { Field, FormError, FormFooter } from './ui'

function vehicleOption(vehicle: Vehicle, trips: Trip[]) {
  const duty = vehicleDuty(vehicle.status, trips, vehicle.id)
  return `${vehicle.plate} · ${vehicle.model} · ${vehicleStatusLabel[duty]}`
}

function amountText(value: number) {
  return value ? String(value) : ''
}

export function TripForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Trip
  onSubmit: (trip: Trip) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { state } = useData()
  const [number, setNumber] = useState(initial?.number ?? nextTripNumber(state.trips))
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [from, setFrom] = useState(initial?.from ?? '')
  const [to, setTo] = useState(initial?.to ?? '')
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? '')
  const [driverId, setDriverId] = useState(initial?.driverId ?? '')
  const [customer, setCustomer] = useState(initial?.customer ?? '')
  const [cargo, setCargo] = useState(initial?.cargo ?? '')
  const [weight, setWeight] = useState(initial ? String(initial.weightTons || '') : '')
  const [rate, setRate] = useState(initial ? String(initial.rate) : '')
  const [payDue, setPayDue] = useState(initial?.payDue ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'planned')
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedRate = parseMoney(rate)
    const parsedWeight = parseWeight(weight)
    if (!number.trim() || !date || !from.trim() || !to.trim() || !customer.trim() || !cargo.trim()) {
      setError('Заполните номер, дату, маршрут, заказчика и груз.')
      return
    }
    if (!vehicleId || !driverId) {
      setError('Выберите машину и водителя. Их можно добавить в разделе «Парк».')
      return
    }
    if (parsedRate === null || parsedRate <= 0) {
      setError('Укажите ставку больше нуля.')
      return
    }
    if (parsedWeight === null) {
      setError('Вес укажите числом, например 18 или 12,5.')
      return
    }
    if (!tripStatuses.includes(status)) {
      setError('Выберите статус рейса.')
      return
    }
    onSubmit({
      id: initial?.id ?? uid('t'),
      number: number.trim(),
      date,
      from: from.trim(),
      to: to.trim(),
      vehicleId,
      driverId,
      customer: customer.trim(),
      cargo: cargo.trim(),
      weightTons: parsedWeight,
      rate: parsedRate,
      payDue,
      status,
      note: note.trim(),
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Номер рейса">
        <input value={number} onChange={(event) => setNumber(event.target.value)} autoFocus />
      </Field>
      <Field label="Дата выхода">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </Field>
      <Field label="Откуда">
        <input value={from} onChange={(event) => setFrom(event.target.value)} placeholder="Казань" />
      </Field>
      <Field label="Куда">
        <input value={to} onChange={(event) => setTo(event.target.value)} placeholder="Пермь" />
      </Field>
      <Field label="Машина">
        <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)}>
          <option value="">Выберите машину</option>
          {state.vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicleOption(vehicle, state.trips)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Водитель">
        <select value={driverId} onChange={(event) => setDriverId(event.target.value)}>
          <option value="">Выберите водителя</option>
          {state.drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Заказчик">
        <input value={customer} onChange={(event) => setCustomer(event.target.value)} />
      </Field>
      <Field label="Груз">
        <input value={cargo} onChange={(event) => setCargo(event.target.value)} />
      </Field>
      <Field label="Вес, т">
        <input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="18" />
      </Field>
      <Field label="Ставка, ₽">
        <input inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="86000" />
      </Field>
      <Field label="Срок оплаты">
        <input type="date" value={payDue} onChange={(event) => setPayDue(event.target.value)} />
      </Field>
      <Field label="Статус">
        <select value={status} onChange={(event) => setStatus(event.target.value as Trip['status'])}>
          {tripStatuses.map((item) => (
            <option key={item} value={item}>
              {tripStatusLabel[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Комментарий" wide>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <div className="wide">
        <FormError text={error} />
        <FormFooter onCancel={onCancel} onDelete={onDelete} />
      </div>
    </form>
  )
}

export function ExpenseForm({
  initial,
  fixedTripId,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: TripExpense
  fixedTripId?: string
  onSubmit: (expense: TripExpense) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { state } = useData()
  const [tripId, setTripId] = useState(initial?.tripId ?? fixedTripId ?? '')
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [category, setCategory] = useState(initial?.category ?? 'fuel')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [error, setError] = useState('')
  const lockedTrip = fixedTripId ? state.trips.find((trip) => trip.id === fixedTripId) : undefined

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseMoney(amount)
    if (!tripId) {
      setError('Выберите рейс.')
      return
    }
    if (!date) {
      setError('Укажите дату расхода.')
      return
    }
    if (parsed === null || parsed <= 0) {
      setError('Сумма расхода должна быть больше нуля.')
      return
    }
    onSubmit({
      id: initial?.id ?? uid('e'),
      tripId,
      date,
      category,
      amount: parsed,
      comment: comment.trim(),
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {lockedTrip ? (
        <Field label="Рейс" wide>
          <input value={`${lockedTrip.number} · ${lockedTrip.from} → ${lockedTrip.to}`} readOnly />
        </Field>
      ) : (
        <Field label="Рейс" wide>
          <select value={tripId} onChange={(event) => setTripId(event.target.value)} autoFocus>
            <option value="">Выберите рейс</option>
            {[...state.trips]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.number} · {trip.from} → {trip.to}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Field label="Дата">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </Field>
      <Field label="Категория">
        <select value={category} onChange={(event) => setCategory(event.target.value as TripExpense['category'])}>
          {expenseCategories.map((item) => (
            <option key={item} value={item}>
              {expenseCategoryLabel[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Сумма, ₽">
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus={Boolean(lockedTrip)} />
      </Field>
      <Field label="Комментарий" wide>
        <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="АЗС, литры, документ" />
      </Field>
      <div className="wide">
        <FormError text={error} />
        <FormFooter onCancel={onCancel} onDelete={onDelete} />
      </div>
    </form>
  )
}

export function RepairForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: RepairJob
  onSubmit: (job: RepairJob) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { state } = useData()
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? '')
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [kind, setKind] = useState(initial?.kind ?? 'repair')
  const [status, setStatus] = useState(initial?.status ?? 'queued')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [parts, setParts] = useState(initial ? amountText(initial.partsCost) : '')
  const [labor, setLabor] = useState(initial ? amountText(initial.laborCost) : '')
  const [odometer, setOdometer] = useState(initial?.odometer ? String(initial.odometer) : '')
  const [error, setError] = useState('')
  const partsValue = parseMoney(parts)
  const laborValue = parseMoney(labor)
  const preview =
    (parts.trim() ? partsValue ?? 0 : 0) + (labor.trim() ? laborValue ?? 0 : 0)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedParts = parts.trim() ? parseMoney(parts) : 0
    const parsedLabor = labor.trim() ? parseMoney(labor) : 0
    const parsedOdometer = parseOdometer(odometer)
    if (!vehicleId) {
      setError('Выберите машину.')
      return
    }
    if (!date || !description.trim()) {
      setError('Укажите дату и что нужно сделать.')
      return
    }
    if (parsedParts === null || parsedLabor === null) {
      setError('Стоимость запчастей и работы укажите числом. Пустое поле считается нулём.')
      return
    }
    if (round2(parsedParts + parsedLabor) <= 0) {
      setError('Сумма запчастей и работы должна быть больше нуля.')
      return
    }
    if (odometer.trim() && parsedOdometer === null) {
      setError('Пробег укажите целым числом километров.')
      return
    }
    onSubmit({
      id: initial?.id ?? uid('r'),
      vehicleId,
      date,
      kind,
      description: description.trim(),
      partsCost: parsedParts,
      laborCost: parsedLabor,
      status,
      odometer: parsedOdometer,
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Машина" wide>
        <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} autoFocus>
          <option value="">Выберите машину</option>
          {state.vehicles.map((vehicle) => (
            <option key={vehicle.id} value={vehicle.id}>
              {vehicleOption(vehicle, state.trips)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Дата">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </Field>
      <Field label="Вид работ">
        <select value={kind} onChange={(event) => setKind(event.target.value as RepairJob['kind'])}>
          {repairKinds.map((item) => (
            <option key={item} value={item}>
              {repairKindLabel[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Статус">
        <select value={status} onChange={(event) => setStatus(event.target.value as RepairJob['status'])}>
          {repairStatuses.map((item) => (
            <option key={item} value={item}>
              {repairStatusLabel[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Пробег, км">
        <input inputMode="numeric" value={odometer} onChange={(event) => setOdometer(event.target.value)} placeholder="Необязательно" />
      </Field>
      <Field label="Запчасти, ₽">
        <input inputMode="decimal" value={parts} onChange={(event) => setParts(event.target.value)} />
      </Field>
      <Field label="Работа, ₽">
        <input inputMode="decimal" value={labor} onChange={(event) => setLabor(event.target.value)} />
      </Field>
      <Field label="Что сделать" wide>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
      </Field>
      <p className="hint wide">Итого по заявке: {money(round2(preview))}</p>
      <div className="wide">
        <FormError text={error} />
        <FormFooter onCancel={onCancel} onDelete={onDelete} />
      </div>
    </form>
  )
}

export function PaymentForm({
  initial,
  fixedTripId,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Payment
  fixedTripId?: string
  onSubmit: (payment: Payment) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { state } = useData()
  const presetId = initial?.tripId ?? fixedTripId ?? ''
  const presetTrip = state.trips.find((item) => item.id === presetId)
  const presetDebt = presetTrip
    ? debtOf(
        presetTrip,
        sumAmounts(state.payments.filter((payment) => payment.tripId === presetTrip.id)),
      )
    : 0
  const [tripId, setTripId] = useState(presetId)
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [amount, setAmount] = useState(initial ? String(initial.amount) : presetDebt > 0 ? String(presetDebt) : '')
  const [method, setMethod] = useState(initial?.method ?? 'bank')
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? presetTrip?.customer ?? '')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [error, setError] = useState('')
  const trip = state.trips.find((item) => item.id === tripId)
  const paidOther = sumAmounts(
    state.payments.filter((payment) => payment.tripId === tripId && payment.id !== initial?.id),
  )
  const balance = trip ? debtOf({ ...trip, status: trip.status === 'cancelled' ? 'delivered' : trip.status }, paidOther) : 0
  const parsedAmount = parseMoney(amount)

  function chooseTrip(id: string) {
    setTripId(id)
    const next = state.trips.find((item) => item.id === id)
    if (next) setCounterparty(next.customer)
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseMoney(amount)
    if (!tripId || !trip) {
      setError('Выберите рейс.')
      return
    }
    if (!date || !counterparty.trim()) {
      setError('Укажите дату и от кого пришли деньги.')
      return
    }
    if (parsed === null || parsed <= 0) {
      setError('Сумма оплаты должна быть больше нуля.')
      return
    }
    onSubmit({
      id: initial?.id ?? uid('p'),
      tripId,
      date,
      amount: parsed,
      method,
      counterparty: counterparty.trim(),
      comment: comment.trim(),
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {fixedTripId && trip ? (
        <Field label="Рейс" wide>
          <input value={`${trip.number} · ${trip.from} → ${trip.to}`} readOnly />
        </Field>
      ) : (
        <Field label="Рейс" wide>
          <select value={tripId} onChange={(event) => chooseTrip(event.target.value)} autoFocus>
            <option value="">Выберите рейс</option>
            {[...state.trips]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.number} · {item.customer} · долг {money(debtOf(item, sumAmounts(state.payments.filter((payment) => payment.tripId === item.id))))}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Field label="Дата">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </Field>
      <Field label="Способ">
        <select value={method} onChange={(event) => setMethod(event.target.value as Payment['method'])}>
          {payMethods.map((item) => (
            <option key={item} value={item}>
              {payMethodLabel[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Сумма, ₽">
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus={Boolean(fixedTripId)} />
      </Field>
      <Field label="Плательщик">
        <input value={counterparty} onChange={(event) => setCounterparty(event.target.value)} />
      </Field>
      <Field label="Комментарий" wide>
        <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Счёт, аванс, акт" />
      </Field>
      {trip ? (
        <p className={`hint wide ${parsedAmount !== null && parsedAmount > balance ? 'hint-warn' : ''}`}>
          Ставка {money(trip.rate)}. Уже внесено без этой записи {money(paidOther)}. Остаток {money(balance)}.
          {trip.payDue ? ` Срок ${dateRu(trip.payDue)}.` : ''}
          {parsedAmount !== null && parsedAmount > balance ? ' Сумма больше остатка, получится переплата.' : ''}
          {trip.status === 'cancelled' ? ' Рейс отменён, долг по нему не копится.' : ''}
        </p>
      ) : null}
      <div className="wide">
        <FormError text={error} />
        <FormFooter onCancel={onCancel} onDelete={onDelete} />
      </div>
    </form>
  )
}

export function VehicleForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Vehicle
  onSubmit: (vehicle: Vehicle) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { state } = useData()
  const [plate, setPlate] = useState(initial?.plate ?? '')
  const [model, setModel] = useState(initial?.model ?? '')
  const [kind, setKind] = useState(initial?.kind ?? 'Фура')
  const [status, setStatus] = useState(initial?.status ?? 'available')
  const [error, setError] = useState('')
  const duty = initial ? vehicleDuty(status, state.trips, initial.id) : status

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!plate.trim() || !model.trim() || !kind.trim()) {
      setError('Укажите номер, модель и тип машины.')
      return
    }
    onSubmit({
      id: initial?.id ?? uid('v'),
      plate: plate.trim().toUpperCase(),
      model: model.trim(),
      kind: kind.trim(),
      status,
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Госномер" wide>
        <input value={plate} onChange={(event) => setPlate(event.target.value)} autoFocus placeholder="А123ВС 116" />
      </Field>
      <Field label="Модель">
        <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Volvo FH" />
      </Field>
      <Field label="Тип">
        <input value={kind} onChange={(event) => setKind(event.target.value)} placeholder="Фура" />
      </Field>
      <Field label="Статус в парке" wide>
        <select value={status} onChange={(event) => setStatus(event.target.value as Vehicle['status'])}>
          {parkStatuses.map((item) => (
            <option key={item} value={item}>
              {vehicleStatusLabel[item]}
            </option>
          ))}
        </select>
      </Field>
      {duty === 'on_trip' || duty === 'loading' ? (
        <p className="hint wide">
          Сейчас машина {vehicleStatusLabel[duty].toLowerCase()}. Это берётся из открытого рейса. Статус парка снова
          станет «{vehicleStatusLabel[status]}», когда рейс закроют или отменят.
        </p>
      ) : null}
      <div className="wide">
        <FormError text={error} />
        <FormFooter onCancel={onCancel} onDelete={onDelete} />
      </div>
    </form>
  )
}

export function DriverForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Driver
  onSubmit: (driver: Driver) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError('Укажите имя водителя.')
      return
    }
    onSubmit({
      id: initial?.id ?? uid('d'),
      name: name.trim(),
      phone: phone.trim(),
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Имя" wide>
        <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
      </Field>
      <Field label="Телефон" wide>
        <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+7 900 000-00-00" />
      </Field>
      <div className="wide">
        <FormError text={error} />
        <FormFooter onCancel={onCancel} onDelete={onDelete} />
      </div>
    </form>
  )
}
