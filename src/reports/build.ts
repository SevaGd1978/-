import { debtOf, expenseVat, expenseWithVat, inRange, isOverdue, repairCost, round2, sumAmounts, sumExpenses } from '../calc'
import {
  dateRu,
  expenseCategories,
  expenseCategoryLabel,
  payMethodLabel,
  payMethods,
  repairKindLabel,
  repairKinds,
  repairStatusLabel,
  repairStatuses,
  tripStatusLabel,
  tripStatuses,
} from '../format'
import type { State, Trip } from '../types'

export type ReportKind = 'summary' | 'trips' | 'expenses' | 'repairs' | 'payments' | 'debts'

export type ColumnKind = 'text' | 'money' | 'number' | 'figure'

export interface ReportQuery {
  kind: ReportKind
  from: string
  to: string
}

export interface ReportColumn {
  title: string
  align: 'left' | 'right'
  width: number
  kind: ColumnKind
}

export interface ReportSection {
  title: string
  columns: ReportColumn[]
  rows: (string | number | null)[][]
  totals: (string | number | null)[] | null
}

export interface BuiltReport {
  kind: ReportKind
  title: string
  filename: string
  periodLabel: string
  note: string
  from: string
  to: string
  createdAt: string
  sections: ReportSection[]
}

export const reportCatalog: { kind: ReportKind; label: string; text: string }[] = [
  {
    kind: 'summary',
    label: 'Сводка',
    text: 'Итог периода, статьи затрат, ремзона, долги и разрезы по заказчикам, водителям и машинам.',
  },
  {
    kind: 'trips',
    label: 'Рейсы',
    text: 'Реестр рейсов и сводки по заказчикам, водителям, машинам и статусам.',
  },
  {
    kind: 'expenses',
    label: 'Расходы',
    text: 'Затраты по дате. Топливо, Платон и платные дороги отдельно, без машины. Общие расходы тоже можно записать без машины.',
  },
  {
    kind: 'repairs',
    label: 'Ремзона',
    text: 'Заявки мастерской и итоги по машинам, видам работ и статусам.',
  },
  {
    kind: 'payments',
    label: 'Оплаты',
    text: 'Поступления и сводки по заказчикам и способам оплаты.',
  },
  {
    kind: 'debts',
    label: 'Долги',
    text: 'Непогашенные рейсы и долг по заказчикам, в том числе просроченный.',
  },
]

const titles: Record<ReportKind, string> = {
  summary: 'Сводка',
  trips: 'Реестр рейсов',
  expenses: 'Расходы по машинам',
  repairs: 'Ремзона',
  payments: 'Оплаты за рейсы',
  debts: 'Долги по рейсам',
}

const notes: Record<ReportKind, string> = {
  summary:
    'Результат = получено − расходы − ремзона. Долг считается по дате выхода рейса, с учётом всех оплат. Статьи затрат и ремзона — по своим датам.',
  trips:
    'Рейсы отобраны по дате выхода. Оплаты в реестре и сводках показаны целиком, даже если часть из них попала в другой месяц.',
  expenses:
    'Строки отобраны по дате расхода. Топливо, Платон, ремзона и платные дороги записаны отдельно, без машины. Суточные, зарплату, погрузку, стоянку и прочее можно записать на машину или в общие расходы. Топливо вводят суммой с НДС: пустое поле выделяет 22% внутри неё. У остальных пустое поле добавляет 22% сверху. Зарплата выделена отдельной статьёй, даже если за период её не было.',
  repairs: 'Заявки и сводки отобраны по дате постановки в ремзону.',
  payments: 'Оплаты и сводки отобраны по дате поступления денег.',
  debts: 'Только рейсы с остатком к оплате. Просрочка считается на момент формирования отчёта.',
}

const fileSlugs: Record<ReportKind, string> = {
  summary: 'svodka',
  trips: 'reisy',
  expenses: 'raskhody',
  repairs: 'remzona',
  payments: 'oplaty',
  debts: 'dolgi',
}

function column(title: string, align: 'left' | 'right', width: number, kind: ColumnKind): ReportColumn {
  return { title, align, width, kind }
}

export function describePeriod(from: string, to: string) {
  if (!from && !to) return 'За всё время'
  if (from && to) return `С ${dateRu(from)} по ${dateRu(to)}`
  if (from) return `С ${dateRu(from)}`
  return `По ${dateRu(to)}`
}

