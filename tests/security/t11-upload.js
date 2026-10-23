// 上傳對應：放入的資料要清楚列出來源與筆數；新的 Excel 取代舊資料；沒有資料的 Excel (空白範本) 不能留著上一份的結果
const fs = require('fs');
const path = require('path');
const { open, ROOT } = require('./_browser.js');
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t11');
fs.mkdirSync(TMP, { recursive: true });
// 測試瀏覽器放不進中文檔名，先複製成英數字檔名
const cancer = path.join(TMP, 'cancer.xlsx'), blank = path.join(TMP, 'blank_template.xlsx');
fs.copyFileSync(path.join(ROOT, 'samples', 'excel', '試用資料_癌症險_含錯誤.xlsx'), cancer);
const XLSX = require(path.join(ROOT, 'vendor', 'xlsx.core.min.js'));
const all = require(path.join(ROOT, 'src', 'rulesets', 'index.js'));
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['填寫說明'], ['第一列是欄位名稱']]), '說明');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([all.layouts.L.fields.map(f => f.name)]), '保單資料');
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([all.layouts.D.fields.map(f => f.name)]), '理賠資料');
fs.writeFileSync(blank, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));

(async () => {
  const { browser, page, log } = await open();
  const look = () => page.evaluate(() => ({
    files: Object.keys(DQ.app.state.files).filter(k => DQ.app.state.files[k]),
    noData: document.body.classList.contains('no-data'),
    resultsVisible: getComputedStyle(document.querySelector('#view-check')).display !== 'none',
    map: [...document.querySelectorAll('#data-map .dm-row')].map(r => r.innerText.replace(/\s+/g, ' ').trim()),
    head: (document.querySelector('#data-map .dm-head') || {}).innerText || '',
    note: document.querySelector('#sample-note').textContent,
  }));
  await page.setInputFiles('#file-book', cancer); await page.waitForTimeout(2500);
  const first = await look();
  await page.setInputFiles('#file-book', blank); await page.waitForTimeout(2000);
  const second = await look();
  const r = {
    first, second,
    ok: {
      cancerMapped: first.files.join() === 'CL,CD' && first.map.some(t => /癌症險保單資料 cancer\.xlsx「癌症險保單資料」 \d+ 筆/.test(t)),
      unusedListed: first.map.some(t => /沒有使用.*「說明」「錯誤解答」/.test(t)),
      blankClears: second.files.length === 0 && second.noData && !second.resultsVisible,
      blankExplained: /只有標題列/.test(second.note) && second.map.some(t => /保單資料」「理賠資料」.*只有標題列/.test(t)),
    },
    errors: log.errors.filter(e => !/serviceWorker/.test(e)),
  };
  console.log(JSON.stringify(r, null, 2));
  await browser.close();
  process.exitCode = Object.values(r.ok).every(Boolean) && !r.errors.length ? 0 : 1;
})();
