#!/usr/bin/env node
// 產生範例資料：samples/clean (無錯誤) 與 samples/dirty (注入錯誤 + answer-key.json)
const fs = require('fs');
const path = require('path');
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const { generate } = require('../src/mock.js');

const out = path.join(__dirname, '..', 'samples');
for (const [dir, inject] of [['clean', false], ['dirty', true]]) {
  const g = generate({ inject });
  const d = path.join(out, dir);
  fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(path.join(d, g.names.L), g.L);
  fs.writeFileSync(path.join(d, g.names.D), g.D);
  fs.writeFileSync(path.join(d, g.names.prior), g.prior);
  fs.writeFileSync(path.join(d, g.names.control), g.control);
  fs.writeFileSync(path.join(d, g.names.statement), g.statement);
  fs.writeFileSync(path.join(d, g.names.products), g.products);
  fs.writeFileSync(path.join(d, g.names.customers), g.customers);
  if (inject) fs.writeFileSync(path.join(d, 'answer-key.json'), JSON.stringify({ 明細檢核: g.key, 對帳與勾稽: g.reconKey, 匯入規則: g.ruleKey, 客戶與商品資料: g.masterKey }, null, 2) + '\n');
  // 另存 CSV 版本 (方便以 Excel 開啟展示)
  const parsed = C.parseFixedWidth(g.L, life.layouts.L).records.filter(r => r._raw.length === life.layouts.L.recordLength);
  fs.writeFileSync(path.join(d, g.names.L.replace('.txt', '.csv')), C.recordsToCSV(life.layouts.L, parsed));
  console.log(`${dir}: 承保 ${g.L.split('\n').length - 1} 筆、給付 ${g.D.split('\n').length - 1} 筆${inject ? `、注入錯誤 ${g.key.length} 項` : ''}`);
}
