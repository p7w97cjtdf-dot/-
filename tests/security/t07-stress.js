// T07 檔案壓力測試：不同大小與結構的檔案，記錄反應時間、記憶體、錯誤處理，並確認之後還能正常檢查
const fs = require('fs');
const path = require('path');
const { open, ROOT } = require('./_browser.js');
const { generate } = require(path.join(ROOT, 'src/mock.js'));
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t07');
fs.mkdirSync(TMP, { recursive: true });
const SIZES = (process.env.SIZES || '1000,20000,100000').split(',').map(Number);
const w = (name, data) => { const p = path.join(TMP, name); fs.writeFileSync(p, data); return p; };

const files = [];
for (const n of SIZES) {
  const g = generate({ policies: n, seed: 7, inject: true });
  const d = path.join(TMP, `n${n}`); fs.mkdirSync(d, { recursive: true });
  files.push({ name: `模擬資料 ${n.toLocaleString()} 張保單`, paths: [w(`n${n}/${g.names.L}`, g.L), w(`n${n}/${g.names.D}`, g.D)], ok: true, wait: 300000 });
}
const crypto = require('crypto');
// 每一筆都錯 (長度正確、內容全是 Z)：問題數量很多時畫面還能不能操作
files.push({ name: '2 萬筆每筆都錯', paths: [w('LFL03_2025.txt', ('Z'.repeat(425) + '\n').repeat(20000))], ok: true, wait: 300000 });
files.push({ name: '空白檔案', paths: [w('LFL01_2025.txt', '')] });
files.push({ name: '亂碼二進位 (2 MB)', paths: [w('LFD01_2025.txt', crypto.randomBytes(2 << 20))] });
files.push({ name: '單行 20 MB 沒有換行', paths: [w('LFL02_2025.txt', 'A'.repeat(20 << 20))] });
files.push({ name: '副檔名是 xlsx 但其實是文字', paths: [w('fake.xlsx', 'not a workbook\n'.repeat(1000))] });
files.push({ name: 'Big5 編碼的 CSV', paths: [w('customers_2025.csv', Buffer.from(fs.readFileSync(path.join(ROOT, 'samples/dirty/客戶資料_2025.csv'), 'utf8').replace(/[^\x00-\x7f]/g, '?'), 'latin1'))] });
files.push({ name: '無法辨認的檔名', paths: [w('random.bin', crypto.randomBytes(1000))] });
const RECOVER = path.join(ROOT, 'samples/clean/LFL01_2025.txt');

(async () => {
  const out = [];
  for (const f of files) {
    const { browser, page, log } = await open();
    const bytes = f.paths.reduce((t, p) => t + fs.statSync(p).size, 0);
    const t0 = Date.now();
    let status = '', timedOut = false;
    await page.setInputFiles('#file-book', f.paths);
    // 正常檔案等到檢查完成；有問題的檔案最多等 20 秒 (看畫面有沒有說明、會不會卡住)
    try { await page.waitForFunction(n => DQ.app.state.res && Object.keys(DQ.app.state.res.meta).length >= n, f.ok ? f.paths.length : 1, { timeout: f.wait || 20000, polling: 200 }); } catch (e) { timedOut = true; }
    await page.waitForTimeout(300);
    const ms = Date.now() - t0;
    const r = await page.evaluate(() => ({ records: DQ.app.state.res ? Object.values(DQ.app.state.res.summary.byFile).reduce((t, b) => t + b.records, 0) : 0, issues: (DQ.app.state.all || []).length,
      heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null, status: document.querySelector('#run-status')?.innerText || '',
      note: [document.querySelector('#sample-note'), ...document.querySelectorAll('[role=status]')].filter(Boolean).map(e => e.textContent.trim()).filter(Boolean).slice(0, 3).join(' / ').slice(0, 200), elapsed: DQ.app.state.elapsed }));
    // 恢復：同一個頁面再放入正常檔案
    await page.setInputFiles('#file-book', RECOVER); await page.waitForTimeout(1500);
    const rec = await page.evaluate(() => !!(DQ.app.state.res && DQ.app.state.res.meta.L && DQ.app.state.res.meta.L.count > 100));
    out.push({ name: f.name, MB: +(bytes / 1048576).toFixed(1), seconds: +(ms / 1000).toFixed(1), checkSeconds: r.elapsed ? +(r.elapsed / 1000).toFixed(1) : null, records: r.records, issues: r.issues, heapMB: r.heapMB, timedOut, note: r.note, pageErrors: log.errors.slice(0, 3), recovered: rec });
    console.log(JSON.stringify(out[out.length - 1]));
    if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
    await browser.close();
  }
})();
