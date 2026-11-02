import { useState, type FormEvent } from 'react'
import {
  copiedTrip,
  debtOf,
  legDebt,
  nextTripNumber,
  parseMoney,
  parseOdometer,
  parseWeight,
  round2,
  sumAmounts,
  tripTotalRate,
} from './calc'
import {
  dateRu,
  expenseCategoryLabel,
  expenseEntryHint,
  expenseSkipsVehicle,
  vehicleExpenseCategories,
  money,
  payMethodLabel,
  payMethods,
  repairKindLabel,
  repairKinds,
  repairSkipsVehicle,
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
import type { Driver, Payment, PaymentLeg, RepairJob, Trip, TripExpense, TripRouteKind, Vehicle } from './types'
import { finalizeTripRoute, tripRouteKindLabel, tripRouteLabel, validateTripRoute } from './tripRoute.ts'
import { CityField } from './CityField'
import { CustomerField } from './CustomerField'
import { customerCatalog } from './customers'
import { Drawer, Field, FormError, FormFooter } from './ui'

function vehicleOption(vehicle: Vehicle, trips: Trip[]) {
  const duty = vehicleDuty(vehicle.status, trips, vehicle.id)
  return `${vehicle.plate} · ${vehicle.model} · ${vehicleStatusLabel[duty]}`
}

function amountText(value: number) {
  return value ? String(value) : ''
}

function odometerText(value: number | null | undefined) {
  return value != null && value > 0 ? String(value) : ''
}

function validateOdometerSequence(values: (number | null)[]) {
  const filled = values.filter((value): value is number => value != null)
  for (let index = 1; index < filled.length; index += 1) {
    if (filled[index] < filled[index - 1]) return 'Показания одометра должны расти по ходу рейса.'
  }
  return null
}

const routeKinds: TripRouteKind[] = ['direct', 'round1', 'round2']

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
  const [routeKind, setRouteKind] = useState<TripRouteKind>(initial?.routeKind ?? 'direct')
  const [from, setFrom] = useState(initial?.from ?? '')
  const [to, setTo] = useState(initial?.to ?? '')
  const [load1, setLoad1] = useState(initial?.load1 ?? '')
  const [unload1, setUnload1] = useState(initial?.unload1 ?? '')
  const [load2, setLoad2] = useState(initial?.load2 ?? '')
  const [unload2, setUnload2] = useState(initial?.unload2 ?? '')
  const [returnCity, setReturnCity] = useState(initial?.returnCity ?? '')
  const [odometerLoad1, setOdometerLoad1] = useState(odometerText(initial?.odometerLoad1))
  const [odometerUnload1, setOdometerUnload1] = useState(odometerText(initial?.odometerUnload1))
  const [odometerLoad2, setOdometerLoad2] = useState(odometerText(initial?.odometerLoad2))
  const [odometerUnload2, setOdometerUnload2] = useState(odometerText(initial?.odometerUnload2))
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? '')
  const [driverId, setDriverId] = useState(initial?.driverId ?? '')
  const [customer, setCustomer] = useState(initial?.customer ?? '')
  const [cargo, setCargo] = useState(initial?.cargo ?? '')
  const [weight, setWeight] = useState(initial ? String(initial.weightTons || '') : '')
  const [rate, setRate] = useState(initial ? String(initial.rate) : '')
  const [payDue, setPayDue] = useState(initial?.payDue ?? '')
  const [customer2, setCustomer2] = useState(initial?.customer2 ?? '')
  const [cargo2, setCargo2] = useState(initial?.cargo2 ?? '')
  const [rate2, setRate2] = useState(initial?.rate2 ? String(initial.rate2) : '')
  const [payDue2, setPayDue2] = useState(initial?.payDue2 ?? '')
  const [status, setStatus] = useState(initial?.status ?? 'planned')
  const [note, setNote] = useState(initial?.note ?? '')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedRate = parseMoney(rate)
    const parsedRate2 = parseMoney(rate2)
    const parsedWeight = parseWeight(weight)
    if (!number.trim() || !date || !customer.trim() || !cargo.trim()) {
      setError('Заполните номер, дату, заказчика и груз.')
      return
    }
    const routeError = validateTripRoute({
      routeKind,
      from,
      to,
      load1,
      unload1,
      load2,
      unload2,
    })
    if (routeError) {
      setError(routeError)
      return
    }
    const parsedOdo1 = parseOdometer(odometerLoad1)
    const parsedOdoU1 = parseOdometer(odometerUnload1)
    const parsedOdo2 = parseOdometer(odometerLoad2)
    const parsedOdoU2 = parseOdometer(odometerUnload2)
    if (odometerLoad1.trim() && parsedOdo1 === null) {
      setError('Одометр на погрузке укажите целым числом, км.')
      return
    }
    if (odometerUnload1.trim() && parsedOdoU1 === null) {
      setError('Одометр на выгрузке укажите целым числом, км.')
      return
    }
    if (routeKind === 'round2') {
      if (odometerLoad2.trim() && parsedOdo2 === null) {
        setError('Одометр на второй погрузке укажите целым числом, км.')
        return
      }
      if (odometerUnload2.trim() && parsedOdoU2 === null) {
        setError('Одометр на второй выгрузке укажите целым числом, км.')
        return
      }
    }
    const odoSeq =
      routeKind === 'round2'
        ? validateOdometerSequence([parsedOdo1, parsedOdoU1, parsedOdo2, parsedOdoU2])
        : validateOdometerSequence([parsedOdo1, parsedOdoU1])
    if (odoSeq) {
      setError(odoSeq)
      return
    }
    if (!vehicleId || !driverId) {
      setError('Выберите машину и водителя. Их можно добавить в разделе «Парк».')
      return
    }
    if (parsedRate === null || parsedRate <= 0) {
      setError(routeKind === 'round2' ? 'Укажите ставку первого плеча больше нуля.' : 'Укажите ставку больше нуля.')
      return
    }
    // Ставка / заказчик / груз плеча 2 необязательны — допишут позже.
    if (routeKind === 'round2' && rate2.trim() && (parsedRate2 === null || parsedRate2 < 0)) {
      setError('Ставку второго плеча укажите числом или оставьте пустой.')
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
    onSubmit(
      finalizeTripRoute({
        id: initial?.id || uid('t'),
        number: number.trim(),
        date,
        from: from.trim(),
        to: to.trim(),
        routeKind,
        load1: load1.trim(),
        unload1: unload1.trim(),
        load2: load2.trim(),
        unload2: unload2.trim(),
        returnCity: returnCity.trim(),
        odometerLoad1: parsedOdo1,
        odometerUnload1: parsedOdoU1,
        odometerLoad2: routeKind === 'round2' ? parsedOdo2 : null,
        odometerUnload2: routeKind === 'round2' ? parsedOdoU2 : null,
        vehicleId,
        driverId,
        customer: customer.trim(),
        cargo: cargo.trim(),
        weightTons: parsedWeight,
        rate: parsedRate,
        payDue,
        customer2: customer2.trim(),
        cargo2: cargo2.trim(),
        rate2: routeKind === 'round2' ? (rate2.trim() ? parsedRate2! : 0) : 0,
        payDue2: routeKind === 'round2' ? payDue2 : '',
        status,
        note: note.trim(),
      }),
    )
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Номер рейса">
        <input value={number} onChange={(event) => setNumber(event.target.value)} autoFocus />
      </Field>
      <Field label="Дата выхода">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </Field>
      <Field label="Тип маршрута" wide>
        <select value={routeKind} onChange={(event) => setRouteKind(event.target.value as TripRouteKind)}>
          {routeKinds.map((kind) => (
            <option key={kind} value={kind}>
              {tripRouteKindLabel(kind)}
            </option>
          ))}
        </select>
      </Field>
      {routeKind === 'direct' ? (
        <>
          <CityField label="Откуда" value={from} onChange={setFrom} placeholder="Казань" />
          <CityField label="Куда" value={to} onChange={setTo} placeholder="Пермь" />
          <Field label="Одометр на погрузке, км">
            <input
              inputMode="numeric"
              value={odometerLoad1}
              onChange={(event) => setOdometerLoad1(event.target.value)}
              placeholder="Необязательно"
            />
          </Field>
          <Field label="Одометр на выгрузке, км">
            <input
              inputMode="numeric"
              value={odometerUnload1}
              onChange={(event) => setOdometerUnload1(event.target.value)}
              placeholder="Необязательно"
            />
          </Field>
        </>
      ) : (
        <>
          <CityField label="База выезда" value={from} onChange={setFrom} placeholder="Казань" />
          <CityField label="Погрузка 1" value={load1} onChange={setLoad1} placeholder="Нижний Новгород" />
          <Field label="Одометр · погрузка 1, км">
            <input
              inputMode="numeric"
              value={odometerLoad1}
              onChange={(event) => setOdometerLoad1(event.target.value)}
              placeholder="Необязательно"
            />
          </Field>
          <CityField label="Выгрузка 1" value={unload1} onChange={setUnload1} placeholder="Самара" />
          <Field label="Одометр · выгрузка 1, км">
            <input
              inputMode="numeric"
              value={odometerUnload1}
              onChange={(event) => setOdometerUnload1(event.target.value)}
              placeholder="Необязательно"
            />
          </Field>
          {routeKind === 'round2' ? (
            <>
              <CityField label="Погрузка 2" value={load2} onChange={setLoad2} placeholder="Позже" />
              <Field label="Одометр · погрузка 2, км">
                <input
                  inputMode="numeric"
                  value={odometerLoad2}
                  onChange={(event) => setOdometerLoad2(event.target.value)}
                  placeholder="Необязательно"
                />
              </Field>
              <CityField label="Выгрузка 2" value={unload2} onChange={setUnload2} placeholder="Позже" />
              <Field label="Одометр · выгрузка 2, км">
                <input
                  inputMode="numeric"
                  value={odometerUnload2}
                  onChange={(event) => setOdometerUnload2(event.target.value)}
                  placeholder="Необязательно"
                />
              </Field>
            </>
          ) : null}
          <CityField
            label="Возврат на базу"
            value={returnCity}
            onChange={setReturnCity}
            placeholder={from.trim() || 'Как база выезда'}
          />
        </>
      )}
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
      {routeKind === 'round2' ? (
        <p className="hint wide">
          Плечо 1 — первая погрузка и выгрузка. Плечо 2 — вторая пара точек и отдельная оплата: города, заказчика,
          груз и ставку можно оставить пустыми и дописать позже.
        </p>
      ) : null}
      <CustomerField
        label={routeKind === 'round2' ? 'Заказчик · плечо 1' : 'Заказчик'}
        value={customer}
        onChange={setCustomer}
        catalog={customerCatalog(state.customers, state.trips)}
      />
      <Field label={routeKind === 'round2' ? 'Груз · плечо 1' : 'Груз'}>
        <input value={cargo} onChange={(event) => setCargo(event.target.value)} />
      </Field>
      <Field label="Вес, т">
        <input inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="18" />
      </Field>
      <Field label={routeKind === 'round2' ? 'Ставка · плечо 1, ₽' : 'Ставка, ₽'}>
        <input inputMode="decimal" value={rate} onChange={(event) => setRate(event.target.value)} placeholder="86000" />
      </Field>
      <Field label={routeKind === 'round2' ? 'Срок оплаты · плечо 1' : 'Срок оплаты'}>
        <input type="date" value={payDue} onChange={(event) => setPayDue(event.target.value)} />
      </Field>
      {routeKind === 'round2' ? (
        <>
          <CustomerField
            label="Заказчик · плечо 2"
            value={customer2}
            onChange={setCustomer2}
            catalog={customerCatalog(state.customers, state.trips)}
            placeholder="Можно позже"
          />
          <Field label="Груз · плечо 2">
            <input
              value={cargo2}
              onChange={(event) => setCargo2(event.target.value)}
              placeholder="Можно позже"
            />
          </Field>
          <Field label="Ставка · плечо 2, ₽">
            <input
              inputMode="decimal"
              value={rate2}
              onChange={(event) => setRate2(event.target.value)}
              placeholder="Можно позже"
            />
          </Field>
          <Field label="Срок оплаты · плечо 2">
            <input type="date" value={payDue2} onChange={(event) => setPayDue2(event.target.value)} />
          </Field>
        </>
      ) : null}
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

export function CopyTripDrawer({
  source,
  onClose,
  onSaved,
}: {
  source: Trip
  onClose: () => void
  onSaved: (trip: Trip) => void
}) {
  const { state, saveTrip } = useData()
  const draft = copiedTrip(source, state.trips, todayIso())
  return (
    <Drawer title={`Копия ${source.number}`} onClose={onClose}>
      <p className="hint">
        Новый рейс по образцу {source.number}: маршрут, заказчик, груз, машина, водитель и ставка. Номер {draft.number},
        дата сегодня, статус «Запланирован». Оплаты исходного рейса остаются на нём. Топливо, Платон и платные дороги
        записываются отдельно, без машины. Суточные и прочие затраты можно провести по машине или в общие расходы.
      </p>
      <TripForm
        initial={draft}
        onCancel={onClose}
        onSubmit={async (trip) => {
          if (await saveTrip(trip)) onSaved(trip)
        }}
      />
    </Drawer>
  )
}

export function ExpenseForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: TripExpense
  onSubmit: (expense: TripExpense) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const { state } = useData()
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId ?? '')
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [category, setCategory] = useState(
    initial?.category && !expenseSkipsVehicle(initial.category) ? initial.category : 'driver',
  )
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [vat, setVat] = useState(initial?.vat != null ? String(initial.vat) : '')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [error, setError] = useState('')
  const vehicles = [...state.vehicles].sort((a, b) => a.plate.localeCompare(b.plate, 'ru'))
  const shared = expenseSkipsVehicle(category)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsed = parseMoney(amount)
    if (!shared && !vehicleId) {
      setError('Выберите машину из парка.')
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
    const manual = vat.trim() === '' ? null : parseMoney(vat)
    if (manual === null && vat.trim() !== '') {
      setError('НДС укажите числом или оставьте поле пустым.')
      return
    }
    onSubmit({
      id: initial?.id ?? uid('e'),
      vehicleId: shared ? '' : vehicleId,
      tripId: initial?.tripId ?? '',
      date,
      category,
      amount: parsed,
      vat: manual,
      comment: comment.trim(),
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {shared ? (
        <p className="hint wide">Эта статья записывается без машины.</p>
      ) : (
        <Field label="Машина" wide>
          <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} autoFocus>
            <option value="">Выберите машину</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate} · {vehicle.model}
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
          {vehicleExpenseCategories.map((item) => (
            <option key={item} value={item}>
              {expenseCategoryLabel[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={category === 'fuel' ? 'Сумма, ₽' : 'Сумма без НДС, ₽'}>
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field label="НДС, ₽">
        <input
          inputMode="decimal"
          value={vat}
          onChange={(event) => {
            setVat(event.target.value)
            setError('')
          }}
          placeholder="само"
        />
      </Field>
      <p className="hint wide">{expenseEntryHint(category, parseMoney(amount), vat.trim() === '' ? null : parseMoney(vat))}</p>
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

export function SharedExpenseForm({
  initial,
  category,
  categories,
  onSubmit,
  onCancel,
}: {
  initial?: TripExpense
  category: TripExpense['category']
  categories: readonly TripExpense['category'][]
  onSubmit: (expense: TripExpense) => void
  onCancel: () => void
}) {
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [picked, setPicked] = useState<TripExpense['category']>(
    initial && categories.includes(initial.category) ? initial.category : category,
  )
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [vat, setVat] = useState(initial?.vat != null ? String(initial.vat) : '')
  const [error, setError] = useState('')

  function submit(event: FormEvent) {
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
    const manual = vat.trim() === '' ? null : parseMoney(vat)
    if (manual === null && vat.trim() !== '') {
      setError('НДС укажите числом или оставьте поле пустым.')
      return
    }
    onSubmit({
      id: initial?.id ?? uid('e'),
      vehicleId: '',
      tripId: initial?.tripId ?? '',
      date,
      category: picked,
      amount: parsed,
      vat: manual,
      comment: initial?.comment ?? '',
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Дата">
        <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required autoFocus />
      </Field>
      <Field label="Категория">
        <select value={picked} onChange={(event) => setPicked(event.target.value as TripExpense['category'])}>
          {categories.map((item) => (
            <option key={item} value={item}>
              {expenseCategoryLabel[item]}
            </option>
          ))}
        </select>
      </Field>
      <Field label={picked === 'fuel' ? 'Сумма, ₽' : 'Сумма без НДС, ₽'}>
        <input inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </Field>
      <Field label="НДС, ₽">
        <input
          inputMode="decimal"
          value={vat}
          onChange={(event) => {
            setVat(event.target.value)
            setError('')
          }}
          placeholder="само"
        />
      </Field>
      <p className="hint wide">{expenseEntryHint(picked, parseMoney(amount), vat.trim() === '' ? null : parseMoney(vat))}</p>
      <div className="wide">
        <FormError text={error} />
        <FormFooter onCancel={onCancel} />
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
  const shared = repairSkipsVehicle(kind)

  function submit(event: FormEvent) {
    event.preventDefault()
    const parsedParts = parts.trim() ? parseMoney(parts) : 0
    const parsedLabor = labor.trim() ? parseMoney(labor) : 0
    const parsedOdometer = parseOdometer(odometer)
    if (!shared && !vehicleId) {
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
    if (!shared && odometer.trim() && parsedOdometer === null) {
      setError('Пробег укажите целым числом километров.')
      return
    }
    onSubmit({
      id: initial?.id ?? uid('r'),
      vehicleId: shared ? '' : vehicleId,
      date,
      kind,
      description: description.trim(),
      partsCost: parsedParts,
      laborCost: parsedLabor,
      status,
      odometer: shared ? null : parsedOdometer,
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {shared ? (
        <p className="hint wide">Запчасти записываются без машины.</p>
      ) : (
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
      )}
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
      {shared ? null : (
        <Field label="Пробег, км">
          <input inputMode="numeric" value={odometer} onChange={(event) => setOdometer(event.target.value)} placeholder="Необязательно" />
        </Field>
      )}
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
  const isRound2 = (presetTrip?.routeKind ?? 'direct') === 'round2'
  const presetStartLeg: PaymentLeg = initial?.leg ?? (isRound2 ? 1 : 0)
  const presetDebt = presetTrip
    ? isRound2 && (presetStartLeg === 1 || presetStartLeg === 2)
      ? legDebt(
          { ...presetTrip, status: presetTrip.status === 'cancelled' ? 'delivered' : presetTrip.status },
          presetStartLeg,
          sumAmounts(
            state.payments.filter(
              (payment) =>
                payment.tripId === presetTrip.id &&
                payment.id !== initial?.id &&
                (payment.leg ?? 0) === presetStartLeg,
            ),
          ),
        )
      : debtOf(
          presetTrip,
          sumAmounts(state.payments.filter((payment) => payment.tripId === presetTrip.id && payment.id !== initial?.id)),
        )
    : 0
  const [tripId, setTripId] = useState(presetId)
  const [leg, setLeg] = useState<PaymentLeg>(presetStartLeg)
  const [date, setDate] = useState(initial?.date ?? todayIso())
  const [method, setMethod] = useState(initial?.method ?? 'bank')
  const [counterparty, setCounterparty] = useState(initial?.counterparty ?? presetTrip?.customer ?? '')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [error, setError] = useState('')
  const trip = state.trips.find((item) => item.id === tripId)
  const tripIsRound2 = (trip?.routeKind ?? 'direct') === 'round2'
  const paidOther = sumAmounts(
    state.payments.filter((payment) => payment.tripId === tripId && payment.id !== initial?.id),
  )
  const paidOtherLeg = sumAmounts(
    state.payments.filter(
      (payment) => payment.tripId === tripId && payment.id !== initial?.id && (payment.leg ?? 0) === leg,
    ),
  )
  const balance = trip
    ? tripIsRound2 && (leg === 1 || leg === 2)
      ? legDebt({ ...trip, status: trip.status === 'cancelled' ? 'delivered' : trip.status }, leg, paidOtherLeg)
      : debtOf({ ...trip, status: trip.status === 'cancelled' ? 'delivered' : trip.status }, paidOther)
    : 0
  const [amount, setAmount] = useState(
    initial ? String(initial.amount) : presetDebt > 0 ? String(presetDebt) : '',
  )
  const parsedAmount = parseMoney(amount)

  function chooseTrip(id: string) {
    setTripId(id)
    const next = state.trips.find((item) => item.id === id)
    if (!next) return
    if ((next.routeKind ?? 'direct') === 'round2') {
      setLeg(1)
      setCounterparty(next.customer)
      const paidLeg1 = sumAmounts(
        state.payments.filter(
          (payment) => payment.tripId === id && payment.id !== initial?.id && (payment.leg ?? 0) === 1,
        ),
      )
      const nextBalance = legDebt(
        { ...next, status: next.status === 'cancelled' ? 'delivered' : next.status },
        1,
        paidLeg1,
      )
      setAmount(nextBalance > 0 ? String(nextBalance) : '')
    } else {
      setLeg(0)
      setCounterparty(next.customer)
      const paid = sumAmounts(state.payments.filter((payment) => payment.tripId === id && payment.id !== initial?.id))
      const nextBalance = debtOf(
        { ...next, status: next.status === 'cancelled' ? 'delivered' : next.status },
        paid,
      )
      setAmount(nextBalance > 0 ? String(nextBalance) : '')
    }
  }

  function chooseLeg(nextLeg: PaymentLeg) {
    setLeg(nextLeg)
    if (!trip) return
    if (nextLeg === 2) setCounterparty(trip.customer2 || '')
    else if (nextLeg === 1) setCounterparty(trip.customer)
    if (nextLeg === 1 || nextLeg === 2) {
      const paidLeg = sumAmounts(
        state.payments.filter(
          (payment) => payment.tripId === tripId && payment.id !== initial?.id && (payment.leg ?? 0) === nextLeg,
        ),
      )
      const nextBalance = legDebt(
        { ...trip, status: trip.status === 'cancelled' ? 'delivered' : trip.status },
        nextLeg,
        paidLeg,
      )
      setAmount(nextBalance > 0 ? String(nextBalance) : '')
    }
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
    if (tripIsRound2 && leg !== 1 && leg !== 2) {
      setError('Для кругорейса ×2 выберите плечо оплаты.')
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
      leg: tripIsRound2 ? leg : 0,
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      {fixedTripId && trip ? (
        <Field label="Рейс" wide>
          <input value={`${trip.number} · ${tripRouteLabel(trip)}`} readOnly />
        </Field>
      ) : (
        <Field label="Рейс" wide>
          <select value={tripId} onChange={(event) => chooseTrip(event.target.value)} autoFocus>
            <option value="">Выберите рейс</option>
            {[...state.trips]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.number} · {item.customer}
                  {(item.routeKind ?? 'direct') === 'round2' && item.customer2 ? ` / ${item.customer2}` : ''} · долг{' '}
                  {money(debtOf(item, sumAmounts(state.payments.filter((payment) => payment.tripId === item.id))))}
                </option>
              ))}
          </select>
        </Field>
      )}
      {tripIsRound2 ? (
        <Field label="Плечо оплаты" wide>
          <select value={String(leg)} onChange={(event) => chooseLeg(Number(event.target.value) as PaymentLeg)}>
            <option value="1">Плечо 1 · {trip?.customer || 'заказчик 1'} · ставка {money(trip?.rate ?? 0)}</option>
            <option value="2">Плечо 2 · {trip?.customer2 || 'заказчик 2'} · ставка {money(trip?.rate2 ?? 0)}</option>
          </select>
        </Field>
      ) : null}
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
          {tripIsRound2 && (leg === 1 || leg === 2)
            ? `Плечо ${leg}: ставка ${money(leg === 1 ? trip.rate : trip.rate2)}. По плечу без этой записи ${money(paidOtherLeg)}. Остаток по плечу ${money(balance)}. Всего по рейсу ${money(tripTotalRate(trip))}, внесено ${money(paidOther)}.`
            : `Ставка ${money(tripTotalRate(trip))}. Уже внесено без этой записи ${money(paidOther)}. Остаток ${money(balance)}.`}
          {tripIsRound2 && leg === 1 && trip.payDue ? ` Срок плеча 1 ${dateRu(trip.payDue)}.` : ''}
          {tripIsRound2 && leg === 2 && trip.payDue2 ? ` Срок плеча 2 ${dateRu(trip.payDue2)}.` : ''}
          {!tripIsRound2 && trip.payDue ? ` Срок ${dateRu(trip.payDue)}.` : ''}
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
  const [sts, setSts] = useState(initial?.sts ?? '')
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
      sts: sts.toUpperCase().replace(/\s+/g, ''),
    })
  }

  return (
    <form className="form-grid" onSubmit={submit}>
      <Field label="Госномер" wide>
        <input value={plate} onChange={(event) => setPlate(event.target.value)} autoFocus placeholder="А123ВС 116" />
      </Field>
      <Field label="СТС" wide>
        <input
          value={sts}
          onChange={(event) => setSts(event.target.value)}
          placeholder="9912345678"
          inputMode="text"
          autoComplete="off"
        />
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
