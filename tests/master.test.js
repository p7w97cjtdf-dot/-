const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const M = require('../src/master.js');
const { generate } = require('../src/mock.js');

const run = g => {
  const res = C.validate(life, { L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D } });
  return { res, cust: M.customers(res, g.customers), prod: M.products(res, g.products) };
};

test('身分證檢查碼', () => {
  assert.ok(M.idCheck('A123456789').ok);
  const bad = M.idCheck('J195366528');
  assert.ok(!bad.ok);
  assert.strictEqual(bad.expected, 'J195366527');
  assert.ok(!M.idCheck('A12345678').ok);
  const id = M.makeId('F', '2', '1234567');
  assert.ok(M.idCheck(id).ok && id.startsWith('F21234567'));
});

test('郵遞區號與地址', () => {
  assert.ok(M.addressOk('110', '臺北市信義區中正路57號7樓').ok);
  assert.ok(M.addressOk('110', '台北市信義區中正路57號').ok, '台/臺 視為相同');
  const r = M.addressOk('813', '臺北市中正區民生路88號3樓');
  assert.ok(!r.ok);
  assert.strictEqual(r.expected, '100');
});

test('正確資料：客戶與商品資料 0 問題 (多組亂數)', () => {
  for (const seed of [20251014, 1, 7, 42]) {
    const { cust, prod } = run(generate({ seed, policies: 150 }));
    assert.deepStrictEqual(cust.issues.concat(prod.issues).map(i => `${seed} ${i.ruleId} ${i.message}`), []);
  }
});

test('試用資料：刻意放入的客戶與商品錯誤全部找到', () => {
  const g = generate({ inject: true });
  const { cust, prod } = run(g);
  const all = cust.issues.concat(prod.issues);
  assert.ok(g.masterKey.length >= 13);
  for (const k of g.masterKey) {
    const hit = all.find(i => i.ruleId === k.ruleId && i.policy === k.policy);
    assert.ok(hit, `${k.ruleId} ${k.policy} ${k.desc}`);
    if (k.fix) assert.strictEqual(hit.fix && hit.fix.value, k.fix, `${k.policy} 修正值`);
    if (k.suggest) assert.strictEqual(hit.fix && hit.fix.value, k.suggest, `${k.policy} 建議代號`);
  }
});

test('以客戶資料更正承保檔後，相關錯誤消失', () => {
  const g = generate({ inject: true });
  const { res, cust } = run(g);
  const fixable = cust.issues.filter(i => i.file === 'L' && i.fix);
  const merged = Object.assign({}, res, { issues: res.issues.concat(fixable.map((i, n) => Object.assign({ id: 9000 + n }, i))) });
  const fixed = C.applyFixes(life, merged, 'L', fixable.map((i, n) => 9000 + n));
  assert.strictEqual(fixed.applied, fixable.length);
  const res2 = C.validate(life, { L: { name: g.names.L, text: fixed.text }, D: { name: g.names.D, text: g.D } });
  for (const p of ['P250000001/A01', 'P250000101/A01']) assert.ok(!res2.issues.some(i => i.ruleId === '23900_L0802' && i.policy.trim() === p), p);
  assert.ok(!res2.issues.some(i => i.ruleId === '20300_L0902'));
});
