// landing page (docs/index.html) 上的數字與連結必須與程式實際結果一致
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const fin = require('../src/rulesets/finance.js');
const R = require('../src/recon.js');
const stats = require('../src/rule-stats.js').count();
const { generate } = require('../src/mock.js');

const file = path.join(__dirname, '../docs/index.html');
const html = fs.readFileSync(file, 'utf8');
const counts = Object.fromEntries([...html.matchAll(/data-count="(\w+)">([\d,]+)</g)].map(m => [m[1], +m[2].replace(/,/g, '')]));

test('規則數量：總數與各卡片數字 = 程式實際數量，且卡片加總 = 總數', () => {
  assert.strictEqual(counts.total, stats.total);
  for (const c of stats.cats) assert.strictEqual(counts[c.key], c.n, `${c.name}`);
  const sum = stats.cats.reduce((s, c) => s + counts[c.key], 0);
  assert.strictEqual(sum, counts.total);
  // 總數旁的分類說明也要一致
  for (const [label, key] of [['明細', 'detail'], ['主檔', 'master'], ['財報', 'stmt'], ['結轉', 'roll'], ['合理性', 'anomaly'], ['對帳', 'recon']]) assert.ok(html.includes(`${label} ${stats.by[key]}`), label);
});

test('相對連結在目前目錄結構下都存在', () => {
  const links = [...html.matchAll(/href="([^"#:]+)"/g)].map(m => m[1]);
  assert.ok(links.includes('../index.html') && links.includes('../samples/excel/試用資料_含錯誤.xlsx'));
  for (const l of links) assert.ok(fs.existsSync(path.resolve(path.dirname(file), decodeURI(l))), l);
});

test('退件解碼範例：錯誤代碼 10400 定位 5 處，hero 顯示的那一筆與實際結果相同', () => {
  const g = generate({ inject: true });
  const res = C.validate(life, { L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D } });
  const d = R.decode('錯誤代碼 10400：數字資料範圍錯誤', { res, catalogs: [life.catalog, fin.catalog] });
  assert.ok(html.includes('錯誤代碼 10400：數字資料範圍錯誤') && html.includes(`定位 ${d.located} 處`) && html.includes(`共定位 ${d.located} 處`));
  const i = d.findings[0].matches.find(x => x.ruleId === '10400_L0501');
  assert.ok(html.includes(`第 ${i.line} 行・保單 ${i.policy.trim()}`));
  assert.ok(html.includes(i.fix.value));
  const raw = res.data.L.find(r => r._line === i.line)._raw;
  assert.ok(html.includes(`029│${raw.slice(28, 38)}<mark>${raw.slice(38, 56)}</mark>${raw.slice(56, 60)}`), '欄位尺規與原始資料一致');
  assert.ok(!/Error 504/.test(html));
});

test('68/68：試用資料刻意放入的錯誤數', () => {
  const g = generate({ inject: true });
  const n = g.key.length + g.masterKey.length + g.reconKey.length + g.ruleKey.length;
  assert.ok(html.includes(`${n}/${n}`));
});
