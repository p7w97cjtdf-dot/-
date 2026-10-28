// T08 輸出正確性：套用全部建議值 (測試直接呼叫，畫面只提供逐筆套用) 後下載的檔案重新檢查，結果要和畫面一致；畫面、報告、問題清單的數字一致
const fs = require('fs');
const path = require('path');
const { open, ROOT } = require('./_browser.js');
const C = require(path.join(ROOT, 'src/core.js'));
const all = require(path.join(ROOT, 'src/rulesets/index.js'));
const SAMPLE = process.env.SAMPLE || path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx');
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t08');
fs.mkdirSync(TMP, { recursive: true });

async function grab(page, click, n) {
  const got = [];
  const done = new Promise(res => { page.on('download', async d => { const p = path.join(TMP, d.suggestedFilename()); await d.saveAs(p); got.push(p); if (got.length === n) res(); }); });
  await page.click(click);
  await Promise.race([done, page.waitForTimeout(5000)]);
  page.removeAllListeners('download');
  return got;
}
const counts = page => page.evaluate(() => {
  const s = DQ.app.state, rep = new DOMParser().parseFromString(document.querySelector('#report-frame').srcdoc, 'text/html');
  const tiles = [...document.querySelectorAll('#summary .tile')].map(t => t.innerText.replace(/\s+/g, ' '));
  return { all: s.all.length, errors: s.all.filter(i => i.severity === 'error').length, warnings: s.all.filter(i => i.severity === 'warning').length, suspect: s.all.filter(i => i.severity === 'suspect').length,
    listCount: document.querySelector('#issue-count').textContent, tiles, reportCards: [...rep.querySelectorAll('.cards .v.err, .cards .v.warn')].map(e => +e.textContent), reportRows: rep.querySelectorAll('tbody tr.error, tbody tr.warning, tbody tr.suspect').length,
    csvRows: DQ.report.toRows(DQ.app.rs || DQ.rulesets.all, s.res, s.extra).length - 1,
    detail: s.res.issues.filter(i => ['L', 'D'].includes(i.file)).map(i => `${i.file}:${i.line}:${i.ruleId}`),
    fixable: s.res.issues.filter(i => i.fix).map(i => ({ file: i.file, line: i.line, field: i.fix.field, value: i.fix.value, ruleId: i.ruleId })) };
});

(async () => {
  const { browser, page, log } = await open();
  await page.setInputFiles('#file-book', SAMPLE); await page.waitForTimeout(2500);
  await page.evaluate(() => DQ.app.showTab('report')); await page.waitForTimeout(300);
  const before = await counts(page);
  await page.evaluate(() => DQ.app.showTab('check'));
  await page.evaluate(() => DQ.app.applyFix(null)); await page.waitForTimeout(1500);
  const note = await page.textContent('#action-note');
  await page.evaluate(() => DQ.app.showTab('report')); await page.waitForTimeout(300);
  const after = await counts(page);
  await page.evaluate(() => DQ.app.showTab('check'));
  const files = await grab(page, '#btn-dl-fixed', 2);
  // 下載的檔案在 Node 重新檢查 (只比對明細檔規則)
  const input = {};
  for (const p of files) { const n = path.basename(p); const k = /^LFD/.test(n) ? 'D' : 'L'; input[k] = { name: n, text: fs.readFileSync(p, 'utf8') }; }
  const re = C.validate(all, input);
  const ids = new Set(all.catalog.map(c => c.id));
  const reKeys = re.issues.filter(i => ['L', 'D'].includes(i.file) && ids.has(i.ruleId)).map(i => `${i.file}:${i.line}:${i.ruleId}`).sort();
  const uiKeys = after.detail.filter(k => ids.has(k.split(':')[2])).sort();
  // 修改過的值確實寫進檔案
  const lay = all.layouts, rec = (k, line) => (input[k] ? input[k].text.split(/\r?\n/)[line - 1] : '') || '';
  const notWritten = before.fixable.filter(f => input[f.file] && lay[f.file].field(f.field)).filter(f => { const fd = lay[f.file].field(f.field); return rec(f.file, f.line).substr(fd.start - 1, fd.len).trim() !== String(f.value).trim(); });
  const stillThere = before.fixable.filter(f => after.fixable.some(a => a.file === f.file && a.line === f.line && a.ruleId === f.ruleId));
  const out = {
    before: { all: before.all, errors: before.errors, warnings: before.warnings, suspect: before.suspect, listCount: before.listCount, reportCards: before.reportCards, reportRows: before.reportRows, csvRows: before.csvRows, fixable: before.fixable.length },
    actionNote: note,
    after: { all: after.all, errors: after.errors, warnings: after.warnings, suspect: after.suspect, listCount: after.listCount, reportCards: after.reportCards, reportRows: after.reportRows, csvRows: after.csvRows, fixable: after.fixable.length },
    downloaded: files.map(p => path.basename(p)),
    revalidate: { sameAsScreen: JSON.stringify(reKeys) === JSON.stringify(uiKeys), screen: uiKeys.length, file: reKeys.length, onlyInFile: reKeys.filter(k => !uiKeys.includes(k)).slice(0, 5), onlyOnScreen: uiKeys.filter(k => !reKeys.includes(k)).slice(0, 5) },
    fixedValueNotInFile: notWritten.length, fixableStillReported: stillThere.map(f => `${f.file}:${f.line}:${f.ruleId}`),
    pageErrors: log.errors,
  };
  console.log(JSON.stringify(out, null, 2));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
  await browser.close();
})();
