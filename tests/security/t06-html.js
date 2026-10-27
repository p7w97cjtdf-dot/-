// T06 HTML 注入：虛構資料、檔名、更新包、退件訊息、AI 回覆與規則預覽放入 HTML 特殊字元與無害的注入標記，
// 確認畫面、報告、手機複核、規則預覽都只顯示文字 (沒有多出元素、沒有執行程式)，CSV 不會被 Excel 當公式
const fs = require('fs');
const path = require('path');
const { open, ROOT } = require('./_browser.js');
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t06');
fs.mkdirSync(TMP, { recursive: true });
const X = tag => `<img src=x id=inj-${tag} onerror="window.__x=(window.__x||[]).concat('${tag}')">`;

// 1) 保單資料：保單號碼 (12 碼) 放入標記與公式
const L = fs.readFileSync(path.join(ROOT, 'samples/clean/LFL01_2025.txt'), 'utf8').split('\n');
const lay = require(path.join(ROOT, 'src/rulesets/index.js')).layouts.L, pf = lay.field('policyNo');
const put = (r, v) => r.slice(0, pf.start - 1) + v.padEnd(pf.len).slice(0, pf.len) + r.slice(pf.start - 1 + pf.len);
L[2] = put(L[2], '<b id=inj-a>'); L[4] = put(L[4], '"><i id=inj-'); L[6] = put(L[6], '=1+2+3+4+5+6');
fs.writeFileSync(path.join(TMP, 'LFL01_2025.txt'), L.join('\n'));
// 2) 客戶資料：姓名、地址放入 HTML
const cust = fs.readFileSync(path.join(ROOT, 'samples/dirty/客戶資料_2025.csv'), 'utf8').split('\n');
cust[1] = cust[1].replace(/,[^,]+,(\d{8}),/, `,${X('name')},$1,`).replace(/,[^,]*$/, `,${X('addr').replace(/,/g, '')}`);
fs.writeFileSync(path.join(TMP, 'customers_2025.csv'), cust.join('\n'));
// 3) 更新包：名稱、說明、規則訊息
const pack = { id: 'inj', name: 'pack' + X('pack'), version: '1"><b id=inj-ver>', basis: X('basis'), note: X('note'), disable: [],
  rules: [{ id: 'U-INJ', name: X('rname'), file: 'L', assert: { field: 'policyNo', op: 'notBlank' }, message: X('rmsg'), suggestion: X('rsug') }] };
fs.writeFileSync(path.join(TMP, 'inj-pack.json'), JSON.stringify(pack));
// 4) AI 規則轉換的回覆 (規則預覽)
const aiRules = JSON.stringify({ rules: [{ id: 'U001', name: X('ai-name'), file: 'L', scope: 'record', severity: 'error', assert: { field: 'policyNo', op: 'notBlank' }, message: X('ai-msg'), suggestion: X('ai-sug'), source: X('ai-src') }], unconvertible: [X('ai-unconv')] });

