// 試用資料完整驗收：與網頁「載入含錯誤資料」相同的流程，一次跑完全部檢核
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const R = require('../src/recon.js');
const M = require('../src/master.js');
const A = require('../src/anomaly.js');
const dsl = require('../src/rules-dsl.js');
const S = require('../src/rule-samples.js');
const { generate } = require('../src/mock.js');

function full(g) {
  const res = C.validate(life, { L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D } });
  const cust = M.customers(res, g.customers), prod = M.products(res, g.products);
  const anom = A.check(res, g.customers);
  const roll = R.rollForward(res, g.prior);
  const ctl = R.controlRecon(res, g.control, roll.issues);
  const stmt = R.statement(g.statement, res);
  return { res, cust, prod, anom, roll, ctl, stmt };
}
const pol = i => (i.policy || '').trim();

test('含錯誤試用資料：68 項全數檢出，另有 4 項疑似異常', () => {
  const g = generate({ inject: true });
  const r = full(g);
  const det = g.key.filter(k => r.res.issues.some(i => i.ruleId === k.ruleId && (!k.policy || pol(i) === k.policy)));
  const mst = g.masterKey.filter(k => r.cust.issues.concat(r.prod.issues).some(i => i.ruleId === k.ruleId && i.policy === k.policy));
  const rc = g.reconKey.filter(k => k.module === 'control'
    ? r.ctl.rows.some(x => x.item === k.item && x.period === k.period && x.status === k.status)
    : (k.module === 'roll' ? r.roll.issues : r.stmt.issues).some(i => i.ruleId === k.ruleId && (k.policy ? pol(i) === k.policy : i.code === k.code)));
  const imp = dsl.runRules(life, S.converted.company, { L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D } });
  const ru = g.ruleKey.filter(k => imp.some(i => i.ruleId === k.ruleId && pol(i) === k.policy));
  const found = det.length + mst.length + rc.length + ru.length, total = g.key.length + g.masterKey.length + g.reconKey.length + g.ruleKey.length;
  assert.strictEqual(total, 68);
  assert.strictEqual(found, 68, `明細 ${det.length}/${g.key.length}、客戶商品 ${mst.length}/${g.masterKey.length}、對帳 ${rc.length}/${g.reconKey.length}、匯入規則 ${ru.length}/${g.ruleKey.length}`);
  // 疑似異常：剛好是埋入的 4 筆，且不計入錯誤
  assert.deepStrictEqual(r.anom.issues.map(i => `${i.ruleId} ${pol(i)}`).sort(), g.anomalyKey.map(k => `${k.ruleId} ${k.policy}`).sort());
  assert.ok(r.anom.issues.every(i => i.severity === 'suspect'));
  // 埋入疑似異常的保單不應產生任何錯誤或警告 (資料合法，只是不合理)
  const anomPol = new Set(g.anomalyKey.map(k => k.policy));
  const all = r.res.issues.concat(r.cust.issues, r.prod.issues, r.roll.issues);
  assert.deepStrictEqual(all.filter(i => anomPol.has(pol(i))).map(i => `${i.ruleId} ${pol(i)} ${i.message}`), []);
  // 客戶/商品問題只出現在解答列出的保單
  const mpol = new Set(g.masterKey.map(k => k.policy).concat(g.key.map(k => k.policy)));
  const linked = new Set(g.key.flatMap(k => k.affects || []));   // 其他錯誤的連帶結果 (已在解答說明)
  assert.deepStrictEqual(r.cust.issues.concat(r.prod.issues).filter(i => !mpol.has(i.policy) && !linked.has(`${i.ruleId} ${i.policy}`)).map(i => `${i.ruleId} ${i.policy} ${i.message}`), []);
});

test('正確試用資料：所有檢核 0 錯誤、0 警告、0 疑似異常', () => {
  for (const seed of [20251014, 3, 11, 2026]) {
    const g = generate({ seed, policies: seed === 20251014 ? 120 : 200 });
    const r = full(g);
    const all = r.res.issues.concat(r.cust.issues, r.prod.issues, r.anom.issues, r.roll.issues, r.ctl.issues, r.stmt.issues);
    assert.deepStrictEqual(all.map(i => `${seed}: ${i.ruleId} ${pol(i)} ${i.message}`), []);
  }
});
