// AI 洞見驗證 (瀏覽器)：模擬 AI 回覆「文字 + 原因的檢查條件」，確認畫面顯示的是工具驗證後的筆數，
// 可以只看驗證到的資料，報告與稽核軌跡都有記錄；AI 寫的標題含 HTML 也只當文字顯示
const path = require('path');
const fs = require('fs');
const { open, ROOT } = require('./_browser.js');
const SAMPLE = process.env.SAMPLE || path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx');
const reply = `1. 整體狀況：有幾類格式錯誤，直接送出被退件的可能性高。
2. 問題主要出在哪裡：金額沒有補前置 0、出生日期不是合法日期。
3. 先改什麼：先改格式錯誤。
4. 以後怎麼避免：轉檔時檢查長度。
\`\`\`json
{"insights":[
 {"title":"金額沒有補前置 0","file":"L","condition":{"field":"sumInsuredOrig","pos":[1,1],"op":"eq","value":" "},"ruleIds":["10400_L0501"],"claim":1,"type":"改資料"},
 {"title":"出生日期不是合法日期","file":"L","condition":{"not":{"field":"birthDate","op":"isDate"}},"ruleIds":["23900_L0802"],"claim":40,"type":"改資料"},
 {"title":"日幣保單<img src=x onerror=window.__x=1>","file":"L","condition":{"field":"currency","op":"eq","value":"JPY"},"claim":5},
 {"title":"寫錯的條件","file":"L","condition":{"field":"nope","op":"eq","value":"1"},"claim":3}
]}
\`\`\``;
(async () => {
  const { browser, page, log } = await open({ ai: true });
  await page.setInputFiles('#file-book', SAMPLE); await page.waitForTimeout(2500);
  await page.evaluate(r => { window.__aiReply = r; }, reply);
  await page.click('#btn-ai'); await page.waitForTimeout(800);
  const shown = await page.evaluate(() => ({
    statuses: [...document.querySelectorAll('#ai-out .ins')].map(e => e.className.replace('ins ', '') + '：' + e.querySelector('.ins-top b').textContent + '｜' + (e.querySelector('p') || {}).textContent),
    textHasJson: /insights/.test(document.querySelector('#ai-out .ai-text').textContent),
  }));
  const before = await page.textContent('#issue-count');
  await page.click('#ai-out [data-focus="1"]'); await page.waitForTimeout(400);
  const focused = { count: await page.textContent('#issue-count'), bar: await page.textContent('#focus-bar'), items: await page.$$eval('#issue-list .issue', e => e.length) };
  await page.click('#btn-focus-off'); await page.waitForTimeout(200);
  const after = await page.textContent('#issue-count');
  const rep = await page.evaluate(() => { const d = new DOMParser().parseFromString(document.querySelector('#report-frame').srcdoc, 'text/html'); const h = [...d.querySelectorAll('h3')].find(x => /驗證結果/.test(x.textContent)); return h ? [...h.nextElementSibling.nextElementSibling.querySelectorAll('tbody tr')].map(r => [...r.cells].map(c => c.textContent).join('｜')) : null; });
  const audit = await page.evaluate(() => DQ.app.state.audit.filter(e => e.action === 'AI 洞見驗證').map(e => e.detail));
  const injected = await page.evaluate(() => ({ x: window.__x || null, img: document.querySelectorAll('#ai-out img').length }));
  console.log(JSON.stringify({ shown, before, focused, after, report: rep, audit, injected, errors: log.errors.filter(e => !/serviceWorker/.test(e)) }, null, 2));
  await browser.close();
})();
