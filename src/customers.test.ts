import assert from 'node:assert/strict'
import { customerCatalog, customerTripsLabel, suggestCustomers } from './customers.ts'

const catalog = customerCatalog(
  ['ООО «Архив»'],
  [
    { customer: 'ООО «Теплосеть»' },
    { customer: 'ООО «Теплосеть»' },
    { customer: 'АО «СтройТрубМонтаж»' },
    { customer: 'МУП «Горводоканал»' },
  ],
)

assert.deepEqual(
  catalog.map((item) => item.label),
  ['ООО «Теплосеть»', 'АО «СтройТрубМонтаж»', 'МУП «Горводоканал»', 'ООО «Архив»'],
)
assert.equal(suggestCustomers('строй', catalog)[0]?.label, 'АО «СтройТрубМонтаж»')
assert.equal(suggestCustomers('тепло', catalog)[0]?.label, 'ООО «Теплосеть»')
assert.equal(suggestCustomers('', catalog, 2).length, 2)
assert.equal(suggestCustomers('неттакого', catalog).length, 0)
assert.equal(customerTripsLabel(1), '1 рейс')
assert.equal(customerTripsLabel(2), '2 рейса')
assert.equal(customerTripsLabel(5), '5 рейсов')
assert.equal(customerTripsLabel(11), '11 рейсов')

console.log('customers tests ok')
