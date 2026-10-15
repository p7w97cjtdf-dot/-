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

  // 讀入：接受更新包物件，或只有規則的陣列 (舊版「備份的規則」)
  function normalize(data, fallbackName) {
    const p = Array.isArray(data) ? { rules: data } : Object.assign({}, data);
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

  // 檢查更新包是否能使用：回傳 { errors: [整包的問題], rules: [{ id, errors }] }
  function validate(pack, base, others) {
    const p = normalize(pack), errors = [];
    const layouts = layoutsWith(base, (others || []).concat(p));
    for (const f of p.fields) {
      const lay = base.layouts[f.file];
      if (!lay) { errors.push(`新欄位「${f.name || f.key}」的資料代號 ${f.file} 不存在`); continue; }
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(String(f.key || ''))) errors.push(`新欄位代號「${f.key}」只能用英文字母與數字`);
      if (lay.field(f.key)) errors.push(`欄位代號「${f.key}」已存在於${lay.title}`);
      if (!(+f.start >= 1 && +f.len >= 1 && +f.start + +f.len - 1 <= lay.recordLength)) errors.push(`新欄位「${f.name || f.key}」的位置 ${f.start}~${+f.start + +f.len - 1} 超出每筆 ${lay.recordLength} 字的範圍`);
    }
    for (const id of p.disable) if (!base.catalog.some(c => c.id === id)) errors.push(`要停用的檢查「${id}」不存在`);
    const rules = p.rules.map(r => {
      const e = dsl.validateRule(withEffective(r), layouts);
      if (r.effective && (!isDate8(r.effective.from) || !layouts[r.file] || !layouts[r.file].field(r.effective.field))) e.push('適用起日的設定不正確 (需要日期欄位與 8 碼日期)');
      return { id: r.id, errors: e };
    });
    return { errors, rules, ok: !errors.length && rules.every(r => !r.errors.length) };
  }

  // 「effective」轉成前提條件：只檢查日期欄位在起日以後的資料
  function withEffective(r) {
    if (!r.effective) return r;
    const cond = { field: r.effective.field, op: 'gte', value: String(r.effective.from) };
    return Object.assign({}, r, { when: r.when ? { all: [cond, r.when] } : cond });
  }

  // 套用啟用中的更新包，回傳新的規則集與要停用的檢查
  function apply(base, packs) {
    const on = (packs || []).map(normalize);
    const layouts = layoutsWith(base, on);
    const rules = [];
    for (const p of on) for (const r of p.rules) {
      const rr = withEffective(r);
      if (dsl.validateRule(rr, layouts).length) continue;
      rules.push(Object.assign({}, rr, { category: '法規更新', level: '法規更新', ref: [p.name, p.version && `第 ${p.version} 版`, r.ref || p.basis].filter(Boolean).join('・'), pack: p.id }));
    }
    const rs = dsl.extend(Object.assign({}, base, { layouts }), rules);
    // 新欄位的格式／代碼檢查也列入規則清單
    for (const p of on) for (const f of p.fields) if (layouts[f.file] && layouts[f.file].field(f.key) && layouts[f.file].field(f.key).added === p.name)
      rs.catalog.push({ id: `${p.id}:${f.key}`, name: `${f.name || f.key}格式與代碼`, level: '法規更新', ref: [p.name, p.basis].filter(Boolean).join('・'), severity: 'error', pack: p.id });
    const disabled = new Set(on.flatMap(p => p.disable));
    return { ruleset: rs, disabled };
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
