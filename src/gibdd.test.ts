import assert from 'node:assert/strict'
import { finesForm, parseGibddPayload, splitPlate, stsLooksValid } from './gibdd.ts'

assert.deepEqual(splitPlate('А123ВС 116'), { regnum: 'А123ВС', regreg: '116' })
assert.deepEqual(splitPlate('a123bc77'), { regnum: 'А123ВС', regreg: '77' })
assert.equal(splitPlate('123'), null)
assert.equal(stsLooksValid('99 12 345678'), true)
assert.equal(stsLooksValid('123'), false)

const form = finesForm({
  regnum: 'А123ВС',
  regreg: '116',
  sts: '9912 345678',
  captchaWord: ' 15аб ',
  captchaToken: 'token',
})
assert.equal(form.stsnum, '9912345678')
assert.equal(form.captchaWord, '15аб')
assert.equal(form.captchaToken, 'token')

const found = parseGibddPayload({
  code: 200,
  divisions: { '16': { name: 'ЦАФАП ГИБДД' } },
  data: [
    {
      NumPost: '18810150260211001234',
      DatePost: '2026-02-11 10:00:00',
      Summa: 500,
      KoAPtext: 'Превышение скорости',
      Division: 16,
      enableDiscount: true,
      DateDiscount: '2026-02-26',
    },
  ],
})
assert.equal(found.ok, true)
if (!found.ok) throw new Error('fines')
assert.equal(found.fines.length, 1)
assert.equal(found.fines[0].number, '18810150260211001234')
assert.equal(found.fines[0].date, '2026-02-11')
assert.equal(found.fines[0].amount, 500)
assert.equal(found.fines[0].division, 'ЦАФАП ГИБДД')
assert.equal(found.fines[0].discount, 'до 26.02.2026')

assert.deepEqual(parseGibddPayload({ code: 404, message: 'Информация не найдена' }), { ok: true, fines: [] })
const captcha = parseGibddPayload({ code: 201, message: 'Проверка капчи не была пройдена' })
assert.equal(captcha.ok, false)
if (captcha.ok) throw new Error('captcha')
assert.equal(captcha.retryCaptcha, true)

console.log('gibdd tests ok')
