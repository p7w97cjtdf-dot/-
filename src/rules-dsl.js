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
  // 規則格式驗證：規則來自自訂、更新包或 AI 轉換，都是不可信的輸入。任何格式問題都回傳可讀的錯誤 (不丟例外、不執行任何程式)
  const LIMITS = Object.freeze({ nodes: 200, depth: 8, fnDepth: 3, values: 200, str: 500, id: 64, rulesPerPack: 500 });
  const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']);
  const RULE_KEYS = new Set(['id', 'name', 'file', 'scope', 'severity', 'when', 'assert', 'message', 'suggestion', 'source', 'ref', 'effective', 'category', 'level', 'pack', 'src']);
  const LEAF_KEYS = new Set(['field', 'op', 'value', 'values', 'ref', 'pos']);
  const FIELD_RE = /^(prev\.)?[A-Za-z][A-Za-z0-9_]{0,40}$/;
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  // 普通的資料物件 (JSON 物件)：不是 null、陣列、函式或特殊類別
  const plain = o => o !== null && typeof o === 'object' && !Array.isArray(o) && [Object.prototype, null].includes(Object.getPrototypeOf(o));
  const okScalar = v => (typeof v === 'string' && v.length <= LIMITS.str) || (typeof v === 'number' && Number.isFinite(v));
  function validateRule(rule, layouts) {
    try { return validateRule0(rule, layouts); } catch (e) { return ['規則格式錯誤，無法驗證']; }
  }
  function validateRule0(rule, layouts) {
    const errs = [];
    if (!plain(rule)) return ['規則必須是物件（不能是空值、陣列或其他型態）'];
    if (!plain(layouts)) return ['缺少資料格式定義，無法驗證規則'];
    for (const k of Object.keys(rule)) {
      if (BAD_KEYS.has(k)) errs.push(`不允許的鍵名「${k}」`);
      else if (!RULE_KEYS.has(k)) errs.push(`不認得的規則屬性「${k.slice(0, 40)}」`);
    }
    const lay = typeof rule.file === 'string' && has(layouts, rule.file) ? layouts[rule.file] : null;
    if (!lay) errs.push(`file 應為 ${Object.keys(layouts).join('/')}`);
    if (typeof rule.id !== 'string' || !rule.id || rule.id.length > LIMITS.id) errs.push(`缺少 id，或 id 超過 ${LIMITS.id} 字`);
    else if (BAD_KEYS.has(rule.id)) errs.push(`不允許的 id「${rule.id}」`);
    for (const k of ['name', 'message', 'suggestion', 'source', 'ref', 'category', 'level', 'pack', 'src']) if (has(rule, k) && rule[k] != null && (typeof rule[k] !== 'string' || rule[k].length > (k === 'source' ? 4000 : LIMITS.str))) errs.push(`${k} 必須是 ${k === 'source' ? 4000 : LIMITS.str} 字以內的文字`);
    if (has(rule, 'scope') && rule.scope != null && !['record', 'policy'].includes(rule.scope)) errs.push('scope 應為 record 或 policy');
    if (rule.scope === 'policy' && !['L', 'CL', 'AL'].includes(rule.file)) errs.push('policy 範圍只適用保單資料 (承保檔)');
    if (has(rule, 'severity') && rule.severity != null && !['error', 'warning'].includes(rule.severity)) errs.push('severity 應為 error 或 warning');
    if (!has(rule, 'assert')) errs.push('缺少 assert');
    let nodes = 0;
    const fieldOk = (f, fd) => {
      if (typeof f === 'string') {
        if (!FIELD_RE.test(f) || BAD_KEYS.has(f.replace(/^prev\./, ''))) return errs.push(`欄位代號「${f.slice(0, 40)}」格式不正確`);
        const prev = f.startsWith('prev.');
        if (prev && rule.scope !== 'policy') errs.push(`「${f}」只能用在 policy 範圍`);
        const k = prev ? f.slice(5) : f;
        if (lay && !(lay.field && lay.field(k))) errs.push(`欄位「${k}」不存在於${lay.title}`);
        return;
      }
      if (plain(f)) {
        if (fd > LIMITS.fnDepth) return errs.push(`函式巢狀超過 ${LIMITS.fnDepth} 層`);
        for (const k of Object.keys(f)) if (k !== 'fn' && k !== 'args') return errs.push(`函式只能有 fn 與 args（多了「${String(k).slice(0, 40)}」）`);
        if (typeof f.fn !== 'string' || !has(FNS, f.fn)) return errs.push(`不支援的函式「${String(f.fn).slice(0, 40)}」`);
        if (!Array.isArray(f.args) || f.args.length !== FNS[f.fn]) return errs.push(`函式 ${f.fn} 需要 ${FNS[f.fn]} 個參數`);
        f.args.forEach(a => { if (typeof a === 'number') { if (!Number.isFinite(a)) errs.push(`函式 ${f.fn} 的參數必須是有限的數字`); } else fieldOk(a, fd + 1); });
        return;
      }
      errs.push('無法辨識的欄位或函式');
    };
    const walk = (c, d) => {
      if (++nodes > LIMITS.nodes) { if (nodes === LIMITS.nodes + 1) errs.push(`條件節點超過 ${LIMITS.nodes} 個`); return; }
      if (d > LIMITS.depth) return errs.push(`條件巢狀超過 ${LIMITS.depth} 層`);
      if (!plain(c)) return errs.push('條件必須是物件（不能是空值、陣列或其他型態）');
      const keys = Object.keys(c);
      for (const k of keys) if (BAD_KEYS.has(k)) return errs.push(`不允許的鍵名「${k}」`);
      // all、any、not、單一條件 (op) 只能擇一
      const kinds = ['all', 'any', 'not', 'op'].filter(k => has(c, k));
      if (kinds.length !== 1) return errs.push(kinds.length ? `同一個條件同時有 ${kinds.join('、')}，只能擇一` : '條件缺少 all、any、not 或 op');
      if (kinds[0] === 'all' || kinds[0] === 'any') {
        if (keys.length !== 1) return errs.push(`${kinds[0]} 條件不能有其他屬性`);
        const a = c[kinds[0]];
        if (!Array.isArray(a) || !a.length) return errs.push('all/any 需為非空陣列');
        if (a.length > LIMITS.nodes) return errs.push(`all/any 的條件超過 ${LIMITS.nodes} 個`);
        return a.forEach(x => walk(x, d + 1));
      }
      if (kinds[0] === 'not') { if (keys.length !== 1) return errs.push('not 條件不能有其他屬性'); return walk(c.not, d + 1); }
      for (const k of keys) if (!LEAF_KEYS.has(k)) return errs.push(`條件不認得的屬性「${String(k).slice(0, 40)}」`);
      if (typeof c.op !== 'string' || !has(OPS, c.op)) return errs.push(`不支援的運算「${String(c.op).slice(0, 40)}」`);
      if (!has(c, 'field')) return errs.push('條件缺少 field');
      fieldOk(c.field, 0);
      if (has(c, 'ref') && c.ref != null) fieldOk(c.ref, 0);
      if (has(c, 'pos') && c.pos != null && !(Array.isArray(c.pos) && c.pos.length === 2 && c.pos.every(Number.isInteger) && c.pos[0] >= 1 && c.pos[1] >= c.pos[0] && c.pos[1] <= 1000)) errs.push('pos 應為 [起, 迄]');
      if (['in', 'notIn'].includes(c.op)) {
        if (!Array.isArray(c.values) || !c.values.length) errs.push(`${c.op} 需要非空的 values 陣列`);
        else if (c.values.length > LIMITS.values) errs.push(`values 超過 ${LIMITS.values} 個`);
        else if (!c.values.every(okScalar)) errs.push(`values 只能是 ${LIMITS.str} 字以內的文字或有限的數字`);
      } else if (has(c, 'values')) errs.push(`${c.op} 不使用 values`);
      if (has(c, 'value') && c.value != null && !okScalar(c.value)) errs.push(`value 只能是 ${LIMITS.str} 字以內的文字或有限的數字`);
      if (NO_VALUE.includes(c.op) && (c.value != null || c.ref != null)) errs.push(`${c.op} 不需要 value 或 ref`);
      if (!NO_VALUE.includes(c.op) && !['in', 'notIn'].includes(c.op) && c.value == null && c.ref == null) errs.push(`${c.op} 需要 value 或 ref`);
      if (c.value != null && c.ref != null) errs.push('value 與 ref 只能擇一');
      if (c.op === 'matches' && !safeRegex(c.value)) errs.push('matches 的格式不安全或不支援：只能用簡單格式 (例如 ^[A-Z]\\d{9}$)，不能用括號、|、*、+、? 與反向參照，重複次數上限 500');
    };
    if (has(rule, 'when') && rule.when != null) walk(rule.when, 0);
    if (has(rule, 'assert')) walk(rule.assert, 0);
    return errs;
  }
  // 一整批規則 (更新包、AI 轉換的結果、備份檔)：先全部驗證，回傳 { ok, errors: [{ id, errors }] }；呼叫端要 ok 才套用 (不部分生效)
  function validateAll(rules, layouts) {
    if (!Array.isArray(rules)) return { ok: false, errors: [{ id: '', errors: ['規則清單必須是陣列'] }] };
    if (rules.length > LIMITS.rulesPerPack) return { ok: false, errors: [{ id: '', errors: [`規則超過 ${LIMITS.rulesPerPack} 條`] }] };
    const errors = rules.map((r, i) => ({ id: plain(r) && typeof r.id === 'string' ? r.id : `第 ${i + 1} 條`, errors: validateRule(r, layouts) })).filter(x => x.errors.length);
    const ids = rules.filter(plain).map(r => r.id), dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    if (dup.length) errors.push({ id: dup[0], errors: [`規則編號重複：${[...new Set(dup)].join('、')}`] });
    return { ok: !errors.length, errors };
  }

  // ---------- 執行 ----------
  // 取值：只讀資料「自己的」欄位 (不讀繼承來的屬性)，並區分以下情況 (各運算的結果見 evalCond)：
  //   MISSING  欄位不存在 (資料裡沒有這個欄位，例如這一行太短沒拆出來) 或函式算不出來
  //   NULLV    欄位存在但值是 undefined / null
  //   ''       空字串或空白 (固定長度檔案空著的欄位)
  //   其他      正常值 (含合法的 0、'0'、'000')
  const MISSING = Symbol('missing'), NULLV = Symbol('null');
  const own = (o, k) => o != null && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, k) ? (o[k] == null ? NULLV : o[k]) : MISSING;
  // 精確的十進位數：{ n: BigInt, s: 小數位數 }。整數用 BigInt 比較 (不會因超過 2^53 失真)，金額保留小數位數
  const DEC = /^\s*([+-]?)(\d{1,40})(?:\.(\d{1,20}))?\s*$/;
  function toDec(v) {
    if (v && typeof v === 'object' && typeof v.n === 'bigint') return v;
    if (typeof v === 'number') { if (!Number.isFinite(v)) return null; v = String(v); if (/e/i.test(v)) return null; }
    if (typeof v !== 'string') return null;
    const m = DEC.exec(v); if (!m) return null;
    const frac = m[3] || '';
    return { n: BigInt((m[1] === '-' ? '-' : '') + m[2] + frac), s: frac.length };
  }
  function decCmp(a, b) {
    const s = Math.max(a.s, b.s), x = a.n * 10n ** BigInt(s - a.s), y = b.n * 10n ** BigInt(s - b.s);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const fromInt = n => Number.isSafeInteger(n) ? { n: BigInt(n), s: 0 } : MISSING;
  function getField(f, ctx) {
    if (typeof f === 'number') return Number.isFinite(f) ? f : MISSING;
    if (typeof f === 'string') {
      if (f.startsWith('prev.')) return ctx.prev ? own(ctx.prev, f.slice(5)) : MISSING;
      return own(ctx.rec, f);
    }
    if (!f || typeof f !== 'object' || !Array.isArray(f.args) || typeof f.fn !== 'string' || !Object.prototype.hasOwnProperty.call(FNS, f.fn)) return MISSING;
    const a = f.args.map(x => getField(x, ctx));
    if (a.some(x => x === MISSING || x === NULLV)) return MISSING;
    const date = v => typeof v === 'string' && C.isValidDate(v);
    switch (f.fn) {
      case 'age': return date(a[0]) && date(a[1]) ? fromInt(C.ageAt(a[0], a[1])) : MISSING;
      case 'years': return date(a[0]) && date(a[1]) ? fromInt(Math.abs(C.ageAt(a[0] < a[1] ? a[0] : a[1], a[0] < a[1] ? a[1] : a[0]))) : MISSING;
      case 'days': return date(a[0]) && date(a[1]) ? fromInt(Math.round((C.toDate(a[1]) - C.toDate(a[0])) / 86400000)) : MISSING;
      case 'addYearsMinusDay': {
        // 年數要是整數；算出的日期要仍是 8 位數的合法日期 (西元 9999 年以內)，否則無法判定
        const d = toDec(a[1]), n = d && d.s === 0 && d.n >= 0n && d.n <= 9999n ? Number(d.n) : NaN;
        if (!date(a[0]) || !Number.isInteger(n)) return MISSING;
        const out = C.addYearsMinusDay(a[0], n);
        return typeof out === 'string' && /^\d{8}$/.test(out) && C.isValidDate(out) ? out : MISSING;
      }
      case 'amount': return typeof a[0] === 'string' && /^\d{1,40}$/.test(a[0]) ? { n: BigInt(a[0]), s: 2 } : MISSING;   // 申報檔的金額欄位以「分」記，換算成元保留 2 位小數
      case 'num': { const d = toDec(a[0]); return d || MISSING; }
    }
    return MISSING;
  }
  // 比較方式依欄位格式決定 (layout 的欄位定義)：
  //   text  英數字欄位 (X)、有代碼表的欄位：文字比較，保留前導零 ('001' ≠ '1')；固定長度欄位前後的空白不算
  //   dec   數字欄位 (9)、日期、函式算出的數字或金額：精確的十進位比較 ('001' = '1'；長整數不失真)
  //   auto  沒有欄位定義時 (例如試算或測試)：兩邊都是數字才用數字比較，否則用文字比較
  function kindOf(f, lay) {
    if (f && typeof f === 'object') return typeof f.fn === 'string' && Object.prototype.hasOwnProperty.call(FNS, f.fn) ? 'dec' : null;
    if (typeof f !== 'string' || !lay || !lay.field) return null;
    const d = lay.field(f.replace(/^prev\./, ''));
    if (!d) return null;
    return d.codes || d.type !== '9' ? 'text' : 'dec';
  }
  const text = v => String(v).trim();
  // 回傳 -1/0/1，或 null (無法安全比較：數字比較時有一邊不是數字、超出支援範圍)
  function compare(a, b, kind) {
    if (kind === 'dec' || (kind === 'auto' && (typeof b === 'number' || typeof a === 'number' || (a && typeof a === 'object') || (b && typeof b === 'object')))) {
      const x = toDec(typeof a === 'string' ? a : a), y = toDec(b);
      return x && y ? decCmp(x, y) : null;
    }
    const x = text(a), y = text(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  // 大小比較 (gt/lt)：auto 時兩邊都是數字字串也用數字比較 (例如年齡 '65' > '9')
  function order(a, b, kind) {
    if (kind === 'auto' && toDec(a) && toDec(b)) return decCmp(toDec(a), toDec(b));
    return compare(a, b, kind);
  }
  const isBlankVal = v => v === NULLV || (typeof v === 'string' && v.trim() === '');

  // 回傳 true / false / null (無法判定：資料不足或無法安全比較；不算通過，會列在「檢查範圍」)
  // 缺值的處理：
  //   欄位不存在 (MISSING)：所有運算都是 null
  //   undefined / null、空白：isBlank → true、notBlank → false；其他運算 (含 isZero、數字比較) → null；
  //                          文字的 eq/ne/in 照文字比較 (空白 = 空白)
  //   0 / '0' / '000'：是合法值，isZero → true、notBlank → true
  function evalCond(c, ctx) {
    if (!c || typeof c !== 'object') return null;
    if (c.all) { let unknown = false; for (const x of c.all) { const r = evalCond(x, ctx); if (r === false) return false; if (r === null) unknown = true; } return unknown ? null : true; }
    if (c.any) { let unknown = false; for (const x of c.any) { const r = evalCond(x, ctx); if (r === true) return true; if (r === null) unknown = true; } return unknown ? null : false; }
    if (c.not) { const r = evalCond(c.not, ctx); return r === null ? null : !r; }
    let v = getField(c.field, ctx);
    if (v === MISSING) return null;
    if (c.op === 'isBlank') return isBlankVal(v);
    if (c.op === 'notBlank') return !isBlankVal(v);
    if (v === NULLV) return null;
    if (c.pos && typeof v === 'string') v = v.slice(c.pos[0] - 1, c.pos[1]);
    const other = c.ref != null ? getField(c.ref, ctx) : c.value;
    if (other === MISSING || other === NULLV) return null;
    const kind = c.pos ? 'text' : kindOf(c.field, ctx.lay) || (c.ref != null ? kindOf(c.ref, ctx.lay) : null) || 'auto';
    const vs = typeof v === 'string' ? v : v;
    switch (c.op) {
      case 'isZero': case 'notZero': { const d = toDec(vs); if (!d) return null; return (d.n === 0n) === (c.op === 'isZero'); }
      case 'isDate': return typeof v === 'string' ? C.isValidDate(v) : null;
      case 'matches': { const re = safeRegex(c.value), t = String(typeof v === 'object' ? '' : v); return re && t.length <= 1000 && typeof v !== 'object' ? re.test(t) : null; }
      case 'startsWith': return typeof v === 'object' ? null : text(v).startsWith(String(other));
      case 'in': case 'notIn': {
        if (!Array.isArray(c.values)) return null;
        let unknown = false;
        for (const x of c.values) { const r = compare(vs, x, kind); if (r === 0) return c.op === 'in'; if (r === null) unknown = true; }
        return unknown ? null : c.op === 'notIn';
      }
      case 'eq': case 'ne': { const r = compare(vs, other, kind); return r === null ? null : (r === 0) === (c.op === 'eq'); }
      case 'gt': case 'gte': case 'lt': case 'lte': {
        const r = order(vs, other, kind);
        if (r === null) return null;
        return c.op === 'gt' ? r > 0 : c.op === 'gte' ? r >= 0 : c.op === 'lt' ? r < 0 : r <= 0;
      }
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
      const ctx = { rec, prev, lay: base.layouts[rule.file] };
      if (!prev && usesPrev.has(rule)) return;   // 每張保單的第一筆沒有「上一筆」可比，不適用 (不算無法判定)
      const w = rule.when ? evalCond(rule.when, ctx) : true;
      if (w === null) { stats.unjudged[rule.id] = (stats.unjudged[rule.id] || 0) + 1; return; }
      if (w !== true) return;
      const a = evalCond(rule.assert, ctx);
      if (a === null) { stats.unjudged[rule.id] = (stats.unjudged[rule.id] || 0) + 1; return; }
      if (a !== false) return;
      const fields = fieldsOf(rule).filter(k => base.layouts[rule.file].field(k));
      push({ ruleId: rule.id, severity: rule.severity || 'error', category: rule.category || '匯入規則', fields, value: fields.map(k => { const v = own(rec, k); return v === MISSING || v === NULLV ? '' : String(v).trim(); }).join(' / '),
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

  return { OPS, FNS, LIMITS, safeRegex, validateRule, validateAll, evalCond, extend, runRules, describe, fieldsOf, toDec, decCmp };
});
