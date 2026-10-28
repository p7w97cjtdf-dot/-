// 證據表：在真正的工具頁面上跑「放入資料 → 對照錯誤解答 → 逐筆套用建議值 → 重新檢查」，
// 產出「預期違反規則 → 實際是否檢出 → 漏報／誤報／未判定 → 修正後結果」。
//   node tools/evidence.js [輸出資料夾]   預設 docs/evidence/
// 輸出：evidence.csv (Excel 可開)、evidence.json (含摘要，給 tools/evidence-pdf.js 用)
// 說明：
//  - 「套用建議值」用工具本身的修改函式 (DQ.app.applyFix) 套用全部建議值，等同使用者逐筆按下「套用建議值」；
//    之後重新檢查，看原本的問題是否消失、有沒有因修改而產生新問題
//  - 「誤報」= 含錯誤資料裡、不在解答中的問題；另用正確版資料 (samples/clean) 檢查，計算誤報
//  - 只記錄實際跑出來的結果，不做任何調整
const fs = require('fs');
const os = require('os');
const path = require('path');
const { open, ROOT } = require('../tests/security/_browser.js');

const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'evidence'));
const KEY = path.join(ROOT, 'tests', 'fixtures', 'answer-key-sample.csv');
// 每個資料格的檔案 (瀏覽器測試環境不能直接上傳中文檔名，先複製成英文檔名)
const SLOTS = { L: 'LFL01_2025.txt', D: 'LFD01_2025.txt', prior: 'LFL01_2024.txt', control: '控制總數_2025.csv', statement: '資產負債表_2025.csv', products: '商品資料_2025.csv', customers: '客戶資料_2025.csv' };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dq-evidence-'));
// 英文檔名照原名 (檔名本身也會檢查)，中文檔名的對帳資料以資料格名稱命名 (這幾種資料不檢查檔名)
const copy = (dir, slot) => {
  const d = path.join(TMP, path.basename(dir)); fs.mkdirSync(d, { recursive: true });
  const p = path.join(d, /^[\x20-\x7e]+$/.test(SLOTS[slot]) ? SLOTS[slot] : slot + path.extname(SLOTS[slot]));
  fs.copyFileSync(path.join(dir, SLOTS[slot]), p); return p;
};

async function load(page, dir) {
  for (const slot of Object.keys(SLOTS)) { await page.setInputFiles(`#file-${slot}`, copy(dir, slot)); await page.waitForTimeout(600); }
  await page.waitForTimeout(1500);
}
// 頁面內：目前的問題 (只取需要的欄位)
const snapshot = page => page.evaluate(() => DQ.app.state.all.map(i => ({ id: i.id, ruleId: i.ruleId, policy: String(i.policy || i.code || '').trim(), line: i.line, file: i.file, severity: i.severity, message: i.message, fix: i.fix ? { field: i.fix.field, value: String(i.fix.value) } : null, detail: DQ.app.state.res.issues.includes(i) })));

