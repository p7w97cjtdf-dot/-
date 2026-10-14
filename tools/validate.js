#!/usr/bin/env node
// 命令列檢核：node tools/validate.js LFL01_2025.txt [LFD01_2025.txt] [--json] [--html report.html]
const fs = require('fs');
const path = require('path');
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const report = require('../src/report.js');

const args = process.argv.slice(2);
const files = {};
let json = false, html = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') json = true;
  else if (args[i] === '--html') html = args[++i];
  else {
    const name = path.basename(args[i]);
    const fid = /^LFD/i.test(name) ? 'D' : 'L';
    let text = fs.readFileSync(args[i], 'utf8');
    if (/\.csv$/i.test(name)) text = C.csvToFixedWidth(text, life.layouts[fid]);
    files[fid] = { name: name.replace(/\.csv$/i, '.txt'), text };
  }
}
if (!Object.keys(files).length) { console.error('用法：node tools/validate.js <承保檔> [給付檔] [--json] [--html 報告.html]'); process.exit(2); }
const res = C.validate(life, files);
if (json) console.log(JSON.stringify({ summary: res.summary, issues: res.issues }, null, 2));
else console.log(report.toText(life, res));
if (html) { fs.writeFileSync(html, report.toHTML(life, res)); console.error('已輸出報告：' + html); }
process.exit(res.summary.errors ? 1 : 0);
