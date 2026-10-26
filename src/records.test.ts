import assert from 'node:assert/strict'
import { parseExpense, parseRepair, parseTrip } from './records.ts'

const base = {
  id: 't_copy',
  number: 'Р-1042',
  date: '2026-10-21',
  from: 'Казань',
  to: 'Пермь',
  vehicleId: 'v1',
  driverId: 'd1',
  customer: 'ООО «Теплосеть»',
  cargo: 'Труба',
  weightTons: 18,
  rate: 86000,
  status: 'planned',
  note: '',
}

const open = parseTrip({ ...base, payDue: '' })
assert.equal(open?.payDue, '')
assert.equal(open?.number, 'Р-1042')

const dated = parseTrip({ ...base, payDue: '2026-11-01' })
assert.equal(dated?.payDue, '2026-11-01')

assert.equal(parseTrip({ ...base, payDue: 'завтра' }), null)
assert.equal(parseTrip({ ...base, id: '' }), null)

const toll = parseExpense({
  id: 'e_toll',
  vehicleId: 'v1',
  date: '2026-10-21',
  category: 'toll',
  amount: 100,
  comment: 'М-12',
})
assert.equal(toll?.vehicleId, '')
assert.equal(parseExpense({ ...toll, id: 'e_fuel', category: 'fuel', vehicleId: '' }), null)
const workshop = parseExpense({
  id: 'e_shop',
  vehicleId: 'v2',
  date: '2026-10-21',
  category: 'workshop',
  amount: 900,
  comment: '',
})
assert.equal(workshop?.vehicleId, '')
assert.equal(workshop?.category, 'workshop')

const parts = parseRepair({
  id: 'r_parts',
  vehicleId: 'v4',
  date: '2026-10-21',
  kind: 'parts',
  description: 'Фильтр',
  partsCost: 800,
  laborCost: 0,
  status: 'queued',
  odometer: 1200,
})
assert.equal(parts?.vehicleId, '')
assert.equal(parts?.odometer, null)
assert.equal(parseRepair({ ...parts, id: 'r_fix', kind: 'repair', vehicleId: '' }), null)

console.log('records tests ok')
