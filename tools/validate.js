#!/usr/bin/env node
// 命令列檢核：
//   node tools/validate.js LFL01_2025.txt [LFD01_2025.txt] [--prior LFL01_2024.txt] [--control 控制總數.csv]
//                          [--statement 資產負債表.csv] [--json] [--html 報告.html]
// 有錯誤時 exit code = 1，可接在轉檔排程之後。
const fs = require('fs');
const path = require('path');
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const R = require('../src/recon.js');
const report = require('../src/report.js');

const args = process.argv.slice(2);
const files = {}, opt = {};
let json = false, html = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--json') json = true;
  else if (a === '--html') html = args[++i];
  else if (['--prior', '--control', '--statement'].includes(a)) opt[a.slice(2)] = fs.readFileSync(args[++i], 'utf8');
  else {
    const name = path.basename(a), fid = /^LFD/i.test(name) ? 'D' : 'L';
    let text = fs.readFileSync(a, 'utf8');
    if (/\.csv$/i.test(name)) text = C.csvToFixedWidth(text, life.layouts[fid]);
    files[fid] = { name: name.replace(/\.csv$/i, '.txt'), text };
  }
}
if (!Object.keys(files).length) { console.error('用法：node tools/validate.js <承保檔> [給付檔] [--prior 上年度承保檔] [--control 控制總數.csv] [--statement 資產負債表.csv] [--json] [--html 報告.html]'); process.exit(2); }

const res = C.validate(life, files);
const roll = files.L ? R.rollForward(res, opt.prior) : null;
const ctl = opt.control ? R.controlRecon(res, opt.control, roll ? roll.issues : []) : null;
const stmt = opt.statement ? R.statement(opt.statement, res) : null;
const extra = [].concat(opt.prior && roll ? roll.issues : [], ctl ? ctl.issues : [], stmt ? stmt.issues : []);

if (json) console.log(JSON.stringify({ summary: res.summary, issues: res.issues, recon: { control: ctl && ctl.rows.map(r => Object.assign({}, r, { recs: undefined })), rollForward: roll, statement: stmt } }, null, 2));
else {
  console.log(report.toText(life, res));
  if (extra.length) {
    console.log('\n== 對帳與勾稽 ==');
    for (const i of extra) console.log(`[${i.severity === 'error' ? '錯誤' : '警告'}] (${i.ruleId}) ${i.policy || i.code || ''} ${i.message}${i.explain ? '\n   說明：' + i.explain : ''}\n   建議：${i.suggestion}`);
  }
}
if (html) { fs.writeFileSync(html, report.toHTML(life, res, { recon: { ctl, roll: opt.prior ? roll : null, stmt } })); console.error('已輸出報告：' + html); }
process.exit(res.summary.errors || extra.some(i => i.severity === 'error') ? 1 : 0);
