// 瀏覽器測試共用：開啟檢核工具、攔截外部請求 (Excel 元件改用 vendor 檔)，並可模擬 claude.ai 線上版的 AI
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
function load() {
  try { return require('playwright'); } catch (e) { return require(path.join(process.env.PW_PATH || '', 'playwright')); }
}
// 本機伺服器：src/app.js 的 PACK_KEY_PINS 換成測試金鑰的指紋 (模擬「這個版本核准的金鑰」)
function pinServer(pin) {
  const http = require('http'), fs = require('fs');
  return new Promise(res => {
    const srv = http.createServer((q, r) => {
      const f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); }
      let body = fs.readFileSync(f);
      if (f.endsWith(path.join('src', 'app.js'))) body = Buffer.from(String(body).replace(/PACK_KEY_PINS = Object\.freeze\(\[[^\]]*\]\)/, `PACK_KEY_PINS = Object.freeze(['${pin}'])`));
      const type = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' }[path.extname(f)] || 'application/octet-stream';
      r.writeHead(200, { 'content-type': type + '; charset=utf-8' }); r.end(body);
    }).listen(0, () => res(srv));
  });
}
async function open(opts) {
  opts = Object.assign({ viewport: { width: 1360, height: 950 }, ai: false, url: 'file://' + path.join(ROOT, 'index.html') }, opts);
  let srv = null;
  if (opts.pin) {
    srv = await pinServer(opts.pin);
    const port = srv.address().port, inner = opts.serve, OFF = 'https://p7w97cjtdf-dot.github.io/-/';
    opts = Object.assign({}, opts, { url: `http://localhost:${port}/index.html`, serve: (u, r) => {
      if (inner && inner(u.replace(`http://localhost:${port}/`, OFF), r)) return true;
      if (u.startsWith(`http://localhost:${port}/`)) { r.continue(); return true; }
      return false;
    } });
  }
  const { chromium } = load();
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const ctx = await browser.newContext({ viewport: opts.viewport, acceptDownloads: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const log = { requests: [], errors: [], dialogs: [] };
  page.on('pageerror', e => log.errors.push(e.message));
  page.on('dialog', d => { log.dialogs.push(d.message()); opts.acceptDialogs ? d.accept() : d.dismiss(); });
  page.on('request', r => log.requests.push({ method: r.method(), url: r.url(), type: r.resourceType(), body: r.postData() || '' }));
  // 測試環境沒有對外網路：外部請求記錄後中止 (opts.serve 可回應指定網址)
  await ctx.route(/^https?:\/\//, r => {
    const u = r.request().url();
    if (opts.serve && opts.serve(u, r)) return;
    return r.abort();
  });
  if (opts.aiPreview) await page.addInitScript(() => { window.__keepPreview = true; });
  // Dify 金鑰每次操作完就清除：確認視窗要求金鑰時，自動貼上測試用的金鑰 (opts.difyKey)
  if (opts.difyKey) await page.addInitScript(k => { window.__testDifyKey = k; }, opts.difyKey);
  // 測試時自動按「送出前確認」視窗的「送出」，和使用者操作一樣 (opts.aiPreview 為 true 時不自動按，用來測試這個視窗)
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const d = document.querySelector('#ai-preview'); if (!d || window.__keepPreview) return;
    new MutationObserver(() => { if (d.open) setTimeout(() => { const kb = document.querySelector('#ai-preview-key-box'); if (kb && !kb.hidden) document.querySelector('#ai-preview-key').value = window.__testDifyKey || ''; const b = document.querySelector('#ai-preview-yes'); if (d.open && b) b.click(); }, 0); }).observe(d, { attributes: true, attributeFilter: ['open'] });
  }));
  if (opts.ai) await page.addInitScript(() => {
    window.__sent = [];

    window.claude = { use: async k => k === 'sample' ? async prompt => { window.__sent.push(prompt); return { text: window.__aiReply || 'AI 回覆（測試）' }; } : { save: async o => { (window.__saved = window.__saved || []).push(o); } } };
  });
  // 收在「更多」選單裡的按鈕：點之前先打開選單 (和使用者操作一樣)
  const click = page.click.bind(page);
  page.click = async (sel, o) => { await page.evaluate(q => { const el = document.querySelector(q), m = el && el.closest('details.more-menu'); if (m) m.open = true; }, sel).catch(() => {}); return click(sel, o); };
  await page.goto(opts.url); await page.waitForTimeout(800);
  if (srv) { const close = browser.close.bind(browser); browser.close = async () => { await close(); srv.close(); }; }
  return { browser, ctx, page, log, ROOT };
}
module.exports = { open, ROOT };
