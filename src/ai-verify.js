/*
 * AI 洞見驗證：AI 只負責「提出假設」，由規則引擎用原始資料驗證後才算數。
 *
 * AI 在重點整理後面附上 JSON，每個共同原因都要寫成可以檢查的條件 (規則 DSL 的條件格式)：
 *   {"insights":[{ "title": "轉檔時金額沒有補前置 0", "file": "L",
 *                  "condition": {"field":"sumInsuredOrig","pos":[18,18],"op":"eq","value":" "},
 *                  "ruleIds": ["10400_L0501"], "claim": 12, "type": "改資料" }]}
 * 驗證方式：
 *   1. 條件先經 rules-dsl 驗證 (欄位要存在、只能用允許的比對方式；不執行任何程式)
 *   2. 對該檔每一筆格式正確的資料計算條件，找出符合的資料列
 *   3. 有寫 ruleIds 時，只算「符合條件、而且真的有這些檢查問題」的資料列，並算出這個原因解釋了多少比例的問題
 *   4. 和 AI 宣稱的筆數比對：
 *        verified  已驗證：條件成立，筆數相符 (差距 2 筆或 20% 以內)
 *        mismatch  原因成立、數字不對：條件成立，但筆數和 AI 說的不同 (以實際筆數為準)
 *        refuted   不成立：沒有任何資料符合
 *        invalid   無法驗證：條件寫錯或沒有提供條件，只能當推測
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const m = factory(isNode ? require('./rules-dsl.js') : root.DQ.dsl);
  if (isNode) module.exports = m; else { root.DQ = root.DQ || {}; root.DQ.aiVerify = m; }
})(typeof self !== 'undefined' ? self : this, function (dsl) {
  'use strict';
  const MAX = 8;                          // 最多驗證幾個原因
  const STATUS = { verified: '已驗證', mismatch: '原因成立、數字不對', refuted: '不成立', invalid: '無法驗證（推測）' };

  // AI 回覆 → { text: 給人看的文字, insights: [...] }；JSON 放在 ```json 區塊或最後一個 {"insights": …}
  function split(reply) {
    const s = String(reply || '');
    let m = s.match(/```json\s*([\s\S]*?)```/i), json = null, text = s;
    if (m) { json = m[1]; text = s.replace(m[0], ''); }
    else { const i = s.lastIndexOf('{"insights"'); if (i >= 0) { const j = s.lastIndexOf('}'); json = s.slice(i, j + 1); text = s.slice(0, i) + s.slice(j + 1); } }
    let insights = [];
    if (json) { try { const o = JSON.parse(json); insights = Array.isArray(o.insights) ? o.insights : []; } catch (e) { insights = []; } }
    return { text: text.replace(/\n{3,}/g, '\n\n').trim(), insights: insights.slice(0, MAX) };
  }

  // 只允許單筆比對 (不用 prev.)，不允許 matches (AI 寫的正規表示式可能很慢)
  function badOps(c) {
    if (!c || typeof c !== 'object') return ['條件格式不對'];
    if (c.all) return [].concat(...c.all.map(badOps));
    if (c.any) return [].concat(...c.any.map(badOps));
    if (c.not) return badOps(c.not);
    return c.op === 'matches' ? ['不能使用 matches，請改用 startsWith、in 或 pos'] : [];
  }

  function check(ins, rs, res) {
    const out = { title: String(ins.title || '（沒有標題）').slice(0, 80), type: ins.type === '寫說明' ? '寫說明' : '改資料', file: ins.file, claim: Number.isFinite(+ins.claim) && ins.claim !== '' && ins.claim != null ? +ins.claim : null,
      condition: ins.condition || null, ruleIds: Array.isArray(ins.ruleIds) ? ins.ruleIds.map(String).slice(0, 10) : [], count: 0, matched: 0, lines: [], policies: [], errors: [] };
    const lay = rs.layouts[ins.file];
    if (!lay || !res.data[ins.file]) out.errors.push(`資料「${ins.file}」不在這次檢查的檔案裡`);
    if (!ins.condition) out.errors.push('沒有提供可以檢查的條件');
    if (!out.errors.length) out.errors.push(...badOps(ins.condition), ...dsl.validateRule({ id: 'H', file: ins.file, scope: 'record', assert: ins.condition }, rs.layouts));
    if (out.errors.length) return Object.assign(out, { status: 'invalid' });
    out.text = dsl.describe({ file: ins.file, assert: ins.condition }, rs.layouts).assert;
    // 1) 符合條件的資料列 (只看長度正確、已拆好欄位的資料)
    const recs = res.data[ins.file].filter(r => r._raw.length === lay.recordLength && dsl.evalCond(ins.condition, { rec: r }) === true);
    out.matched = recs.length;
    // 2) 有指定檢查編號時：只算真的有這些問題的資料列
    const known = new Set(res.issues.map(i => i.ruleId));
    out.unknownRules = out.ruleIds.filter(id => !known.has(id));
    const ids = new Set(out.ruleIds.filter(id => known.has(id)));
    let hit = recs;
    if (ids.size) {
      const bad = new Set(res.issues.filter(i => i.file === ins.file && ids.has(i.ruleId) && i.line).map(i => i.line));
      hit = recs.filter(r => bad.has(r._line));
      out.issueLines = bad.size;
      out.coverage = bad.size ? hit.length / bad.size : 0;   // 這個原因解釋了這些問題的多少比例
    }
    out.count = hit.length;
    out.lines = hit.map(r => r._line);
    out.policies = hit.slice(0, 5).map(r => (lay.keyOf ? lay.keyOf(r) : '').trim()).filter(Boolean);
    const close = out.claim == null || Math.abs(out.claim - out.count) <= Math.max(2, out.count * 0.2);
    out.status = !out.count ? 'refuted' : close ? 'verified' : 'mismatch';
    return out;
  }

  const verify = (insights, rs, res) => (insights || []).slice(0, MAX).map(i => check(i || {}, rs, res));

  // 給 AI 的欄位清單 (只列這次有放入的明細檔)，讓它寫得出正確的欄位代號
  function fieldGuide(rs, res) {
    return Object.keys(res.meta).filter(fid => rs.layouts[fid] && res.data[fid] && res.data[fid].length).map(fid => {
      const lay = rs.layouts[fid];
      return `${fid}（${lay.title}）：` + lay.fields.map(f => `${f.key}=${f.name}${f.type === '9' ? `(數字${f.len})` : `(${f.len})`}`).join('、');
    }).join('\n');
  }

  const SPEC = `最後另外附上一個 \`\`\`json 區塊，把第 2 點的每個共同原因寫成可以用資料檢查的條件 (最多 ${MAX} 個)：
{"insights":[{"title":"一句話的原因","file":"資料代號 (如 L、D、CL)","condition":條件,"ruleIds":["相關的檢核編號"],"claim":你估計影響的筆數,"type":"改資料 或 寫說明"}]}
條件格式：{"field":"欄位代號","op":"比對方式","value":"值"}；可用 {"all":[…]}、{"any":[…]}、{"not":…} 組合；
比對方式：eq ne gt gte lt lte in notIn (values 陣列) isBlank notBlank isZero notZero isDate startsWith；
取欄位的一部分用 "pos":[起,迄] (從 1 算起)；欄位代號只能用下面清單裡的。
工具會用原始資料逐筆驗證這些條件，算出實際筆數；寫不成條件的原因不要列進 JSON。`;

  return { split, verify, check, fieldGuide, SPEC, STATUS, MAX };
});
