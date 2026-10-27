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

export function cityChoice(city: CityPoint, cities: CityPoint[]) {
  const name = foldPlace(city.name)
  const shared = cities.filter((item) => foldPlace(item.name) === name).length > 1
  return shared ? `${city.name}, ${city.region}` : city.name
}

export function suggestCities(query: string, cities: CityPoint[], limit = 12) {
  const folded = foldPlace(query).replace(/^(город|г\.?)\s+/, '')
  const pool = folded ? matchingCities(cities, folded) : cities
  return [...pool]
    .sort((left, right) => {
      if (right.population !== left.population) return right.population - left.population
      return left.name.localeCompare(right.name, 'ru') || left.region.localeCompare(right.region, 'ru')
    })
    .slice(0, limit)
}

function matchingCities(cities: CityPoint[], folded: string) {
  const prefix = cities.filter((city) => {
    const name = foldPlace(city.name)
    const full = `${name}, ${foldPlace(city.region)}`
    return name.startsWith(folded) || full.startsWith(folded)
  })
  if (prefix.length) return prefix
  return cities.filter((city) => {
    const name = foldPlace(city.name)
    const full = `${name}, ${foldPlace(city.region)}`
    return name.includes(folded) || full.includes(folded)
  })
}
