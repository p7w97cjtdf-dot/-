// 完整流程：原始資料 → 檢核結果 → 修改 → 再檢核 → 匯出。每一步的數字要一致，而且
// 任何被停用、沒有執行、無法判定或沒檢查完的檢查，都不能讓結果看起來比實際更安全
const fs = require('fs');
const path = require('path');
const { open, ROOT } = require('./_browser.js');
const C = require(path.join(ROOT, 'src/core.js'));
const all = require(path.join(ROOT, 'src/rulesets/index.js'));
const XLSX = require(path.join(ROOT, 'vendor', 'xlsx.core.min.js'));
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t14');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
const cp = (from, to) => { fs.copyFileSync(from, path.join(TMP, to)); return path.join(TMP, to); };
const DIRTY = cp(process.env.SAMPLE || path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx'), 'dirty.xlsx');
const ok = {}, facts = {};
// 法規更新要主管核可才會套用：測試用的主管金鑰 (只在這次測試；工具用本機伺服器把固定指紋換成這把)
const crypto = require('crypto'), A = require(path.join(ROOT, 'src', 'approval.js'));
const BOSS = (() => { const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }); const j = publicKey.export({ format: 'jwk' });
  return { pem: privateKey.export({ type: 'pkcs8', format: 'pem' }), id: crypto.createHash('sha256').update(JSON.stringify([j.x, j.y])).digest('hex').slice(0, 16) }; })();
const approvedFile = async (pack, name) => { const f = path.join(TMP, name); fs.writeFileSync(f, JSON.stringify(await A.approve(await A.request(pack, null, '測試'), BOSS.pem, '測試主管'))); return f; };
const nonSw = log => log.errors.filter(e => !/serviceWorker|sandboxed and lacks/.test(e));
// 下載：依序收下 (中文檔名在部分系統會變成 download，所以依按鈕對應)
async function grab(page, sel) {
  const d = page.waitForEvent('download', { timeout: 8000 });
  await page.click(sel);
  const x = await d, p = path.join(TMP, `${Date.now()}_${x.suggestedFilename()}`); await x.saveAs(p); return { name: x.suggestedFilename(), path: p };
}
const sheet = (file, name) => XLSX.utils.sheet_to_json(XLSX.read(fs.readFileSync(file), { type: 'buffer' }).Sheets[name], { header: 1, defval: '' });
const screen = page => page.evaluate(() => {
  const s = DQ.app.state, c = sev => s.all.filter(i => i.severity === sev).length;
  return { all: s.all.length, error: c('error'), warning: c('warning'), suspect: c('suspect'), fixable: s.all.filter(i => i.fix && s.res.issues.includes(i)).length,
    tiles: [...document.querySelectorAll('#summary .tile')].map(t => t.innerText.replace(/\s+/g, ' ')), status: document.querySelector('#run-status').innerText,
    scope: document.querySelector('#scope-note').hidden ? '' : document.querySelector('#scope-note').innerText, hidden: document.querySelector('#hidden-note').hidden ? '' : document.querySelector('#hidden-note').innerText,
    list: document.querySelector('#issue-list').innerText.slice(0, 300),
    // 核心檢核 (保單、理賠明細) 的問題；客戶、商品比對與疑似異常另外比
    keys: (() => { const other = new Set(DQ.master.catalog.concat(DQ.anomaly.catalog).map(c => c.id)); return s.res.issues.filter(i => ['L', 'D'].includes(i.file) && !other.has(i.ruleId)).map(i => `${i.file}:${i.line}:${i.ruleId}`).sort(); })(),
    files: Object.fromEntries(['L', 'D'].filter(k => s.files[k]).map(k => [k, s.files[k].text])) };
});
const nodeKeys = files => C.validate(all, Object.fromEntries(Object.entries(files).map(([k, t]) => [k, { text: t }]))).issues.map(i => `${i.file}:${i.line}:${i.ruleId}`).sort();

