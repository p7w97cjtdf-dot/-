#!/usr/bin/env node
// 匯出試用活頁簿的資料 (JSON)，供 tools/build_workbook.py 產生 Excel
// 用法：node tools/export-workbook.js [--clean] [--seed 2026 --policies 1000] > data.json
//   不指定 --seed/--policies 時為預設試用資料 (samples/excel/試用資料_*.xlsx)
const C = require('../src/core.js');
const fin = require('../src/rulesets/finance.js');
const { generate } = require('../src/mock.js');

const inject = !process.argv.includes('--clean');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : undefined; };
const opts = Object.assign({ inject }, arg('--seed') ? { seed: arg('--seed') } : {}, arg('--policies') ? { policies: arg('--policies') } : {});
const g = generate(opts);
const W = require('../src/workbook.js');
const csv = text => { const rows = C.parseCSV(text.replace(/^\uFEFF/, '')); return { header: rows[0], rows: rows.slice(1) }; };
const SH = W.sheets(g);
const L = SH.保單資料, D = SH.理賠資料;
// 錯誤解答：對應到工作表與 Excel 列號
const rowOf = (sheet, policy) => {
  if (!policy) return '';
  const [no, seq] = policy.split('/');
  const i = sheet.rows.findIndex(r => r[1].trim() === no && r[2].trim() === (seq || '')); return i < 0 ? '' : i + 2;
};
const keyRows = [];
for (const k of g.key) keyRows.push(['保單／理賠資料', k.ruleId, k.file === 'D' ? '理賠資料' : '保單資料', k.policy, rowOf(k.file === 'D' ? { rows: D.rows.map(r => [r[0], r[2], r[3]]) } : L, k.policy), k.desc]);
for (const k of g.masterKey) keyRows.push([k.ruleId.startsWith('PM') ? '商品資料' : '客戶資料', k.ruleId, k.ruleId.startsWith('PM') || k.ruleId === 'C008' || k.ruleId === 'C009' || k.ruleId === 'C006' ? '保單資料' : '客戶資料', k.policy, k.ruleId.startsWith('PM') || ['C006', 'C008', 'C009'].includes(k.ruleId) ? rowOf(L, k.policy) : '', k.desc + (k.fix ? `（修正值 ${k.fix}）` : '') + (k.suggest ? `（正確代號 ${k.suggest}）` : '')]);
for (const k of g.anomalyKey) keyRows.push(['請人工判斷（不太合理）', k.ruleId, k.file === 'D' ? '理賠資料' : '保單資料', k.policy, rowOf(k.file === 'D' ? { rows: D.rows.map(r => [r[0], r[2], r[3]]) } : L, k.policy), k.desc + '（不算錯誤：工具會標成「請人工判斷」）']);
for (const k of g.ruleKey) keyRows.push(['自訂規則', k.ruleId, '保單資料／理賠資料', k.policy, '', k.desc + '（需先在「新增檢查規則」套用範例的公司內部規則）']);
for (const k of g.reconKey) keyRows.push([{ control: '和系統總數比對', roll: '去年和今年', stmt: '資產負債表' }[k.module], k.ruleId || 'R001', { control: '系統總數', roll: '去年保單資料', stmt: '資產負債表' }[k.module], k.policy || k.code || `${k.item} ${k.period}`, '', k.desc + (k.status ? `（應判定為：${({ 時間差: '結帳日不同', 定義差: '算法不同', 待查: '需要追查' })[k.status] || k.status}）` : '')]);

// 資產負債表：上層科目以公式加總
const st = csv(g.statement);
const codes = st.rows.map(r => r[0]);
const parentOf = code => { for (let k = code.length - 1; k >= 1; k--) if (fin.byCode.has(code.slice(0, k))) return code.slice(0, k); return null; };
const children = codes.map(c => codes.map((x, j) => (fin.byCode.has(x) ? fin.byCode.get(x).parent : parentOf(x)) === c ? j : -1).filter(j => j >= 0));

console.log(JSON.stringify({
  inject, names: g.names, dataset: { seed: opts.seed || 20251014, policies: opts.policies || 120 },
  sheets: {
    ...SH, 資產負債表: Object.assign({}, SH.資產負債表, { children }),
  },
  key: keyRows,
  skipped: inject ? ['保單資料文字檔中「長度不足」的一筆與「空白行」無法在 Excel 中表示，請用文字檔版本測試這兩項。' +
    `長度不足的那筆 (${(g.key.find(k => k.ruleId === '10300').affects || [''])[0].split(' ')[1] || ''}) 因此不在本檔「保單資料」，客戶資料會連帶出現 1 項 C007。`] : [],
}));
