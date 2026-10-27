// AI 連線政策與完全離線：第一次送到新網址要明確確認、限定清單、只用 https；完全離線時不連任何外部網站
const path = require('path');
const fs = require('fs');
const { open, ROOT } = require('./_browser.js');
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t17');
fs.mkdirSync(TMP, { recursive: true });
const SAMPLE = path.join(TMP, 'sample.xlsx');
fs.copyFileSync(process.env.SAMPLE || path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx'), SAMPLE);
const DIFY = 'https://api.dify.ai/v1';

(async () => {
  const ok = {}, got = [];
  const serve = (u, r) => { if (!u.startsWith(DIFY)) return false; got.push(u); r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ answer: 'OK' }) }); return true; };
  const { browser, page, ctx, log } = await open({ serve, originPrompt: true, difyKey: 'app-test12345' });
  await page.evaluate(() => { document.querySelector('#ai-settings').open = true; });
  // 限定清單：只允許別的網址時，存檔就拒絕
  await page.fill('#dify-url', DIFY); await page.fill('#ai-allow', 'https://dify.corp.example'); await page.click('#btn-dify-save'); await page.waitForTimeout(200);
  ok.userAllowList = /只允許這些網址.*沒有列出 https:\/\/api\.dify\.ai/.test(await page.textContent('#dify-note'));
  await page.fill('#ai-allow', 'https://api.dify.ai'); await page.fill('#dify-key', 'app-test12345'); await page.click('#btn-dify-save'); await page.waitForTimeout(200);
  ok.policyShown = /部署者核准的網域/.test(await page.textContent('#ai-policy')) && /你自行設定的網址/.test(await page.textContent('#dify-note'));
  // 第一次送出：跳出「資料會送到 https://api.dify.ai 網站」，沒勾選不能按；取消就不送
  await page.click('#btn-dify-test'); await page.waitForTimeout(300);
  const dlg = await page.evaluate(() => ({ open: document.querySelector('#ai-origin').open, host: document.querySelector('#ai-origin-host').textContent, text: document.querySelector('#ai-origin').textContent, yesDisabled: document.querySelector('#ai-origin-yes').disabled }));
  await page.click('#ai-origin-no'); await page.waitForTimeout(300);
  const after = await page.textContent('#dify-note');
  ok.firstUseConfirm = dlg.open && dlg.host === 'https://api.dify.ai' && /資料會送到/.test(dlg.text) && dlg.yesDisabled && got.length === 0 && /沒有確認資料會送到/.test(after);
  // 勾選同意後才送；同一個網址第二次不再問這一步 (送出前仍會顯示完整內容)
  await page.fill('#dify-key', 'app-test12345');
  await page.click('#btn-dify-test'); await page.waitForTimeout(300);
  await page.check('#ai-origin-check'); await page.click('#ai-origin-yes'); await page.waitForTimeout(500);
  const n1 = got.length;
  await page.fill('#dify-key', 'app-test12345'); await page.click('#btn-dify-test'); await page.waitForTimeout(500);
  ok.consentRemembered = n1 === 1 && got.length === 2 && !(await page.evaluate(() => document.querySelector('#ai-origin').open));
  // 只用 https
  await page.fill('#dify-url', 'http://api.dify.ai/v1'); await page.click('#btn-dify-save'); await page.waitForTimeout(200);
  ok.httpsOnly = /只能用 https/.test(await page.textContent('#dify-note'));
  await page.fill('#dify-url', DIFY); await page.click('#btn-dify-save'); await page.waitForTimeout(200);

  // ---- 完全離線 ----
  await page.setInputFiles('#file-book', SAMPLE); await page.waitForTimeout(2500);
  const issues0 = await page.evaluate(() => DQ.app.state.all.length);
  await page.check('#offline-mode'); await page.waitForTimeout(400);
  const net0 = log.requests.length;
  const off = await page.evaluate(async () => {
    let blocked = false;
    try { await fetch('https://api.dify.ai/v1/chat-messages'); } catch (e) { blocked = true; }
    let aiErr = ''; try { await DQ.ai.ping(); } catch (e) { aiErr = e.message; }
    return { blocked, aiErr, noAi: document.body.classList.contains('no-ai'), csp: !!document.querySelector('meta[data-offline]'), note: document.querySelector('#offline-note').textContent, issues: DQ.app.state.all.length };
  });
  ok.offlineBlocksNetwork = off.blocked && /完全離線/.test(off.aiErr) && off.noAi && off.csp && /完全離線中/.test(off.note);
  ok.offlineNoRequests = log.requests.slice(net0).filter(r => !r.url.startsWith('file:') && !r.url.startsWith('data:') && !r.url.startsWith('blob:')).length === 0;
  ok.offlineChecksStillWork = off.issues === issues0 && issues0 > 0;
  // 重新開啟：還是離線、不自動讀取線上法規更新
  const p2 = await ctx.newPage(); const req2 = []; p2.on('request', r => req2.push(r.url()));
  await p2.goto(page.url()); await p2.waitForTimeout(1500);
  const st2 = await p2.evaluate(() => ({ checked: document.querySelector('#offline-mode').checked, offline: DQ.ai.isOffline(), loaded: DQ.app.state.officialLoaded || null }));
  ok.offlinePersistsNoUpdates = st2.checked && st2.offline && !req2.some(u => /rules\/updates|dify|github\.io/.test(u)) && st2.loaded && st2.loaded.offline;
  // 關閉離線：提示重新整理；重新整理後恢復讀取法規更新
  await p2.uncheck('#offline-mode'); await p2.waitForTimeout(300);
  const note = await p2.textContent('#offline-note');
  const req3 = []; p2.on('request', r => req3.push(r.url())); await p2.reload(); await p2.waitForTimeout(1500);
  ok.offlineOffRestores = /重新整理/.test(note) && req3.some(u => /rules\/updates\/index\.json/.test(u));
  ok.noErrors = !log.errors.filter(e => !/serviceWorker/.test(e)).length;
  console.log(JSON.stringify(ok, null, 2));
  if (!Object.values(ok).every(Boolean)) console.log(JSON.stringify({ dlg, after, off, st2, note }, null, 2));
  await browser.close();
  process.exitCode = Object.values(ok).every(Boolean) ? 0 : 1;
})();
