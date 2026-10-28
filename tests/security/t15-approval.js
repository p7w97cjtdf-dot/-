// 法規更新要主管核可：匯入或自己建立的更新包不會套用；試跑 → 申請 → 主管核可 → 匯入已核可檔才套用。
// 被竄改、別把金鑰簽的、核可後再修改的都不套用；重新開啟時重新驗證
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { open, ROOT } = require('./_browser.js');
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t15');
fs.rmSync(TMP, { recursive: true, force: true }); fs.mkdirSync(TMP, { recursive: true });
const SAMPLE = path.join(TMP, 'sample.xlsx');
fs.copyFileSync(process.env.SAMPLE || path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx'), SAMPLE);
const U = n => { const p = path.join(TMP, `u${n}.json`); fs.copyFileSync(path.join(ROOT, 'samples', 'updates', fs.readdirSync(path.join(ROOT, 'samples', 'updates')).find(f => f.startsWith(n + '_'))), p); return p; };
// 測試用的主管金鑰 (只在這次測試，不是正式金鑰)
const kp = () => { const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }); const j = publicKey.export({ format: 'jwk' });
  return { pem: privateKey.export({ type: 'pkcs8', format: 'pem' }), id: crypto.createHash('sha256').update(JSON.stringify([j.x, j.y])).digest('hex').slice(0, 16) }; };
const BOSS = kp(), OTHER = kp();
const keyFile = (k, n) => { const p = path.join(TMP, n); fs.writeFileSync(p, k.pem); return p; };

