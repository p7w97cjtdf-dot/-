/*
 * 檢查範圍：這次「沒有執行」或「結果不完整」的檢查。
 * 沒放入的資料、被停用的檢查、無法判定的自訂規則、格式不對沒有執行的規則、問題太多沒檢查完，
 * 都要明白寫出來，不能讓結果看起來比實際更安全 (畫面、報告、問題清單、稽核軌跡共用)。
 */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.DQ.coverage = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // present：有放入的資料 (L、D、prior、control、statement、products、customers、CL、CD、AL、AD)
  // o：{ disabled: {檢查編號: 隱藏的問題數}, unjudged: {規則編號: 無法判定的筆數}, invalid: [格式不對沒有執行的規則編號], truncated: 是否問題太多沒檢查完 }
  function scope(present, o) {
    const has = k => present.includes(k), notRun = [], warn = [];
    o = o || {};
    const pair = (a, b, an, bn) => {
      if (has(a) && !has(b)) notRun.push({ what: `${bn}的檢查，以及${an}和${bn}的比對`, short: bn, why: `沒有放入${bn}` });
      if (has(b) && !has(a)) notRun.push({ what: `${an}的檢查，以及${an}和${bn}的比對`, short: an, why: `沒有放入${an}` });
    };
    pair('L', 'D', '保單資料', '理賠資料');
    pair('CL', 'CD', '癌症險保單資料', '癌症險理賠資料');
    pair('AL', 'AD', '傷害險保單資料', '傷害險理賠資料');
    if (has('L')) {
      if (!has('prior')) notRun.push({ what: '去年底和今年初是否接得上', short: '去年接續', why: '沒有放入去年保單資料' });
      if (!has('control')) notRun.push({ what: '和各系統的總數核對', short: '系統總數', why: '沒有放入系統總數' });
      if (!has('customers')) notRun.push({ what: '客戶資料比對（身分證號、生日、性別）', short: '客戶資料', why: '沒有放入客戶資料' });
      if (!has('products')) notRun.push({ what: '商品資料比對（商品代號、停售）', short: '商品資料', why: '沒有放入商品資料' });
    }
    if ((has('L') || has('D')) && !has('statement')) notRun.push({ what: '資產負債表加總', short: '資產負債表', why: '沒有放入資產負債表' });
    const sum = m => Object.values(m || {}).reduce((t, n) => t + n, 0);
    const dis = Object.keys(o.disabled || {}).filter(k => o.disabled[k] > 0);
    if (dis.length) warn.push({ kind: 'disabled', text: `法規更新停用了 ${dis.length} 項檢查，隱藏了 ${sum(o.disabled)} 個問題（${dis.slice(0, 5).join('、')}${dis.length > 5 ? '…' : ''}）`, n: sum(o.disabled) });
    const un = Object.keys(o.unjudged || {}).filter(k => o.unjudged[k] > 0);
    if (un.length) warn.push({ kind: 'unjudged', text: `自訂規則有 ${sum(o.unjudged)} 筆資料無法判定（資料不足或格式不支援，${un.slice(0, 5).join('、')}），這些筆數不算通過`, n: sum(o.unjudged) });
    if ((o.invalid || []).length) warn.push({ kind: 'invalid', text: `${o.invalid.length} 條自訂規則格式不正確，沒有執行（${o.invalid.slice(0, 5).join('、')}）`, n: o.invalid.length });
    if (o.truncated) warn.push({ kind: 'truncated', text: '問題太多，只列出前一部分，之後的資料沒有檢查完', n: 1 });
    return { notRun, warn, complete: !notRun.length && !warn.length, safe: !warn.length };
  }
  // 一句話的摘要 (畫面頂端、報告、稽核軌跡)
  function summary(sc) {
    const parts = sc.warn.map(w => w.text);
    if (sc.notRun.length) parts.push(`沒有執行：${sc.notRun.map(x => x.what).join('、')}`);
    return parts.join('；');
  }
  return { scope, summary };
});
