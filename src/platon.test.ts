import assert from 'node:assert/strict'
import { platonCharge, platonComment, platonRate } from './platon.ts'

assert.equal(platonRate('2026-10-16'), 5.19)
assert.equal(platonRate('2026-03-01'), 5.19)
assert.equal(platonRate('2026-02-15'), 3.53)
assert.equal(platonRate('2025-06-01'), 3.34)
assert.equal(platonRate('2019-12-01'), null)

assert.deepEqual(platonCharge(590, '2026-10-16'), { perKm: 5.19, amount: 3062.1 })
assert.deepEqual(platonCharge(557, '2026-10-07'), { perKm: 5.19, amount: 2890.83 })
assert.equal(platonCharge(0, '2026-10-16'), null)
assert.equal(platonComment(218, 5.19), 'Платон · 218 км федеральных дорог × 5,19 ₽/км')

console.log('platon tests ok')
