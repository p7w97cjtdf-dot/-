// 檔案拒絕與壓縮炸彈：預檢不通過的 Excel 不進入 XLSX.read；沒有讀取的檔案會移除它要放的那一格的舊資料，
// 不會讓舊結果看起來像新檔案的檢查結果；頁面不卡死、沒有未處理的例外
const fs = require('fs');
const path = require('path');
const { open, ROOT } = require('./_browser.js');
const { makeZip } = require('../make-zip.js');
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t16');
fs.mkdirSync(TMP, { recursive: true });
const f = (name, data) => { const p = path.join(TMP, name); fs.writeFileSync(p, data); return p; };
const L = f('LFL01_2025.txt', fs.readFileSync(path.join(ROOT, 'samples', 'dirty', 'LFL01_2025.txt')));
const D = f('LFD01_2025.txt', fs.readFileSync(path.join(ROOT, 'samples', 'dirty', 'LFD01_2025.txt')));
const good = f('good.xlsx', fs.readFileSync(path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx')));
const bomb = f('bomb.xlsx', makeZip([['[Content_Types].xml', Buffer.from('<Types/>')], ['xl/worksheets/sheet1.xml', Buffer.alloc(50 * 1048576, 0x20)]]));
const broken = f('broken.xlsx', fs.readFileSync(good).subarray(0, 40000));
const fake = f('fake.xlsx', 'this is not an excel file');
const binTxt = f('LFL01_bin.txt', Buffer.from([0, 1, 2, 3, 0, 255, 0, 7].concat(Array(5000).fill(0))));
const badCsv = f('LFL01_2025.csv', '欄位一,欄位二\n1,2\n');
const huge = path.join(TMP, 'LFL01_huge.txt'); fs.writeFileSync(huge, ''); fs.truncateSync(huge, 61 * 1048576);

(async () => {
  const ok = {};
  const { browser, page, log } = await open();
  const rej = []; page.on('console', m => { if (/Unhandled|Uncaught/i.test(m.text())) rej.push(m.text()); });
  await page.evaluate(() => { window.__xlsxReads = 0; const r = XLSX.read; XLSX.read = function () { window.__xlsxReads++; return r.apply(this, arguments); }; });
  const look = () => page.evaluate(() => ({
    files: Object.keys(DQ.app.state.files).filter(k => DQ.app.state.files[k]),
    note: document.querySelector('#sample-note').textContent, reads: window.__xlsxReads,
    noData: document.body.classList.contains('no-data'),
    total: DQ.app.state.all ? DQ.app.state.all.length : 0, nameL: document.querySelector('#name-L').textContent,
    map: document.querySelector('#data-map').textContent,
  }));
  const put = async (sel, files) => { await page.setInputFiles(sel, files); await page.waitForTimeout(1500); return look(); };

  // 1. 壓縮炸彈 (48 KB → 50 MB)：不進入 XLSX.read，說明原因，頁面還能操作
  let r = await put('#file-book', good);
  const before = r.reads;
  ok.goodExcelRead = r.files.length >= 5 && r.reads === before && before === 1;
  const t0 = Date.now();
  r = await put('#file-book', bomb);
  ok.bombRejectedBeforeRead = r.reads === before && /壓縮比約 1,0\d\d 倍/.test(r.note) && r.files.length === 0 && r.noData;
  ok.bombFast = Date.now() - t0 < 5000;
  ok.pageResponsive = await page.evaluate(() => { DQ.app.showTab('rules'); DQ.app.showTab('check'); return true; });
  // 2. 損毀的 Excel、副檔名是 .xlsx 但不是 Excel：先放好資料，再放壞檔 → 全部清除、說明原因
  await put('#file-book', good);
  r = await put('#file-book', broken);
  ok.brokenExcel = r.files.length === 0 && r.noData && /沒有讀取/.test(r.note) && /已移除/.test(r.note);
  await put('#file-book', good); const reads2 = (await look()).reads;
  r = await put('#file-book', fake);
  ok.fakeExcelNoParse = r.reads === reads2 && r.files.length === 0 && /不是有效的 Excel 檔/.test(r.note);
  // 3. 同一格：有效檔接著放無效檔 (非文字檔、標題不符、超過大小) → 這一格的舊資料移除，結果重新計算
  for (const [k, bad, why] of [['binary', binTxt, /不是文字檔/], ['csvHead', badCsv, /沒有讀取/], ['tooBig', huge, /超過文字檔、CSV 單檔 60 MB 上限/]]) {
    await page.evaluate(() => document.querySelector('#btn-clear-files') && document.querySelector('#btn-clear-files').click());
    await put('#file-L', L); await put('#file-D', D);
    const a = await look();
    r = await put('#file-L', bad);
    ok['sameSlot_' + k] = a.files.includes('L') && !r.files.includes('L') && r.files.includes('D') && why.test(r.note) && /「保單資料」已移除/.test(r.note) && r.nameL === '尚未放入' && r.total !== a.total;
  }
  // 4. 同一格替換成另一個有效檔：用新的
  await put('#file-L', L);
  const L2 = f('LFL01_2025b.txt', fs.readFileSync(path.join(ROOT, 'samples', 'clean', 'LFL01_2025.txt')));
  r = await put('#file-L', L2);
  ok.sameSlotReplace = r.files.includes('L') && r.nameL === 'LFL01_2025b.txt';
  // 5. 一次放入多份：有效的保單資料 + 不是文字檔的理賠資料 → 保單資料照常、理賠資料沒有讀取並說明
  await page.evaluate(() => document.querySelector('#btn-clear-files') && document.querySelector('#btn-clear-files').click());
  const binD = f('LFD01_bin.txt', fs.readFileSync(binTxt));
  r = await put('#file-book', [L, binD]);
  ok.multiPartial = r.files.includes('L') && !r.files.includes('D') && /LFD01_bin\.txt.*沒有讀取/.test(r.map + r.note);
  // 6. 一次放入多份：兩份有效 → 都讀取
  r = await put('#file-book', [L, D]);
  ok.multiBoth = r.files.includes('L') && r.files.includes('D') && !r.noData;
  // 7. 原本支援的格式：舊版 Excel (.xls)、OpenDocument (.ods)、CSV 都照常讀取
  const XLSX = require(path.join(ROOT, 'vendor', 'xlsx.core.min.js'));
  const wb = XLSX.read(fs.readFileSync(good), { type: 'buffer' });
  const xls = f('old.xls', XLSX.write(wb, { type: 'buffer', bookType: 'biff8' })), ods = f('book.ods', XLSX.write(wb, { type: 'buffer', bookType: 'ods' }));
  const csvL = f('LFL01_2025.csv', fs.readFileSync(path.join(ROOT, 'samples', 'dirty', 'LFL01_2025.csv')));
  r = await put('#file-book', good); const nGood = r.total;
  r = await put('#file-book', xls); ok.xlsOk = r.files.length >= 5 && r.total === nGood;
  r = await put('#file-book', ods); ok.odsOk = r.files.length >= 5 && r.total === nGood;
  await page.evaluate(() => document.querySelector('#btn-clear-files') && document.querySelector('#btn-clear-files').click());
  r = await put('#file-book', csvL); ok.csvOk = r.files.includes('L');
  // 8. 檔名含 HTML／JavaScript 標記：只顯示文字，不會變成元素或執行
  const evilName = f('"><img src=x id=inj-fn onerror="window.__x=1">.txt', fs.readFileSync(binTxt));
  r = await put('#file-book', evilName);
  const fn = await page.evaluate(() => ({ x: window.__x || null, inj: !!document.querySelector('#inj-fn'), shown: document.body.innerText.includes('<img src=x id=inj-fn') }));
  ok.fileNameNotExecuted = !fn.x && !fn.inj && fn.shown;
  ok.noPageErrors = !log.errors.filter(e => !/serviceWorker/.test(e)).length && !rej.length;
  console.log(JSON.stringify(ok, null, 2));
  if (!Object.values(ok).every(Boolean)) console.log(JSON.stringify({ last: r, errors: log.errors }, null, 2));
  await browser.close();
  fs.rmSync(huge, { force: true });
  process.exitCode = Object.values(ok).every(Boolean) ? 0 : 1;
})();
