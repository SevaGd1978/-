import assert from 'node:assert/strict'
import { parseTrip } from './records.ts'

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

console.log('records tests ok')
