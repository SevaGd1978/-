import type { Trip, TripRouteKind } from './types.ts'

export function parseRouteKind(value: unknown): TripRouteKind {
  if (value === 'round1' || value === 'round2') return value
  return 'direct'
}

export function tripRouteKindLabel(kind: TripRouteKind) {
  if (kind === 'round1') return 'Кругорейс · 1 загрузка и 1 выгрузка'
  if (kind === 'round2') return 'Кругорейс · 2 загрузки и 2 выгрузки'
  return 'Прямой рейс'
}

export function tripRouteLabel(trip: Pick<Trip, 'routeKind' | 'from' | 'to' | 'load1' | 'unload1' | 'load2' | 'unload2' | 'returnCity'>) {
  const kind = trip.routeKind ?? 'direct'
  if (kind === 'round1') {
    const back = trip.returnCity || trip.from
    return `${trip.from} → погр. ${trip.load1} → выгр. ${trip.unload1} → ${back}`
  }
  if (kind === 'round2') {
    const back = trip.returnCity || trip.from
    return `${trip.from} → погр. ${trip.load1} → выгр. ${trip.unload1} → погр. ${trip.load2} → выгр. ${trip.unload2} → ${back}`
  }
  return `${trip.from} – ${trip.to}`
}

/** Полный маршрут для Excel/PDF: тип + все погрузки и выгрузки. */
export function tripRouteReportLabel(
  trip: Pick<Trip, 'routeKind' | 'from' | 'to' | 'load1' | 'unload1' | 'load2' | 'unload2' | 'returnCity'>,
) {
  const kind = trip.routeKind ?? 'direct'
  if (kind === 'direct') return tripRouteLabel(trip)
  return `${tripRouteKindLabel(kind)}: ${tripRouteLabel(trip)}`
}

export function tripRoadPairs(trip: Trip): { from: string; to: string }[] {
  const kind = trip.routeKind ?? 'direct'
  if (kind === 'round1') {
    const back = trip.returnCity || trip.from
    return [
      { from: trip.from, to: trip.load1 },
      { from: trip.load1, to: trip.unload1 },
      { from: trip.unload1, to: back },
    ].filter((pair) => pair.from && pair.to)
  }
  if (kind === 'round2') {
    const back = trip.returnCity || trip.from
    return [
      { from: trip.from, to: trip.load1 },
      { from: trip.load1, to: trip.unload1 },
      { from: trip.unload1, to: trip.load2 },
      { from: trip.load2, to: trip.unload2 },
      { from: trip.unload2, to: back },
    ].filter((pair) => pair.from && pair.to)
  }
  if (!trip.from || !trip.to) return []
  return [{ from: trip.from, to: trip.to }]
}

export function tripRouteSearchText(trip: Trip) {
  const kind = trip.routeKind ?? 'direct'
  const parts = [trip.from, trip.to, trip.load1, trip.unload1, trip.load2, trip.unload2, trip.returnCity]
  if (kind !== 'direct') parts.push('кругорейс')
  return parts.filter(Boolean).join(' ')
}

export function validateTripRoute(trip: Pick<Trip, 'routeKind' | 'from' | 'to' | 'load1' | 'unload1' | 'load2' | 'unload2'>) {
  const kind = trip.routeKind ?? 'direct'
  if (kind === 'direct') {
    if (!trip.from.trim() || !trip.to.trim()) return 'Укажите откуда и куда.'
    return null
  }
  if (!trip.from.trim()) return 'Укажите базу выезда.'
  if (!trip.load1.trim() || !trip.unload1.trim()) return 'Укажите города первой загрузки и выгрузки.'
  if (kind === 'round2' && (!trip.load2.trim() || !trip.unload2.trim())) {
    return 'Укажите города второй загрузки и выгрузки.'
  }
  return null
}

export function finalizeTripRoute(trip: Trip): Trip {
  const kind = trip.routeKind ?? 'direct'
  if (kind === 'direct') {
    return {
      ...trip,
      routeKind: 'direct',
      load1: '',
      unload1: '',
      load2: '',
      unload2: '',
      returnCity: '',
      odometerLoad2: null,
      odometerUnload2: null,
      customer2: '',
      cargo2: '',
      rate2: 0,
      payDue2: '',
      from: trip.from.trim(),
      to: trip.to.trim(),
    }
  }
  const back = (trip.returnCity || trip.from).trim()
  const isRound2 = kind === 'round2'
  return {
    ...trip,
    routeKind: kind,
    from: trip.from.trim(),
    to: back,
    load1: trip.load1.trim(),
    unload1: trip.unload1.trim(),
    load2: isRound2 ? trip.load2.trim() : '',
    unload2: isRound2 ? trip.unload2.trim() : '',
    returnCity: back,
    odometerLoad2: isRound2 ? trip.odometerLoad2 : null,
    odometerUnload2: isRound2 ? trip.odometerUnload2 : null,
    customer2: isRound2 ? (trip.customer2 ?? '').trim() : '',
    cargo2: isRound2 ? (trip.cargo2 ?? '').trim() : '',
    rate2: isRound2 ? trip.rate2 || 0 : 0,
    payDue2: isRound2 ? trip.payDue2 || '' : '',
  }
}

export function paymentLegLabel(leg: number) {
  if (leg === 1) return 'Плечо 1'
  if (leg === 2) return 'Плечо 2'
  return 'Без плеча'
}

/** Пробег по одометру: от первой погрузки до последней выгрузки. */
export function tripOdometerKm(trip: Pick<Trip, 'routeKind' | 'odometerLoad1' | 'odometerUnload1' | 'odometerUnload2'>) {
  const start = trip.odometerLoad1
  if (start == null) return null
  const kind = trip.routeKind ?? 'direct'
  const end = kind === 'round2' && trip.odometerUnload2 != null ? trip.odometerUnload2 : trip.odometerUnload1
  if (end == null || end < start) return null
  return end - start
}

export function formatOdometer(value: number | null | undefined) {
  if (value == null) return '—'
  return `${value.toLocaleString('ru-RU')} км`
}
