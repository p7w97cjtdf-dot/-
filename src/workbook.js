/*
 * Excel 活頁簿：
 *  - sheets(g)：由模擬資料組出試用活頁簿的 7 張工作表 (tools/export-workbook.js 與 tests/run.html 共用)
 *  - slots(XLSX, wb)：依工作表名稱分配到工具的 7 個上傳格 (網頁與 tests/run.html 共用)
 *  - files(got)：把各工作表轉成檢核引擎的輸入 (承保/給付/上年度轉回固定長度格式)
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('./core.js') : root.DQ;
  const life = isNode ? require('./rulesets/life.js') : root.DQ.rulesets.life;
  const m = factory(C, life);
  if (isNode) module.exports = m; else root.DQ.workbook = m;
})(typeof self !== 'undefined' ? self : this, function (C, life) {
  'use strict';
  const L = life.layouts.L, D = life.layouts.D;
  // 工作表名稱包含這些字就分配到對應的上傳格 (「去年保單資料」要先於「保單」比對)；舊名稱 (承保、給付、上年度、控制總數) 也接受
  const SHEET_SLOT = [['上年度', 'prior'], ['去年', 'prior'], ['承保', 'L'], ['保單', 'L'], ['給付', 'D'], ['理賠', 'D'], ['控制總數', 'control'], ['系統總數', 'control'], ['資產負債', 'statement'], ['商品', 'products'], ['客戶', 'customers']];
  const NAMES = { L: '保單資料', D: '理賠資料', customers: '客戶資料', products: '商品資料', prior: '去年保單資料', control: '系統總數', statement: '資產負債表' };

  const recs = (text, lay) => C.parseFixedWidth(text, lay).records.filter(r => r._raw.length === lay.recordLength);
  const fixed = (text, lay) => ({ header: lay.fields.map(f => f.name), rows: recs(text, lay).map(r => lay.fields.map(f => r[f.key])) });
  const csv = text => { const rows = C.parseCSV(text.replace(/^﻿/, '')); return { header: rows[0], rows: rows.slice(1) }; };

  // 7 張工作表 (資產負債表金額為數字，其餘皆為文字以保留前置 0)
  function sheets(g) {
    const st = csv(g.statement);
    return {
      保單資料: fixed(g.L, L), 理賠資料: fixed(g.D, D), 客戶資料: csv(g.customers), 商品資料: csv(g.products),
      去年保單資料: fixed(g.prior, L), 系統總數: csv(g.control),
      資產負債表: { header: st.header, rows: st.rows.map(r => [r[0], r[1], ...r.slice(2).map(Number)]) },
    };
  }

  // 名稱看不出來時，改看第一列標題 (例如使用者把工作表命名為 Sheet1)
  function bySignature(head) {
    const h = new Set(head.map(x => String(x || '').replace(/^\uFEFF/, '').trim()));
    const has = (...k) => k.every(x => h.has(x));
    if (has('給付類別', '保單編號')) return 'D';
    if (has('加保別', '退保別', '保單編號')) return 'L';
    if (has('角色', '姓名', '證件編號')) return 'customers';
    if (has('商品代號', '停售日')) return 'products';
    if (has('來源系統', '項目代號')) return 'control';
    if (has('科目代號', '期末餘額')) return 'statement';
    return null;
  }
  // 依工作表名稱分配，名稱不符時依標題列判斷：回傳 { slot: csv文字 } 與 { slot: 工作表名稱 }
  // 兩張工作表都像保單資料、又沒有名稱可判斷時，日期較早的那張當作去年保單資料
  function slots(XLSX, wb) {
    const got = {}, from = {}, unknown = [];
    for (const name of wb.SheetNames) {
      const hit = SHEET_SLOT.find(([k]) => name.includes(k));
      if (hit && !got[hit[1]]) { got[hit[1]] = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false, rawNumbers: true }); from[hit[1]] = name; }
      else if (!hit) unknown.push(name);
    }
    for (const name of unknown) {
      const head = (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false })[0]) || [];
      let slot = bySignature(head);
      if (slot === 'L' && got.L) slot = got.prior ? null : 'prior';
      if (slot && !got[slot]) { got[slot] = XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false, rawNumbers: true }); from[slot] = name; }
    }
    if (got.L && got.prior && !SHEET_SLOT.some(([k, v]) => v === 'prior' && from.prior.includes(k))) {
      const lastYear = csvText => { const r = C.parseFixedWidth(C.csvToFixedWidth(csvText, L), L).records; return r.map(x => x.startDate).filter(d => C.isValidDate(d)).sort().pop() || ''; };
      if (lastYear(got.prior) > lastYear(got.L)) { [got.L, got.prior] = [got.prior, got.L]; [from.L, from.prior] = [from.prior, from.L]; }
    }
    return { got, from };
  }

  // 由承保資料推得公司代號與填報年度，產生符合命名原則的檔名 (對帳依填報年度彙總)
  function files(got) {
    let co = '01', year = String(new Date().getFullYear() - 1);
    if (got.L) {
      const r = C.parseFixedWidth(C.csvToFixedWidth(got.L, L), L).records;
      if (r[0]) co = r[0].company;
      const ys = r.flatMap(x => [x.addDate, x.exitDate]).filter(d => C.isValidDate(d)).map(d => d.slice(0, 4));
      if (ys.length) year = ys.sort().pop();
    }
    const names = { L: `LFL${co}_${year}.txt`, D: `LFD${co}_${year}.txt`, prior: `LFL${co}_${year - 1}.txt`, control: `控制總數_${year}.csv`, statement: `資產負債表_${year}.csv`, products: `商品資料_${year}.csv`, customers: `客戶資料_${year}.csv` };
    const out = {};
    for (const [slot, text] of Object.entries(got)) {
      const lay = slot === 'D' ? D : (slot === 'L' || slot === 'prior') ? L : null;
      out[slot] = { name: names[slot], text: lay ? C.csvToFixedWidth(text, lay) : text, fromSheet: true };
    }
    return out;
  }

  return { SHEET_SLOT, NAMES, sheets, slots, files };
});
