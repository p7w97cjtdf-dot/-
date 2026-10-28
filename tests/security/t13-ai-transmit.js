// AI 傳輸：每一次送出都要能看到實際送出的完整內容 (系統指示＋遮蔽後的資料)，傳送紀錄與稽核軌跡都有
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
    // AI 傳送紀錄：三筆 (兩筆成功、一筆取消)，內容等於實際送出
    await page.click('#btn-ai-log'); await page.waitForTimeout(200);
    const logged = await page.evaluate(() => ({ open: document.querySelector('#ai-log').open, items: DQ.ai.sent.map(e => ({ status: e.status, payload: e.payload })), rows: document.querySelectorAll('#ai-log .ai-log-item').length }));
    ok.transmitLog = logged.open && logged.rows === 3 && logged.items.filter(e => e.status === '成功').map(e => e.payload).join('\u0000') === sent.join('\u0000') && logged.items.some(e => /取消/.test(e.status));
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
  process.exitCode = Object.values(ok).every(Boolean) ? 0 : 1;
})();
