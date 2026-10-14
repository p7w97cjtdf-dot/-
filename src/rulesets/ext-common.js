/*
 * 癌症保險、傷害保險規則集共用的小工具：欄位格式定義、商品編碼、暴露數與日期計算。
 * 個人壽險規則集 (life.js) 不使用此檔，保持原樣。
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('../core.js') : root.DQ;
  const life = isNode ? require('./life.js') : root.DQ.rulesets.life;
  const occ = isNode ? require('./occupation.js') : root.DQ.rulesets.occupation;
  const m = factory(C, life, occ);
  if (isNode) module.exports = m; else root.DQ.rulesets.extCommon = m;
})(typeof self !== 'undefined' ? self : this, function (C, life, occ) {
  'use strict';
  const keys = o => Object.keys(o);

  // [key, 名稱, 起, 長度, 型態, 其他屬性]；欄位長度合計必須等於每筆長度
  function layout(id, title, recordLength, defs, extra) {
    const fields = defs.map(([key, name, start, len, type, o], i) => Object.assign({ no: i + 1, key, name, start, len, type }, o || {}));
    for (let i = 1; i < fields.length; i++) if (fields[i].start !== fields[i - 1].start + fields[i - 1].len) throw new Error(`${id} ${fields[i].name} 起始位置不連續`);
    const total = fields.reduce((s, f) => s + f.len, 0);
    if (total !== recordLength) throw new Error(`${id} 欄位長度合計 ${total} ≠ ${recordLength}`);
    return Object.assign({ id, title, recordLength, fields, field: k => fields.find(f => f.key === k) }, extra);
  }

  const T = {
    company: Object.assign({}, life.tables.company, { '05': '凱基人壽', '56': '國際康健人壽', '70': '安達人壽' }),
    currency: life.tables.currency,
    zip: life.tables.zip,
    idType: { '0': '無資料', '1': '身分證', '2': '護照', '3': '居留證', '9': '其他證件' },
    sex: { '1': '男', '2': '女' },
    channel: life.tables.channel,
    disabilityLevel: life.tables.disabilityLevel,
  };
  const isDisabilityCat = v => v === '000' || /^(0[1-9]0|1[0-8]0|990)$/.test(v) || /^A0[1-8]$/.test(v) || /^M[0-9A-F]{2}$/.test(v);
  const zipOk = v => T.zip.includes(v) || v === '999' || v === '888';

  const dateOk = v => !!v && C.isValidDate(v);
  const nz = v => !!v && !C.isZero(v);
  const mmdd = d => d.slice(4);
  const daysInYear = y => ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0) ? 366 : 365;
  const dayDiff = (a, b) => Math.round((C.toDate(b) - C.toDate(a)) / 86400000);
  const plusDays = (d, n) => { const x = C.toDate(d); x.setUTCDate(x.getUTCDate() + n); return C.fmtDate(x); };
  // 保險年齡：最近生日法 (不足一年的月數 ≦ 6 取實際年齡，> 6 加一歲)
  function insAge(birth, on) {
    const months = C.monthsBetween(birth, on);
    return Math.floor(months / 12) + (months % 12 > 6 ? 1 : 0);
  }
  // 暴露數：期間 [from, to] 的天數 ÷ 填報年度天數，取小數 6 位 (整數 1 位 + 小數 6 位，共 7 位)
  const exposure = (from, to, year) => String(Math.round((dayDiff(from, to) + 1) / daysInYear(year) * 1e6)).padStart(7, '0');

  // 職業分類代碼
  const occOk = v => occ.has(v);

  // 保險商品編號 (15 碼版本 1 或 27 碼版本 2) 的基本編碼原則
  // scope(p)：回傳 true 表示屬於此險種的填報對象
  function checkProduct(r, p, o) {
    const code = r[o.codeKey], ver = r[o.verKey];
    const c15 = code.slice(0, 15), rest = code.slice(15);
    const id = o.ids;
    if (ver === '1' && !/^[0 ]*$/.test(rest)) return p({ ruleId: id.len, category: '單筆邏輯', fields: [o.codeKey, o.verKey], value: code.trimEnd(), message: '商品編號適用版本=1 (15 碼版本)，但商品編號超過 15 碼', suggestion: '15 碼版本後 12 碼請補空白或 0；若為 27 碼商品，適用版本應填 2' });
    if (ver === '2' && /[ ]/.test(code.slice(0, 27).trimEnd()) || ver === '2' && code.trimEnd().length < 27) return p({ ruleId: id.len, category: '單筆邏輯', fields: [o.codeKey, o.verKey], value: code.trimEnd(), message: '商品編號適用版本=2 (27 碼版本)，但商品編號不足 27 碼', suggestion: '2015/7/1 前適用的 15 碼商品，適用版本應填 1' });
    const bad = [];
    if (c15[0] !== '2') bad.push('第 1 碼應為 2 (壽險業)');
    if (!/^\d\d$/.test(c15.slice(1, 3))) bad.push('第 2-3 碼應為公司代號');
    if (!'1234'.includes(c15[3])) bad.push('第 4 碼 (大分類) 應為 1~4');
    if (!'136'.includes(c15[5])) bad.push('第 6 碼 (個人/團體) 應為 1、3 或 6');
    if (!'MRAEN'.includes(c15[6])) bad.push('第 7 碼 (契約別) 應為 M、R、A、E 或 N');
    if (ver === '2') {
      if (!'ABZUV'.includes(c15[7])) bad.push('第 8 碼 (傳統/非傳統) 應為 A、B、Z、U 或 V');
      if (!'123'.includes(code[13])) bad.push('第 14 碼 (審查制度別) 應為 1~3');
      if (!'123'.includes(code[14])) bad.push('第 15 碼 (年期別) 應為 1~3');
      if (!/[A-KZ]/.test(code[15])) bad.push('第 16 碼 (幣別) 應為 A~K 或 Z');
      if (!'123'.includes(code[16])) bad.push('第 17 碼 (體況別) 應為 1~3');
      if (!'12'.includes(code[17])) bad.push('第 18 碼 (給付方式別) 應為 1 或 2');
      if (code.slice(20, 25) !== '00000') bad.push('第 21-25 碼 (保留碼) 應為 00000');
    } else if (!'1234'.includes(c15[7])) bad.push('第 8 碼應為 1~4');
    if (bad.length) return p({ ruleId: id.rule, category: '單筆邏輯', fields: [o.codeKey], value: code.trimEnd(), message: `商品編號不符編碼原則：${bad.join('；')}`, suggestion: '請依「人身保險商品編碼原則」重新確認商品編號' });
    if (!o.scope(c15)) p({ ruleId: id.scope, category: '單筆邏輯', fields: [o.codeKey], value: code.trimEnd(), message: o.scopeMsg, suggestion: o.scopeHint });
  }

  return { layout, T, keys, isDisabilityCat, zipOk, occOk, occ, dateOk, nz, mmdd, daysInYear, dayDiff, plusDays, insAge, exposure, checkProduct };
});