(async () => {
  const { browser, page, log } = await open({ ai: true, acceptDialogs: true });
  await page.evaluate(r => { window.__aiReply = r; }, aiRules);
  await page.setInputFiles('#file-book', [path.join(TMP, 'LFL01_2025.txt'), path.join(TMP, 'customers_2025.csv')]); await page.waitForTimeout(2500);
  const visit = [];
  const step = async (name, fn) => { try { await fn(); visit.push(name); } catch (e) { visit.push(`${name}（失敗：${e.message.split('\n')[0]}）`); } await page.waitForTimeout(400); };
  await step('問題清單與明細', async () => { const ids = await page.evaluate(() => DQ.app.state.all.filter(i => /</.test(i.policy || '') || /</.test(String(i.value))).slice(0, 5).map(i => i.id)); for (const id of ids) await page.evaluate(i => DQ.app.select(i, true), id); });
  await step('AI 單筆解釋 (回覆含標記)', async () => { await page.evaluate(() => { window.__aiReply = '<b id=inj-aiout>粗體</b><script>window.__x=["ai"]</script>'; }); await page.click('#btn-explain'); });
  await step('AI 重點整理', async () => { await page.click('#btn-ai'); });
  await step('手機複核模式', async () => { await page.click('#btn-review'); await page.waitForTimeout(300); await page.keyboard.press('Escape'); });
  await step('退件通知', async () => { await page.evaluate(() => DQ.app.showTab('decode')); await page.fill('#dec-text', `錯誤 10400 ${'<b id=inj-dec>x</b>'}`); await page.click('#btn-decode'); });
  await step('法規更新：匯入更新包', async () => { await page.evaluate(() => DQ.app.showTab('updates')); await page.setInputFiles('#file-pack', path.join(TMP, 'inj-pack.json')); });
  await step('用 AI 轉換規則：預覽', async () => { await page.evaluate(r => { window.__aiReply = r; DQ.app.showTab('import'); }, aiRules); await page.fill('#rule-text', '規則：保單號碼不可空白。' + X('doc')); await page.click('#btn-convert'); await page.waitForTimeout(800); });
  await step('規則清單', async () => { await page.evaluate(() => DQ.app.showTab('rules')); });
  await step('檢查報告', async () => { await page.evaluate(() => DQ.app.showTab('report')); });
  await page.waitForTimeout(600);
  const res = await page.evaluate(() => {
    const f = document.querySelector('#report-frame');
    const rep = new DOMParser().parseFromString(f.srcdoc, 'text/html');
    const csv = DQ.report.toCSV(DQ.app.rs || DQ.rulesets.all, DQ.app.state.res, DQ.app.state.extra);
    return {
      executed: window.__x || [], frameSandbox: f.getAttribute('sandbox'), srcdoc: f.srcdoc,
      injectedInPage: [...document.querySelectorAll('[id^="inj-"]')].map(e => e.id),
      injectedInReport: [...rep.querySelectorAll('[id^="inj-"]')].map(e => e.id),
      shownAsText: document.body.innerText.split('<img src=x').length - 1, reportText: rep.body.innerText.split('<b id=inj-a>').length - 1,
      csvFormula: csv.split('\n').filter(l => /=1\+2/.test(l)).map(l => l.slice(0, 80)),
    };
  });
  // 報告另存成 HTML 後直接用瀏覽器打開 (沒有 iframe 保護) 也不能執行
  const rp = await page.context().newPage(); await rp.setContent(res.srcdoc); await rp.waitForTimeout(500);
  res.reportExecuted = await rp.evaluate(() => window.__x || []); delete res.srcdoc;
  // 第二道防線：就算哪一處漏了 esc() 跳脫，DQ.safe (DOMPurify) 也會拿掉會執行的內容 (一般區塊、表格、插入、整份報告)
  res.sanitizer = await page.evaluate(() => {
    const bad = '<img src=x id=inj-s1 onerror="window.__x=(window.__x||[]).concat(\'s1\')"><script>window.__x=["s2"]</script><a id=inj-s3 href="javascript:window.__x=[\'s3\']">x</a><svg><script>window.__x=["s4"]</script></svg><iframe srcdoc="<script>parent.__x=[\'s5\']</script>"></iframe><b onclick="x()" id=inj-keep>文字</b>';
    const div = document.createElement('div'); document.body.append(div); DQ.safe(div).innerHTML = bad;
    const tb = document.createElement('tbody'); const tbl = document.createElement('table'); tbl.append(tb); document.body.append(tbl);
    DQ.safe(tb).innerHTML = `<tr><td>${bad}</td></tr>`;
    DQ.safe(div).insertAdjacentHTML('beforeend', bad);
    const doc = DQ.safe.doc(`<!doctype html><html><head><meta charset="utf-8"><style>b{color:red}</style><script>window.__x=['s6']</script></head><body>${bad}</body></html>`);
    const scan = el => ({ scripts: el.querySelectorAll('script, iframe').length, handlers: [...el.querySelectorAll('*')].filter(e => [...e.attributes].some(a => /^on/i.test(a.name))).length, jsLinks: [...el.querySelectorAll('[href]')].filter(e => /^\s*javascript:/i.test(e.getAttribute('href'))).length });
    const d = new DOMParser().parseFromString(doc, 'text/html');
    // DOMPurify 沒有載入時：不寫入 HTML，只顯示文字
    const P = window.DOMPurify; window.DOMPurify = undefined; const fb = document.createElement('div'); DQ.safe(fb).innerHTML = bad; window.DOMPurify = P;
    return { div: scan(div), table: Object.assign(scan(tb), { rows: tb.rows.length }), doc: Object.assign(scan(d), { keepsCharset: !!d.querySelector('meta[charset]'), keepsStyle: !!d.querySelector('style') }), keptText: div.textContent.includes('文字'), fallbackElements: fb.children.length };
  });
  await page.waitForTimeout(300);
  res.executedAfterSanitizer = await page.evaluate(() => window.__x || []);
  res.visited = visit; res.pageErrors = log.errors.filter(e => !/serviceWorker/.test(e));
  console.log(JSON.stringify(res, null, 2));
  const z = o => !o.scripts && !o.handlers && !o.jsLinks, sz = res.sanitizer;
  process.exitCode = !res.executed.length && !res.reportExecuted.length && !res.executedAfterSanitizer.length && !res.injectedInPage.length && !res.injectedInReport.length
    && z(sz.div) && z(sz.table) && sz.table.rows === 1 && z(sz.doc) && sz.doc.keepsCharset && sz.doc.keepsStyle && sz.keptText && sz.fallbackElements === 0
    && !res.csvFormula.some(l => /(^|,)=1\+2/.test(l)) && res.visited.every(v => !/失敗/.test(v)) && !res.pageErrors.length ? 0 : 1;
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res, null, 2));
  await browser.close();
})();
