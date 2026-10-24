// 瀏覽器測試共用：開啟檢核工具、攔截外部請求 (Excel 元件改用 vendor 檔)，並可模擬 claude.ai 線上版的 AI
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
function load() {
  try { return require('playwright'); } catch (e) { return require(path.join(process.env.PW_PATH || '', 'playwright')); }
}
async function open(opts) {
  opts = Object.assign({ viewport: { width: 1360, height: 950 }, ai: false, url: 'file://' + path.join(ROOT, 'index.html') }, opts);
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
  // 測試時自動按「送出前確認」視窗的「送出」，和使用者操作一樣 (opts.aiPreview 為 true 時不自動按，用來測試這個視窗)
  await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => {
    const d = document.querySelector('#ai-preview'); if (!d || window.__keepPreview) return;
    new MutationObserver(() => { if (d.open) setTimeout(() => { const b = document.querySelector('#ai-preview-yes'); if (d.open && b) b.click(); }, 0); }).observe(d, { attributes: true, attributeFilter: ['open'] });
  }));
  if (opts.ai) await page.addInitScript(() => {
    window.__sent = [];

    window.claude = { use: async k => k === 'sample' ? async prompt => { window.__sent.push(prompt); return { text: window.__aiReply || 'AI 回覆（測試）' }; } : { save: async o => { (window.__saved = window.__saved || []).push(o); } } };
  });
  // 收在「更多」選單裡的按鈕：點之前先打開選單 (和使用者操作一樣)
  const click = page.click.bind(page);
  page.click = async (sel, o) => { await page.evaluate(q => { const el = document.querySelector(q), m = el && el.closest('details.more-menu'); if (m) m.open = true; }, sel).catch(() => {}); return click(sel, o); };
  await page.goto(opts.url); await page.waitForTimeout(800);
  return { browser, ctx, page, log, ROOT };
}
module.exports = { open, ROOT };
