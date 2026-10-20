import assert from 'node:assert/strict'
import { matchCity, type CityPoint } from './cities.ts'

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

console.log('cities tests ok')
