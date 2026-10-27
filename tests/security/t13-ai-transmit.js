// AI 傳輸：每一次都要能看到實際送出的完整內容；金鑰只放在閉包、用完就清除，不寫進瀏覽器儲存空間或 window
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
    ok.previewIncludesSystem = shown.every(x => /安全規則|<declaration_data>/.test(x.text) && x.text.length === sent[0].length);
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
  // ---- 2. Dify 金鑰：只接受應用金鑰；只放在 AI 模組的閉包 (不寫進 localStorage / sessionStorage、不掛在 window)；
  //         每完成一次 AI 操作就清除；舊版存的金鑰會刪掉；部署設定不能放金鑰；輸入框不讓瀏覽器自動填入 ----
  {
    const DIFY = 'https://api.dify.ai/v1', auths = [];
    const serve = (u, r) => { if (!u.startsWith(DIFY)) return false; auths.push(r.request().headers().authorization || ''); r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ answer: 'OK' }) }); return true; };
    const t = await open({ serve, aiPreview: true });
    const { page, ctx } = t;
    // 在 window 底下 (含 DQ 的所有物件) 找有沒有金鑰字串
    const keyInWindow = k => page.evaluate(k => {
      const seen = new Set(), stack = [[window, 0]];
      while (stack.length) {
        const [o, d] = stack.pop();
        if (!o || seen.has(o) || d > 6) continue; seen.add(o);
        let keys; try { keys = Object.keys(o); } catch (e) { continue; }
        for (const p of keys) {
          let v; try { v = o[p]; } catch (e) { continue; }
          if (typeof v === 'string' && v.includes(k)) return p;
          if (v && typeof v === 'object' && !(v instanceof Node) && (o !== window || /^(DQ|DQ_AI_CONFIG|__)/.test(p))) stack.push([v, d + 1]);
        }
      }
      return '';
    }, k);
    const stores = () => page.evaluate(() => JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage)) + document.cookie);
    await page.evaluate(() => { document.querySelector('#ai-settings').open = true; });
    await page.fill('#dify-url', DIFY); await page.fill('#dify-key', 'dataset-abcdefgh1234'); await page.click('#btn-dify-save'); await page.waitForTimeout(200);
    ok.rejectHighPrivilegeKey = /只接受 Dify「應用」的 API 金鑰/.test(await page.textContent('#dify-note')) && await page.evaluate(() => DQ.ai.providerName() !== 'Dify');
    await page.fill('#dify-key', 'app-goodkey12345'); await page.click('#btn-dify-save'); await page.waitForTimeout(200);
    const st = await page.evaluate(() => ({ provider: DQ.ai.providerName(), cfg: JSON.stringify(DQ.ai.difyConfig()), box: document.querySelector('#dify-key').value, local: localStorage.getItem('dq-dify-url') }));
    const s1 = await stores(), w1 = await keyInWindow('app-goodkey');
    ok.keyNotStored = st.provider === 'Dify' && !/app-goodkey/.test(s1) && st.local === DIFY && !/app-goodkey|key/.test(st.cfg) && st.box === '' && w1 === '';
    // 測試連線：帶著金鑰；完成後金鑰清除，再按一次要重新貼
    await page.click('#btn-dify-test'); await page.waitForTimeout(400);
    const afterPing = await page.evaluate(() => ({ note: document.querySelector('#dify-note').textContent, needs: DQ.ai.needsKey() }));
    await page.click('#btn-dify-test'); await page.waitForTimeout(300);
    const again = await page.textContent('#dify-note');
    ok.keyClearedAfterCall = auths.length === 1 && auths[0] === 'Bearer app-goodkey12345' && /連線成功/.test(afterPing.note) && afterPing.needs && /請先在「API 金鑰」貼上/.test(again);
    // 一般 AI 操作：確認視窗要求貼上金鑰；送出後輸入框清空、金鑰清除；整個過程沒有寫進儲存空間或 window
    await page.setInputFiles('#file-book', SAMPLE); await page.waitForTimeout(2500);
    await page.click('#btn-ai'); await page.waitForTimeout(400);
    const dlg = await page.evaluate(() => ({ open: document.querySelector('#ai-preview').open, keyBox: !document.querySelector('#ai-preview-key-box').hidden }));
    await page.click('#ai-preview-yes'); await page.waitForTimeout(200);   // 沒貼金鑰：視窗不關，說明原因
    const noKey = await page.evaluate(() => ({ open: document.querySelector('#ai-preview').open, note: document.querySelector('#ai-preview-note').textContent }));
    await page.fill('#ai-preview-key', 'app-goodkey12345');
    const w2 = await keyInWindow('app-goodkey');   // 輸入框本身不算 (不是 window 的屬性)
    await page.click('#ai-preview-yes'); await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ needs: DQ.ai.needsKey(), box: document.querySelector('#ai-preview-key').value, open: document.querySelector('#ai-preview').open }));
    const s2 = await stores(), w3 = await keyInWindow('app-goodkey');
    ok.dialogAsksKeyThenClears = dlg.open && dlg.keyBox && noKey.open && /金鑰/.test(noKey.note) && auths.length === 2 && auths[1] === 'Bearer app-goodkey12345' && after.needs && after.box === '' && !after.open && !/app-goodkey/.test(s2) && w2 === '' && w3 === '';
    // 輸入框都關掉瀏覽器的自動填入
    ok.autocompleteOff = await page.evaluate(() => ['#dify-url', '#dify-key', '#ai-preview-key', '#ap-key', '#ap-name'].every(s => document.querySelector(s).getAttribute('autocomplete') === 'off'));
    // 新分頁 (同一台電腦)：網址還在，金鑰沒有跟著過去
    const p2 = await ctx.newPage(); await p2.goto(page.url()); await p2.waitForTimeout(800);
    ok.newTabNoKey = await p2.evaluate(() => DQ.ai.providerName() === 'Dify' && DQ.ai.needsKey() && document.querySelector('#dify-url').value === 'https://api.dify.ai/v1');
    // 舊版：金鑰存在 localStorage 或 sessionStorage → 開啟時刪掉金鑰、只留網址
    await p2.evaluate(() => { localStorage.setItem('dq-dify', JSON.stringify({ url: 'https://api.dify.ai/v1', key: 'app-oldkey123456' })); sessionStorage.setItem('dq-dify', JSON.stringify({ url: 'https://api.dify.ai/v1', key: 'app-oldkey654321' })); });
    await p2.reload(); await p2.waitForTimeout(800);
    ok.oldKeyMigrated = await p2.evaluate(() => !/app-oldkey/.test(JSON.stringify(Object.assign({}, localStorage)) + JSON.stringify(Object.assign({}, sessionStorage))) && localStorage.getItem('dq-dify-url') === 'https://api.dify.ai/v1' && DQ.ai.needsKey());
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
