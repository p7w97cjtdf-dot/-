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
  const m = factory(isNode ? require('./rules-dsl.js') : root.DQ.dsl, isNode ? require('./core.js') : root.DQ);
  if (isNode) module.exports = m; else { root.DQ = root.DQ || {}; root.DQ.aiVerify = m; }
})(typeof self !== 'undefined' ? self : this, function (dsl, C) {
  'use strict';
  const MAX = 8;                          // 最多驗證幾個原因
  const STATUS = { verified: '已驗證', mismatch: '原因成立、數字不對', refuted: '不成立', invalid: '無法驗證（推測）' };

  // AI 回覆 → { text: 給人看的文字, insights: [...] }；JSON 放在 ```json 區塊或最後一個 {"insights": …}
  function split(reply) {
    const s = String(reply || '');
    let m = s.match(/```json\s*([\s\S]*?)```/i), json = null, text = s;
    if (m) { json = m[1]; text = s.replace(m[0], ''); }
    else { const i = s.lastIndexOf('{"insights"'); if (i >= 0) { const j = s.lastIndexOf('}'); json = s.slice(i, j + 1); text = s.slice(0, i) + s.slice(j + 1); } }
    let o = {};
    if (json) { try { o = JSON.parse(json) || {}; } catch (e) { o = {}; } }
    const arr = k => Array.isArray(o[k]) ? o[k].slice(0, MAX) : [];
    return { text: text.replace(/\n{3,}/g, '\n\n').trim(), insights: arr('insights'), risk: typeof o.risk === 'string' ? o.risk : null,
      priorities: arr('priorities'), preventions: arr('preventions'), fix: o.fix && typeof o.fix === 'object' ? o.fix : null,
      systemic: typeof o.systemic === 'boolean' ? o.systemic : null, likely: arr('likely'), json: o };
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

  // ---------- 整體狀況：退件風險由工具依檢查結果判定，再和 AI 說的比對 ----------
  // 高：有「必須修改」(違反手冊規則，送出會被退件)；中：只有「建議確認」；低：都沒有
  function riskOf(res) {
    const n = s => res.issues.filter(i => i.severity === s).length;
    return n('error') ? '高' : n('warning') ? '中' : '低';
  }
  function verifyRisk(claim, res) {
    const tool = riskOf(res), c = /高|中|低/.exec(String(claim || '')); 
    if (!c) return { status: 'invalid', tool, claim: null, why: 'AI 沒有說明風險高低' };
    return { status: c[0] === tool ? 'verified' : 'refuted', tool, claim: c[0] };
  }

  // ---------- 先改什麼：AI 的理由用數字檢查 ----------
  const REASONS = ['影響最多', '有建議修正值', '會連帶其他錯誤'];
  function verifyPriorities(list, res) {
    const by = new Map();
    for (const i of res.issues) if (i.severity !== 'suspect') { if (!by.has(i.ruleId)) by.set(i.ruleId, []); by.get(i.ruleId).push(i); }
    const rank = [...by.entries()].sort((a, b) => b[1].length - a[1].length).map(x => x[0]);
    return (list || []).slice(0, MAX).map((p, k) => {
      const ids = (Array.isArray(p.ruleIds) ? p.ruleIds : []).map(String).filter(id => by.has(id));
      const out = { order: k + 1, ruleIds: ids, unknown: (p.ruleIds || []).filter(id => !by.has(String(id))), reason: String(p.reason || ''), note: String(p.note || '').slice(0, 120) };
      if (!ids.length) return Object.assign(out, { status: 'invalid', why: '指定的檢核編號這次沒有出現' });
      const items = ids.flatMap(id => by.get(id)), fix = items.filter(i => i.fix).length;
      out.count = items.length; out.fixable = fix; out.rank = Math.min(...ids.map(id => rank.indexOf(id) + 1));
      const lines = new Set(items.filter(i => i.line).map(i => i.file + ':' + i.line));
      const other = new Set(res.issues.filter(i => i.line && !ids.includes(i.ruleId) && i.severity !== 'suspect' && lines.has(i.file + ':' + i.line)).map(i => i.file + ':' + i.line));
      out.cooccur = lines.size ? other.size / lines.size : 0;
      if (out.reason.includes('影響最多')) { out.status = out.rank <= 3 ? 'verified' : 'refuted'; out.fact = `筆數排第 ${out.rank}（${out.count} 筆）`; }
      else if (out.reason.includes('建議修正值') || out.reason.includes('一鍵')) { out.status = fix / items.length >= 0.8 ? 'verified' : fix ? 'mismatch' : 'refuted'; out.fact = `${items.length} 筆中 ${fix} 筆有建議修正值`; }
      else if (out.reason.includes('連帶')) { out.status = out.cooccur >= 0.5 ? 'verified' : out.cooccur ? 'mismatch' : 'refuted'; out.fact = `這些資料列有 ${Math.round(out.cooccur * 100)}% 同時有其他問題`; }
      else { out.status = 'invalid'; out.fact = `${items.length} 筆`; out.why = `理由「${out.reason || '（沒寫）'}」無法用資料檢查；可檢查的理由：${REASONS.join('、')}`; }
      return out;
    });
  }

  // ---------- 以後怎麼避免：AI 提出的預防檢查，拿現在的資料試跑 ----------
  // 條件是「正確的資料應該符合的條件」；不符合的資料列 = 這條檢查會擋下的資料
  function verifyPreventions(list, rs, res) {
    return (list || []).slice(0, MAX).map(p => {
      const out = { title: String(p.title || '（沒有標題）').slice(0, 80), file: p.file, condition: p.condition || null, ruleIds: Array.isArray(p.ruleIds) ? p.ruleIds.map(String) : [], errors: [] };
      const lay = rs.layouts[p.file];
      if (!lay || !res.data[p.file]) out.errors.push(`資料「${p.file}」不在這次檢查的檔案裡`);
      if (!p.condition) out.errors.push('沒有提供可以檢查的條件');
      if (!out.errors.length) out.errors.push(...badOps(p.condition), ...dsl.validateRule({ id: 'P', file: p.file, scope: 'record', assert: p.condition }, rs.layouts));
      if (out.errors.length) return Object.assign(out, { status: 'invalid' });
      out.text = dsl.describe({ file: p.file, assert: p.condition }, rs.layouts).assert;
      const recs = res.data[p.file].filter(r => r._raw.length === lay.recordLength);
      const flagged = recs.filter(r => dsl.evalCond(p.condition, { rec: r }) === false);
      const ids = new Set(out.ruleIds);
      const bad = new Set(res.issues.filter(i => i.file === p.file && i.line && i.severity === 'error' && (!ids.size || ids.has(i.ruleId))).map(i => i.line));
      const anyIssue = new Set(res.issues.filter(i => i.file === p.file && i.line).map(i => i.line));
      out.caught = flagged.filter(r => bad.has(r._line)).length;
      out.falseAlarm = flagged.filter(r => !anyIssue.has(r._line)).length;
      out.flagged = flagged.length; out.target = bad.size; out.checked = recs.length;
      out.status = !out.caught ? 'refuted' : out.falseAlarm ? 'mismatch' : 'verified';
      out.rule = { id: 'P-' + Math.random().toString(36).slice(2, 8).toUpperCase(), name: out.title, file: p.file, scope: 'record', severity: 'warning', assert: p.condition,
        message: `不符合預防檢查：${out.title}`, suggestion: '確認這筆資料是否正確', source: 'AI 提出、經工具試跑驗證的預防檢查' };
      return out;
    });
  }

  // ---------- 單筆解釋：AI 建議的正確值，改進副本重新檢查 ----------
  // files：{ 檔案代號: { name, text } }；只看明細檔規則在這一筆的結果
  function verifyFix(fix, issue, rs, files) {
    const out = { field: fix && fix.field, value: fix && fix.value != null ? String(fix.value) : null };
    const lay = rs.layouts[issue.file], f = lay && out.field && lay.field(out.field);
    if (!fix) return Object.assign(out, { status: 'invalid', why: 'AI 沒有提出可以試的正確值' });
    if (!f) return Object.assign(out, { status: 'invalid', why: `欄位「${out.field}」不存在` });
    if (!files[issue.file] || !issue.line) return Object.assign(out, { status: 'invalid', why: '這個問題不在明細資料裡，無法試改' });
    if (out.value.length > f.len) return Object.assign(out, { status: 'refuted', why: `「${out.value}」超過欄位長度 ${f.len} 碼` });
    const lines = files[issue.file].text.split(/\r?\n/), raw = lines[issue.line - 1];
    if (raw == null || raw.length !== lay.recordLength) return Object.assign(out, { status: 'invalid', why: '這一筆長度不對，無法拆欄試改' });
    out.fieldName = f.name; out.before = raw.substr(f.start - 1, f.len).trim();
    lines[issue.line - 1] = raw.slice(0, f.start - 1) + C.pad(f, out.value) + raw.slice(f.start - 1 + f.len);
    const keys = Object.keys(files).filter(k => rs.layouts[k]);
    const run = map => C.validate(rs, Object.fromEntries(keys.map(k => [k, map[k]]))).issues.filter(i => i.file === issue.file && i.line === issue.line);
    const before = run(files), after = run(Object.assign({}, files, { [issue.file]: Object.assign({}, files[issue.file], { text: lines.join('\n') }) }));
    const key = i => i.ruleId + '|' + i.message;
    const had = new Set(before.map(key));
    out.solved = !after.some(i => i.ruleId === issue.ruleId);
    out.newIssues = after.filter(i => !had.has(key(i))).map(i => `${i.ruleId} ${i.message}`).slice(0, 5);
    out.remaining = after.filter(i => i.severity === 'error').length;
    out.status = out.solved && !out.newIssues.length ? 'verified' : out.solved ? 'mismatch' : 'refuted';
    return out;
  }
  function verifySystemic(claim, sameRule) {
    const tool = sameRule >= 3;
    return { status: claim == null ? 'invalid' : claim === tool ? 'verified' : 'refuted', claim, tool, sameRule };
  }

  // ---------- 退件說明：AI 說最可能是哪幾類問題，核對工具的定位結果 ----------
  function verifyLikely(list, decoded, res) {
    const located = new Map();
    for (const f of decoded.findings || []) for (const g of f.groups || []) located.set(g.ruleId, (located.get(g.ruleId) || 0) + g.items.length);
    return (list || []).slice(0, MAX).map(x => {
      const ids = (Array.isArray(x.ruleIds) ? x.ruleIds : []).map(String);
      const out = { title: String(x.title || ids.join('、')).slice(0, 80), ruleIds: ids, claim: Number.isFinite(+x.claim) && x.claim != null ? +x.claim : null };
      if (!ids.length) return Object.assign(out, { status: 'invalid', why: '沒有指出檢核編號' });
      out.count = ids.reduce((t, id) => t + (located.get(id) || 0), 0);
      out.inData = res.issues.filter(i => ids.includes(i.ruleId)).length;
      const close = out.claim == null || Math.abs(out.claim - out.count) <= Math.max(2, out.count * 0.2);
      out.status = !out.count ? 'refuted' : close ? 'verified' : 'mismatch';
      return out;
    });
  }

  const SPEC_MORE = `JSON 裡另外加上：
"risk": "高、中 或 低"（第 1 點說的退件可能性）,
"priorities": [{"ruleIds":["檢核編號"],"reason":"影響最多 或 有建議修正值 或 會連帶其他錯誤","note":"一句話"}]（第 3 點的修改順序，依先後排列）,
"preventions": [{"title":"一句話","file":"資料代號","condition":條件,"ruleIds":["想預防的檢核編號"]}]（第 4 點的預防檢查：條件寫成「正確的資料應該符合」，工具會拿現在的資料試跑，看能抓到幾筆現有問題、會不會誤報）`;
  const SPEC_FIX = `最後附上 \`\`\`json 區塊：{"fix":{"field":"欄位代號","value":"你建議的正確值"},"systemic":true 或 false}
fix 寫不出確定的值就省略；工具會把這個值試改進資料副本重新檢查，確認這筆是否通過。systemic 表示你是否認為這是系統性問題。`;
  const SPEC_LIKELY = `最後附上 \`\`\`json 區塊：{"likely":[{"title":"一句話","ruleIds":["檢核編號"],"claim":你估計的筆數}]}
列出你認為這則退件訊息最可能指的問題 (1~3 類)；工具會核對這些檢核編號是否在定位結果裡、實際有幾筆。`;

  return { split, verify, check, fieldGuide, riskOf, verifyRisk, verifyPriorities, verifyPreventions, verifyFix, verifySystemic, verifyLikely,
    SPEC, SPEC_MORE, SPEC_FIX, SPEC_LIKELY, STATUS, MAX, REASONS };
});
