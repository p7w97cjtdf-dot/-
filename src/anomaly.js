/*
 * 資料邏輯合理性：疑似異常 (需人工判斷)
 * 這些不是填報手冊的錯誤，而是「資料本身可能合法、但不太合理」的情況，
 * 結果一律標為 suspect，不計入錯誤數，也不影響申報檔是否可送出。
 *  A001 新契約投保年齡超出合理範圍 (> 80 歲)
 *  A002 保額 / 應繳總保費比，與同商品中位數相差 5 倍以上 (統計離群)
 *  A003 生效後 180 天內發生身故 / 完全失能 / 末期給付
 *  A004 同一被保險人 365 天內有 2 次以上身故 / 失能 / 末期給付
 * 已由手冊規則涵蓋的不重複實作：理賠發生日早於保險期間起日 (26600_D1002，錯誤)。
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('./core.js') : root.DQ;
  const life = isNode ? require('./rulesets/life.js') : root.DQ.rulesets.life;
  const R = isNode ? require('./recon.js') : root.DQ.recon;
  const m = factory(C, life, R);
  if (isNode) module.exports = m; else root.DQ.anomaly = m;
})(typeof self !== 'undefined' ? self : this, function (C, life, R) {
  'use strict';
  const L = life.layouts.L, D = life.layouts.D;
  const AGE_MAX = 80, RATIO_FACTOR = 5, RATIO_MIN_GROUP = 5, EARLY_DAYS = 180, REPEAT_DAYS = 365;
  const SERIOUS = { '1': '身故', '2': '完全失能', '3': '生命末期提前給付' };

  const catalog = [
    { id: 'A001', name: `新契約投保年齡超過 ${AGE_MAX} 歲`, level: '疑似異常', ref: '合理性：投保年齡', severity: 'suspect' },
    { id: 'A002', name: `保額/總保費比與同商品中位數相差 ${RATIO_FACTOR} 倍以上`, level: '疑似異常', ref: '合理性：統計離群 (中位數比)', severity: 'suspect' },
    { id: 'A003', name: `生效後 ${EARLY_DAYS} 天內身故/失能/末期給付`, level: '疑似異常', ref: '合理性：早期理賠', severity: 'suspect' },
    { id: 'A004', name: `同一被保險人 ${REPEAT_DAYS} 天內多次身故/失能/末期給付`, level: '疑似異常', ref: '合理性：短期多次理賠', severity: 'suspect' },
  ];

  const ok = (lay, r) => r._raw.length === lay.recordLength;
  const dateOk = s => C.isValidDate(s);
  const days = (a, b) => Math.round((C.toDate(b) - C.toDate(a)) / 86400000);
  const ageAt = (birth, d) => { let a = +d.slice(0, 4) - +birth.slice(0, 4); if (d.slice(4) < birth.slice(4)) a--; return a; };
  const big = s => /^\d+$/.test(s) ? Number(s) : null;
  const key = r => r.policyNo.trim() + '/' + r.policySeq.trim();
  const median = xs => { const s = xs.slice().sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };

  // res：明細檢核結果；customersCsv：客戶資料 (選填，用證號辨識同一被保險人)
  function check(res, customersCsv) {
    const issues = [];
    const push = (file, r, o) => issues.push(Object.assign({ severity: 'suspect', category: '合理性（疑似異常）', file, line: r._line, policy: key(r) }, o));
    const Ls = (res.data.L || []).filter(r => ok(L, r)), Ds = (res.data.D || []).filter(r => ok(D, r));

    // A001
    for (const r of Ls) if (r.addType === 'NEW' && dateOk(r.birthDate) && dateOk(r.startDate)) {
      const a = ageAt(r.birthDate, r.startDate);
      if (a > AGE_MAX && a <= 100) push('L', r, { ruleId: 'A001', fields: ['birthDate', 'startDate'], value: `${a} 歲`,
        message: `新契約投保年齡 ${a} 歲，超過一般承保上限 ${AGE_MAX} 歲`, suggestion: '確認出生日期是否誤植；若屬實，確認核保紀錄' });
    }

    // A002：以原幣金額計算，避免匯率影響；同商品代號 5 筆以上才比較
    const groups = new Map();
    for (const r of Ls) {
      const s = big(r.sumInsuredOrig), p = big(r.totalPremOrig);
      if (!s || !p || r.payFreq === '0') continue;
      const g = r.productCode.trim();
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push({ r, ratio: s / p });
    }
    for (const [g, xs] of groups) {
      if (xs.length < RATIO_MIN_GROUP) continue;
      const med = median(xs.map(x => x.ratio));
      for (const { r, ratio } of xs) {
        const f = ratio / med;
        if (f >= RATIO_FACTOR || f <= 1 / RATIO_FACTOR) push('L', r, { ruleId: 'A002', fields: ['sumInsuredOrig', 'totalPremOrig'], value: `${ratio.toFixed(2)} (中位數 ${med.toFixed(2)})`,
          message: `保額/應繳總保費比 ${ratio.toFixed(2)}，為商品 ${g} 中位數 ${med.toFixed(2)} 的 ${f >= 1 ? f.toFixed(1) + ' 倍' : '1/' + (1 / f).toFixed(1)}（同商品 ${xs.length} 筆）`,
          suggestion: f >= 1 ? '保費相對保額偏低：確認總保費是否少一位數或漏乘繳費年期' : '保費相對保額偏高：確認保額是否少一位數' });
      }
    }

    // A003
    const serious = Ds.filter(d => SERIOUS[d.claimType] && dateOk(d.eventDate) && dateOk(d.startDate));
    for (const d of serious) {
      const n = days(d.startDate, d.eventDate);
      if (n >= 0 && n < EARLY_DAYS) push('D', d, { ruleId: 'A003', fields: ['startDate', 'eventDate'], value: `${n} 天`,
        message: `保險期間起日 ${d.startDate} 後 ${n} 天即發生${SERIOUS[d.claimType]}（${d.eventDate}）`, suggestion: '早期理賠：確認是否有帶病投保、告知義務或起保日填錯' });
    }

    // A004：有客戶資料時以被保險人證號辨識，否則以保單辨識
    const insured = new Map();
    if (customersCsv) for (const o of R.csvObjects(customersCsv)) if (o['角色'] === '2' && o['證件編號']) insured.set((o['保單編號'] || '') + '/' + (o['保單序號'] || ''), o['證件編號'].toUpperCase());
    const byPerson = new Map();
    for (const d of serious) { const p = insured.get(key(d)) || 'policy:' + key(d); if (!byPerson.has(p)) byPerson.set(p, []); byPerson.get(p).push(d); }
    for (const [p, ds] of byPerson) {
      if (ds.length < 2) continue;
      ds.sort((a, b) => a.eventDate.localeCompare(b.eventDate));
      for (let i = 1; i < ds.length; i++) {
        const n = days(ds[i - 1].eventDate, ds[i].eventDate);
        if (n <= REPEAT_DAYS) push('D', ds[i], { ruleId: 'A004', fields: ['claimType', 'eventDate'], value: `${n} 天內 2 次`,
          message: `同一被保險人${p.startsWith('policy:') ? '（同保單）' : ''}在 ${n} 天內有 2 次給付：第 ${ds[i - 1]._line} 行${SERIOUS[ds[i - 1].claimType]}（${ds[i - 1].eventDate}）、本筆${SERIOUS[ds[i].claimType]}（${ds[i].eventDate}）`,
          suggestion: '確認是否重複申報，或同一事故分次給付' });
      }
    }
    issues.forEach(i => { i.ruleName = (catalog.find(c => c.id === i.ruleId) || {}).name; });
    return { issues, summary: { suspects: issues.length } };
  }

  return { catalog, check, LABEL: '疑似異常（需人工判斷）', AGE_MAX, RATIO_FACTOR, EARLY_DAYS, REPEAT_DAYS };
});
