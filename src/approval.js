/*
 * 法規更新的主管核可：一般人匯入或建立的更新包，要由持有核可私鑰的主管簽章後才會套用。
 *  1. 申請：request(pack, 影響摘要) → 「核可申請」檔，寄給主管
 *  2. 核可：approve(申請, 私鑰 PEM, 主管姓名) → 「已核可」檔 (私鑰只在記憶體裡用來簽章，不保存、不上傳)
 *  3. 套用：verify(已核可檔, 固定的公鑰指紋) → 簽章正確、公鑰是這個版本固定的才套用；內容被改過就不套用
 * 簽章：ECDSA P-256 / SHA-256，r||s (IEEE P1363)，和官方更新包相同；瀏覽器 (WebCrypto) 與 Node 都能驗證
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const m = factory(isNode ? require('crypto').webcrypto : root.crypto);
  if (isNode) module.exports = m; else root.DQ.approval = m;
})(typeof self !== 'undefined' ? self : this, function (wc) {
  'use strict';
  const subtle = wc && wc.subtle;
  const enc = s => new TextEncoder().encode(s);
  const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  const b64 = u8 => { let s = ''; for (const x of new Uint8Array(u8)) s += String.fromCharCode(x); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(String(s)), c => c.charCodeAt(0));
  const sha256 = async s => hex(await subtle.digest('SHA-256', enc(s)));
  const keyIdOf = async k => (await sha256(JSON.stringify([k.x, k.y]))).slice(0, 16);   // 和 tools/pack-keygen.js 同一算法
  // 簽章的內容：更新包原文、核可人、核可時間綁在一起 (任何一項被改都驗證不過)
  const payload = (packText, approver, approvedAt) => JSON.stringify({ pack: packText, approver, approvedAt });

  async function request(pack, impact, by) {
    const packText = JSON.stringify(pack);
    return { type: 'dq-approval-request', requestedAt: new Date().toISOString(), requestedBy: by || '', packText, sha256: await sha256(packText), impact: impact || null };
  }
  function pemToDer(pem) {
    const body = String(pem).replace(/-----BEGIN [A-Z ]+-----|-----END [A-Z ]+-----|\s+/g, '');
    if (!/^[A-Za-z0-9+/=]+$/.test(body) || !/BEGIN PRIVATE KEY/.test(pem)) throw new Error('私鑰檔格式不正確：需要 PEM 格式 (-----BEGIN PRIVATE KEY-----)');
    return unb64(body);
  }
  // 主管核可：回傳「已核可」檔。申請檔的雜湊對不上 (被改過) 就不核可
  async function approve(req, pem, approver) {
    if (!req || req.type !== 'dq-approval-request' || typeof req.packText !== 'string') throw new Error('這不是核可申請檔');
    if (await sha256(req.packText) !== req.sha256) throw new Error('核可申請檔的內容和申請時不同 (可能被改過)，不予核可');
    if (!String(approver || '').trim()) throw new Error('請填核可人姓名');
    let priv, jwk;
    try {
      priv = await subtle.importKey('pkcs8', pemToDer(pem), { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
      jwk = await subtle.exportKey('jwk', priv);
    } catch (e) { throw new Error(e.message && /PEM/.test(e.message) ? e.message : '私鑰無法使用：請確認是核可用的 ECDSA P-256 私鑰'); }
    const approvedAt = new Date().toISOString(), who = String(approver).trim();
    const sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, enc(payload(req.packText, who, approvedAt)));
    const publicKey = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
    return { type: 'dq-approved-pack', packText: req.packText, approval: { approver: who, approvedAt, keyId: await keyIdOf(publicKey), requestedBy: req.requestedBy || '', impact: req.impact || null }, publicKey, sig: b64(sig) };
  }
  // 驗證已核可檔：公鑰必須是這個版本固定的 (pins)，簽章必須正確。回傳 { ok, pack, approval } 或 { ok: false, why }
  async function verify(file, pins) {
    try {
      if (!file || file.type !== 'dq-approved-pack' || typeof file.packText !== 'string' || !file.approval || !file.publicKey) return { ok: false, why: '不是已核可的更新包' };
      const id = await keyIdOf(file.publicKey);
      if (!(pins || []).includes(id)) return { ok: false, why: `核可用的金鑰（${id}）不是這個版本核准的主管金鑰` };
      const key = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: file.publicKey.x, y: file.publicKey.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const good = await subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, unb64(file.sig), enc(payload(file.packText, file.approval.approver, file.approval.approvedAt)));
      if (!good) return { ok: false, why: '主管簽章不正確：更新包內容、核可人或核可時間被改過' };
      return { ok: true, pack: JSON.parse(file.packText), approval: Object.assign({}, file.approval, { keyId: id }) };
    } catch (e) { return { ok: false, why: '已核可檔格式不正確' }; }
  }
  return { request, approve, verify, sha256, keyIdOf };
});
