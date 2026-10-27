import type { CityPoint } from './cities'

type CityRow = { n: string; r: string; p: number }

let pending: Promise<CityPoint[]> | null = null

export function loadCityList() {
  pending ??= fetch('/api/cities')
    .then(async (response) => {
      if (!response.ok) throw new Error('cities')
      const body = (await response.json()) as { cities?: CityRow[] }
      return (body.cities ?? []).map((row) => ({
        name: row.n,
        region: row.r,
        lat: 0,
        lon: 0,
        population: row.p,
      }))
    })
    .catch((error: unknown) => {
      pending = null
      throw error
    })
  return pending
}
