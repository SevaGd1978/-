import { foldPlace } from './cities'

export type RoadGeometry = { type: 'LineString'; coordinates: [number, number][] }

export type RoadLeg = {
  from: string
  to: string
  km: number | null
  federalKm: number | null
  minutes: number | null
  geometry: RoadGeometry | null
}

export function legKey(from: string, to: string) {
  return `${foldPlace(from)}\n${foldPlace(to)}`
}

export function roadKm(leg: RoadLeg | undefined, ready: boolean) {
  if (!leg) return ready ? '—' : '…'
  if (leg.km == null) return '—'
  return `${new Intl.NumberFormat('ru-RU').format(leg.km)} км`
}

export function roadDetail(leg: RoadLeg | undefined, ready: boolean) {
  if (!leg) return ready ? 'Нет маршрута по автодорогам' : 'Считаем по дорогам…'
  if (leg.km == null) return 'Нет маршрута по автодорогам'
  if (leg.km === 0) return '0 км'
  const time = leg.minutes == null ? '' : ` · ${driveTime(leg.minutes)}`
  return `${new Intl.NumberFormat('ru-RU').format(leg.km)} км${time}`
}

export function federalLabel(km: number | null | undefined) {
  if (km == null) return ''
  if (km <= 0) return 'Федеральных дорог нет'
  const text = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(km)
  return `Федеральные: ${text} км`
}

function driveTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours <= 0) return `${rest} мин`
  if (rest === 0) return `${hours} ч`
  return `${hours} ч ${rest} мин`
}
