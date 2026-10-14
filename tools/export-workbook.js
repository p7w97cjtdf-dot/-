#!/usr/bin/env node
// 匯出試用活頁簿的資料 (JSON)，供 tools/build_workbook.py 產生 Excel
// 用法：node tools/export-workbook.js [--clean] > data.json
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const fin = require('../src/rulesets/finance.js');
const R = require('../src/recon.js');
const { generate } = require('../src/mock.js');

const inject = !process.argv.includes('--clean');
const g = generate({ inject });
const recs = (text, lay) => C.parseFixedWidth(text, lay).records.filter(r => r._raw.length === lay.recordLength);
const fixed = (text, lay) => ({ header: lay.fields.map(f => f.name), rows: recs(text, lay).map(r => lay.fields.map(f => r[f.key])), keys: lay.fields.map(f => f.key) });
const csv = text => { const rows = C.parseCSV(text.replace(/^﻿/, '')); return { header: rows[0], rows: rows.slice(1) }; };

const L = fixed(g.L, life.layouts.L), D = fixed(g.D, life.layouts.D), P = fixed(g.prior, life.layouts.L);
// 錯誤解答：對應到工作表與 Excel 列號
const rowOf = (sheet, policy) => {
  if (!policy) return '';
  const [no, seq] = policy.split('/');
  const i = sheet.rows.findIndex(r => r[1].trim() === no && r[2].trim() === (seq || '')); return i < 0 ? '' : i + 2;
};
const keyRows = [];
for (const k of g.key) keyRows.push(['明細檢核', k.ruleId, k.file === 'D' ? '給付資料' : '承保資料', k.policy, rowOf(k.file === 'D' ? { rows: D.rows.map(r => [r[0], r[2], r[3]]) } : L, k.policy), k.desc]);
for (const k of g.masterKey) keyRows.push([k.ruleId.startsWith('PM') ? '商品資料' : '客戶資料', k.ruleId, k.ruleId.startsWith('PM') || k.ruleId === 'C008' || k.ruleId === 'C009' || k.ruleId === 'C006' ? '承保資料' : '客戶資料', k.policy, k.ruleId.startsWith('PM') || ['C006', 'C008', 'C009'].includes(k.ruleId) ? rowOf(L, k.policy) : '', k.desc + (k.fix ? `（修正值 ${k.fix}）` : '') + (k.suggest ? `（正確代號 ${k.suggest}）` : '')]);
for (const k of g.anomalyKey) keyRows.push(['疑似異常（需人工判斷）', k.ruleId, k.file === 'D' ? '給付資料' : '承保資料', k.policy, rowOf(k.file === 'D' ? { rows: D.rows.map(r => [r[0], r[2], r[3]]) } : L, k.policy), k.desc + '（不是錯誤：結果應標為疑似異常，由人工判斷）']);
for (const k of g.ruleKey) keyRows.push(['匯入規則', k.ruleId, '承保資料／給付資料', k.policy, '', k.desc + '（需先在「規則匯入」套用公司內部核保規則）']);
for (const k of g.reconKey) keyRows.push([{ control: '跨系統對帳', roll: '期初期末結轉', stmt: '財報勾稽' }[k.module], k.ruleId || 'R001', { control: '控制總數', roll: '上年度承保資料', stmt: '資產負債表' }[k.module], k.policy || k.code || `${k.item} ${k.period}`, '', k.desc + (k.status ? `（應判定為：${k.status}）` : '')]);

// 資產負債表：上層科目以公式加總
const st = csv(g.statement);
const codes = st.rows.map(r => r[0]);
const parentOf = code => { for (let k = code.length - 1; k >= 1; k--) if (fin.byCode.has(code.slice(0, k))) return code.slice(0, k); return null; };
const children = codes.map(c => codes.map((x, j) => (fin.byCode.has(x) ? fin.byCode.get(x).parent : parentOf(x)) === c ? j : -1).filter(j => j >= 0));

console.log(JSON.stringify({
  inject, names: g.names,
  sheets: {
    承保資料: L, 給付資料: { header: D.header, rows: D.rows }, 上年度承保資料: { header: P.header, rows: P.rows },
    客戶資料: csv(g.customers), 商品資料: csv(g.products), 控制總數: csv(g.control),
    資產負債表: { header: st.header, rows: st.rows.map(r => [r[0], r[1], ...r.slice(2).map(Number)]), children },
  },
  key: keyRows,
  skipped: inject ? ['承保資料檔中「長度不足」的一筆與「空白行」無法以 Excel 儲存格表示，請使用 samples/dirty/LFL01_2025.txt 測試這兩項。' +
    `長度不足的那筆 (${(g.key.find(k => k.ruleId === '10300').affects || [''])[0].split(' ')[1] || ''}) 因此不在本檔「承保資料」，客戶資料會連帶出現 1 項 C007。`] : [],
}));