(async () => {
  // ===== A. 完整流程 =====
  {
    const { browser, page, log } = await open();
    await page.setInputFiles('#file-book', DIRTY); await page.waitForTimeout(3000);
    const s1 = await screen(page);
    // 1) 畫面的結果 = 用同一份資料在 Node 獨立重跑核心檢核 (保單、理賠明細)
    ok.A1_screenMatchesEngine = JSON.stringify(s1.keys) === JSON.stringify(nodeKeys(s1.files));
    // 2) 匯出：報告、問題清單的數字和畫面一樣
    const rep1 = fs.readFileSync((await grab(page, '#btn-dl-report')).path, 'utf8');
    const list1 = (await grab(page, '#btn-dl-csv')).path;
    const rows1 = sheet(list1, '問題清單');
    ok.A2_exportsMatchScreen = rows1.length - 1 === s1.all && new RegExp(`class="v err">${s1.error}<`).test(rep1) && new RegExp(`class="v warn">${s1.warning}<`).test(rep1);
    // 3) 一鍵修改 → 再檢核：問題只會變少，能一鍵修改的都改掉了
    await page.click('#btn-fix'); await page.waitForTimeout(2000);
    const s2 = await screen(page);
    ok.A3_fixThenRecheck = s2.all < s1.all && s2.fixable === 0 && s1.fixable > 0 && s1.all - s2.all >= 1;
    // 4) 下載改好的資料，在 Node 重新檢核：和畫面一模一樣
    const fixedL = await grab(page, '#btn-dl-fixed');
    const files2 = Object.assign({}, s2.files, { L: fs.readFileSync(fixedL.path, 'utf8') });
    ok.A4_downloadedFixedRevalidates = JSON.stringify(nodeKeys(files2)) === JSON.stringify(s2.keys) && files2.L === s2.files.L;
    // 5) 修改後的報告、問題清單、稽核軌跡
    const rep2 = fs.readFileSync((await grab(page, '#btn-dl-report')).path, 'utf8');
    const rows2 = sheet((await grab(page, '#btn-dl-csv')).path, '問題清單');
    const aud = (await grab(page, '#btn-dl-audit')).path;
    const fixes = sheet(aud, '修改紀錄').slice(1), checks = sheet(aud, '檢查與檔案').slice(1).filter(r => r[1] === '檢查');
    const applied = await page.evaluate(() => (document.querySelector('#action-note').textContent.match(/已修改 (\d+) 個地方/) || [])[1]);
    ok.A5_exportsAfterFix = rows2.length - 1 === s2.all && new RegExp(`class="v err">${s2.error}<`).test(rep2) && fixes.length === +applied && checks.length === 2 &&
      new RegExp(`必須修改 ${s1.error}`).test(checks[0][2]) && new RegExp(`必須修改 ${s2.error}`).test(checks[1][2]);
    // 這份試用資料什麼都有放：檢查範圍完整，不顯示「結果不完整」
    ok.A6_completeScopeNoWarning = !s1.scope && !/結果不完整/.test(s1.tiles.join(' ') + s1.status) && sheet(list1, '檢查範圍').some(r => r[0] === '完整');
    facts.A = { before: s1.all, after: s2.all, applied: +applied };
    ok.A_errors = nonSw(log).length === 0;
    await browser.close();
  }
  // ===== B. 停用規則：把唯一的錯誤藏起來時，不能看起來全部正確 =====
  {
    // 正確的保單資料，只放一個錯：第 1 筆性別改成 3 (只會被 20300_L0902 抓到)
    const L = all.layouts.L, sex = L.field('sex'), lines = fs.readFileSync(path.join(ROOT, 'samples/clean/LFL01_2025.txt'), 'utf8').split('\n');
    lines[0] = lines[0].slice(0, sex.start - 1) + '3' + lines[0].slice(sex.start);
    const one = path.join(TMP, 'LFL01_2025.txt'); fs.writeFileSync(one, lines.join('\n'));
    const base = C.validate(all, { L: { text: lines.join('\n') } }).issues;
    const rule = base.filter(i => i.severity === 'error').map(i => i.ruleId);
    const pack = await approvedFile({ id: 'hide-one', name: '測試：停用性別代碼檢查', version: '1', issuedAt: '20261024', basis: '測試', disable: [...new Set(rule)] }, 'disable.json');
    const { browser, page, log } = await open({ pin: BOSS.id });
    await page.evaluate(() => DQ.app.showTab('updates')); await page.setInputFiles('#file-pack', pack); await page.waitForTimeout(1000); await page.evaluate(() => DQ.app.showTab('check'));
    await page.setInputFiles('#file-book', one); await page.waitForTimeout(2500);
    const s = await screen(page);
    const rep = fs.readFileSync((await grab(page, '#btn-dl-report')).path, 'utf8');
    const sc = sheet((await grab(page, '#btn-dl-csv')).path, '檢查範圍');
    const aud = sheet((await grab(page, '#btn-dl-audit')).path, '檢查與檔案');
    facts.B = { hiddenRules: [...new Set(rule)], shownErrors: s.error, tile: s.tiles[0], status: s.status };
    ok.B1_errorReallyHidden = rule.length >= 1 && s.error === 0;
    ok.B2_screenNotSafe = !/100%/.test(s.tiles[0]) && /無法確認|結果不完整/.test(s.tiles[0]) && /結果不完整/.test(s.status) && /隱藏了 \d+ 個問題/.test(s.hidden) && /檢查不完整/.test(s.list);
    ok.B3_reportNotSafe = /hidden-note/.test(rep) && /無法確認/.test(rep) && /結果不完整/.test(rep);
    ok.B4_exportsDisclose = sc.some(r => r[0] === '結果不完整' && /停用/.test(r[1])) && aud.some(r => r[1] === '檢查' && /停用的檢查隱藏 \d+ 個/.test(r[2]));
    ok.B_errors = nonSw(log).length === 0;
    await browser.close();
  }
  // ===== C. 沒有執行：只放保單資料，其他檢查沒有執行要寫出來 =====
  {
    const onlyL = cp(path.join(ROOT, 'samples/clean/LFL01_2025.txt'), 'LFL01_2025.txt');
    const { browser, page, log } = await open();
    await page.setInputFiles('#file-book', onlyL); await page.waitForTimeout(2500);
    const s = await screen(page);
    const rep = fs.readFileSync((await grab(page, '#btn-dl-report')).path, 'utf8');
    const sc = sheet((await grab(page, '#btn-dl-csv')).path, '檢查範圍');
    ok.C1_notRunShown = /沒有檢查：理賠資料、去年接續、系統總數、客戶資料、商品資料、資產負債表/.test(s.scope) && /類檢查沒有執行/.test(s.status) && /檢查不完整/.test(s.list);
    ok.C2_notRunExported = /沒有執行的檢查：理賠資料的檢查/.test(rep) && sc.filter(r => r[0] === '沒有執行').length === 6;
    ok.C_errors = nonSw(log).length === 0;
    await browser.close();
  }
  // ===== D. 自訂規則無法判定、格式不對：不算通過 =====
  {
    const onlyL = path.join(TMP, 'LFL01_2025.txt'); fs.copyFileSync(path.join(ROOT, 'samples/clean/LFL01_2025.txt'), onlyL);
    // 主管核可的更新包裡有一條無法判定的規則、一條格式不對的規則
    const pack = await approvedFile({ id: 'custom', name: '測試：自訂規則', rules: [
      { id: 'U1', file: 'L', name: '保單號碼要是數字', scope: 'record', assert: { field: { fn: 'num', args: ['policyNo'] }, op: 'gt', value: 0 }, message: '測試' },
      { id: 'U2', file: 'L', name: '不安全的式樣', scope: 'record', assert: { field: 'policyNo', op: 'matches', value: '(a+)+' }, message: '測試' }] }, 'custom.json');
    const { browser, page, log } = await open({ pin: BOSS.id });
    await page.evaluate(() => DQ.app.showTab('updates')); await page.setInputFiles('#file-pack', pack); await page.waitForTimeout(800); await page.evaluate(() => DQ.app.showTab('check'));
    await page.setInputFiles('#file-book', onlyL); await page.waitForTimeout(2500);
    const s = await screen(page);
    const rep = fs.readFileSync((await grab(page, '#btn-dl-report')).path, 'utf8');
    ok.D1_unjudgedShown = /153 筆資料無法判定/.test(s.scope) && /1 條自訂規則格式不正確/.test(s.scope) && /無法確認/.test(s.tiles[0]) && /結果不完整/.test(s.status);
    ok.D2_unjudgedReported = /無法判定/.test(rep) && /格式不正確/.test(rep) && /無法確認/.test(rep);
    ok.D_errors = nonSw(log).length === 0;
    await browser.close();
  }
  console.log(JSON.stringify({ ok, facts }, null, 2));
  process.exitCode = Object.values(ok).every(Boolean) ? 0 : 1;
})();
