const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const source = fs.readFileSync('lib/booking-pricing.ts', 'utf8')
const moduleUnderTest = { exports: {} }
new Function('exports', 'module', ts.transpile(source, { module: ts.ModuleKind.CommonJS }))(moduleUnderTest.exports, moduleUnderTest)
const { quotePeople, validatePeopleTiers } = moduleUnderTest.exports
const tiers = [{ min: 1, max: 2, price: 300000 }, { min: 3, max: 4, price: 250000 }, { min: 5, max: null, price: 200000 }]
test('prices the entire group using the matching tier, including boundaries', () => {
  for (const [people, price] of [[1,300000],[2,300000],[3,250000],[4,250000],[5,200000],[100,200000]]) {
    assert.deepEqual(quotePeople(tiers, people), { unitPrice: price, total: people * price })
  }
})
test('rejects missing, fractional, negative and uncovered counts', () => {
  for (const people of [0,-1,1.5,NaN,Infinity]) assert.equal(quotePeople(tiers, people), null)
  assert.equal(quotePeople(tiers.slice(0, 1), 3), null)
})
test('validates ranges and rejects ambiguous pricing', () => {
  assert.equal(validatePeopleTiers(tiers), null)
  for (const invalid of [[], [{min:1,max:2,price:-1}], [{min:1,max:2,price:0}], [{min:2,max:1,price:10}], [{min:1.5,max:2,price:10}], [{min:1,max:2,price:10},{min:2,max:4,price:20}], [{min:1,max:null,price:10},{min:5,max:6,price:20}]]) assert.ok(validatePeopleTiers(invalid))
})
const { quoteSessions, validateSessionPercentages } = moduleUnderTest.exports
test('additional sessions add percentages of the original price, without compounding', () => {
  assert.deepEqual(quoteSessions(1000000, [50,30], 3), { basePrice:1000000, percent:180, extra:800000, total:1800000 })
  assert.equal(quoteSessions(750000, [50,30], 2).total,1125000)
  assert.equal(quoteSessions(101, [50], 2).total,152)
  assert.equal(quoteSessions(123, [], 1).total,123)
  assert.equal(quoteSessions(123, [0], 2).total,123)
})
test('rejects unconfigured sessions and invalid percentages', () => {
  for (const count of [0, -1, 1.5, 4, NaN]) assert.equal(quoteSessions(100,[50,30],count),null)
  for (const percents of [[-1],[1.5],[Infinity],[10001]]) assert.ok(validateSessionPercentages(percents))
  assert.equal(validateSessionPercentages([50,30,0]),null)
  assert.equal(quoteSessions(Number.MAX_SAFE_INTEGER,[100],2),null)
})