(async () => {
  const { browser, page, log } = await open({});
  // 1) 含錯誤版資料 + 錯誤解答
  await load(page, path.join(ROOT, 'samples', 'dirty'));
  const keyCopy = path.join(TMP, 'answer-key.csv'); fs.copyFileSync(KEY, keyCopy);
  await page.setInputFiles('#file-book', keyCopy); await page.waitForTimeout(1500);
  const key = await page.evaluate(() => DQ.app.state.answer && DQ.app.state.answer.key);
  if (!key || !key.length) throw new Error('工具沒有認出錯誤解答檔');
  const known = new Set(await page.evaluate(() => [].concat(DQ.app.state.all.map(i => i.ruleId), DQ.rulesets.all.catalog.map(c => c.id), DQ.rulesets.finance.catalog.map(c => c.id), DQ.master.catalog.map(c => c.id), DQ.anomaly.catalog.map(c => c.id))));
  const scope = await page.evaluate(() => document.querySelector('#scope') ? document.querySelector('#scope').textContent.replace(/\s+/g, ' ').trim() : '');
  const before = await snapshot(page);
  const match = (k, list) => list.filter(i => i.ruleId === k.ruleId && (!k.policy || i.policy === k.policy));

  // 2) 逐筆套用所有建議值 (等同使用者每一筆都按「套用建議值」)，重新檢查
  const fixIds = before.filter(i => i.fix && i.detail).map(i => i.id);
  const applied = await page.evaluate(ids => DQ.app.applyFix(ids), fixIds);
  const after = await snapshot(page);
  // 修改可能刪掉空白行使行號變動、統計類訊息的筆數也會變，所以有保單時用檢核編號＋保單比對，沒有保單時用訊息
  const sig = i => `${i.ruleId}|${i.file}|${i.policy || i.message}`;
  const beforeSig = new Set(before.map(sig));
  const newAfterFix = after.filter(i => !beforeSig.has(sig(i)));

  const SEV = { error: '必須修改', warning: '建議確認', suspect: '請人工判斷', info: '提醒' };
  const rows = key.map((k, n) => {
    const hit = k.ruleId ? match(k, before) : [];
    let detected, outcome;
    if (!k.ruleId) { detected = '未判定：解答沒有檢核編號'; outcome = '人工對照（系統總數的時間差等，工具只列出差額）'; }
    else if (hit.length) detected = '檢出';
    else if (!known.has(k.ruleId)) detected = '未判定：範例自訂規則，預設未啟用';
    else detected = '漏報';
    if (hit.length) {
      const still = match(k, after);
      const fixable = hit.some(i => i.fix);
      if (hit.every(i => i.severity === 'suspect')) outcome = '交人工判斷（不提供修改）';
      else if (fixable && hit.some(i => i.fix && i.detail) && !still.length) outcome = '套用建議值後重新檢查：已消失';
      else if (fixable && hit.some(i => i.fix && i.detail)) outcome = '套用建議值後重新檢查：仍在（需人工修正）';
      else if (fixable) outcome = '有參考值（對帳或報表資料，工具不修改）：交人工修正';
      else outcome = '沒有建議值：交人工修正原始資料';
    } else if (!outcome) outcome = '—';
    return { no: n + 1, category: k.category, file: k.file, ruleId: k.ruleId, policy: k.policy, expected: k.desc, detected,
      severity: [...new Set(hit.map(i => SEV[i.severity] || i.severity))].join('、'), actual: hit[0] ? hit[0].message : '',
      suggested: hit.filter(i => i.fix).map(i => `${i.fix.field}→${i.fix.value.trim() || '(空白)'}`).slice(0, 2).join('；'), outcome };
  });
  // 解答以外的問題 (可能誤報、或由解答項目連帶產生)
  // 分類：同一張保單已在解答裡 (連帶問題)、系統總數差額 (對應解答裡沒有編號的系統總數項目)、其他 (解答沒有說明的，視為可能誤報)
  const keyPolicies = new Set(key.map(k => k.policy).filter(Boolean).concat(key.flatMap(k => (k.desc.match(/P\d{9}\/A\d\d/g) || []))));
  const stray = before.filter(i => !key.some(k => k.ruleId && i.ruleId === k.ruleId && (!k.policy || i.policy === k.policy)))
    .map(i => Object.assign(i, { kind: i.policy && keyPolicies.has(i.policy) ? '連帶問題（同一保單已在解答）' : i.ruleId === 'R001' && key.some(k => !k.ruleId && k.file === 'control') ? '系統總數差額（對應解答中沒有編號的項目）' : '解答未列（可能誤報）' }));

  // 3) 正確版資料：應該 0 個問題
  await page.reload(); await page.waitForTimeout(1200);
  await load(page, path.join(ROOT, 'samples', 'clean'));
  const clean = await snapshot(page);
  const errors = log.errors.filter(e => !/serviceWorker|sandboxed|TUNNEL/.test(e));
  await browser.close();

  const cnt = s => rows.filter(r => r.detected === s).length;
  const judged = rows.filter(r => r.detected === '檢出' || r.detected === '漏報').length;
  const summary = {
    generatedAt: new Date().toISOString(), data: 'samples/dirty（模擬資料）', key: 'tests/fixtures/answer-key-sample.csv', keyRows: rows.length,
    judged, detected: cnt('檢出'), missed: cnt('漏報'), notJudgedNoId: rows.filter(r => r.detected.startsWith('未判定：解答')).length,
    notJudgedInactive: rows.filter(r => r.detected.startsWith('未判定：範例')).length,
    issuesBefore: before.length, fixApplied: applied.total, issuesAfter: after.length, newAfterFix: newAfterFix.length,
    outcome: rows.reduce((o, r) => (o[r.outcome] = (o[r.outcome] || 0) + 1, o), {}),
    stray: stray.map(i => ({ kind: i.kind, ruleId: i.ruleId, policy: i.policy, severity: SEV[i.severity] || i.severity, message: i.message })),
    strayByKind: stray.reduce((o, i) => (o[i.kind] = (o[i.kind] || 0) + 1, o), {}),
    newAfterFixList: newAfterFix.map(i => ({ ruleId: i.ruleId, policy: i.policy, line: i.line, file: i.file, severity: SEV[i.severity] || i.severity, message: i.message })),
    cleanIssues: clean.length, cleanList: clean.slice(0, 20).map(i => `${i.ruleId} ${i.policy} ${i.message}`), scope, pageErrors: errors,
  };
  fs.mkdirSync(OUT, { recursive: true });
  const H = ['#', '分類', '資料', '檢核編號', '保單／案例', '預期問題（解答）', '實際是否檢出', '工具標示', '工具訊息', '建議值', '修正後結果'];
  const cell = v => { v = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; };
  const csv = [H].concat(rows.map(r => [r.no, r.category, r.file, r.ruleId, r.policy, r.expected, r.detected, r.severity, r.actual, r.suggested, r.outcome])).map(r => r.map(cell).join(',')).join('\r\n');
  fs.writeFileSync(path.join(OUT, 'evidence.csv'), '﻿' + csv + '\r\n');
  fs.writeFileSync(path.join(OUT, 'evidence.json'), JSON.stringify({ summary, rows }, null, 1) + '\n');
  fs.rmSync(TMP, { recursive: true, force: true });
  console.log(JSON.stringify(Object.assign({}, summary, { stray: summary.stray.length, rows: undefined }), null, 1));
})().catch(e => { console.error(e); process.exit(1); });
