// Dify：在「AI 服務設定」填入 Dify 後，AI 功能改送到 Dify (這裡用假的 Dify 伺服器回應)。
// 確認：只有按 AI 按鈕才送、送的內容已遮蔽、帶著金鑰、回覆經工具驗證；網址不是 https 或不在 CSP 允許清單時不接受
const path = require('path');
const { open, ROOT } = require('./_browser.js');
const SAMPLE = process.env.SAMPLE || path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx');
const DIFY = 'https://api.dify.ai/v1';
const reply = '1. 整體狀況：有格式錯誤。\n```json\n{"insights":[{"title":"出生日期不是合法日期","file":"L","condition":{"not":{"field":"birthDate","op":"isDate"}},"ruleIds":["23900_L0802"],"claim":2}],"risk":"高"}\n```';
(async () => {
  const got = [];
  const { browser, page, log } = await open({ serve: (u, r) => {
    if (!u.startsWith(DIFY)) return false;
    const q = r.request();
    got.push({ url: u, auth: q.headers().authorization, body: JSON.parse(q.postData() || '{}') });
    const isPing = /連線測試/.test(got[got.length - 1].body.query);
    r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ answer: isPing ? 'OK' : reply }) });
    return true;
  } });
  await page.setInputFiles('#file-book', SAMPLE); await page.waitForTimeout(2500);
  const before = got.length;
  // 不接受沒有加密的網址
  await page.evaluate(() => { document.querySelector('#ai-settings').open = true; });
  await page.fill('#dify-url', 'http://api.dify.ai/v1'); await page.fill('#dify-key', 'app-test12345'); await page.click('#btn-dify-save'); await page.waitForTimeout(200);
  const rejectHttp = await page.textContent('#dify-note');
  // 不在網站安全設定 (CSP) 允許清單的自架網址：存檔時就說明要加進 connect-src
  await page.fill('#dify-url', 'https://dify.example.com/v1'); await page.click('#btn-dify-save'); await page.waitForTimeout(200);
  const rejectCsp = await page.textContent('#dify-note');
  await page.fill('#dify-url', DIFY); await page.fill('#dify-key', 'app-test12345'); await page.click('#btn-dify-save'); await page.waitForTimeout(200);
  const saved = await page.evaluate(() => ({ note: document.querySelector('#dify-note').textContent, aiShown: !document.body.classList.contains('no-ai'), keyInBox: document.querySelector('#dify-key').value }));
  await page.click('#btn-dify-test'); await page.waitForTimeout(500);
  const ping = await page.textContent('#dify-note');
  await page.click('#btn-ai'); await page.waitForTimeout(800);
  const shown = await page.evaluate(() => ({ tag: document.querySelector('#ai-out .ai-tag').textContent, ins: [...document.querySelectorAll('#ai-out .ins')].map(e => e.querySelector('.ins-st').textContent + ' ' + e.querySelector('b').textContent) }));
  const sum = got[got.length - 1];
  const idsInBody = /[A-Z][12]\d{8}/.test(sum.body.query.replace(/P2\d{8}/g, ''));
  console.log(JSON.stringify({ sentBeforeClick: before, rejectHttp, rejectCsp, saved, ping, calls: got.length, auth: got.map(g => g.auth), mode: sum.body.response_mode, rawIdLeft: idsInBody, hasGuard: /安全規則/.test(sum.body.query), shown, errors: log.errors.filter(e => !/serviceWorker/.test(e)) }, null, 2));
  await browser.close();
})();
