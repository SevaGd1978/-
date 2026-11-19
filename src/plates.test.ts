import assert from 'node:assert/strict'
import { normalizePlateKey, platesMatch } from './plates.ts'

assert.equal(normalizePlateKey('а123вс 116'), 'А123ВС116')
assert.equal(normalizePlateKey('A123BC 116'), 'А123ВС116')
assert.equal(platesMatch('А123ВС 116', 'a123bc116'), true)
assert.equal(platesMatch('А123ВС 116', 'К456ОР 716'), false)

console.log('plates tests ok')
