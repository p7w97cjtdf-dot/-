/*
 * 試用資料驗收：一次跑完全部檢核，比對「錯誤解答」。
 * tests/trial.test.js (Node) 與 tests/run.html (瀏覽器) 共用這份判定邏輯。
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = isNode ? {
    C: require('./core.js'), life: require('./rulesets/life.js'), R: require('./recon.js'), M: require('./master.js'),
    A: require('./anomaly.js'), dsl: require('./rules-dsl.js'), S: require('./rule-samples.js'),
  } : { C: root.DQ, life: root.DQ.rulesets.life, R: root.DQ.recon, M: root.DQ.master, A: root.DQ.anomaly, dsl: root.DQ.dsl, S: root.DQ.ruleSamples };
  const m = factory(deps);
  if (isNode) module.exports = m; else root.DQ.selftest = m;
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  const { C, life, R, M, A, dsl, S } = deps;
  const pol = i => (i.policy || '').trim();
  const t = f => f && f.text;

  // files：{ L, D, prior, control, statement, products, customers }，每個為 { name, text }
  function full(files) {
    const LD = { L: files.L, D: files.D };
    const res = C.validate(life, LD);
    const cust = files.customers ? M.customers(res, t(files.customers)) : { issues: [] };
    const prod = files.products ? M.products(res, t(files.products)) : { issues: [] };
    const anom = A.check(res, t(files.customers));
    const roll = R.rollForward(res, t(files.prior));
    const ctl = files.control ? R.controlRecon(res, t(files.control), roll.issues) : { rows: [], issues: [] };
    const stmt = files.statement ? R.statement(t(files.statement), res) : { issues: [] };
    // 規則匯入情境：套用範例「公司內部核保規則」(預先轉換結果)
    const imported = dsl.runRules(life, S.converted.company, LD);
    return { res, cust, prod, anom, roll, ctl, stmt, imported };
  }
  const allIssues = r => r.res.issues.concat(r.cust.issues, r.prod.issues, r.anom.issues, r.roll.issues, r.ctl.issues, r.stmt.issues, r.imported);

  // 文字檔版的模擬資料 → 引擎輸入
  const filesOf = g => ({ L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D }, prior: { name: g.names.prior, text: g.prior },
    control: { name: g.names.control, text: g.control }, statement: { name: g.names.statement, text: g.statement },
    products: { name: g.names.products, text: g.products }, customers: { name: g.names.customers, text: g.customers } });

  // 含錯誤版：逐項比對解答。excel=true 時，「長度不足」與「空白行」兩項無法以 Excel 儲存格表示，不列入應找到
  function checkDirty(g, r, opts) {
    const excel = opts && opts.excel;
    const NOT_IN_EXCEL = new Set(['10300', 'F003']);
    const items = [];
    const add = (group, k, found) => items.push({ group, ruleId: k.ruleId, where: k.policy || k.code || [k.item, k.period].filter(Boolean).join(' '), desc: k.desc, found, skipped: excel && NOT_IN_EXCEL.has(k.ruleId) });
    for (const k of g.key) add('明細檢核', k, r.res.issues.some(i => i.ruleId === k.ruleId && (!k.policy || pol(i) === k.policy)));
    for (const k of g.masterKey) add(k.ruleId.startsWith('PM') ? '商品資料' : '客戶資料', k, r.cust.issues.concat(r.prod.issues).some(i => i.ruleId === k.ruleId && i.policy === k.policy));
    for (const k of g.reconKey) add({ control: '跨系統對帳', roll: '期初期末結轉', stmt: '財報勾稽' }[k.module], k, k.module === 'control'
      ? r.ctl.rows.some(x => x.item === k.item && x.period === k.period && x.status === k.status)
      : (k.module === 'roll' ? r.roll.issues : r.stmt.issues).some(i => i.ruleId === k.ruleId && (k.policy ? pol(i) === k.policy : i.code === k.code)));
    for (const k of g.ruleKey) add('匯入規則', k, r.imported.some(i => i.ruleId === k.ruleId && pol(i) === k.policy));
    const expected = items.filter(x => !x.skipped);
    // 疑似異常：應剛好等於埋入的案例
    const suspects = r.anom.issues.map(i => `${i.ruleId} ${pol(i)}`).sort();
    const suspectKey = g.anomalyKey.map(k => `${k.ruleId} ${k.policy}`).sort();
    // 誤報：落在解答以外的保單上的明細、客戶、商品問題 (連帶結果已在解答註明)
    const keyed = new Set([].concat(g.key, g.masterKey, g.ruleKey, g.anomalyKey, g.reconKey).map(k => k.policy).filter(Boolean));
    const linked = new Set(g.key.flatMap(k => k.affects || []));
    const stray = r.res.issues.concat(r.cust.issues, r.prod.issues)
      .filter(i => pol(i) && pol(i) !== '/' && !keyed.has(pol(i)) && !linked.has(`${i.ruleId} ${pol(i)}`) && i.ruleId !== '10300')
      .map(i => `${i.ruleId} ${pol(i)} ${i.message}`);
    return {
      items, total: items.length, expected: expected.length, found: expected.filter(x => x.found).length,
      missed: expected.filter(x => !x.found), suspects, suspectKey, suspectOk: suspects.join() === suspectKey.join(), stray,
    };
  }

  // 正確版：所有檢核都不應有任何問題
  function checkClean(r) { return allIssues(r).map(i => `${i.ruleId} ${pol(i) || i.code || ''} ${i.message}`); }

  return { full, filesOf, checkDirty, checkClean, allIssues };
});
