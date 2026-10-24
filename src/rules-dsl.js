/*
 * 規則描述語言 (Rule DSL)：AI 由規則文件轉出的「可執行規則」格式。
 * 規則是純 JSON 條件式，由本引擎驗證、解讀、執行；不執行任何 AI 產生的程式碼。
 *
 * 規則：
 * { id, name, file: "L"|"D", scope: "record"|"policy", severity: "error"|"warning",
 *   when?: 條件, assert: 條件, message, suggestion, source (原文), ref (頁碼/條號) }
 *   - when 成立且 assert 不成立 → 產生一筆問題
 *   - scope "policy"：同保單依異動序號排序，可用 "prev.欄位" 取上一筆 (只適用承保檔)
 * 條件：
 *   {all:[條件...]} | {any:[條件...]} | {not:條件}
 *   {field, op, value? | values? | ref?, pos?: [起, 迄]}
 *     field / ref：欄位代號 (可加 "prev.")，或函式 {fn, args}
 *     pos：取欄位第 起~迄 碼 (從 1 起算)
 * 函式：age(出生日, 日期) 足歲、years/days(日期1, 日期2) 相差年/日、
 *       addYearsMinusDay(日期, 年數欄位或數字)、amount(金額欄位) 以「元」計、num(欄位) 數值
 */
