/*
 * 規則數量統計：工具「檢核規則」分頁、命令列與 landing page 的數字都以此為準 (tests/landing.test.js 會比對)。
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = isNode
    ? { life: require('./rulesets/life.js'), fin: require('./rulesets/finance.js'), master: require('./master.js'), anomaly: require('./anomaly.js') }
    : null;
  const m = factory(deps);
  if (isNode) module.exports = m; else { root.DQ = root.DQ || {}; root.DQ.ruleStats = m; }
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  function count(d) {
    d = d || deps || { life: self.DQ.rulesets.life, fin: self.DQ.rulesets.finance, master: self.DQ.master, anomaly: self.DQ.anomaly };
    const uniq = list => new Set(list.map(r => r.id)).size;
    const fin = lv => d.fin.catalog.filter(r => lv.includes(r.level));
    const levels = {};
    for (const r of d.life.catalog) levels[r.level] = (levels[r.level] || 0) + 1;
    const cats = [
      { key: 'detail', name: '明細檢核', n: uniq(d.life.catalog), note: Object.entries(levels).map(([k, v]) => `${k} ${v}`).join('、') },
      { key: 'master', name: '主檔交叉比對', n: uniq(d.master.catalog), note: `客戶資料 ${d.master.catalog.filter(r => r.id.startsWith('C')).length}、商品資料 ${d.master.catalog.filter(r => r.id.startsWith('PM')).length}` },
      { key: 'recon', name: '跨系統對帳', n: uniq(fin(['跨系統對帳'])), note: '上游控制總數逐期比對，差異自動歸因 (時間差／定義差／待查)' },
      { key: 'stmt', name: '財報勾稽', n: uniq(fin(['財報', '財報×明細'])), note: '結轉、上下層合計、資產 = 負債 + 權益、停用科目、代號錯置、給付明細勾稽' },
      { key: 'roll', name: '期初期末結轉', n: uniq(fin(['期初期末結轉'])), note: '上年度期末 vs 本年度期初逐保單勾稽' },
      { key: 'anomaly', name: '合理性（疑似異常）', n: uniq(d.anomaly.catalog), note: '不計入錯誤，需人工判斷' },
    ];
    return { cats, total: cats.reduce((s, c) => s + c.n, 0), by: Object.fromEntries(cats.map(c => [c.key, c.n])) };
  }
  return { count };
});
