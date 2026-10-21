export type CustomerEntry = { label: string; count: number }

export function foldCustomer(value: string) {
  return value.trim().toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ')
}

export function customerCatalog(saved: string[], trips: { customer: string }[]) {
  const counts = new Map<string, number>()
  for (const trip of trips) {
    const label = trip.customer.trim().replace(/\s+/g, ' ')
    if (!label) continue
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const labels = new Set<string>(counts.keys())
  for (const name of saved) {
    const label = name.trim().replace(/\s+/g, ' ')
    if (label) labels.add(label)
  }
  return [...labels]
    .map((label) => ({ label, count: counts.get(label) ?? 0 }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'ru'))
}

export function suggestCustomers(query: string, catalog: CustomerEntry[], limit = 12) {
  const folded = foldCustomer(query)
  const pool = folded
    ? catalog.filter((item) => foldCustomer(item.label).startsWith(folded))
    : catalog
  const matched = pool.length || !folded ? pool : catalog.filter((item) => foldCustomer(item.label).includes(folded))
  return matched.slice(0, limit)
}

export function customerTripsLabel(count: number) {
  const teen = count % 100
  const last = count % 10
  if (teen > 10 && teen < 20) return `${count} рейсов`
  if (last === 1) return `${count} рейс`
  if (last >= 2 && last <= 4) return `${count} рейса`
  return `${count} рейсов`
}
