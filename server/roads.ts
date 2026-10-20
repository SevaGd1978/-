import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DatabaseSync } from 'node:sqlite'
import { foldPlace, matchCity, type CityPoint } from '../src/cities.ts'
import type { RoadGeometry, RoadLeg } from '../src/roads.ts'

type Sql = DatabaseSync
type Pair = { from: string; to: string }
type Point = { lat: number; lon: number }

const FAIL_TTL_MS = 60 * 60 * 1000
const USER_AGENT = 'Putevoy/1.0 (dispatch road distance)'
const ROUTERS = ['https://router.project-osrm.org', 'https://routing.openstreetmap.de/routed-car']

const cities = loadCities()
let nominatimAt = 0

export function ensureRoadCache(db: Sql) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS road_cache (
      pair_key TEXT PRIMARY KEY,
      km REAL,
      minutes INTEGER,
      geometry TEXT,
      ok INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS geocode_cache (
      city_key TEXT PRIMARY KEY,
      lat REAL,
      lon REAL,
      ok INTEGER NOT NULL,
      fetched_at INTEGER NOT NULL
    );
  `)
}

export async function lookupRoutes(db: Sql, pairs: Pair[]): Promise<RoadLeg[]> {
  const unique: Pair[] = []
  const seen = new Set<string>()
  for (const pair of pairs) {
    const key = pairKey(pair.from, pair.to)
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(pair)
  }
  const legs: RoadLeg[] = []
  const pending: Pair[] = []
  for (const pair of unique) {
    const cached = readRoad(db, pair)
    if (cached) legs.push(cached)
    else pending.push(pair)
  }
  const queue = [...pending]
  const workers = Array.from({ length: Math.min(3, queue.length) }, async () => {
    while (queue.length) {
      const pair = queue.shift()
      if (!pair) return
      const leg = await resolvePair(db, pair)
      legs.push(leg)
    }
  })
  await Promise.all(workers)
  return legs
}

async function resolvePair(db: Sql, pair: Pair): Promise<RoadLeg> {
  if (foldPlace(pair.from) === foldPlace(pair.to)) {
    const leg = { from: pair.from, to: pair.to, km: 0, minutes: 0, geometry: null }
    writeRoad(db, pair, leg, true)
    return leg
  }
  const from = await locate(db, pair.from)
  const to = await locate(db, pair.to)
  const driven = from && to ? await drive(from, to) : null
  const leg: RoadLeg = driven
    ? { from: pair.from, to: pair.to, km: driven.km, minutes: driven.minutes, geometry: driven.geometry }
    : { from: pair.from, to: pair.to, km: null, minutes: null, geometry: null }
  writeRoad(db, pair, leg, driven !== null)
  return leg
}

async function locate(db: Sql, name: string): Promise<Point | null> {
  const local = matchCity(name, cities)
  if (local) return { lat: local.lat, lon: local.lon }
  const key = foldPlace(name)
  const cached = db.prepare(`SELECT lat, lon, ok, fetched_at FROM geocode_cache WHERE city_key = ?`).get(key) as
    | { lat: number | null; lon: number | null; ok: number; fetched_at: number }
    | undefined
  if (cached?.ok && cached.lat != null && cached.lon != null) return { lat: cached.lat, lon: cached.lon }
  if (cached && !cached.ok && Date.now() - cached.fetched_at < FAIL_TTL_MS) return null
  const point = await nominatim(name)
  db.prepare(
    `INSERT INTO geocode_cache (city_key, lat, lon, ok, fetched_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(city_key) DO UPDATE SET lat = excluded.lat, lon = excluded.lon, ok = excluded.ok, fetched_at = excluded.fetched_at`,
  ).run(key, point?.lat ?? null, point?.lon ?? null, point ? 1 : 0, Date.now())
  return point
}

async function nominatim(name: string): Promise<Point | null> {
  const wait = nominatimAt + 1100 - Date.now()
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
  nominatimAt = Date.now()
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('countrycodes', 'ru')
  url.searchParams.set('q', `${name}, Россия`)
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!response.ok) return null
    const rows = (await response.json()) as { lat?: string; lon?: string; name?: string; category?: string }[]
    const asked = foldPlace(name).replace(/^(город|г\.?)\s+/, '')
    const row = rows.find((item) => item.category === 'place' && foldPlace(item.name || '') === asked)
    const lat = Number(row?.lat)
    const lon = Number(row?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
    return { lat, lon }
  } catch {
    return null
  }
}

async function drive(from: Point, to: Point) {
  for (const base of ROUTERS) {
    const url = `${base}/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=simplified&geometries=geojson&alternatives=false`
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': USER_AGENT, accept: 'application/json' },
        signal: AbortSignal.timeout(12000),
      })
      if (!response.ok) continue
      const body = (await response.json()) as {
        code?: string
        routes?: { distance?: number; duration?: number; geometry?: { type?: string; coordinates?: unknown } }[]
      }
      const route = body.code === 'Ok' ? body.routes?.[0] : undefined
      if (!route || typeof route.distance !== 'number' || typeof route.duration !== 'number') continue
      const geometry = line(route.geometry)
      if (!geometry) continue
      return { km: Math.round(route.distance / 1000), minutes: Math.round(route.duration / 60), geometry }
    } catch {
      continue
    }
  }
  return null
}

function line(value: { type?: string; coordinates?: unknown } | undefined): RoadGeometry | null {
  if (!value || value.type !== 'LineString' || !Array.isArray(value.coordinates)) return null
  const coordinates: [number, number][] = []
  for (const pair of value.coordinates) {
    if (!Array.isArray(pair) || pair.length < 2) return null
    const lon = Number(pair[0])
    const lat = Number(pair[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null
    coordinates.push([lon, lat])
  }
  if (coordinates.length < 2) return null
  return { type: 'LineString', coordinates: slim(coordinates) }
}

function slim(coordinates: [number, number][]) {
  if (coordinates.length <= 800) return coordinates
  const step = Math.ceil(coordinates.length / 800)
  const out = coordinates.filter((_, index) => index % step === 0)
  const last = coordinates[coordinates.length - 1]
  if (out[out.length - 1] !== last) out.push(last)
  return out
}

function readRoad(db: Sql, pair: Pair): RoadLeg | null {
  const row = db.prepare(`SELECT km, minutes, geometry, ok, fetched_at FROM road_cache WHERE pair_key = ?`).get(pairKey(pair.from, pair.to)) as
    | { km: number | null; minutes: number | null; geometry: string | null; ok: number; fetched_at: number }
    | undefined
  if (!row) return null
  if (!row.ok && Date.now() - row.fetched_at >= FAIL_TTL_MS) return null
  return {
    from: pair.from,
    to: pair.to,
    km: row.ok ? row.km : null,
    minutes: row.ok ? row.minutes : null,
    geometry: row.ok ? parseGeometry(row.geometry) : null,
  }
}

function writeRoad(db: Sql, pair: Pair, leg: RoadLeg, ok: boolean) {
  db.prepare(
    `INSERT INTO road_cache (pair_key, km, minutes, geometry, ok, fetched_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(pair_key) DO UPDATE SET
       km = excluded.km, minutes = excluded.minutes, geometry = excluded.geometry,
       ok = excluded.ok, fetched_at = excluded.fetched_at`,
  ).run(pairKey(pair.from, pair.to), ok ? leg.km : null, ok ? leg.minutes : null, ok && leg.geometry ? JSON.stringify(leg.geometry) : null, ok ? 1 : 0, Date.now())
}

function parseGeometry(value: string | null): RoadGeometry | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as RoadGeometry
    if (parsed?.type !== 'LineString' || !Array.isArray(parsed.coordinates)) return null
    return parsed
  } catch {
    return null
  }
}

function pairKey(from: string, to: string) {
  return `${foldPlace(from)}\n${foldPlace(to)}`
}

function loadCities(): CityPoint[] {
  const file = join(dirname(fileURLToPath(import.meta.url)), 'data', 'ru-cities.json')
  const rows = JSON.parse(readFileSync(file, 'utf8')) as { n: string; r: string; lat: number; lon: number; p: number }[]
  return rows.map((row) => ({ name: row.n, region: row.r, lat: row.lat, lon: row.lon, population: row.p }))
}
