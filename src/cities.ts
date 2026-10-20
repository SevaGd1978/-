export type CityPoint = {
  name: string
  region: string
  lat: number
  lon: number
  population: number
}

export function foldPlace(value: string) {
  return value.trim().toLowerCase().replaceAll('ё', 'е').replace(/\s+/g, ' ')
}

export function matchCity(query: string, cities: CityPoint[]): CityPoint | null {
  const folded = foldPlace(query).replace(/^(город|г\.?)\s+/, '')
  if (!folded) return null
  const exact = cities.filter((city) => foldPlace(city.name) === folded)
  if (exact.length) return prefer(exact, folded)
  const comma = folded.indexOf(',')
  if (comma > 0) {
    const name = folded.slice(0, comma).trim()
    const region = folded.slice(comma + 1).trim()
    const named = cities.filter((city) => foldPlace(city.name) === name && foldPlace(city.region).includes(region))
    if (named.length) return prefer(named, folded)
  }
  return null
}

function prefer(cities: CityPoint[], query: string) {
  const regional = cities.filter((city) => query.includes(foldPlace(city.region)))
  const pool = regional.length ? regional : cities
  return pool.reduce((best, city) => (city.population > best.population ? city : best))
}
