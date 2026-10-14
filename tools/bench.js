#!/usr/bin/env node
// 計時：用試用資料跑一次完整檢核 (與網頁「載入含錯誤資料」相同的 7 個檔案)，供簡報估算效益
//   npm run bench            試用資料 (samples/dirty)，另跑 1 萬張保單的規模測試
const fs = require('fs');
const path = require('path');
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const R = require('../src/recon.js');
const M = require('../src/master.js');
const A = require('../src/anomaly.js');
const { generate } = require('../src/mock.js');

function full(f) {
  const t0 = process.hrtime.bigint();
  const res = C.validate(life, { L: { name: f.names.L, text: f.L }, D: { name: f.names.D, text: f.D } });
  const cust = M.customers(res, f.customers), prod = M.products(res, f.products), anom = A.check(res, f.customers);
  const roll = R.rollForward(res, f.prior), ctl = R.controlRecon(res, f.control, roll.issues), stmt = R.statement(f.statement, res);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const n = res.issues.length + cust.issues.length + prod.issues.length + anom.issues.length + roll.issues.length + ctl.issues.length + stmt.issues.length;
  return { ms, n, L: res.meta.L.count, D: res.meta.D.count };
}
const median = xs => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const sec = ms => (ms / 1000).toFixed(3) + ' 秒';

const dir = path.join(__dirname, '../samples/dirty');
const read = n => fs.readFileSync(path.join(dir, n), 'utf8');
const t0 = process.hrtime.bigint();
const trial = { names: { L: 'LFL01_2025.txt', D: 'LFD01_2025.txt' }, L: read('LFL01_2025.txt'), D: read('LFD01_2025.txt'), prior: read('LFL01_2024.txt'),
  control: read('控制總數_2025.csv'), statement: read('資產負債表_2025.csv'), products: read('商品資料_2025.csv'), customers: read('客戶資料_2025.csv') };
const readMs = Number(process.hrtime.bigint() - t0) / 1e6;
const first = full(trial);
const runs = Array.from({ length: 20 }, () => full(trial).ms);
console.log(`試用資料（7 個檔案：承保 ${first.L} 筆、給付 ${first.D} 筆）`);
console.log(`  讀檔 ${sec(readMs)}，第一次完整檢核 ${sec(first.ms)}，20 次中位數 ${sec(median(runs))}，找出 ${first.n} 項問題（含錯誤、警告、疑似異常、對帳差異）`);

if (!process.argv.includes('--quick')) {
  const big = generate({ seed: 7, policies: 10000 });
  const r = full(big);
  console.log(`規模測試（正確資料 1 萬張保單：承保 ${r.L} 筆、給付 ${r.D} 筆）：完整檢核 ${sec(r.ms)}，問題 ${r.n} 項（正確資料應為 0）`);
}
