import { debtOf, inRange, marginOf, repairCost, round2, sumAmounts } from '../calc'
import {
  dateRu,
  expenseCategories,
  expenseCategoryLabel,
  payMethodLabel,
  repairKindLabel,
  repairKinds,
  repairStatusLabel,
  tripStatusLabel,
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
    text: 'Полученные деньги, расходы рейсов, ремзона и результат за период.',
  },
  {
    kind: 'trips',
    label: 'Рейсы',
    text: 'Реестр рейсов со ставкой, расходами, оплатой, долгом и маржой.',
  },
  {
    kind: 'expenses',
    label: 'Расходы',
    text: 'Топливо, дороги, суточные и остальные затраты по дате расхода.',
  },
  {
    kind: 'repairs',
    label: 'Ремзона',
    text: 'Заявки мастерской: запчасти, работа и статус.',
  },
  {
    kind: 'payments',
    label: 'Оплаты',
    text: 'Поступления от заказчиков по дате оплаты.',
  },
  {
    kind: 'debts',
    label: 'Долги',
    text: 'Непогашенные рейсы, вышедшие в выбранные даты.',
  },
]

const titles: Record<ReportKind, string> = {
  summary: 'Сводка',
  trips: 'Реестр рейсов',
  expenses: 'Расходы по рейсам',
  repairs: 'Ремзона',
  payments: 'Оплаты за рейсы',
  debts: 'Долги по рейсам',
}

const notes: Record<ReportKind, string> = {
  summary: 'Результат = получено − расходы по рейсам − ремзона. Долг считается по рейсам, вышедшим в этот период, с учётом всех их оплат.',
  trips: 'Рейсы отобраны по дате выхода. Расходы и оплаты показаны целиком, даже если часть из них попала в другой месяц.',
  expenses: 'Строки отобраны по дате расхода.',
  repairs: 'Заявки отобраны по дате постановки в ремзону.',
  payments: 'Оплаты отобраны по дате поступления денег.',
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
  const vehicle = state.vehicles.find((item) => item.id === id)
  return vehicle ? `${vehicle.plate}, ${vehicle.model}` : '—'
}

function driverName(state: State, id: string) {
  return state.drivers.find((item) => item.id === id)?.name ?? '—'
}

function tripEconomics(state: State, trip: Trip) {
  const expenses = sumAmounts(state.expenses.filter((expense) => expense.tripId === trip.id))
  const paid = sumAmounts(state.payments.filter((payment) => payment.tripId === trip.id))
  return {
    expenses,
    paid,
    debt: debtOf(trip, paid),
    margin: marginOf(trip, expenses),
  }
}

function summarySections(state: State, from: string, to: string): ReportSection[] {
  const payments = state.payments.filter((payment) => inRange(payment.date, from, to))
  const expenses = state.expenses.filter((expense) => inRange(expense.date, from, to))
  const repairs = state.repairs.filter((job) => inRange(job.date, from, to))
  const trips = state.trips.filter((trip) => inRange(trip.date, from, to))
  const received = sumAmounts(payments)
  const tripSpend = sumAmounts(expenses)
  const workshop = sumAmounts(repairs.map((job) => ({ amount: repairCost(job) })))
  const debt = round2(trips.reduce((sum, trip) => sum + tripEconomics(state, trip).debt, 0))

  const byCategory = expenseCategories
    .map((category) => ({
      label: expenseCategoryLabel[category],
      amount: sumAmounts(expenses.filter((expense) => expense.category === category)),
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
        ['Расходы по рейсам', tripSpend],
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
    column('Статус', 'left', 16, 'text'),
    column('Ставка', 'right', 14, 'money'),
    column('Расходы', 'right', 14, 'money'),
    column('Оплачено', 'right', 14, 'money'),
    column('Долг', 'right', 14, 'money'),
    column('Маржа', 'right', 14, 'money'),
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
        tripStatusLabel[trip.status],
        trip.rate,
        economics.expenses,
        economics.paid,
        economics.debt,
        economics.margin,
      ]
    })
  return { title: 'Рейсы', columns, rows, totals: totalRow(rows, columns) }
}

function expenseSection(state: State, from: string, to: string): ReportSection {
  const columns = [
    column('Дата', 'left', 14, 'text'),
    column('Рейс', 'left', 12, 'text'),
    column('Маршрут', 'left', 28, 'text'),
    column('Заказчик', 'left', 28, 'text'),
    column('Статья', 'left', 24, 'text'),
    column('Комментарий', 'left', 32, 'text'),
    column('Сумма', 'right', 14, 'money'),
  ]
  const rows = state.expenses
    .filter((expense) => inRange(expense.date, from, to))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((expense) => {
      const trip = tripById(state, expense.tripId)
      return [
        dateRu(expense.date),
        trip?.number ?? '—',
        trip ? `${trip.from} – ${trip.to}` : '—',
        trip?.customer ?? '—',
        expenseCategoryLabel[expense.category],
        expense.comment || '—',
        expense.amount,
      ]
    })
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

export function buildReport(state: State, query: ReportQuery, now = new Date()): BuiltReport {
  const today = isoDate(now)
  const sections =
    query.kind === 'summary'
      ? summarySections(state, query.from, query.to)
      : query.kind === 'trips'
        ? [tripSection(state, query.from, query.to)]
        : query.kind === 'expenses'
          ? [expenseSection(state, query.from, query.to)]
          : query.kind === 'repairs'
            ? [repairSection(state, query.from, query.to)]
            : query.kind === 'payments'
              ? [paymentSection(state, query.from, query.to)]
              : [debtSection(state, query.from, query.to, today)]

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
