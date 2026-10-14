// 試用資料完整驗收 (與 tests/run.html 共用 src/selftest.js 的判定)
const test = require('node:test');
const assert = require('node:assert');
const T = require('../src/selftest.js');
const { generate } = require('../src/mock.js');

test('含錯誤試用資料：68 項全數檢出、4 項疑似異常剛好對上、無誤報', () => {
  const g = generate({ inject: true });
  const c = T.checkDirty(g, T.full(T.filesOf(g)));
  assert.strictEqual(c.total, 68);
  assert.deepStrictEqual(c.missed.map(x => `${x.ruleId} ${x.where}`), []);
  assert.strictEqual(c.found, 68);
  assert.ok(c.suspectOk, c.suspects.join(', '));
  assert.deepStrictEqual(c.stray, []);
});

test('正確試用資料：所有檢核 0 錯誤、0 警告、0 疑似異常', () => {
  for (const seed of [20251014, 3, 11, 2026]) {
    const g = generate({ seed, policies: seed === 20251014 ? 120 : 200 });
    assert.deepStrictEqual(T.checkClean(T.full(T.filesOf(g))).map(x => `${seed}: ${x}`), []);
  }
});
