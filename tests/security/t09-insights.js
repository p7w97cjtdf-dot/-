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
],
"risk":"低",
"priorities":[{"ruleIds":["23900_L0802"],"reason":"影響最多"},{"ruleIds":["10400_L0501"],"reason":"可一鍵修改"},{"ruleIds":["K0001"],"reason":"很重要"}],
"preventions":[{"title":"出生日期要是合法日期","file":"L","condition":{"field":"birthDate","op":"isDate"},"ruleIds":["23900_L0802"]},
  {"title":"性別只能填 1","file":"L","condition":{"field":"sex","op":"eq","value":"1"}}]
}
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
  const checks = await page.$$eval('#ai-out .insights', bs => bs.slice(1).map(b => b.querySelector('h4').textContent + '｜' + [...b.querySelectorAll('.ins')].map(e => e.querySelector('.ins-st').textContent + ' ' + e.querySelector('b').textContent + '：' + [...e.querySelectorAll('p')].map(p => p.textContent).join(' / ')).join(' ‖ ')));
  // 加入 AI 提出、驗證過的預防檢查
  await page.click('#ai-out [data-add-prev="0"]'); await page.waitForTimeout(800);
  const added = await page.evaluate(() => ({ rules: DQ.app.state.customRules.map(r => r.name), aiStillShown: !!document.querySelector('#ai-out .insights'), hits: DQ.app.state.all.filter(i => /^P-/.test(i.ruleId)).length }));
  // 單筆解釋：AI 建議的值改進副本重新檢查
  const explain = {};
  for (const [k, v] of [['正確的值', '19910623'], ['仍不合法的值', '19910231']]) {
    await page.evaluate(x => { window.__aiReply = '1. 出生日期不是合法日期。\n```json\n{"fix":{"field":"birthDate","value":"' + x + '"},"systemic":true}\n```'; }, v);
    const id = await page.evaluate(() => DQ.app.state.all.find(i => i.ruleId === '23900_L0802').id);
    await page.evaluate(i => DQ.app.select(i, true), id); await page.click('#btn-explain'); await page.waitForTimeout(800);
    explain[k] = await page.$$eval('#explain-out .ins', es => es.map(e => e.querySelector('.ins-st').textContent + ' ' + e.querySelector('b').textContent + '：' + [...e.querySelectorAll('p')].map(p => p.textContent).join(' / ')));
  }
  // 退件說明：AI 說最可能是哪幾類，核對定位結果
  await page.evaluate(() => { window.__aiReply = '最可能是出生日期與幣別問題。\n```json\n{"likely":[{"title":"出生日期不合法","ruleIds":["23900_L0802"],"claim":2},{"title":"性別代碼","ruleIds":["20300_L0902"],"claim":1}]}\n```'; DQ.app.showTab('decode'); });
  await page.fill('#dec-text', '錯誤代碼 23900'); await page.click('#btn-decode'); await page.waitForTimeout(300); await page.click('#btn-decode-ai'); await page.waitForTimeout(800);
  const decode = await page.$$eval('#dec-ai .ins', es => es.map(e => e.querySelector('.ins-st').textContent + ' ' + e.querySelector('b').textContent + '：' + [...e.querySelectorAll('p')].map(p => p.textContent).join(' / ')));
  const injected = await page.evaluate(() => ({ x: window.__x || null, img: document.querySelectorAll('#ai-out img').length }));
  console.log(JSON.stringify({ shown, before, focused, after, report: rep, checks, added, explain, decode, audit, injected, errors: log.errors.filter(e => !/serviceWorker/.test(e)) }, null, 2));
  await browser.close();
})();
