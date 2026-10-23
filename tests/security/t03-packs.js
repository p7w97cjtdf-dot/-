// T03 更新包信任：格式合法但停用規則的測試包 (自行匯入)、被竄改或格式錯誤的官方包
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { open, ROOT } = require('./_browser.js');
const SAMPLE = process.env.SAMPLE || path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx');
const TMP = process.env.TMPDIR_T || path.join(require('os').tmpdir(), 'dq-t03');
fs.mkdirSync(TMP, { recursive: true });

// 測試包：只停用兩項會找到問題的內建檢查 (格式完全合法)
const evil = { id: 'test-disable', name: '測試用停用包', version: '1', issuedAt: '20261022', basis: '安全測試 T03（虛構）', disable: ['30212_L1305', '30205_P0502', 'C008'] };
const evilFile = path.join(TMP, 'test-disable.json'); fs.writeFileSync(evilFile, JSON.stringify(evil));
const sha = t => crypto.createHash('sha256').update(t).digest('hex');
const OFF = 'https://p7w97cjtdf-dot.github.io/-/rules/updates/';

async function scenario(name, opts, act) {
  const t = await open(opts);
  await t.page.setInputFiles('#file-book', SAMPLE); await t.page.waitForTimeout(2500);
  const before = await t.page.evaluate(() => DQ.app.state.all.length);
  const r = await act(t);
  const after = await t.page.evaluate(() => ({ n: DQ.app.state.all.length, hidden: DQ.app.state.disabledCount, note: document.querySelector('#hidden-note').hidden ? '' : document.querySelector('#hidden-note').textContent,
    report: /hidden-note/.test(document.querySelector('#report-frame').srcdoc), packs: DQ.app.state.packs.map(x => ({ id: x.pack.id, on: x.on, official: !!x.official, imported: !!x.imported })), rejected: DQ.app.state.officialRejected || [] }));
  await t.browser.close();
  return Object.assign({ name, before, dialogs: t.log.dialogs.map(d => d.split('\n')[0]) }, after, r || {});
}
(async () => {
  const out = [];
  const imp = async t => { await t.page.evaluate(() => DQ.app.showTab('updates')); await t.page.setInputFiles('#file-pack', evilFile); await t.page.waitForTimeout(1200); await t.page.evaluate(() => DQ.app.showTab('check')); await t.page.waitForTimeout(300); };
  out.push(await scenario('自行匯入停用包，按「取消」', {}, imp));
  out.push(await scenario('自行匯入停用包，按「確定」', { acceptDialogs: true }, imp));
  // 官方清單：同一個停用包，分別是 雜湊不符 / 雜湊相符 / 停用不存在的檢查
  const text = JSON.stringify(evil), bad = JSON.stringify(Object.assign({}, evil, { id: 'bad', disable: ['NO_SUCH_RULE'] }));
  const serve = (idx, pk) => (u, r) => {
    if (u.startsWith(OFF + 'index.json')) { r.fulfill({ contentType: 'application/json', body: JSON.stringify(idx) }); return true; }
    if (u.startsWith(OFF + 'public-key.json')) { pk ? r.fulfill({ contentType: 'application/json', body: JSON.stringify(pk) }) : r.fulfill({ status: 404, body: '' }); return true; }
    if (u.startsWith(OFF + 'p.json')) { r.fulfill({ contentType: 'application/json', body: text }); return true; }
    if (u.startsWith(OFF + 'bad.json')) { r.fulfill({ contentType: 'application/json', body: bad }); return true; }
  };
  const reload = async t => { await t.page.evaluate(() => DQ.app.loadOfficial()); await t.page.waitForTimeout(1000); };
  out.push(await scenario('官方包被竄改 (雜湊不符)', { serve: serve({ packs: [{ file: 'p.json', sha256: sha(text + ' ') }] }) }, reload));
  out.push(await scenario('官方包雜湊相符，但還沒有簽章公鑰', { serve: serve({ packs: [{ file: 'p.json', sha256: sha(text) }] }) }, reload));
  out.push(await scenario('官方包停用不存在的檢查', { serve: serve({ packs: ['bad.json'] }) }, reload));
  // 數位簽章：有公鑰時只接受核准者簽過的更新包
  const kp = () => { const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }); const j = publicKey.export({ format: 'jwk' }); return { privateKey, pk: { keyId: crypto.createHash('sha256').update(JSON.stringify([j.x, j.y])).digest('hex').slice(0, 16), key: { kty: j.kty, crv: j.crv, x: j.x, y: j.y } } }; };
  const A = kp(), B = kp();
  const sign = (k, t) => crypto.sign('sha256', Buffer.from(t), { key: k, dsaEncoding: 'ieee-p1363' }).toString('base64');
  const good = { file: 'p.json', sha256: sha(text), sig: sign(A.privateKey, text) };
  out.push(await scenario('簽章正確', { serve: serve({ packs: [good] }, A.pk) }, reload));
  out.push(await scenario('有公鑰但更新包沒有簽章', { serve: serve({ packs: [{ file: 'p.json', sha256: sha(text) }] }, A.pk) }, reload));
  out.push(await scenario('用別人的私鑰簽章', { serve: serve({ packs: [Object.assign({}, good, { sig: sign(B.privateKey, text) })] }, A.pk) }, reload));
  // 同一台裝置：先看過公鑰 A，之後公鑰被拿掉或換成 B
  const seenA = async (t, pk) => { await t.page.evaluate(() => DQ.app.loadOfficial()); await t.page.waitForTimeout(800); };
  out.push(await scenario('看過公鑰後公鑰被拿掉', { serve: serve({ packs: [good] }, A.pk) }, async t => { await t.page.evaluate(() => localStorage.setItem('dq-pack-key', 'x')); await t.ctx.unrouteAll(); await t.ctx.route(/^https?:\/\//, r => serve({ packs: [good] }, null)(r.request().url(), r) || r.abort()); await seenA(t); }));
  out.push(await scenario('公鑰被換成另一把', { serve: serve({ packs: [Object.assign({}, good, { sig: sign(B.privateKey, text) })] }, B.pk) }, async t => { await t.page.evaluate(k => localStorage.setItem('dq-pack-key', k), A.pk.keyId); await seenA(t); }));
  console.log(JSON.stringify(out, null, 2));
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
})();
