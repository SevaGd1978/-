import { legKey, roadDetail, type RoadLeg } from './roads'
import { tripRoadPairs } from './tripRoute.ts'
import type { Trip } from './types.ts'

export function tripRouteDistance(routes: Record<string, RoadLeg>, ready: boolean, trip: Trip) {
  const pairs = tripRoadPairs(trip)
  if (pairs.length === 0) return ready ? '—' : '…'
  let total = 0
  let missing = false
  for (const pair of pairs) {
    const leg = routes[legKey(pair.from, pair.to)]
    if (!leg || leg.km == null) {
      missing = true
      continue
    }
    total += leg.km
  }
  if (missing && total === 0) return ready ? '—' : '…'
  const km = new Intl.NumberFormat('ru-RU').format(Math.round(total))
  return missing ? `${km} км*` : `${km} км`
}

export function tripRouteDetail(routes: Record<string, RoadLeg>, ready: boolean, trip: Trip) {
  const pairs = tripRoadPairs(trip)
  if (pairs.length === 0) return ready ? 'Нет маршрута' : 'Считаем по дорогам…'
  if (pairs.length === 1) return roadDetail(routes[legKey(pairs[0].from, pairs[0].to)], ready)
  let total = 0
  let minutes = 0
  let missing = false
  for (const pair of pairs) {
    const leg = routes[legKey(pair.from, pair.to)]
    if (!leg || leg.km == null) {
      missing = true
      continue
    }
    total += leg.km
    if (leg.minutes != null) minutes += leg.minutes
  }
  if (total === 0) return ready ? 'Нет маршрута по автодорогам' : 'Считаем по дорогам…'
  const km = new Intl.NumberFormat('ru-RU').format(Math.round(total))
  const time =
    minutes > 0
      ? ` · ${Math.floor(minutes / 60) > 0 ? `${Math.floor(minutes / 60)} ч ` : ''}${minutes % 60} мин`
      : ''
  const legs = `${pairs.length} плеч${missing ? ', часть без данных' : ''}`
  return `${km} км${time} · ${legs}`
}
