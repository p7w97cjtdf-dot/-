#!/usr/bin/env node
// 把 index.html 與 src/、rules/、vendor/ 打包成單一 HTML (CSS/JS 內嵌)，供發佈為 claude.ai 線上頁面。
// 用法：node tools/build-artifact.js <輸出檔>
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'dist', 'index.html');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<script src="config.local.js"></script>\n', '');
html = html.replace(/<link rel="stylesheet" href="(src\/[^"]+)">/g, (_, f) => `<style>\n${fs.readFileSync(path.join(root, f), 'utf8')}</style>`);
// 讀檔元件 (vendor/) 也一起內嵌：線上版不從外部網站載入任何程式 (安全測試 T01)；PDF 改在主執行緒解析
html = html.replace(/<script src="((?:src|rules|vendor)\/[^"]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`);
// 發佈時平台會包上 doctype/head/body 骨架：只保留 title、字型、樣式與內容
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
// 只保留外部字型；manifest、圖示在單一 HTML 中沒有對應檔案
const links = head.match(/<link[^>]+>/g).filter(l => /href="https:/.test(l)).join('\n');
const styles = head.match(/<style>[\s\S]*?<\/style>/g).join('\n');
// 使用說明、限制與風險說明等 docs/ 頁面改連到公開網站 (GitHub Pages)
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>')).replace(/href="docs\/([\w.-]+\.html)"/g, 'href="https://p7w97cjtdf-dot.github.io/-/docs/$1" target="_blank" rel="noopener"');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${title}\n${links}\n${styles}\n${body}`);
console.log(`已輸出 ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
