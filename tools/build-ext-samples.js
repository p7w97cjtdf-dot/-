#!/usr/bin/env node
// 產生癌症險 / 傷害險的範例資料：samples/<險種>/clean、dirty (文字檔＋錯誤解答)，
// 並輸出 JSON 給 tools/build_ext_workbook.py 產生 Excel 試用檔。
// 用法：node tools/build-ext-samples.js cancer|accident
const fs = require('fs');
const path = require('path');
const M = require('../src/mock-ext.js');
const W = require('../src/workbook.js');
const all = require('../src/rulesets/index.js');

const product = process.argv[2] || 'cancer';
const gen = product === 'cancer' ? M.generateCancer : M.generateAccident;
const P = product === 'cancer' ? { L: 'CL', D: 'CD', title: '癌症險' } : { L: 'AL', D: 'AD', title: '傷害險' };
const root = path.join(__dirname, '..', 'samples', product);
for (const [dir, inject] of [['clean', false], ['dirty', true]]) {
  const g = gen({ inject });
  const d = path.join(root, dir);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, g.names[P.L]), g[P.L]);
  fs.writeFileSync(path.join(d, g.names[P.D]), g[P.D]);
  if (inject) fs.writeFileSync(path.join(d, 'answer-key.json'), JSON.stringify(g.key, null, 2) + '\n');
  const sheets = W.extSheets(g);
  // 錯誤解答：對應到工作表與 Excel 列號
  const rowsOf = (name, policy) => {
    const sh = sheets[name], lay = all.layouts[name === W.NAMES[P.L] ? P.L : P.D];
    const iNo = lay.fields.findIndex(f => f.key === 'policyNo'), iSeq = lay.fields.findIndex(f => f.key === 'policySeq');
    const [no, seq] = policy.split('/');
    return sh.rows.map((r, i) => r[iNo].trim() === no && r[iSeq].trim() === (seq || '') ? i + 2 : 0).filter(Boolean);
  };
  const key = g.key.map(k => { const sheet = W.NAMES[k.file]; const rows = rowsOf(sheet, k.policy); return [k.rules.join('、'), sheet, k.policy, rows.slice(0, 4).join('、'), k.what]; });
  const out = { inject, product, title: P.title, year: g.year, names: g.names, sheets, key, layout: { L: all.layouts[P.L].fields.length, D: all.layouts[P.D].fields.length } };
  fs.writeFileSync(path.join(require('os').tmpdir(), `ext-${product}-${dir}.json`), JSON.stringify(out));
  console.log(`${product} ${dir}: 保單 ${g[P.L].split('\n').length - 1} 筆、理賠 ${g[P.D].split('\n').length - 1} 筆${inject ? `、注入錯誤 ${g.key.length} 項` : ''}`);
}
