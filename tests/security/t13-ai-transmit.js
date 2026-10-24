// AI 傳輸：每一次都要能看到實際送出的完整內容，並且不在前端長期保存高權限金鑰
const fs = require('fs');
const path = require('path');
const { open, ROOT } = require('./_browser.js');
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t13');
fs.mkdirSync(TMP, { recursive: true });
const SAMPLE = path.join(TMP, 'sample.xlsx');
fs.copyFileSync(process.env.SAMPLE || path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx'), SAMPLE);
const XLSX = require(path.join(ROOT, 'vendor', 'xlsx.core.min.js'));

(async () => {
  const ok = {};
  // ---- 1. 每次送出都跳確認視窗，內容就是實際送出的完整內容；傳送紀錄與稽核軌跡都有 ----
  {
    const { browser, page, log } = await open({ ai: true, aiPreview: true });
    await page.setInputFiles('#file-book', SAMPLE); await page.waitForTimeout(2500);
    ok.noSkipOption = await page.evaluate(() => !document.querySelector('#ai-preview-skip') && !/不再詢問/.test(document.querySelector('#ai-preview').textContent));
    const shown = [];
    for (let k = 0; k < 2; k++) {   // 連續兩次，兩次都要確認
      await page.click('#btn-ai'); await page.waitForTimeout(400);
      shown.push(await page.evaluate(() => ({ open: document.querySelector('#ai-preview').open, text: document.querySelector('#ai-preview-text').textContent })));
      await page.click('#ai-preview-yes'); await page.waitForTimeout(800);
    }
    await page.click('#btn-ai'); await page.waitForTimeout(400);
    await page.click('#ai-preview-no'); await page.waitForTimeout(300);   // 第三次取消
    const sent = await page.evaluate(() => window.__sent);
    ok.everyTimeConfirm = shown.length === 2 && shown.every(x => x.open);
    ok.previewIsExactlySent = sent.length === 2 && shown.every((x, i) => x.text === sent[i]);
    // 系統指示也在預覽裡 (不是只有資料那一段)
    ok.previewIncludesSystem = shown.every(x => /安全規則|<資料>/.test(x.text) && x.text.length === sent[0].length);
    // AI 傳送紀錄：三筆 (兩筆已送出、一筆取消)，內容等於實際送出
    await page.click('#btn-ai-log'); await page.waitForTimeout(200);
    const logged = await page.evaluate(() => ({ open: document.querySelector('#ai-log').open, items: DQ.ai.sent.map(e => ({ status: e.status, payload: e.payload })), rows: document.querySelectorAll('#ai-log .ai-log-item').length }));
    ok.transmitLog = logged.open && logged.rows === 3 && logged.items.filter(e => e.status === '已送出').map(e => e.payload).join('\u0000') === sent.join('\u0000') && logged.items.some(e => /取消/.test(e.status));
    await page.click('#ai-log-close');
    // 稽核軌跡「AI 使用」有送出的完整內容
    // (模擬的 claude.ai 線上版：下載交給平台存檔，測試記下存檔內容)
    await page.click('#btn-dl-audit'); await page.waitForTimeout(500);
    const bytes = await page.evaluate(() => { const o = window.__saved.filter(x => /^稽核軌跡_/.test(x.filename)).pop(); return Array.from(o.data); });
    const ai = XLSX.utils.sheet_to_json(XLSX.read(Buffer.from(bytes), { type: 'buffer' }).Sheets['AI 使用'], { header: 1 });
    ok.auditHasPayload = ai[0][3] === '送出的完整內容' && ai.filter(r => r[1] === '送出給 AI' && String(r[3] || '').length > 1000).length === 2;
    ok.errors1 = log.errors.filter(e => !/serviceWorker/.test(e)).length === 0;
    await browser.close();
  }
  // ---- 2. Dify 金鑰：只接受應用金鑰、只留在這個分頁；舊版存在 localStorage 的金鑰會刪掉；部署設定不能放金鑰 ----
  {
    const DIFY = 'https://api.dify.ai/v1';
    const serve = (u, r) => { if (!u.startsWith(DIFY)) return false; r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ answer: 'OK' }) }); return true; };
    const t = await open({ serve });
    const { page, ctx } = t;
    await page.evaluate(() => { document.querySelector('#ai-settings').open = true; });
    await page.fill('#dify-url', DIFY); await page.fill('#dify-key', 'dataset-abcdefgh1234'); await page.click('#btn-dify-save'); await page.waitForTimeout(200);
    ok.rejectHighPrivilegeKey = /只接受 Dify「應用」的 API 金鑰/.test(await page.textContent('#dify-note')) && await page.evaluate(() => DQ.ai.providerName() !== 'Dify');
    await page.fill('#dify-key', 'app-goodkey12345'); await page.click('#btn-dify-save'); await page.waitForTimeout(200);
    const st = await page.evaluate(() => ({ provider: DQ.ai.providerName(), local: JSON.stringify(Object.assign({}, localStorage)), session: JSON.stringify(Object.assign({}, sessionStorage)) }));
    ok.keyOnlyInTab = st.provider === 'Dify' && !/app-goodkey/.test(st.local) && /app-goodkey/.test(st.session) && /api\.dify\.ai/.test(st.local);
    // 新分頁 (同一台電腦)：網址還在、金鑰要重新貼
    const p2 = await ctx.newPage(); await p2.goto(page.url()); await p2.waitForTimeout(800);
    ok.newTabNeedsKey = await p2.evaluate(() => DQ.ai.providerName() !== 'Dify' && document.querySelector('#dify-url').value === 'https://api.dify.ai/v1');
    // 舊版：金鑰存在 localStorage → 開啟時刪掉金鑰、只留網址
    await p2.evaluate(() => localStorage.setItem('dq-dify', JSON.stringify({ url: 'https://api.dify.ai/v1', key: 'app-oldkey123456' })));
    await p2.reload(); await p2.waitForTimeout(800);
    ok.oldKeyMigrated = await p2.evaluate(() => !/app-oldkey/.test(JSON.stringify(Object.assign({}, localStorage))) && !localStorage.getItem('dq-dify') && localStorage.getItem('dq-dify-url') === 'https://api.dify.ai/v1');
    await t.browser.close();
    // 部署設定 window.DQ_AI_CONFIG 帶金鑰：不採用 (任何打開網頁的人都看得到)；只指定轉發網址 (proxy) 時不帶金鑰
    const t2 = await open({ serve });
    await t2.page.addInitScript(() => { window.DQ_AI_CONFIG = { provider: 'dify', url: 'https://api.dify.ai/v1', key: 'app-publickey1234' }; });
    await t2.page.reload(); await t2.page.waitForTimeout(800);
    ok.configKeyIgnored = await t2.page.evaluate(() => DQ.ai.providerName() !== 'Dify');
    let auth = 'none';
    await t2.ctx.unrouteAll(); await t2.ctx.route(/^https?:\/\//, r => { const u = r.request().url(); if (u.startsWith(DIFY)) { auth = r.request().headers().authorization || ''; return r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ answer: 'OK' }) }); } return r.abort(); });
    await t2.page.addInitScript(() => { window.DQ_AI_CONFIG = { provider: 'dify', url: 'https://api.dify.ai/v1', proxy: true }; });
    await t2.page.reload(); await t2.page.waitForTimeout(800);
    const via = await t2.page.evaluate(async () => { try { await DQ.ai.ping(); return DQ.ai.providerName(); } catch (e) { return e.message; } });
    ok.proxyNoKey = via === 'Dify' && auth === '';
    await t2.browser.close();
  }
  console.log(JSON.stringify(ok, null, 2));
  process.exitCode = Object.values(ok).every(Boolean) ? 0 : 1;
})();
