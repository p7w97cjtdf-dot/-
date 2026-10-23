#!/usr/bin/env node
// 產生官方更新包的簽章金鑰 (ECDSA P-256)。只需做一次，由負責核准法規更新的人 (例如法遵) 在自己的電腦執行：
//   node tools/pack-keygen.js <私鑰存放路徑，例如 ~/dq-pack-signing-key.pem>
// - 私鑰：只存在你指定的位置，不可放進 repo、不可傳給別人；遺失就要重新產生並更換公鑰
// - 公鑰：寫進 rules/updates/public-key.json，提交到 GitHub；工具之後只接受用這把私鑰簽過的官方更新包
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const repo = path.join(__dirname, '..');
const out = process.argv[2];
if (!out) { console.error('用法：node tools/pack-keygen.js <私鑰存放路徑 (不可在 repo 資料夾內)>'); process.exit(2); }
const abs = path.resolve(out.replace(/^~(?=$|\/)/, require('os').homedir()));
if (abs.startsWith(repo + path.sep)) { console.error('私鑰不可放在 repo 資料夾內，請存到別的地方 (例如家目錄)。'); process.exit(2); }
if (fs.existsSync(abs)) { console.error(`「${abs}」已經存在，為避免覆蓋舊私鑰，請換一個檔名。`); process.exit(2); }
const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
fs.writeFileSync(abs, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
const jwk = publicKey.export({ format: 'jwk' });
const id = crypto.createHash('sha256').update(JSON.stringify([jwk.x, jwk.y])).digest('hex').slice(0, 16);
fs.writeFileSync(path.join(repo, 'rules', 'updates', 'public-key.json'), JSON.stringify({
  note: '官方更新包的簽章公鑰。工具只套用用對應私鑰簽過的官方更新包；更換公鑰等同更換「誰可以核准法規更新」，須經審核。',
  keyId: id, createdAt: new Date().toISOString().slice(0, 10), key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
}, null, 2) + '\n');
console.log(`私鑰：${abs}（請妥善保管，不要提交）\n公鑰：rules/updates/public-key.json（keyId ${id}），請提交到 GitHub。`);
