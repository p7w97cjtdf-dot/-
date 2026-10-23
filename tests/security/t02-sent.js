// T02 個資遮罩 (瀏覽器)：實際送給 AI 的每一段文字，不能出現客戶資料中的證號、姓名、地址，
// 也不能出現退件訊息裡手動貼上的虛構個資 (各種格式)。
const fs = require('fs');
const path = require('path');
const { open, ROOT } = require('./_browser.js');
const pii = require(path.join(ROOT, 'src/pii.js'));
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t02');
fs.mkdirSync(TMP, { recursive: true });
for (const f of ['LFL01_2025.txt', 'LFD01_2025.txt']) fs.copyFileSync(path.join(ROOT, 'samples/dirty', f), path.join(TMP, f));
const csv = fs.readFileSync(path.join(ROOT, 'samples/dirty/客戶資料_2025.csv'), 'utf8');
fs.writeFileSync(path.join(TMP, 'customers_2025.csv'), csv);
const rows = csv.trim().split('\n').slice(1).map(l => l.split(','));
var known = { ids: [...new Set(rows.map(r => r[3]))], names: [...new Set(rows.map(r => r[4]))], addrs: [...new Set(rows.map(r => r[8]))] };
// 退件訊息裡貼上的虛構個資 (各種寫法)
const planted = ['被保險人：陳美玲', 'Ｆ２２３４５６７８９', 'F 223 456 789', '0933-222-111', '+886 933 222 111', '(04)2345-6789#12', 'chen.ml@example.com', '高雄市苓雅區四維三路2號5樓', '生日：1985/03/09', '4111-1111-1111-1111'];
const raw = ['陳美玲', 'F223456789', '0933222111', '23456789', 'chen.ml@', '四維三路2號', '1985/03/09', '1111-1111-1111-1111'];

(async () => {
  const { browser, page } = await open({ ai: true });
  await page.setInputFiles('#file-book', ['LFL01_2025.txt', 'LFD01_2025.txt', 'customers_2025.csv'].map(f => path.join(TMP, f))); await page.waitForTimeout(2500);
  await page.click('#btn-ai'); await page.waitForTimeout(500);
  // 單筆解釋：客戶資料、保單資料的問題各一筆
  const ids = await page.evaluate(() => [DQ.app.state.all.find(i => /^C/.test(i.ruleId)), DQ.app.state.all.find(i => i.file === 'L')].filter(Boolean).map(i => i.id));
  for (const id of ids) { await page.evaluate(i => DQ.app.select(i, true), id); await page.click('#btn-explain'); await page.waitForTimeout(400); }
  await page.evaluate(() => DQ.app.showTab('decode')); await page.fill('#dec-text', `錯誤代碼 10400，${planted.join('，')}，客戶 ${known.names ? '' : ''}`.replace(/，客戶 $/, '')); await page.click('#btn-decode'); await page.waitForTimeout(300); await page.click('#btn-decode-ai'); await page.waitForTimeout(500);
  const sent = await page.evaluate(() => window.__sent);
  const note = await page.textContent('#dec-ai-out, .ai-redact').catch(() => '');
  const all = sent.join('\n');
  const leak = {
    ids: known.ids.filter(x => all.includes(x)), names: known.names.filter(x => all.includes(x)), addrs: known.addrs.filter(x => all.includes(x)),
    planted: raw.filter(x => all.includes(x)),
    // 外觀像證號的保單號碼 (P2 開頭 + 8 碼) 依設計不遮罩：它們出現在申報資料的保單號碼欄位
    policyNumbersKept: [...new Set([...all.matchAll(/(?<![A-Za-z0-9])[A-Za-z][1289A-Da-d]\d{8}(?![A-Za-z0-9])/g)].map(m => m[0]))].slice(0, 8),
  };
  console.log(JSON.stringify({ calls: sent.length, chars: sent.map(s => s.length), leak, note: (note || '').slice(0, 120), sampleDecode: (sent[sent.length - 1].match(/<資料>\n錯誤代碼[^\n]*/) || [''])[0].slice(0, 400) }, null, 2));
  await browser.close();
  // 送出前確認視窗：顯示的就是實際要送出的內容；按取消就不送
  {
    const t = await open({ ai: true, aiPreview: true });
    await t.page.setInputFiles('#file-book', ['LFL01_2025.txt', 'LFD01_2025.txt', 'customers_2025.csv'].map(f => path.join(TMP, f))); await t.page.waitForTimeout(2500);
    await t.page.click('#btn-ai'); await t.page.waitForTimeout(400);
    const shown = await t.page.evaluate(() => ({ open: document.querySelector('#ai-preview').open, text: document.querySelector('#ai-preview-text').textContent, note: document.querySelector('#ai-preview-note').textContent }));
    await t.page.click('#ai-preview-no'); await t.page.waitForTimeout(300);
    const cancelled = await t.page.evaluate(() => ({ sent: window.__sent.length, msg: document.querySelector('#ai-out').textContent }));
    await t.page.click('#btn-ai'); await t.page.waitForTimeout(300); await t.page.click('#ai-preview-yes'); await t.page.waitForTimeout(500);
    const sent = await t.page.evaluate(() => window.__sent);
    console.log(JSON.stringify({ preview: { open: shown.open, note: shown.note, rawIdsInPreview: known.ids.filter(x => shown.text.includes(x)).length, sameAsSent: sent.length === 1 && sent[0].endsWith(shown.text) }, cancelled, sentAfterConfirm: sent.length }, null, 2));
    await t.browser.close();
  }
})();
