import assert from 'node:assert/strict'
import { federalKilometers, isFederalRef } from './federalRoads.ts'

assert.equal(isFederalRef('Р-243'), true)
assert.equal(isFederalRef('M-7'), true)
assert.equal(isFederalRef('М-7; Е22'), true)
assert.equal(isFederalRef('16К-0396'), false)
assert.equal(isFederalRef('33Р-001'), false)
assert.equal(isFederalRef('94Р-12'), false)
assert.equal(isFederalRef(''), false)
assert.equal(
  federalKilometers([
    { distance: 217700, ref: 'Р-243' },
    { distance: 111100, ref: '16К-0396' },
    { distance: 94500, ref: '94Р-12' },
    { distance: 5000, ref: 'М-7' },
  ]),
  222.7,
)

console.log('federal roads tests ok')
