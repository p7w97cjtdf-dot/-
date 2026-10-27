// T01 外傳驗證：一般檢核、AI 分析、規則更新時實際發生的網路請求，以及送給 AI 的欄位
const path = require('path');
const fs = require('fs');
const { open, ROOT } = require('./_browser.js');
const XLSX_DIRTY = process.env.SAMPLE || path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx');

(async () => {
  const out = {};
  // 1) 一般檢核 (沒有 AI)
  {
    const { browser, page, log } = await open();
    const n0 = log.requests.length;
    await page.setInputFiles('#file-book', XLSX_DIRTY); await page.waitForTimeout(2500);
    await page.click('#btn-fix'); await page.waitForTimeout(1200);
    const ext = log.requests.filter(r => !r.url.startsWith('file:'));
    out.check = { pageLoad: log.requests.slice(0, n0).filter(r => !r.url.startsWith('file:')).map(r => `${r.method} ${r.url.split('?')[0]}`), afterData: log.requests.slice(n0).filter(r => !r.url.startsWith('file:')).map(r => `${r.method} ${r.url}`), posts: ext.filter(r => r.method !== 'GET').length };
    await browser.close();
  }
  // 2) AI 分析 (模擬線上版)：整理重點、單筆解釋、退件通知
  {
    const { browser, page, log } = await open({ ai: true });
    await page.setInputFiles('#file-book', XLSX_DIRTY); await page.waitForTimeout(2500);
    const n0 = log.requests.length;
    await page.click('#btn-ai'); await page.waitForTimeout(600);
    await page.evaluate(() => DQ.app.select(DQ.app.state.all.find(i => i.file === 'L').id, true)); await page.click('#btn-explain'); await page.waitForTimeout(400);
    await page.evaluate(() => DQ.app.showTab('decode')); await page.fill('#dec-text', '錯誤代碼 10400'); await page.click('#btn-decode'); await page.waitForTimeout(300); await page.click('#btn-decode-ai'); await page.waitForTimeout(500);
    const sent = await page.evaluate(() => window.__sent);
    // 單筆解釋送出的欄位名稱
    const fields = (sent[1].match(/該筆[^\n]*的相關欄位：([^\n]*)/) || ['', ''])[1].split('；').map(x => x.split('=')[0].replace(/^\d+\./, ''));
    out.ai = { networkDuringAi: log.requests.slice(n0).filter(r => !r.url.startsWith('file:')).map(r => `${r.method} ${r.url}`), calls: sent.length, bytes: sent.map(s => s.length), explainFields: fields,
      summaryKeys: Object.keys(JSON.parse(sent[0].match(/<declaration_data>\n(\{[\s\S]*?\})\n<\/declaration_data>/)[1])) };
    await browser.close();
  }
  // 3) 規則更新：官方更新包清單 (本機網站)
  {
    const { browser, page, log } = await open();
    await page.evaluate(() => DQ.app.loadOfficial()); await page.waitForTimeout(800);
    out.updates = log.requests.filter(r => /rules\/updates/.test(r.url)).map(r => `${r.method} ${r.url}`);
    await browser.close();
  }
  console.log(JSON.stringify(out, null, 2));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
})();
