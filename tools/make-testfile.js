// 產生含「繳費期間 > 保險期間」(24906_L0643) 違規的測試檔案：Excel + TXT
const fs = require('fs');
const path = require('path');
const ROOT = '/home/user/-';
const { generate } = require(path.join(ROOT, 'src/mock.js'));
const C = require(path.join(ROOT, 'src/core.js'));
const W = require(path.join(ROOT, 'src/workbook.js'));
const XLSX = require(path.join(ROOT, 'vendor/xlsx.core.min.js'));
const lay = require(path.join(ROOT, 'src/rulesets/index.js')).layouts.L;
const OUT = process.argv[2] || '/tmp/claude-0/-home-user--/12bf06b3-7761-5965-b183-288e354d1a6d/scratchpad/out';
fs.mkdirSync(OUT, { recursive: true });

const g = generate({ seed: 42, policies: 20 });   // 乾淨資料
const lines = g.L.split('\n');
const setf = (raw, key, val) => { const f = lay.field(key); val = String(val).padEnd(f.len).slice(0, f.len); return raw.slice(0, f.start - 1) + val + raw.slice(f.start - 1 + f.len); };
const getf = (raw, key) => { const f = lay.field(key); return raw.slice(f.start - 1, f.start - 1 + f.len).trim(); };

// 找一筆：保險期間別 T、保險期間為數字年期 (非 999)，把繳費期間改成比保險期間大 10 年 → 違規
let injected = null;
for (let i = 0; i < lines.length; i++) {
  const r = lines[i]; if (r.length < lay.recordLength) continue;
  const term = getf(r, 'term'), tt = getf(r, 'termType');
  if (/^\d+$/.test(term) && term !== '999' && +term > 0 && (tt === 'T' || tt === 'Y' && +term < 95)) {
    const newPay = String(+term + 10).padStart(3, '0');
    lines[i] = setf(r, 'payTerm', newPay);
    injected = { line: i + 1, policy: getf(lines[i], 'policyNo'), term, pay: newPay };
    break;
  }
}
if (!injected) throw new Error('找不到可注入的資料列');
g.L = lines.join('\n');

// 驗證確實只多了這一筆違規，且是我們要的規則
const res = C.validate(require(path.join(ROOT, 'src/rulesets/life.js')), { L: { name: 'LFL01_2025.txt', text: g.L } });
const hits = res.issues.filter(i => i.ruleId === '24906_L0643');
console.log('注入位置：', JSON.stringify(injected));
console.log('24906_L0643 檢出：', hits.map(h => `第 ${h.line} 行 ${String(h.policy || '').trim()}：${h.message}`));

// 寫 TXT (保單資料)
const co = getf(lines.find(l => l.length >= lay.recordLength), 'company') || '01';
fs.writeFileSync(path.join(OUT, `LFL${co}_2025.txt`), g.L.endsWith('\n') ? g.L : g.L + '\n');

// 寫 Excel (含 7 張工作表，保單資料含違規)
const wb = XLSX.utils.book_new();
for (const [name, s] of Object.entries(W.sheets(g))) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([s.header].concat(s.rows)), name);
const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
fs.writeFileSync(path.join(OUT, '試用_繳費期間違規.xlsx'), buf);
console.log('已輸出：', fs.readdirSync(OUT).join('、'));
