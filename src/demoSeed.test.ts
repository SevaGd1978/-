import assert from 'node:assert/strict'
import { createSeed } from './seed.ts'
import { looksLikeDemoSeed } from './demoSeed.ts'

const seed = createSeed()
assert.equal(looksLikeDemoSeed(seed), true)

assert.equal(
  looksLikeDemoSeed({
    ...seed,
    trips: [...seed.trips, { ...seed.trips[0], id: 'real_1', number: 'Р-2001' }],
  }),
  false,
)

assert.equal(looksLikeDemoSeed({ trips: [], vehicles: seed.vehicles }), false)

console.log('demoSeed tests ok')
