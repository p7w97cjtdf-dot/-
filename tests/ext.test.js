// 癌症保險、傷害保險：試用資料驗收 (錯誤全數找到、正確資料 0 誤報)
const test = require('node:test');
const assert = require('node:assert');
const M = require('../src/mock-ext.js');
const all = require('../src/rulesets/index.js');

const products = ['cancer'].concat(M.generateAccident ? ['accident'] : []);
for (const product of products) {
  test(`${product}：含錯誤試用資料全部找到、沒有解答以外的問題`, () => {
    const { c } = M.run(product, { inject: true });
    assert.ok(c.total >= 30, `注入 ${c.total} 項`);
    assert.deepStrictEqual(c.missed.map(k => `${k.rules.join('+')} ${k.policy} ${k.what}`), []);
    assert.deepStrictEqual(c.stray.map(i => `${i.ruleId} ${i.policy} ${i.message}`), []);
  });
  test(`${product}：正確試用資料 0 個問題 (多組亂數)`, () => {
    for (const seed of [undefined, 3, 11, 2026]) {
      const { res } = M.run(product, Object.assign({}, seed ? { seed, policies: 300 } : {}));
      assert.deepStrictEqual(res.issues.map(i => `${seed}: ${i.ruleId} ${i.policy} ${i.message}`), []);
    }
  });
  test(`${product}：其他資料組也全部找到`, () => {
    for (const seed of [7, 99, 4242]) {
      const { c } = M.run(product, { inject: true, seed, policies: 400 });
      assert.deepStrictEqual(c.missed.map(k => `${seed}: ${k.rules.join('+')} ${k.what}`), []);
      assert.deepStrictEqual(c.stray.map(i => `${seed}: ${i.ruleId} ${i.message}`), []);
    }
  });
  test(`${product}：合併規則集 (工具實際使用) 結果相同`, () => {
    const a = M.run(product, { inject: true }), b = M.run(product, { inject: true }, all);
    assert.strictEqual(b.res.issues.length, a.res.issues.length);
  });
}
