#!/usr/bin/env node
// 用 LibreOffice 重新計算試用活頁簿的公式 (資產負債表的上層科目為 SUM 公式)。
// openpyxl 產生的檔案只有公式、沒有計算結果；不重算的話，網頁讀到的上層科目會是空白。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const files = process.argv.slice(2);
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'recalc-'));
for (const f of files) {
  try { execFileSync('soffice', ['--headless', '--calc', '--convert-to', 'xlsx', '--outdir', out, f], { stdio: 'ignore', timeout: 180000 }); }
  catch (e) { console.error('找不到 LibreOffice (soffice)，無法重算公式：請用 Excel 開啟並存檔一次 ' + f); process.exitCode = 1; continue; }
  fs.copyFileSync(path.join(out, path.basename(f)), f);
  console.log('已重算公式：' + f);
}
fs.rmSync(out, { recursive: true, force: true });
