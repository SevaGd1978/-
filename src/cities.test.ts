import assert from 'node:assert/strict'
import { cityChoice, matchCity, suggestCities, type CityPoint } from './cities.ts'

const cities: CityPoint[] = [
  { name: 'Казань', region: 'Татарстан', lat: 55.79, lon: 49.11, population: 1_300_000 },
  { name: 'Мирный', region: 'Архангельская', lat: 62.76, lon: 40.33, population: 27_000 },
  { name: 'Мирный', region: 'Якутия', lat: 62.54, lon: 113.96, population: 34_000 },
  { name: 'Советск', region: 'Калининградская', lat: 55.08, lon: 21.88, population: 38_000 },
  { name: 'Советск', region: 'Кировская', lat: 57.58, lon: 48.95, population: 15_000 },
  { name: 'Советск', region: 'Тульская', lat: 53.93, lon: 37.63, population: 7_000 },
]

assert.equal(matchCity('  Казань ', cities)?.region, 'Татарстан')
assert.equal(matchCity('г. казань', cities)?.name, 'Казань')
assert.equal(matchCity('Мирный', cities)?.region, 'Якутия')
assert.equal(matchCity('Советск, Кировская', cities)?.region, 'Кировская')
assert.equal(matchCity('Неттакогогорода', cities), null)
assert.equal(matchCity('   ', cities), null)

assert.equal(suggestCities('каз', cities)[0]?.name, 'Казань')
assert.equal(suggestCities('каз', cities).length, 1)
assert.equal(suggestCities('г. каз', cities)[0]?.name, 'Казань')
assert.deepEqual(
  suggestCities('совет', cities).map((city) => city.region),
  ['Калининградская', 'Кировская', 'Тульская'],
)
assert.equal(suggestCities('Советск, Кировская', cities)[0]?.region, 'Кировская')
assert.equal(suggestCities('татар', cities)[0]?.name, 'Казань')
assert.equal(suggestCities('', cities, 2)[0]?.name, 'Казань')
assert.equal(suggestCities('неттакого', cities).length, 0)
assert.equal(cityChoice(cities[0], cities), 'Казань')
assert.equal(cityChoice(cities.find((city) => city.region === 'Кировская')!, cities), 'Советск, Кировская')

console.log('cities tests ok')
