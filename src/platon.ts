// Официальный тариф системы «Платон» для грузовиков тяжелее 12 т.
// Источник: https://platon.ru/ru/about/procedure-and-conditions/
// Постановление Правительства РФ от 14.06.2013 № 504, в редакции от 27.11.2025 № 1901.
const PLATON_RATES: { from: string; perKm: number }[] = [
  { from: '2026-03-01', perKm: 5.19 },
  { from: '2026-02-01', perKm: 3.53 },
  { from: '2025-02-01', perKm: 3.34 },
  { from: '2024-02-01', perKm: 3.05 },
  { from: '2023-02-01', perKm: 2.84 },
  { from: '2022-02-01', perKm: 2.54 },
  { from: '2021-02-01', perKm: 2.34 },
  { from: '2020-02-01', perKm: 2.2 },
]

export function platonRate(date: string): number | null {
  const row = PLATON_RATES.find((item) => date >= item.from)
  return row ? row.perKm : null
}

export function platonCharge(km: number, date: string) {
  if (!Number.isFinite(km) || km <= 0) return null
  const perKm = platonRate(date)
  if (perKm == null) return null
  return { perKm, amount: Math.round(km * perKm * 100) / 100 }
}

export function platonComment(km: number, perKm: number) {
  const kilometers = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(km)
  const rate = perKm.toFixed(2).replace('.', ',')
  return `Платон · ${kilometers} км федеральных дорог × ${rate} ₽/км`
}

export function platonExpenseId(tripId: string) {
  return `platon_${tripId}`
}
