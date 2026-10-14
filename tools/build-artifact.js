#!/usr/bin/env node
// 把 index.html 與 src/ 打包成單一 HTML (CSS/JS 內嵌)，供發佈為 claude.ai 線上頁面。
// 用法：node tools/build-artifact.js <輸出檔>
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = process.argv[2] || path.join(root, 'dist', 'index.html');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace('<script src="config.local.js"></script>\n', '');
html = html.replace(/<link rel="stylesheet" href="(src\/[^"]+)">/g, (_, f) => `<style>\n${fs.readFileSync(path.join(root, f), 'utf8')}</style>`);
html = html.replace(/<script src="(src\/[^"]+)"><\/script>/g, (_, f) => `<script>\n${fs.readFileSync(path.join(root, f), 'utf8').replace(/<\/script/gi, '<\\/script')}</script>`);
// 發佈時平台會包上 doctype/head/body 骨架：只保留 title、字型、樣式與內容
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const links = head.match(/<link[^>]+>/g).join('\n');
const styles = head.match(/<style>[\s\S]*?<\/style>/g).join('\n');
const body = html.slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${title}\n${links}\n${styles}\n${body}`);
console.log(`已輸出 ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