(async () => {
  const ok = {};
  const { browser, page, log, ctx } = await open({ pin: BOSS.id, acceptDialogs: true });
  const st = () => page.evaluate(() => ({ n: DQ.app.state.all.length, packs: DQ.app.state.packs.map(x => ({ id: x.pack.id, usable: DQ.app.usable(x), on: x.on })), note: document.querySelector('#pack-note').textContent, ap: document.querySelector('#ap-note').textContent }));
  const grab = async sel => { const d = page.waitForEvent('download'); await page.click(sel); const x = await d; const p = path.join(TMP, `${Date.now()}.json`); await x.saveAs(p); return p; };
  await page.setInputFiles('#file-book', SAMPLE); await page.waitForTimeout(2500);
  await page.evaluate(() => DQ.app.showTab('updates'));
  const base = (await st()).n;
  // 1. 匯入一般更新包：放進清單但不套用
  await page.setInputFiles('#file-pack', U(2)); await page.waitForTimeout(800);
  let s = await st();
  ok.importNotApplied = s.n === base && s.packs.some(p => p.id === 'test-disable' && !p.usable) && /還沒有主管核可，不會套用/.test(s.note);
  // 2. 試跑：不影響結果，算出會隱藏幾個問題
  await page.click('#pack-list [data-trial]'); await page.waitForTimeout(800);
  const trialText = await page.textContent('#pack-list .pack-trial');
  ok.trialNoEffect = /停用會隱藏 4 個問題/.test(trialText) && (await st()).n === base;
  // 3. 申請主管核可：產生申請檔
  const req = await grab('#pack-list [data-req]');
  ok.requestFile = JSON.parse(fs.readFileSync(req, 'utf8')).type === 'dq-approval-request';
  // 4. 主管用別把金鑰核可：會說明不是核准的主管金鑰
  await page.evaluate(() => { document.querySelector('#approve-box').open = true; });
  await page.setInputFiles('#ap-req', req); await page.waitForTimeout(300);
  await page.setInputFiles('#ap-key', keyFile(OTHER, 'other.pem')); await page.fill('#ap-name', '別人');
  await page.click('#btn-approve'); await page.waitForTimeout(500);
  ok.wrongKeyRefused = /不是這個版本核准的主管金鑰/.test((await st()).ap);
  // 5. 主管用正確的金鑰核可 → 已核可檔；私鑰用完清掉
  await page.setInputFiles('#ap-key', keyFile(BOSS, 'boss.pem')); await page.fill('#ap-name', '陳經理');
  const approved = await grab('#btn-approve');
  ok.keyCleared = await page.evaluate(() => document.querySelector('#ap-key').files.length === 0);
  // 6. 匯入已核可檔 → 套用 (隱藏 4 個問題，畫面註明結果不完整)
  await page.setInputFiles('#file-pack', approved); await page.waitForTimeout(1200);
  s = await st();
  ok.approvedApplied = s.n === base - 4 && s.packs.some(p => p.id === 'test-disable' && p.usable) && /陳經理 已核可/.test(s.note);
  // 7. 被竄改的已核可檔、用別把金鑰簽的已核可檔：不套用
  const t = JSON.parse(fs.readFileSync(approved, 'utf8')); t.packText = t.packText.replace('30205_P0502', '30202_L0302'); const tp = path.join(TMP, 'tampered.json'); fs.writeFileSync(tp, JSON.stringify(t));
  await page.setInputFiles('#file-pack', tp); await page.waitForTimeout(800);
  ok.tamperedRejected = /主管簽章不正確/.test((await st()).note) && (await st()).n === base - 4;
  const A = require(path.join(ROOT, 'src', 'approval.js'));
  const otherApproved = await A.approve(JSON.parse(fs.readFileSync(req, 'utf8')), OTHER.pem, '冒名');
  const op = path.join(TMP, 'other.json'); fs.writeFileSync(op, JSON.stringify(otherApproved));
  await page.setInputFiles('#file-pack', op); await page.waitForTimeout(800);
  ok.otherKeyRejected = /不是這個版本核准的主管金鑰/.test((await st()).note);
  // 8. 重新開啟：已核可的重新驗證後套用；把這台電腦存的內容偷改 → 不套用
  await page.reload(); await page.waitForTimeout(1500);
  await page.setInputFiles('#file-book', SAMPLE); await page.waitForTimeout(2500);
  ok.reloadReverified = (await st()).n === base - 4;
  await page.evaluate(() => { const l = JSON.parse(localStorage.getItem('dq-rule-packs')); l.forEach(x => { if (x.pack.id === 'test-disable') x.pack.disable.push('30202_L0302'); }); localStorage.setItem('dq-rule-packs', JSON.stringify(l)); });
  await page.reload(); await page.waitForTimeout(1500);
  await page.setInputFiles('#file-book', SAMPLE); await page.waitForTimeout(2500);
  ok.localTamperNotApplied = (await st()).n === base;
  // 9. 自己新增檢查、AI 轉換的規則：放進本機自訂更新，待主管核可，不套用
  await page.evaluate(() => DQ.app.showTab('updates'));
  await page.selectOption('#nr-op', 'notBlank'); await page.fill('#nr-msg', '測試'); await page.click('#btn-nr-add'); await page.waitForTimeout(800);
  await page.evaluate(() => DQ.app.setCustomRules([{ id: 'AI1', file: 'L', name: 'AI', scope: 'record', assert: { field: 'sex', op: 'eq', value: '9' }, message: 'AI' }]));
  await page.waitForTimeout(800);
  s = await st();
  ok.localDraftNotApplied = s.n === base && s.packs.some(p => p.id === 'local' && !p.usable);
  // 10. 有錯的更新包：列出無法使用的項目
  await page.setInputFiles('#file-pack', U(4)); await page.waitForTimeout(800);
  ok.brokenExplained = /格式不對，整包都不會套用/.test((await st()).note);
  ok.errors = log.errors.filter(e => !/serviceWorker|sandboxed and lacks/.test(e)).length === 0;
  await browser.close();
  // 11. 正式版本 (固定的是正式主管金鑰)：測試金鑰簽的已核可檔不會被接受
  {
    const t2 = await open();
    await t2.page.evaluate(() => DQ.app.showTab('updates'));
    await t2.page.setInputFiles('#file-pack', approved); await t2.page.waitForTimeout(800);
    ok.productionRejectsTestKey = /不是這個版本核准的主管金鑰/.test(await t2.page.textContent('#pack-note'));
    // 正式主管金鑰簽的測試檔：已核可的會套用、被竄改的不會
    await t2.page.setInputFiles('#file-book', SAMPLE); await t2.page.waitForTimeout(2500);
    const n0 = await t2.page.evaluate(() => DQ.app.state.all.length);
    await t2.page.setInputFiles('#file-pack', U(6)); await t2.page.waitForTimeout(1200);
    const n1 = await t2.page.evaluate(() => DQ.app.state.all.length);
    await t2.page.setInputFiles('#file-pack', U(7)); await t2.page.waitForTimeout(800);
    ok.sampleApprovedFiles = n1 === n0 + 2 && /主管簽章不正確/.test(await t2.page.textContent('#pack-note'));
    await t2.browser.close();
  }
  console.log(JSON.stringify(ok, null, 2));
  process.exitCode = Object.values(ok).every(Boolean) ? 0 : 1;
})();
