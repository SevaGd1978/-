import type { ExpenseCategory, PayMethod, RepairKind, RepairStatus, TripStatus } from './types'

export const tripStatusLabel: Record<TripStatus, string> = {
  planned: 'Запланирован',
  loading: 'Погрузка',
  in_transit: 'В пути',
  delivered: 'Доставлен',
  closed: 'Закрыт',
  cancelled: 'Отменён',
}

export const expenseCategoryLabel: Record<ExpenseCategory, string> = {
  fuel: 'Топливо',
  toll: 'Платные дороги',
  driver: 'Суточные водителя',
  loading: 'Погрузка и разгрузка',
  parking: 'Стоянка',
  other: 'Прочее',
}

export const repairKindLabel: Record<RepairKind, string> = {
  maintenance: 'ТО',
  repair: 'Ремонт',
  tires: 'Шины',
  parts: 'Запчасти',
  body: 'Кузов',
}

export const repairStatusLabel: Record<RepairStatus, string> = {
  queued: 'В очереди',
  in_progress: 'В работе',
  done: 'Готово',
}

export const payMethodLabel: Record<PayMethod, string> = {
  bank: 'Безнал',
  cash: 'Наличные',
  card: 'Карта',
}

export const tripStatuses = Object.keys(tripStatusLabel) as TripStatus[]
export const expenseCategories = Object.keys(expenseCategoryLabel) as ExpenseCategory[]
export const repairKinds = Object.keys(repairKindLabel) as RepairKind[]
export const repairStatuses = Object.keys(repairStatusLabel) as RepairStatus[]
export const payMethods = Object.keys(payMethodLabel) as PayMethod[]

export function tripTone(status: TripStatus) {
  if (status === 'loading') return 'warn'
  if (status === 'in_transit') return 'info'
  if (status === 'delivered') return 'good'
  if (status === 'cancelled') return 'bad'
  return 'slate'
}

export function repairTone(status: RepairStatus) {
  if (status === 'in_progress') return 'warn'
  if (status === 'done') return 'good'
  return 'slate'
}

export function money(value: number) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatPlain(value: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)
}

export function dateRu(iso: string) {
  if (!iso) return '—'
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}.${month}.${year}`
}

export function tons(value: number) {
  if (!value) return '—'
  return `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value)} т`
}

export function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

export function longDate(date: Date) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  }).format(date)
}

export function periodTitle(period: string) {
  if (period === 'all') return 'Всё время'
  const [year, month] = period.split('-').map(Number)
  const raw = new Date(year, month - 1, 1).toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  })
  const clean = raw.replace(' г.', '')
  return clean.charAt(0).toUpperCase() + clean.slice(1)
}

export function currentPeriod() {
  return todayIso().slice(0, 7)
}

export function tripsAwaitingPayment(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  const noun =
    mod10 === 1 && mod100 !== 11
      ? 'рейс ждёт'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'рейса ждут'
        : 'рейсов ждут'
  return `${count} ${noun} оплату`
}
