/*
 * 規則更新包：法規或申報格式變動時，不必改程式就能調整檢查。
 * 由法遵／主管單位整理成一個 JSON 檔發給大家，匯入後立即生效；也可在工具裡用表單新增。
 *
 * 更新包格式：
 * {
 *   "id": "2026-01",                       更新包代號 (同代號再匯入會取代舊版)
 *   "name": "2026 年度填報格式修正",
 *   "version": "1", "issuedAt": "20260105",  版本與發布日
 *   "basis": "保發中心 115 年 1 月 5 日函",   依據 (函令文號、手冊頁碼等)
 *   "note": "說明",
 *   "fields":  [{ "file": "L", "key": "digitalFlag", "name": "數位投保註記", "start": 422, "len": 1, "type": "X", "values": ["Y", "N"] }],
 *   "rules":   [ 規則 (格式同 src/rules-dsl.js)，可加 "effective": { "field": "startDate", "from": "20260101" } 只檢查該日期以後的資料 ],
 *   "disable": ["L6101"]                    停用的內建檢查 (法規放寬或改變時)
 * }
 * 新欄位只能定義在現有每筆資料的範圍內 (例如保留欄位)；每筆長度改變時仍需更新程式。
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const dsl = isNode ? require('./rules-dsl.js') : root.DQ.dsl;
  const m = factory(dsl);
  if (isNode) module.exports = m; else root.DQ.rulePacks = m;
})(typeof self !== 'undefined' ? self : this, function (dsl) {
  'use strict';
  const isDate8 = v => /^\d{8}$/.test(String(v || ''));

  // 讀入：接受更新包物件，或只有規則的陣列 (舊版「備份的規則」)。只複製認得的屬性 (不用 Object.assign 整個複製，
  // 避免 JSON 裡的「__proto__」等鍵名改到物件的原型)
  const PACK_KEYS = ['id', 'name', 'version', 'issuedAt', 'basis', 'note', 'fields', 'rules', 'disable', 'disableWhy'];
  const plain = o => o !== null && typeof o === 'object' && !Array.isArray(o) && [Object.prototype, null].includes(Object.getPrototypeOf(o));
  function normalize(data, fallbackName) {
    const src = Array.isArray(data) ? { rules: data } : plain(data) ? data : {};
    const p = {};
    for (const k of PACK_KEYS) if (Object.prototype.hasOwnProperty.call(src, k)) p[k] = src[k];
    p.id = String(p.id || ('pack-' + Date.now().toString(36)));
    p.name = String(p.name || fallbackName || '自訂更新');
    p.version = p.version == null ? '' : String(p.version);
    p.fields = Array.isArray(p.fields) ? p.fields : [];
    p.rules = Array.isArray(p.rules) ? p.rules : [];
    p.disable = Array.isArray(p.disable) ? p.disable.map(String) : [];
    return p;
  }

  // 加上新欄位後的檔案格式 (原格式不變)
  function layoutsWith(base, packs) {
    const out = Object.assign({}, base.layouts);
    for (const p of packs) for (const f of p.fields) {
      const lay = out[f.file]; if (!lay || lay.field(f.key)) continue;
      const nf = { no: lay.fields.length + 1, key: f.key, name: f.name || f.key, start: +f.start, len: +f.len, type: f.type === '9' ? '9' : 'X', added: p.name,
        typeRule: `${p.id}:${f.key}`, codeRule: `${p.id}:${f.key}`, codes: Array.isArray(f.values) && f.values.length ? f.values.map(String) : null, codeTable: `${p.name}「${f.name || f.key}」代碼` };
      const fields = lay.fields.concat(nf);
      out[f.file] = Object.assign({}, lay, { fields, field: k => fields.find(x => x.key === k) });
    }
    return out;
  }

  // 更新包的上限 (超過就整包不採用)
  const PACK_LIMITS = Object.freeze({ rules: dsl.LIMITS.rulesPerPack, fields: 50, disable: 500, text: 2000 });
  const BAD = /^(__proto__|constructor|prototype)$/;
  // 深層檢查：任何一層有危險鍵名，或巢狀過深 (JSON 物件)
  function badKeys(v, d) {
    if (d > 40) return '更新包的內容巢狀過深';
    if (v && typeof v === 'object') for (const k of Object.keys(v)) { if (BAD.test(k)) return `不允許的鍵名「${k}」`; const r = badKeys(v[k], d + 1); if (r) return r; }
    return '';
  }
  // 檢查更新包是否能使用：回傳 { errors: [整包的問題], rules: [{ id, errors }], ok }。ok 為 false 時整包都不套用
  function validate(pack, base, others) {
    const errors = [];
    if (!Array.isArray(pack) && !plain(pack)) return { errors: ['更新包必須是 JSON 物件'], rules: [], ok: false };
    const bk = badKeys(pack, 0); if (bk) return { errors: [bk], rules: [], ok: false };
    const p = normalize(pack);
    if (!Array.isArray(p.fields) || !Array.isArray(p.rules) || !Array.isArray(p.disable)) errors.push('fields、rules、disable 必須是陣列');
    if (p.rules.length > PACK_LIMITS.rules) errors.push(`規則超過 ${PACK_LIMITS.rules} 條`);
    if (p.fields.length > PACK_LIMITS.fields) errors.push(`新欄位超過 ${PACK_LIMITS.fields} 個`);
    if (p.disable.length > PACK_LIMITS.disable) errors.push(`停用的檢查超過 ${PACK_LIMITS.disable} 條`);
    for (const k of ['id', 'name', 'version', 'issuedAt', 'basis', 'note']) if (String(p[k] || '').length > PACK_LIMITS.text) errors.push(`${k} 超過 ${PACK_LIMITS.text} 字`);
    if (errors.length) return { errors, rules: [], ok: false };
    const layouts = layoutsWith(base, (others || []).concat(p));
    for (const f of p.fields) {
      if (!plain(f)) { errors.push('新欄位的定義必須是物件'); continue; }
      const lay = typeof f.file === 'string' && Object.prototype.hasOwnProperty.call(base.layouts, f.file) ? base.layouts[f.file] : null;
      if (!lay) { errors.push(`新欄位「${f.name || f.key}」的資料代號 ${f.file} 不存在`); continue; }
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(String(f.key || ''))) errors.push(`新欄位代號「${f.key}」只能用英文字母與數字`);
      if (lay.field(f.key)) errors.push(`欄位代號「${f.key}」已存在於${lay.title}`);
      if (!(+f.start >= 1 && +f.len >= 1 && +f.start + +f.len - 1 <= lay.recordLength)) errors.push(`新欄位「${f.name || f.key}」的位置 ${f.start}~${+f.start + +f.len - 1} 超出每筆 ${lay.recordLength} 字的範圍`);
    }
    for (const id of p.disable) if (!base.catalog.some(c => c.id === id)) errors.push(`要停用的檢查「${id}」不存在`);
    const rules = p.rules.map((r, i) => {
      if (!plain(r)) return { id: `第 ${i + 1} 條`, errors: ['規則必須是物件（不能是空值、陣列或其他型態）'] };
      const e = dsl.validateRule(withEffective(r), layouts);
      if (r.effective != null && (!plain(r.effective) || !isDate8(r.effective.from) || typeof r.effective.field !== 'string' || !layouts[r.file] || !layouts[r.file].field(r.effective.field))) e.push('適用起日的設定不正確 (需要日期欄位與 8 碼日期)');
      return { id: typeof r.id === 'string' ? r.id : `第 ${i + 1} 條`, errors: e };
    });
    const ids = p.rules.filter(plain).map(r => r.id), dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
    if (dup.length) errors.push(`規則編號重複：${dup.join('、')}`);
    return { errors, rules, ok: !errors.length && rules.every(r => !r.errors.length) };
  }

  // 「effective」轉成前提條件：只檢查日期欄位在起日以後的資料
  function withEffective(r) {
    if (!r || !r.effective || !plain(r.effective)) return r;
    const cond = { field: r.effective.field, op: 'gte', value: String(r.effective.from) };
    return Object.assign({}, r, { when: r.when ? { all: [cond, r.when] } : cond });
  }

  // 套用啟用中的更新包，回傳新的規則集、要停用的檢查，以及沒有套用的更新包 (rejected)。
  // 整包驗證：只要有一項格式不對，整包 (規則、新欄位、停用) 都不套用，不會只套用一部分
  // opts.catalog：驗證「要停用的檢查」時另外認得的檢查 (財報、客戶與商品、合理性檢查；和畫面上的規則清單相同)
  function apply(base, packs, opts) {
    const all = (packs || []).map(x => ({ raw: x, p: normalize(x) })), on = [], rejected = [];
    const vbase = opts && opts.catalog ? Object.assign({}, base, { catalog: base.catalog.concat(opts.catalog) }) : base;
    for (const x of all) {
      const v = validate(x.raw, vbase, all.filter(y => y !== x).map(y => y.p));
      if (v.ok) on.push(x.p); else rejected.push({ id: x.p.id, name: x.p.name, errors: v.errors.concat(v.rules.filter(r => r.errors.length).map(r => `${r.id}：${r.errors.join('、')}`)) });
    }
    const layouts = layoutsWith(base, on);
    const rules = [];
    for (const p of on) for (const r of p.rules) {
      const rr = withEffective(r);
      rules.push(Object.assign({}, rr, { category: '法規更新', level: '法規更新', ref: [p.name, p.version && `第 ${p.version} 版`, r.ref || p.basis].filter(Boolean).join('・'), pack: p.id }));
    }
    const rs = dsl.extend(Object.assign({}, base, { layouts }), rules);
    // 新欄位的格式／代碼檢查也列入規則清單
    for (const p of on) for (const f of p.fields) if (layouts[f.file] && layouts[f.file].field(f.key) && layouts[f.file].field(f.key).added === p.name)
      rs.catalog.push({ id: `${p.id}:${f.key}`, name: `${f.name || f.key}格式與代碼`, level: '法規更新', ref: [p.name, p.basis].filter(Boolean).join('・'), severity: 'error', pack: p.id });
    const disabled = new Set(on.flatMap(p => p.disable));
    return { ruleset: rs, disabled, rejected };
  }

  // 依停用清單拿掉問題
  const filterIssues = (issues, disabled) => disabled && disabled.size ? issues.filter(i => !disabled.has(i.ruleId)) : issues;

  // 一句話摘要
  function summary(p) {
    const n = normalize(p);
    return [n.rules.length && `新增 ${n.rules.length} 條檢查`, n.disable.length && `停用 ${n.disable.length} 條`, n.fields.length && `新欄位 ${n.fields.length} 個`].filter(Boolean).join('、') || '沒有內容';
  }

  return { normalize, validate, apply, filterIssues, summary, layoutsWith, withEffective };
});