export function monthBounds(period: string) {
  const [year, month] = period.split('-').map(Number)
  const last = new Date(year, month, 0).getDate()
  const mm = String(month).padStart(2, '0')
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(last).padStart(2, '0')}`,
  }
}

function stamp(now: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(now)
}

function isoDate(now: Date) {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function filename(kind: ReportKind, from: string, to: string) {
  const span = !from && !to ? 'vse-vremya' : `${from || 'nachalo'}_${to || 'konec'}`
  return `putevoy-${fileSlugs[kind]}-${span}`
}

function totalRow(rows: (string | number | null)[][], columns: ReportColumn[]) {
  if (rows.length === 0) return null
  return columns.map((item, index) => {
    if (index === 0) return 'Итого'
    if (item.kind !== 'money' && item.kind !== 'number') return null
    return round2(rows.reduce((sum, row) => sum + (typeof row[index] === 'number' ? row[index] : 0), 0))
  })
}

function tripById(state: State, id: string) {
  return state.trips.find((trip) => trip.id === id)
}

function vehicleLabel(state: State, id: string) {
  if (!id) return 'Без машины'
  const vehicle = state.vehicles.find((item) => item.id === id)
  return vehicle ? `${vehicle.plate}, ${vehicle.model}` : '—'
}

function driverName(state: State, id: string) {
  return state.drivers.find((item) => item.id === id)?.name ?? '—'
}

function tripEconomics(state: State, trip: Trip) {
  const paid = sumAmounts(state.payments.filter((payment) => payment.tripId === trip.id))
  return {
    paid,
    debt: debtOf(trip, paid),
  }
}

interface EconBucket {
  count: number
  weight: number
  rate: number
  paid: number
  debt: number
}

function emptyBucket(): EconBucket {
  return { count: 0, weight: 0, rate: 0, paid: 0, debt: 0 }
}

function absorb(bucket: EconBucket, state: State, trip: Trip) {
  const economics = tripEconomics(state, trip)
  bucket.count += 1
  bucket.weight = round2(bucket.weight + trip.weightTons)
  bucket.rate = round2(bucket.rate + trip.rate)
  bucket.paid = round2(bucket.paid + economics.paid)
  bucket.debt = round2(bucket.debt + economics.debt)
}

const econColumns = [
  column('Рейсов', 'right', 12, 'number'),
  column('Вес, т', 'right', 12, 'number'),
  column('Ставка', 'right', 14, 'money'),
  column('Оплачено', 'right', 14, 'money'),
  column('Долг', 'right', 14, 'money'),
]

function econValues(bucket: EconBucket) {
  return [bucket.count, bucket.weight, bucket.rate, bucket.paid, bucket.debt]
}

function groupedSection(
  title: string,
  label: string,
  groups: Map<string, EconBucket>,
  keepOrder = false,
): ReportSection {
  const columns = [column(label, 'left', 32, 'text'), ...econColumns]
  const entries = [...groups.entries()]
  if (!keepOrder) entries.sort((a, b) => b[1].rate - a[1].rate || a[0].localeCompare(b[0], 'ru'))
  const rows = entries.map(([name, bucket]) => [name, ...econValues(bucket)])
  return { title, columns, rows, totals: totalRow(rows, columns) }
}

function groupTrips(
  state: State,
  trips: Trip[],
  title: string,
  label: string,
  keyOf: (trip: Trip) => string,
) {
  const groups = new Map<string, EconBucket>()
  for (const trip of trips) {
    const key = keyOf(trip)
    const bucket = groups.get(key) ?? emptyBucket()
    absorb(bucket, state, trip)
    groups.set(key, bucket)
  }
  return groupedSection(title, label, groups)
}

function periodTrips(state: State, from: string, to: string) {
  return state.trips
    .filter((trip) => inRange(trip.date, from, to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))
}

function tripBreakdowns(state: State, from: string, to: string): ReportSection[] {
  const trips = periodTrips(state, from, to)
  const byStatus = new Map<string, EconBucket>()
  for (const status of tripStatuses) {
    const matched = trips.filter((trip) => trip.status === status)
    if (matched.length === 0) continue
    const bucket = emptyBucket()
    for (const trip of matched) absorb(bucket, state, trip)
    byStatus.set(tripStatusLabel[status], bucket)
  }
  return [
    groupTrips(state, trips, 'По заказчикам', 'Заказчик', (trip) => trip.customer),
    groupTrips(state, trips, 'По водителям', 'Водитель', (trip) => driverName(state, trip.driverId)),
    groupTrips(state, trips, 'По машинам', 'Машина', (trip) => vehicleLabel(state, trip.vehicleId)),
    groupedSection('По статусам', 'Статус', byStatus, true),
  ]
}

function summarySections(state: State, from: string, to: string): ReportSection[] {
  const payments = state.payments.filter((payment) => inRange(payment.date, from, to))
  const expenses = state.expenses.filter((expense) => inRange(expense.date, from, to))
  const repairs = state.repairs.filter((job) => inRange(job.date, from, to))
  const trips = state.trips.filter((trip) => inRange(trip.date, from, to))
  const received = sumAmounts(payments)
  const tripSpend = sumExpenses(expenses)
  const workshop = sumAmounts(repairs.map((job) => ({ amount: repairCost(job) })))
  const debt = round2(trips.reduce((sum, trip) => sum + tripEconomics(state, trip).debt, 0))

  const byCategory = expenseCategories
    .map((category) => ({
      label: expenseCategoryLabel[category],
      amount: sumExpenses(expenses.filter((expense) => expense.category === category)),
    }))
    .filter((row) => row.amount > 0)
  const categoryRows = byCategory.map((row) => [row.label, row.amount] as (string | number | null)[])
  const categoryColumns = [column('Статья', 'left', 32, 'text'), column('Сумма', 'right', 16, 'money')]

  const byRepair = repairKinds
    .map((kind) => ({
      label: repairKindLabel[kind],
      amount: sumAmounts(
        repairs.filter((job) => job.kind === kind).map((job) => ({ amount: repairCost(job) })),
      ),
    }))
    .filter((row) => row.amount > 0)
  const repairRows = byRepair.map((row) => [row.label, row.amount] as (string | number | null)[])
  const repairColumns = [column('Вид работ', 'left', 24, 'text'), column('Сумма', 'right', 16, 'money')]

  const customers = new Map<string, number>()
  for (const trip of trips) {
    const economics = tripEconomics(state, trip)
    if (economics.debt <= 0) continue
    customers.set(trip.customer, round2((customers.get(trip.customer) ?? 0) + economics.debt))
  }
  const customerRows = [...customers.entries()]
    .sort((a, b) => b[1] - a[1])
    .map((row) => [row[0], row[1]] as (string | number | null)[])
  const customerColumns = [column('Заказчик', 'left', 36, 'text'), column('Долг', 'right', 16, 'money')]

  return [
    {
      title: 'Показатели',
      columns: [column('Показатель', 'left', 36, 'text'), column('Сумма', 'right', 16, 'money')],
      rows: [
        ['Получено', received],
        ['Расходы по машинам', tripSpend],
        ['Ремзона', workshop],
        ['Результат', round2(received - tripSpend - workshop)],
        ['Долг по рейсам периода', debt],
      ],
      totals: null,
    },
    {
      title: 'Расходы по статьям',
      columns: categoryColumns,
      rows: categoryRows,
      totals: totalRow(categoryRows, categoryColumns),
    },
    {
      title: 'Ремзона по видам',
      columns: repairColumns,
      rows: repairRows,
      totals: totalRow(repairRows, repairColumns),
    },
    {
      title: 'Долги по заказчикам',
      columns: customerColumns,
      rows: customerRows,
      totals: totalRow(customerRows, customerColumns),
    },
    ...tripBreakdowns(state, from, to),
    laborSection(state, from, to),
  ]
}

function tripSection(state: State, from: string, to: string): ReportSection {
  const columns = [
    column('Дата', 'left', 14, 'text'),
    column('Рейс', 'left', 12, 'text'),
    column('Маршрут', 'left', 28, 'text'),
    column('Заказчик', 'left', 28, 'text'),
    column('Груз', 'left', 28, 'text'),
    column('Вес, т', 'right', 12, 'number'),
    column('Машина', 'left', 26, 'text'),
    column('Водитель', 'left', 22, 'text'),
    column('Одометр, начало', 'right', 16, 'figure'),
    column('Одометр, конец', 'right', 16, 'figure'),
    column('Статус', 'left', 16, 'text'),
    column('Ставка', 'right', 14, 'money'),
    column('Оплачено', 'right', 14, 'money'),
    column('Долг', 'right', 14, 'money'),
  ]
  const rows = state.trips
    .filter((trip) => inRange(trip.date, from, to))
    .sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number))
    .map((trip) => {
      const economics = tripEconomics(state, trip)
      return [
        dateRu(trip.date),
        trip.number,
        `${trip.from} – ${trip.to}`,
        trip.customer,
        trip.cargo,
        trip.weightTons,
        vehicleLabel(state, trip.vehicleId),
        driverName(state, trip.driverId),
        trip.odometerStart,
        trip.odometerEnd,
        tripStatusLabel[trip.status],
        trip.rate,
        economics.paid,
        economics.debt,
      ]
    })
  return { title: 'Рейсы', columns, rows, totals: totalRow(rows, columns) }
}

function expenseSection(state: State, from: string, to: string): ReportSection {
  const columns = [
    column('Дата', 'left', 14, 'text'),
    column('Машина', 'left', 26, 'text'),
    column('Статья', 'left', 24, 'text'),
    column('Комментарий', 'left', 32, 'text'),
    column('Без НДС', 'right', 14, 'money'),
    column('НДС', 'right', 14, 'money'),
    column('С НДС', 'right', 14, 'money'),
  ]
  const rows = state.expenses
    .filter((expense) => inRange(expense.date, from, to))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((expense) => [
      dateRu(expense.date),
      vehicleLabel(state, expense.vehicleId),
      expenseCategoryLabel[expense.category],
      expense.comment || '—',
      expense.amount,
      expenseVat(expense.category, expense.amount, expense.vat),
      expenseWithVat(expense.category, expense.amount, expense.vat),
    ])
  return { title: 'Расходы', columns, rows, totals: totalRow(rows, columns) }
}

function repairSection(state: State, from: string, to: string): ReportSection {
  const columns = [
    column('Дата', 'left', 14, 'text'),
    column('Машина', 'left', 26, 'text'),
    column('Вид работ', 'left', 16, 'text'),
    column('Описание', 'left', 36, 'text'),
    column('Статус', 'left', 14, 'text'),
    column('Пробег, км', 'right', 14, 'figure'),
    column('Запчасти', 'right', 14, 'money'),
    column('Работа', 'right', 14, 'money'),
    column('Итого', 'right', 14, 'money'),
  ]
  const rows = state.repairs
    .filter((job) => inRange(job.date, from, to))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((job) => [
      dateRu(job.date),
      vehicleLabel(state, job.vehicleId),
      repairKindLabel[job.kind],
      job.description,
      repairStatusLabel[job.status],
      job.odometer,
      job.partsCost,
      job.laborCost,
      repairCost(job),
    ])
  return { title: 'Ремзона', columns, rows, totals: totalRow(rows, columns) }
}

function paymentSection(state: State, from: string, to: string): ReportSection {
  const columns = [
    column('Дата', 'left', 14, 'text'),
    column('Рейс', 'left', 12, 'text'),
    column('Маршрут', 'left', 28, 'text'),
    column('Заказчик', 'left', 28, 'text'),
    column('Плательщик', 'left', 28, 'text'),
    column('Способ', 'left', 14, 'text'),
    column('Комментарий', 'left', 32, 'text'),
    column('Сумма', 'right', 14, 'money'),
  ]
  const rows = state.payments
    .filter((payment) => inRange(payment.date, from, to))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((payment) => {
      const trip = tripById(state, payment.tripId)
      return [
        dateRu(payment.date),
        trip?.number ?? '—',
        trip ? `${trip.from} – ${trip.to}` : '—',
        trip?.customer ?? '—',
        payment.counterparty,
        payMethodLabel[payment.method],
        payment.comment || '—',
        payment.amount,
      ]
    })
  return { title: 'Оплаты', columns, rows, totals: totalRow(rows, columns) }
}

function debtSection(state: State, from: string, to: string, today: string): ReportSection {
  const columns = [
    column('Дата', 'left', 14, 'text'),
    column('Рейс', 'left', 12, 'text'),
    column('Заказчик', 'left', 28, 'text'),
    column('Срок оплаты', 'left', 16, 'text'),
    column('Статус', 'left', 16, 'text'),
    column('Ставка', 'right', 14, 'money'),
    column('Оплачено', 'right', 14, 'money'),
    column('Долг', 'right', 14, 'money'),
    column('Просрочено', 'left', 14, 'text'),
  ]
  const rows = state.trips
    .filter((trip) => inRange(trip.date, from, to))
    .map((trip) => ({ trip, ...tripEconomics(state, trip) }))
    .filter((row) => row.debt > 0)
    .sort((a, b) => a.trip.date.localeCompare(b.trip.date) || a.trip.number.localeCompare(b.trip.number))
    .map((row) => [
      dateRu(row.trip.date),
      row.trip.number,
      row.trip.customer,
      row.trip.payDue ? dateRu(row.trip.payDue) : '—',
      tripStatusLabel[row.trip.status],
      row.trip.rate,
      row.paid,
      row.debt,
      row.trip.payDue !== '' && row.trip.payDue < today ? 'Да' : 'Нет',
    ])
  return { title: 'Долги', columns, rows, totals: totalRow(rows, columns) }
}

function expenseAmount(rows: { category: string; amount: number }[], category: string) {
  return sumExpenses(rows.filter((row) => row.category === category))
}

function expenseBreakdowns(state: State, from: string, to: string): ReportSection[] {
  const expenses = state.expenses.filter((expense) => inRange(expense.date, from, to))
  const categoryColumns = [
    column('Статья', 'left', 28, 'text'),
    column('Строк', 'right', 12, 'number'),
    column('Сумма', 'right', 16, 'money'),
  ]
  const categoryRows = expenseCategories.map((category) => {
    const matched = expenses.filter((expense) => expense.category === category)
    return [expenseCategoryLabel[category], matched.length, sumExpenses(matched)]
  })

  const byVehicle = new Map<string, typeof expenses>()
  for (const expense of expenses) {
    const list = byVehicle.get(expense.vehicleId) ?? []
    list.push(expense)
    byVehicle.set(expense.vehicleId, list)
  }
  const vehicleColumns = [
    column('Машина', 'left', 28, 'text'),
    column('Топливо', 'right', 14, 'money'),
    column('Платные дороги', 'right', 16, 'money'),
    column('Платон', 'right', 14, 'money'),
    column('Ремзона', 'right', 14, 'money'),
    column('Суточные', 'right', 14, 'money'),
    column('Зарплата', 'right', 14, 'money'),
    column('Прочее', 'right', 14, 'money'),
    column('Итого', 'right', 14, 'money'),
  ]
  const vehicleRows = [...byVehicle.entries()]
    .map(([vehicleId, rows]) => {
      const fuel = expenseAmount(rows, 'fuel')
      const toll = expenseAmount(rows, 'toll')
      const platon = expenseAmount(rows, 'platon')
      const workshop = expenseAmount(rows, 'workshop')
      const perDiem = expenseAmount(rows, 'driver')
      const salary = expenseAmount(rows, 'salary')
      const total = sumExpenses(rows)
      const rest = round2(total - fuel - toll - platon - workshop - perDiem - salary)
      return [vehicleLabel(state, vehicleId), fuel, toll, platon, workshop, perDiem, salary, rest, total]
    })
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]), 'ru'))

  const byLabor = new Map<string, { perDiem: number; salary: number; other: number }>()
  for (const expense of expenses) {
    const name = vehicleLabel(state, expense.vehicleId)
    const bucket = byLabor.get(name) ?? { perDiem: 0, salary: 0, other: 0 }
    const gross = expenseWithVat(expense.category, expense.amount, expense.vat)
    if (expense.category === 'driver') bucket.perDiem = round2(bucket.perDiem + gross)
    else if (expense.category === 'salary') bucket.salary = round2(bucket.salary + gross)
    else bucket.other = round2(bucket.other + gross)
    byLabor.set(name, bucket)
  }
  const laborColumns = [
    column('Машина', 'left', 28, 'text'),
    column('Суточные', 'right', 14, 'money'),
    column('Зарплата', 'right', 14, 'money'),
    column('Прочие расходы', 'right', 16, 'money'),
    column('Итого', 'right', 14, 'money'),
  ]
  const laborRows = [...byLabor.entries()]
    .sort((a, b) => b[1].salary + b[1].perDiem - (a[1].salary + a[1].perDiem) || a[0].localeCompare(b[0], 'ru'))
    .map(([name, bucket]) => [
      name,
      bucket.perDiem,
      bucket.salary,
      bucket.other,
      round2(bucket.perDiem + bucket.salary + bucket.other),
    ])

  return [
    { title: 'По статьям', columns: categoryColumns, rows: categoryRows, totals: totalRow(categoryRows, categoryColumns) },
    { title: 'По машинам', columns: vehicleColumns, rows: vehicleRows, totals: totalRow(vehicleRows, vehicleColumns) },
    {
      title: 'Оплата труда по машинам',
      columns: laborColumns,
      rows: laborRows,
      totals: totalRow(laborRows, laborColumns),
    },
  ]
}

function laborSection(state: State, from: string, to: string): ReportSection {
  const expenses = state.expenses.filter((expense) => inRange(expense.date, from, to))
  const columns = [
    column('Машина', 'left', 28, 'text'),
    column('Суточные', 'right', 14, 'money'),
    column('Зарплата', 'right', 14, 'money'),
    column('Итого', 'right', 14, 'money'),
  ]
  const groups = new Map<string, { perDiem: number; salary: number }>()
  for (const expense of expenses) {
    if (expense.category !== 'driver' && expense.category !== 'salary') continue
    const name = vehicleLabel(state, expense.vehicleId)
    const bucket = groups.get(name) ?? { perDiem: 0, salary: 0 }
    const gross = expenseWithVat(expense.category, expense.amount, expense.vat)
    if (expense.category === 'driver') bucket.perDiem = round2(bucket.perDiem + gross)
    else bucket.salary = round2(bucket.salary + gross)
    groups.set(name, bucket)
  }
  const rows = [...groups.entries()]
    .sort((a, b) => b[1].salary + b[1].perDiem - (a[1].salary + a[1].perDiem) || a[0].localeCompare(b[0], 'ru'))
    .map(([name, bucket]) => [name, bucket.perDiem, bucket.salary, round2(bucket.perDiem + bucket.salary)])
  return { title: 'Оплата труда по машинам', columns, rows, totals: totalRow(rows, columns) }
}

function repairBreakdowns(state: State, from: string, to: string): ReportSection[] {
  const jobs = state.repairs.filter((job) => inRange(job.date, from, to))
  const vehicleColumns = [
    column('Машина', 'left', 28, 'text'),
    column('Заявок', 'right', 12, 'number'),
    column('Запчасти', 'right', 14, 'money'),
    column('Работа', 'right', 14, 'money'),
    column('Итого', 'right', 14, 'money'),
  ]
  const byVehicle = new Map<string, { count: number; parts: number; labor: number }>()
  for (const job of jobs) {
    const name = vehicleLabel(state, job.vehicleId)
    const bucket = byVehicle.get(name) ?? { count: 0, parts: 0, labor: 0 }
    bucket.count += 1
    bucket.parts = round2(bucket.parts + job.partsCost)
    bucket.labor = round2(bucket.labor + job.laborCost)
    byVehicle.set(name, bucket)
  }
  const vehicleRows = [...byVehicle.entries()]
    .sort((a, b) => b[1].parts + b[1].labor - (a[1].parts + a[1].labor) || a[0].localeCompare(b[0], 'ru'))
    .map(([name, bucket]) => [name, bucket.count, bucket.parts, bucket.labor, round2(bucket.parts + bucket.labor)])

  const kindColumns = [column('Вид работ', 'left', 20, 'text'), column('Заявок', 'right', 12, 'number'), column('Сумма', 'right', 16, 'money')]
  const kindRows = repairKinds.map((kind) => {
    const matched = jobs.filter((job) => job.kind === kind)
    return [repairKindLabel[kind], matched.length, sumAmounts(matched.map((job) => ({ amount: repairCost(job) })))]
  })

  const statusColumns = [column('Статус', 'left', 16, 'text'), column('Заявок', 'right', 12, 'number'), column('Сумма', 'right', 16, 'money')]
  const statusRows = repairStatuses.map((status) => {
    const matched = jobs.filter((job) => job.status === status)
    return [repairStatusLabel[status], matched.length, sumAmounts(matched.map((job) => ({ amount: repairCost(job) })))]
  })

  return [
    { title: 'По машинам', columns: vehicleColumns, rows: vehicleRows, totals: totalRow(vehicleRows, vehicleColumns) },
    { title: 'По видам работ', columns: kindColumns, rows: kindRows, totals: totalRow(kindRows, kindColumns) },
    { title: 'По статусам заявок', columns: statusColumns, rows: statusRows, totals: totalRow(statusRows, statusColumns) },
  ]
}

function paymentBreakdowns(state: State, from: string, to: string): ReportSection[] {
  const payments = state.payments.filter((payment) => inRange(payment.date, from, to))
  const customerColumns = [column('Заказчик', 'left', 32, 'text'), column('Оплат', 'right', 12, 'number'), column('Сумма', 'right', 16, 'money')]
  const byCustomer = new Map<string, { count: number; amount: number }>()
  for (const payment of payments) {
    const trip = tripById(state, payment.tripId)
    const name = trip?.customer ?? '—'
    const bucket = byCustomer.get(name) ?? { count: 0, amount: 0 }
    bucket.count += 1
    bucket.amount = round2(bucket.amount + payment.amount)
    byCustomer.set(name, bucket)
  }
  const customerRows = [...byCustomer.entries()]
    .sort((a, b) => b[1].amount - a[1].amount || a[0].localeCompare(b[0], 'ru'))
    .map(([name, bucket]) => [name, bucket.count, bucket.amount])

  const methodColumns = [column('Способ', 'left', 16, 'text'), column('Оплат', 'right', 12, 'number'), column('Сумма', 'right', 16, 'money')]
  const methodRows = payMethods.map((method) => {
    const matched = payments.filter((payment) => payment.method === method)
    return [payMethodLabel[method], matched.length, sumAmounts(matched)]
  })

  return [
    { title: 'По заказчикам', columns: customerColumns, rows: customerRows, totals: totalRow(customerRows, customerColumns) },
    { title: 'По способам оплаты', columns: methodColumns, rows: methodRows, totals: totalRow(methodRows, methodColumns) },
  ]
}

function debtBreakdown(state: State, from: string, to: string, today: string): ReportSection {
  const columns = [
    column('Заказчик', 'left', 32, 'text'),
    column('Рейсов', 'right', 12, 'number'),
    column('Ставка', 'right', 14, 'money'),
    column('Оплачено', 'right', 14, 'money'),
    column('Долг', 'right', 14, 'money'),
    column('Просрочено', 'right', 14, 'money'),
  ]
  const groups = new Map<string, { count: number; rate: number; paid: number; debt: number; overdue: number }>()
  for (const trip of periodTrips(state, from, to)) {
    const economics = tripEconomics(state, trip)
    if (economics.debt <= 0) continue
    const bucket = groups.get(trip.customer) ?? { count: 0, rate: 0, paid: 0, debt: 0, overdue: 0 }
    bucket.count += 1
    bucket.rate = round2(bucket.rate + trip.rate)
    bucket.paid = round2(bucket.paid + economics.paid)
    bucket.debt = round2(bucket.debt + economics.debt)
    if (isOverdue(trip, economics.debt, today)) bucket.overdue = round2(bucket.overdue + economics.debt)
    groups.set(trip.customer, bucket)
  }
  const rows = [...groups.entries()]
    .sort((a, b) => b[1].debt - a[1].debt || a[0].localeCompare(b[0], 'ru'))
    .map(([name, bucket]) => [name, bucket.count, bucket.rate, bucket.paid, bucket.debt, bucket.overdue])
  return { title: 'Долги по заказчикам', columns, rows, totals: totalRow(rows, columns) }
}

export function buildReport(state: State, query: ReportQuery, now = new Date()): BuiltReport {
  const today = isoDate(now)
  const sections =
    query.kind === 'summary'
      ? summarySections(state, query.from, query.to)
      : query.kind === 'trips'
        ? [tripSection(state, query.from, query.to), ...tripBreakdowns(state, query.from, query.to)]
        : query.kind === 'expenses'
          ? [expenseSection(state, query.from, query.to), ...expenseBreakdowns(state, query.from, query.to)]
          : query.kind === 'repairs'
            ? [repairSection(state, query.from, query.to), ...repairBreakdowns(state, query.from, query.to)]
            : query.kind === 'payments'
              ? [paymentSection(state, query.from, query.to), ...paymentBreakdowns(state, query.from, query.to)]
              : [debtSection(state, query.from, query.to, today), debtBreakdown(state, query.from, query.to, today)]

  return {
    kind: query.kind,
    title: titles[query.kind],
    filename: filename(query.kind, query.from, query.to),
    periodLabel: describePeriod(query.from, query.to),
    note: notes[query.kind],
    from: query.from,
    to: query.to,
    createdAt: stamp(now),
    sections,
  }
}
