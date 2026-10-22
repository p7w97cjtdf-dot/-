/*
 * 送給 Claude 的內容一律在這裡組成並遮罩個資，方便稽核與測試。遮罩規則在 src/pii.js：
 *  - 身分證／居留證：A123****89；姓名：王○明；地址：臺北市信義區[已遮蔽地址]
 *  - 電話：0912***678、(02)****6789；Email：w***@example.com；卡號／帳號
 *  - 單筆解釋只送與該問題相關的欄位與少數非個資背景欄位，不送整筆明細
 *  - src/ai.js 送出前會再經過 pii.guard 最後檢查一次，仍有疑似個資就停止送出
 * 出生日期、性別等仍會出現在「問題欄位本身就是它」的情況 (例如出生日期不是合法日期)，
 * 但已無法與姓名、證號連結。
 */
(function (root, factory) {
  const pii = (typeof module === 'object' && module.exports) ? require('./pii.js') : root.DQ.pii;
  const m = factory(pii);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.DQ = root.DQ || {}; root.DQ.aiPayload = m; }
})(typeof self !== 'undefined' ? self : this, function (pii) {
  'use strict';

  // 單筆解釋時可附上的背景欄位 (不含證號、生日、性別、郵遞區號、身心障礙、經濟弱勢、職業代碼)
  const CONTEXT = ['policySeq', 'txnSeq', 'termType', 'term', 'addType', 'addDate', 'exitType', 'exitDate', 'productClass', 'startDate', 'endDate',
    'productCode', 'currency', 'payFreq', 'payTerm', 'claimType', 'eventDate', 'payDate'];

  // 從資料中收集要遮罩的姓名、證號，以及外觀像證號但不是個資的代碼 (保單號碼、賠案號碼、險種代號)
  const EXEMPT_FIELDS = ['policyNo', 'claimNo', 'companyPlanCode', 'companyPolicyCode', 'productCode', 'productClass'];
  function context(res, recon) {
    const names = new Set(), ids = new Set(), exempt = new Set();
    const cust = recon && recon.cust;
    for (const r of (cust && cust.rows) || []) { if (r.name) names.add(r.name.trim()); if (r.id) ids.add(r.id.trim()); }
    for (const recs of Object.values((res && res.data) || {})) for (const r of recs || []) {
      for (const k of EXEMPT_FIELDS) if (r[k] && r[k].trim()) exempt.add(r[k].trim());
      if (r.idNo && r.idNo.trim() && !/^0+$/.test(r.idNo.trim())) ids.add(r.idNo.trim());
    }
    for (const id of ids) exempt.delete(id);
    names.delete(''); ids.delete('');
    return { names: [...names].sort((a, b) => b.length - a.length), ids, exempt, policies: exempt };
  }

  // 每次組成送出內容時累計遮罩了哪些個資 (takeCounts 取出並歸零，畫面顯示用)
  let tally = {};
  const mask = (text, ctx) => { const r = pii.redact(text, ctx); for (const [k, n] of Object.entries(r.counts)) tally[k] = (tally[k] || 0) + n; return r.text; };
  const takeCounts = () => { const t = tally; tally = {}; return t; };
  // 檢查遮罩後是否仍含個資 (測試與畫面預覽用)
  const leaks = (text, ctx) => pii.scan(text, ctx).map(x => `${pii.TYPES[x.type]} ${x.sample}`);

  const sev = s => s === 'error' ? '錯誤' : s === 'suspect' ? '疑似異常' : '警告';
  const fileName = f => ({ L: '承保', D: '給付', C: '客戶資料', P: '商品資料' })[f] || f;

  // 1) AI 根因摘要：檢核摘要、前 25 條規則各一則範例、前 80 筆問題 (位置/編號/欄位/值/訊息)
  function summaryData(DQ, rs, res, recon) {
    const report = DQ.report;
    const tops = report.topRules(rs, res, 25).map(t => ({
      檢核編號: t.ruleId, 項目: t.name, 嚴重度: sev(t.severity), 次數: t.count, 範例: t.sample.message, 建議: t.sample.suggestion,
    }));
    const samples = res.issues.slice(0, 80).map(i => ({
      檔: fileName(i.file), 行: i.line, 保單: (i.policy || '').trim(), 編號: i.ruleId,
      欄位: report.fieldLabel(rs, i), 值: String(i.value).trim(), 問題: i.message,
    }));
    const o = { 規則集: rs.name, 摘要: res.summary, 最常見錯誤: tops, 問題樣本: samples };
    const r = recon || {};
    const rc = {};
    if (r.ctl) rc.上游控制總數對帳 = { 摘要: r.ctl.summary, 差異: r.ctl.rows.filter(x => x.status && x.status !== '一致').map(x => ({ 系統: x.source, 項目: x.name, 期間: x.period, 差異筆數: x.diff && x.diff.cnt, 差異金額: x.diff && x.diff.amt / 100, 判定: x.status, 說明: x.explain })) };
    if (r.roll) rc.期初期末結轉 = { 期初: r.roll.movement.open, 上年度期末: r.roll.movement.priorClose, 問題: r.roll.issues.map(i => ({ 編號: i.ruleId, 保單: i.policy, 問題: i.message })) };
    const mst = [].concat(r.cust ? r.cust.issues : [], r.prod ? r.prod.issues : []);
    if (mst.length) rc.客戶與商品資料 = mst.slice(0, 40).map(i => ({ 編號: i.ruleId, 保單: (i.policy || '').trim(), 問題: i.message, 可自動修正: !!i.fix }));
    if (r.stmt) rc.資產負債表勾稽 = { 平衡: r.stmt.summary.balanced, 問題: r.stmt.issues.map(i => ({ 編號: i.ruleId, 科目: i.code, 根因: i.chainRole || '', 問題: i.message, 說明: i.explain || '' })) };
    o.對帳與勾稽 = rc;
    return mask(JSON.stringify(o), context(res, recon));
  }

  // 2) 單筆問題解釋：問題本身 + 問題欄位 + 背景欄位白名單 (不送整筆明細)
  function explainData(rs, res, issue, recon) {
    const lay = rs.layouts[issue.file];
    const rec = lay && (res.data[issue.file] || []).find(r => r._line === issue.line);
    let fields = '(無對應明細)';
    if (rec && rec._raw.length === lay.recordLength) {
      const want = new Set([...(issue.fields || []), ...CONTEXT]);
      fields = lay.fields.filter(f => want.has(f.key)).map(f => `${f.no}.${f.name}=${rec[f.key].trim()}`).join('；');
    } else if (rec) fields = '(長度不符，無法拆欄)';
    const sameRule = res.issues.filter(i => i.ruleId === issue.ruleId).length;
    const o = {
      ruleId: issue.ruleId, ruleName: issue.ruleName || '', ref: issue.ref || '', message: issue.message,
      value: String(issue.value).trim(), suggestion: issue.suggestion || '', sameRule, title: lay ? lay.title : fileName(issue.file), fields,
    };
    const ctx = context(res, recon);
    for (const k of Object.keys(o)) if (typeof o[k] === 'string') o[k] = mask(o[k], ctx);
    return o;
  }

  // 3) 退件解碼：退件訊息原文 + 每條線索的定位結果 (每組最多 3 個範例)
  function decodeData(text, decoded, res, recon) {
    const brief = decoded.findings.map(f => ({ 線索: f.clue, 類型: f.kind, 說明: f.explain,
      定位結果: f.groups.slice(0, 8).map(g => ({ 編號: g.ruleId, 項目: g.name, 筆數: g.items.length,
        範例: g.items.slice(0, 3).map(i => ({ 位置: `${i.file}${i.line ? ' 第' + i.line + '行/列' : ''}`, 保單或科目: (i.policy || i.code || '').trim(), 值: String(i.value).trim(), 問題: i.message, 建議: i.suggestion })) })) }));
    const ctx = context(res, recon);
    return { text: mask(text, ctx), brief: mask(JSON.stringify(brief), ctx) };
  }

  // 4) 規則匯入：規則文件文字 + 欄位字典 + 規則格式說明；文件中若有證號也一併遮罩
  function ruleDoc(prompt) { return mask(prompt, null); }

  return { mask, leaks, takeCounts, context, summaryData, explainData, decodeData, ruleDoc, CONTEXT, EXEMPT_FIELDS };
});
