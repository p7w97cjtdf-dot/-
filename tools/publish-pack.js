#!/usr/bin/env node
// 發布官方更新包：檢查格式後登記到 rules/updates/index.json，記下內容的 SHA-256，並用私鑰簽章。
// 工具載入官方更新包時會比對 SHA-256 與簽章：內容被改過、沒有簽章或簽章不對就不套用 (安全測試 T03)。
//   node tools/publish-pack.js rules/updates/某更新包.json --key ~/dq-pack-signing-key.pem   發布 (也可用環境變數 PACK_SIGNING_KEY)
//   node tools/publish-pack.js --check                                                    檢查已登記的更新包 (CI 使用)
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const packs = require('../src/rule-packs.js');
const all = require('../src/rulesets/index.js');
const DQ = { finance: require('../src/rulesets/finance.js'), master: require('../src/master.js'), anomaly: require('../src/anomaly.js') };

const dir = path.join(__dirname, '..', 'rules', 'updates');
const idxFile = path.join(dir, 'index.json');
const base = Object.assign({}, all, { catalog: all.catalog.concat(DQ.finance.catalog, DQ.master.catalog, DQ.anomaly.catalog) });
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
// 簽章格式與瀏覽器 WebCrypto 相同：ECDSA P-256、SHA-256、r||s (IEEE P1363)，以 base64 存放
const pub = (() => { try { const k = JSON.parse(fs.readFileSync(path.join(dir, 'public-key.json'), 'utf8')); return k.key ? Object.assign(k, { obj: crypto.createPublicKey({ key: k.key, format: 'jwk' }) }) : null; } catch (e) { return null; } })();
const verifySig = (text, sig) => !!sig && crypto.verify('sha256', Buffer.from(text), { key: pub.obj, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64'));
function problems(text, name) {
  const pack = packs.normalize(JSON.parse(text), path.basename(name, '.json'));
  const v = packs.validate(pack, base, []);
  return { pack, bad: v.errors.concat(v.rules.flatMap(r => r.errors.map(e => `${r.id}：${e}`))) };
}

if (process.argv[2] === '--check') {
  const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
  const errs = [];
  for (const e of idx.packs || []) {
    const name = typeof e === 'string' ? e : e.file;
    let text; try { text = fs.readFileSync(path.join(dir, name), 'utf8'); } catch (x) { errs.push(`${name}：找不到檔案`); continue; }
    if (typeof e === 'string' || !e.sha256) errs.push(`${name}：沒有登記 SHA-256，請用 tools/publish-pack.js 重新發布`);
    else if (sha(text) !== e.sha256) errs.push(`${name}：內容和登記的 SHA-256 不同`);
    if (!pub) errs.push(`${name}：還沒有簽章公鑰 (rules/updates/public-key.json)，工具不會套用沒有簽章的官方更新包`);
    else if (typeof e === 'string' || !verifySig(text, e.sig)) errs.push(`${name}：沒有簽章或簽章不對`);
    errs.push(...problems(text, name).bad.map(b => `${name}：${b}`));
  }
  if (errs.length) { console.error('官方更新包檢查沒有通過：\n- ' + errs.join('\n- ')); process.exit(1); }
  console.log(`官方更新包檢查通過：${(idx.packs || []).length} 個${pub ? `，簽章皆有效 (公鑰 ${pub.keyId})` : '（尚未設定簽章公鑰）'}`);
  process.exit(0);
}

const args = process.argv.slice(2), file = args.find(a => !a.startsWith('--'));
const ki = args.indexOf('--key'), keyPath = ki >= 0 ? args[ki + 1] : process.env.PACK_SIGNING_KEY;
if (!file) { console.error('用法：node tools/publish-pack.js rules/updates/<更新包>.json --key <私鑰路徑>'); process.exit(2); }
if (path.resolve(path.dirname(file)) !== dir) { console.error('更新包要放在 rules/updates/ 資料夾'); process.exit(2); }
const text = fs.readFileSync(file, 'utf8');
const { pack, bad } = problems(text, file);
if (bad.length) { console.error('更新包沒有通過檢查：\n- ' + bad.join('\n- ')); process.exit(1); }
const entry = { file: path.basename(file), sha256: sha(text) };
if (!pub) { console.error('還沒有簽章公鑰：請先由核准者執行 node tools/pack-keygen.js 產生金鑰。工具不會套用沒有簽章的官方更新包。'); process.exit(1); }
{
  if (!keyPath) { console.error('已設定簽章公鑰，發布時必須用私鑰簽章：加上 --key <私鑰路徑>，或設定環境變數 PACK_SIGNING_KEY。'); process.exit(1); }
  const key = crypto.createPrivateKey(fs.readFileSync(keyPath.replace(/^~(?=$|\/)/, require('os').homedir())));
  entry.sig = crypto.sign('sha256', Buffer.from(text), { key, dsaEncoding: 'ieee-p1363' }).toString('base64');
  if (!verifySig(text, entry.sig)) { console.error('這把私鑰和 rules/updates/public-key.json 的公鑰不是一對，沒有發布。'); process.exit(1); }
  entry.keyId = pub.keyId;
}
const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8'));
idx.packs = (idx.packs || []).filter(e => (typeof e === 'string' ? e : e.file) !== entry.file).concat(entry);
fs.writeFileSync(idxFile, JSON.stringify(idx, null, 2) + '\n');
console.log(`已登記 ${entry.file}：${packs.summary(pack)}（已簽章）${pack.disable.length ? `\n注意：會停用 ${pack.disable.length} 項內建檢查 (${pack.disable.join('、')})，請法遵確認。` : ''}`);