(function (root, factory) {
  const core = (typeof module === 'object' && module.exports) ? require('./core.js') : root.DQ;
  const m = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = m; else root.DQ.dsl = m;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const OPS = {
    eq: '=', ne: '≠', gt: '>', gte: '≥', lt: '<', lte: '≤', in: '屬於', notIn: '不屬於',
    isBlank: '為空白', notBlank: '不可空白', isZero: '為 0', notZero: '不為 0', isDate: '為合法日期', matches: '符合格式', startsWith: '開頭為',
  };
  const NO_VALUE = ['isBlank', 'notBlank', 'isZero', 'notZero', 'isDate'];
  const FNS = { age: 2, years: 2, days: 2, addYearsMinusDay: 2, amount: 1, num: 1 };
  const FN_TEXT = { age: '足歲', years: '相差年數', days: '相差天數', addYearsMinusDay: '加年數減一天', amount: '金額(元)', num: '數值' };

  // ---------- 驗證 ----------
  // matches 的正規表示式來自自訂規則、更新包或 AI，是不可信的輸入：只允許簡單、長度有限的格式，
  // 不允許分組、交替、反向參照與 * + ? 等不定長量詞，避免寫法不好的式樣讓瀏覽器卡住 (ReDoS)
  function safeRegex(source) {
    const s = String(source == null ? '' : source);
    if (!s || s.length > 120 || /[()|*+?]/.test(s) || /\\[1-9]/.test(s)) return null;
    const qs = [...s.matchAll(/\{(\d{1,3})(?:,(\d{1,3}))?\}/g)];
    if ((s.match(/\{/g) || []).length !== qs.length || (s.match(/\}/g) || []).length !== qs.length) return null;
    let ranges = 0;
    for (const q of qs) {
      const min = +q[1], max = q[2] == null ? min : +q[2];
      if (min > 500 || max > 500 || max < min) return null;
      if (q[2] != null) ranges++;
    }
    if (ranges > 1) return null;
    try { return new RegExp(s); } catch (e) { return null; }
  }
  function validateRule(rule, layouts) {
    const errs = [];
    const lay = layouts[rule.file];
    if (!lay) errs.push(`file 應為 ${Object.keys(layouts).join('/')}`);
    if (!rule.id || typeof rule.id !== 'string') errs.push('缺少 id');
    if (rule.scope && !['record', 'policy'].includes(rule.scope)) errs.push('scope 應為 record 或 policy');
    if (rule.scope === 'policy' && !['L', 'CL', 'AL'].includes(rule.file)) errs.push('policy 範圍只適用保單資料 (承保檔)');
    if (rule.severity && !['error', 'warning'].includes(rule.severity)) errs.push('severity 應為 error 或 warning');
    if (!rule.assert) errs.push('缺少 assert');
    const fieldOk = f => {
      if (typeof f === 'string') {
        const prev = f.startsWith('prev.');
        if (prev && rule.scope !== 'policy') errs.push(`「${f}」只能用在 policy 範圍`);
        const k = prev ? f.slice(5) : f;
        if (lay && !lay.field(k)) errs.push(`欄位「${k}」不存在於${lay.title}`);
        return;
      }
      if (f && typeof f === 'object' && FNS[f.fn] != null) {
        if (!Array.isArray(f.args) || f.args.length !== FNS[f.fn]) errs.push(`函式 ${f.fn} 需要 ${FNS[f.fn]} 個參數`);
        else f.args.forEach(a => typeof a === 'number' ? null : fieldOk(a));
        return;
      }
      errs.push(`無法辨識的欄位或函式：${JSON.stringify(f)}`);
    };
    const walk = (c, d) => {
      if (d > 8) return errs.push('條件巢狀過深');
      if (!c || typeof c !== 'object') return errs.push('條件格式錯誤');
      if (c.all || c.any) { const a = c.all || c.any; if (!Array.isArray(a) || !a.length) errs.push('all/any 需為非空陣列'); else a.forEach(x => walk(x, d + 1)); return; }
      if (c.not) return walk(c.not, d + 1);
      if (!OPS[c.op]) return errs.push(`不支援的運算「${c.op}」`);
      fieldOk(c.field);
      if (c.ref != null) fieldOk(c.ref);
      if (c.pos && !(Array.isArray(c.pos) && c.pos.length === 2 && c.pos.every(Number.isInteger) && c.pos[0] >= 1 && c.pos[1] >= c.pos[0])) errs.push('pos 應為 [起, 迄]');
      if (['in', 'notIn'].includes(c.op) && !Array.isArray(c.values)) errs.push(`${c.op} 需要 values 陣列`);
      if (!NO_VALUE.includes(c.op) && !['in', 'notIn'].includes(c.op) && c.value == null && c.ref == null) errs.push(`${c.op} 需要 value 或 ref`);
      if (c.op === 'matches' && !safeRegex(c.value)) errs.push('matches 的格式不安全或不支援：只能用簡單格式 (例如 ^[A-Z]\\d{9}$)，不能用括號、|、*、+、? 與反向參照，重複次數上限 500');
    };
    if (rule.when) walk(rule.when, 0);
    if (rule.assert) walk(rule.assert, 0);
    return errs;
  }

  // ---------- 執行 ----------
  const MISSING = Symbol('missing');
  function getField(f, ctx) {
    if (typeof f === 'number') return f;
    if (typeof f === 'string') {
      if (f.startsWith('prev.')) return ctx.prev ? ctx.prev[f.slice(5)] : MISSING;
      return ctx.rec[f];
    }
    const a = f.args.map(x => getField(x, ctx));
    if (a.some(x => x === MISSING)) return MISSING;
    const date = v => C.isValidDate(v);
    switch (f.fn) {
      case 'age': return date(a[0]) && date(a[1]) ? C.ageAt(a[0], a[1]) : MISSING;
      case 'years': return date(a[0]) && date(a[1]) ? Math.abs(C.ageAt(a[0] < a[1] ? a[0] : a[1], a[0] < a[1] ? a[1] : a[0])) : MISSING;
      case 'days': return date(a[0]) && date(a[1]) ? Math.round((C.toDate(a[1]) - C.toDate(a[0])) / 86400000) : MISSING;
      case 'addYearsMinusDay': { const n = typeof a[1] === 'number' ? a[1] : Number(a[1]); return date(a[0]) && Number.isFinite(n) ? C.addYearsMinusDay(a[0], n) : MISSING; }
      case 'amount': return /^\d+$/.test(a[0] || '') ? Number(a[0]) / 100 : MISSING;
      case 'num': return /^\s*-?\d+(\.\d+)?\s*$/.test(String(a[0])) ? Number(a[0]) : MISSING;
    }
    return MISSING;
  }
  const isNumStr = v => typeof v === 'number' || /^\s*-?\d+(\.\d+)?\s*$/.test(String(v));
  function cmp(a, b) {
    if (isNumStr(a) && isNumStr(b) && !(typeof a === 'string' && typeof b === 'string' && a.trim().length === 8 && b.trim().length === 8)) return Number(a) - Number(b);
    const x = String(a).trim(), y = String(b).trim();
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const eqv = (a, b) => isNumStr(a) && isNumStr(b) ? Number(a) === Number(b) : String(a).trim() === String(b).trim();

  // 回傳 true / false / null (資料不足，不判定)
  function evalCond(c, ctx) {
    if (c.all) { let unknown = false; for (const x of c.all) { const r = evalCond(x, ctx); if (r === false) return false; if (r === null) unknown = true; } return unknown ? null : true; }
    if (c.any) { let unknown = false; for (const x of c.any) { const r = evalCond(x, ctx); if (r === true) return true; if (r === null) unknown = true; } return unknown ? null : false; }
    if (c.not) { const r = evalCond(c.not, ctx); return r === null ? null : !r; }
    let v = getField(c.field, ctx);
    if (v === MISSING) return null;
    if (c.pos && typeof v === 'string') v = v.slice(c.pos[0] - 1, c.pos[1]);
    let other = c.ref != null ? getField(c.ref, ctx) : c.value;
    if (other === MISSING) return null;
    switch (c.op) {
      case 'isBlank': return String(v).trim() === '';
      case 'notBlank': return String(v).trim() !== '';
      case 'isZero': return /^[0\s]*$/.test(String(v)) || Number(v) === 0;
      case 'notZero': return !(/^[0\s]*$/.test(String(v)) || Number(v) === 0);
      case 'isDate': return C.isValidDate(String(v));
      case 'matches': { const re = safeRegex(c.value), t = String(v); return re && t.length <= 1000 ? re.test(t) : null; }
      case 'startsWith': return String(v).trim().startsWith(String(other));
      case 'in': return c.values.some(x => eqv(v, x));
      case 'notIn': return !c.values.some(x => eqv(v, x));
      case 'eq': return eqv(v, other);
      case 'ne': return !eqv(v, other);
      case 'gt': return cmp(v, other) > 0;
      case 'gte': return cmp(v, other) >= 0;
      case 'lt': return cmp(v, other) < 0;
      case 'lte': return cmp(v, other) <= 0;
    }
    return null;
  }

  function fieldsOf(rule) {
    const out = new Set();
    const add = f => { if (typeof f === 'string') out.add(f.replace(/^prev\./, '')); else if (f && f.args) f.args.forEach(add); };
    const walk = c => { if (!c) return; (c.all || c.any || []).forEach(walk); if (c.not) walk(c.not); if (c.field) add(c.field); if (c.ref != null) add(c.ref); };
    walk(rule.when); walk(rule.assert);
    return [...out];
  }

  // ---------- 轉為規則集 (與內建規則合併) ----------
  // stats：無法判定 (資料不足) 的筆數與格式不對沒有執行的規則，畫面與報告會寫出來，不當作通過
  function extend(base, rules) {
    const ok = rules.filter(r => !validateRule(r, base.layouts).length);
    const stats = { unjudged: {}, invalid: rules.filter(r => !ok.includes(r)).map(r => r.id || '（沒有編號）') };
    const recordRules = {}, groupRules = {};
    for (const k of Object.keys(base.layouts)) {
      recordRules[k] = (base.recordRules[k] || []).slice();
      groupRules[k] = ((base.groupRules || {})[k] || []).slice();
    }
    const usesPrev = new Set(ok.filter(r => /"prev\./.test(JSON.stringify(r))).map(r => r));
    const fire = (rule, rec, prev, push) => {
      const ctx = { rec, prev };
      if (!prev && usesPrev.has(rule)) return;   // 每張保單的第一筆沒有「上一筆」可比，不適用 (不算無法判定)
      const w = rule.when ? evalCond(rule.when, ctx) : true;
      if (w === null) { stats.unjudged[rule.id] = (stats.unjudged[rule.id] || 0) + 1; return; }
      if (w !== true) return;
      const a = evalCond(rule.assert, ctx);
      if (a === null) { stats.unjudged[rule.id] = (stats.unjudged[rule.id] || 0) + 1; return; }
      if (a !== false) return;
      const fields = fieldsOf(rule).filter(k => base.layouts[rule.file].field(k));
      push({ ruleId: rule.id, severity: rule.severity || 'error', category: rule.category || '匯入規則', fields, value: fields.map(k => String(rec[k]).trim()).join(' / '),
        message: rule.message || rule.name, suggestion: rule.suggestion || '請依規則文件確認', imported: true });
    };
    for (const rule of ok) {
      if (rule.scope === 'policy') {
        groupRules[rule.file].push((recs, push) => {
          const seq = r => r.txnSeq || r.seq || '';
          const s = recs.slice().sort((a, b) => seq(a).localeCompare(seq(b)) || a._line - b._line);
          s.forEach((rec, i) => fire(rule, rec, i ? s[i - 1] : null, iss => push(rec, iss)));
        });
      } else recordRules[rule.file].push((rec, push) => fire(rule, rec, null, push));
    }
    const catalog = base.catalog.filter(c => !ok.some(r => r.id === c.id)).concat(ok.map(r => ({ id: r.id, name: r.name, level: r.level || '匯入規則', ref: r.ref || '規則文件', severity: r.severity || 'error', pack: r.pack })));
    return Object.assign({}, base, { catalog, recordRules, groupRules, dslStats: stats });
  }

  // 只執行指定規則 (試跑用)
  function runRules(base, rules, files) {
    const bare = { layouts: base.layouts, catalog: [], recordRules: {}, groupRules: {} };
    for (const k of Object.keys(base.layouts)) { bare.recordRules[k] = []; bare.groupRules[k] = []; }
    const rs = extend(bare, rules);
    // 不做欄位自動檢核：清掉欄位代碼設定
    const quiet = {};
    for (const [k, lay] of Object.entries(base.layouts)) quiet[k] = Object.assign({}, lay, { fields: lay.fields.map(f => Object.assign({}, f, { codes: null, notBlank: false, notZero: false, leftAlign: false, charset: /[\s\S]*/, type: 'X' })), fileName: null });
    rs.layouts = quiet;
    const res = C.validate(rs, files);
    return res.issues.filter(i => i.imported);
  }

  // ---------- 中文說明 ----------
  function describe(rule, layouts) {
    const lay = layouts[rule.file];
    const fname = f => {
      if (typeof f === 'number') return String(f);
      if (typeof f === 'string') { const prev = f.startsWith('prev.'); const k = prev ? f.slice(5) : f; const d = lay && lay.field(k); return (prev ? '上一筆' : '') + (d ? d.name : k); }
      return `${FN_TEXT[f.fn] || f.fn}(${f.args.map(fname).join('，')})`;
    };
    const val = v => typeof v === 'string' ? `「${v}」` : String(v);
    const text = c => {
      if (c.all) return c.all.map(x => (x.any ? `(${text(x)})` : text(x))).join(' 且 ');
      if (c.any) return c.any.map(x => (x.all ? `(${text(x)})` : text(x))).join(' 或 ');
      if (c.not) return `不是 (${text(c.not)})`;
      const f = fname(c.field) + (c.pos ? ` 第 ${c.pos[0]}${c.pos[1] !== c.pos[0] ? '~' + c.pos[1] : ''} 碼` : '');
      if (NO_VALUE.includes(c.op)) return `${f} ${OPS[c.op]}`;
      if (c.op === 'in' || c.op === 'notIn') return `${f} ${OPS[c.op]} ${c.values.map(val).join('、')}`;
      return `${f} ${OPS[c.op]} ${c.ref != null ? fname(c.ref) : val(c.value)}`;
    };
    return { when: rule.when ? text(rule.when) : '', assert: text(rule.assert) };
  }

  return { OPS, FNS, safeRegex, validateRule, evalCond, extend, runRules, describe, fieldsOf };
});
