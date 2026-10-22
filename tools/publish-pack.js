#!/usr/bin/env node
// 發布官方更新包：檢查格式後登記到 rules/updates/index.json，並記下內容的 SHA-256。
// 工具載入官方更新包時會比對 SHA-256，檔案內容和登記時不同就不套用 (安全測試 T03)。
//   node tools/publish-pack.js rules/updates/某更新包.json
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const packs = require('../src/rule-packs.js');
const all = require('../src/rulesets/index.js');
const DQ = { finance: require('../src/rulesets/finance.js'), master: require('../src/master.js'), anomaly: require('../src/anomaly.js') };

const file = process.argv[2];
if (!file) { console.error('用法：node tools/publish-pack.js rules/updates/<更新包>.json'); process.exit(2); }
const dir = path.join(__dirname, '..', 'rules', 'updates');
if (path.resolve(path.dirname(file)) !== dir) { console.error('更新包要放在 rules/updates/ 資料夾'); process.exit(2); }
const text = fs.readFileSync(file, 'utf8');
const pack = packs.normalize(JSON.parse(text), path.basename(file, '.json'));
const base = Object.assign({}, all, { catalog: all.catalog.concat(DQ.finance.catalog, DQ.master.catalog, DQ.anomaly.catalog) });
const v = packs.validate(pack, base, []);
const bad = v.errors.concat(v.rules.flatMap(r => r.errors.map(e => `${r.id}：${e}`)));
if (bad.length) { console.error('更新包沒有通過檢查：\n- ' + bad.join('\n- ')); process.exit(1); }
const idxFile = path.join(dir, 'index.json');
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
const name = path.basename(file);
idx.packs = (idx.packs || []).filter(e => (typeof e === 'string' ? e : e.file) !== name)
  .concat({ file: name, sha256: crypto.createHash('sha256').update(text).digest('hex') });
fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
console.log(`已登記 ${name}：${packs.summary(pack)}${pack.disable.length ? `\n注意：會停用 ${pack.disable.length} 項內建檢查 (${pack.disable.join('、')})，請法遵確認。` : ''}`);
