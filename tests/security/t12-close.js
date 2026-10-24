// 收回與返回：每個打開的地方都要能收回，或有返回鍵；手機或瀏覽器的返回鍵會關掉剛打開的東西，不會離開工具
const fs = require('fs');
const path = require('path');
const { open, ROOT } = require('./_browser.js');
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t12');
fs.mkdirSync(TMP, { recursive: true });
const SAMPLE = path.join(TMP, 'sample.xlsx');
fs.copyFileSync(process.env.SAMPLE || path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx'), SAMPLE);
const back = page => page.evaluate(() => new Promise(r => { addEventListener('popstate', () => setTimeout(r, 100), { once: true }); history.back(); }));

(async () => {
  const ok = {};
  // ---- 桌機 ----
  {
    const { browser, page, log } = await open();
    await page.setInputFiles('#file-book', SAMPLE); await page.waitForTimeout(2500);
    const url = page.url();
    // 篩選・下載選單：點外面、按 Esc 都會收起
    await page.evaluate(() => { document.querySelector('.more-menu').open = true; });
    await page.mouse.click(5, 300);
    ok.menuOutside = await page.evaluate(() => !document.querySelector('.more-menu').open);
    await page.evaluate(() => { document.querySelector('.more-menu').open = true; }); await page.keyboard.press('Escape');
    ok.menuEsc = await page.evaluate(() => !document.querySelector('.more-menu').open);
    // 每個進階頁面都有返回鍵；返回鍵與瀏覽器的返回都回到檢查結果
    const views = await page.evaluate(() => [...document.querySelectorAll('.view:not(#view-check)')].map(v => v.id.replace('view-', '')));
    ok.viewsHaveBack = true;
    for (const v of views) {
      await page.evaluate(x => DQ.app.showTab(x), v);
      const has = await page.evaluate(x => !!document.querySelector(`#view-${x} > .back`), v);
      if (!has) ok.viewsHaveBack = false;
      await page.click(`#view-${v} > .back`);
      if (await page.evaluate(() => document.querySelector('#view-check').hidden)) ok.viewsHaveBack = false;
    }
    await page.evaluate(() => DQ.app.showTab('recon')); await back(page);
    ok.browserBackView = await page.evaluate(() => !document.querySelector('#view-check').hidden && document.querySelector('#view-recon').hidden) && page.url() === url;
    await page.evaluate(() => DQ.app.showTab('decode')); await page.keyboard.press('Escape');
    ok.escView = await page.evaluate(() => !document.querySelector('#view-check').hidden);
    // 原始資料：內容長時底部有「收起」
    await page.evaluate(() => { const d = document.querySelector('#detail details.raw'); d.open = true; });
    await page.waitForTimeout(200);
    ok.rawFold = await page.evaluate(() => !!document.querySelector('#detail details.raw > .fold'));
    if (ok.rawFold) { await page.click('#detail details.raw > .fold'); ok.rawFold = await page.evaluate(() => !document.querySelector('#detail details.raw').open); }
    // AI 整理：有關閉鈕
    await page.evaluate(() => { document.querySelector('#ai-box').hidden = false; });
    await page.click('#btn-ai-close');
    ok.aiClose = await page.evaluate(() => document.querySelector('#ai-box').hidden);
    // 逐筆確認：瀏覽器返回鍵回到總覽
    await page.click('#btn-review'); await page.waitForTimeout(300);
    const opened = await page.evaluate(() => !document.querySelector('#review').hidden);
    await back(page);
    ok.reviewBack = opened && await page.evaluate(() => document.querySelector('#review').hidden) && page.url() === url;
    ok.desktopErrors = log.errors.filter(e => !/serviceWorker/.test(e)).length === 0;
    await browser.close();
  }
  // ---- 手機 ----
  {
    const { browser, page, log } = await open({ viewport: { width: 390, height: 844 } });
    await page.setInputFiles('#file-book', SAMPLE); await page.waitForTimeout(2500);
    const inList = () => page.evaluate(() => document.querySelector('#issue-list').contains(document.querySelector('#detail')));
    await page.click('#issue-list .issue:nth-child(2)'); await page.waitForTimeout(500);
    const shown = await inList();
    await page.click('#detail .d-close'); await page.waitForTimeout(300);
    ok.phoneClose = shown && !(await inList());
    await page.click('#issue-list .issue:nth-child(3)'); await page.waitForTimeout(500);
    await back(page);
    ok.phoneBack = !(await inList()) && await page.evaluate(() => !document.body.classList.contains('no-data'));
    ok.phoneErrors = log.errors.filter(e => !/serviceWorker/.test(e)).length === 0;
    await browser.close();
  }
  console.log(JSON.stringify(ok, null, 2));
  process.exitCode = Object.values(ok).every(Boolean) ? 0 : 1;
})();
