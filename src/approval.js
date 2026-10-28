/*
 * 法規更新的主管核可：一般人匯入或建立的更新包，要由持有核可私鑰的主管簽章後才會套用。
 *  1. 申請：request(pack, 影響摘要) → 「核可申請」檔，寄給主管
 *  2. 核可：approve(申請, 私鑰 PEM, 主管姓名) → 「已核可」檔 (私鑰只在記憶體裡用來簽章，不保存、不上傳)
 *  3. 套用：verify(已核可檔, 固定的公鑰指紋) → 簽章正確、公鑰是這個版本固定的才套用；內容被改過就不套用
 * 簽章：ECDSA P-256 / SHA-256，r||s (IEEE P1363)，和官方更新包相同；瀏覽器 (WebCrypto) 與 Node 都能驗證
 *
 * 簽署內容 (第 2 版，FORMAT = 2)：envelope() 產生的固定格式 JSON (所有物件依鍵名排序、沒有多餘空白)，涵蓋
 *   更新包原文與它的 SHA-256、申請人、申請時間、影響摘要 (試跑結果，綁定同一版更新包的雜湊)、核可人、核可時間。
 *   任何一項被改，簽章都驗證不過。
 * 舊格式 (第 1 版，沒有 format)：只簽了更新包原文、核可人、核可時間。仍可驗證，但申請人與影響摘要「沒有經過簽章」，
 *   verify 回傳 legacy: true、unsigned: ['requestedBy', 'requestedAt', 'impact']，畫面要標示，不可顯示成已驗證。
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
  const FORMAT = 2;
  // 固定格式的 JSON：物件依鍵名排序；只接受 JSON 能表示的值 (文字、有限數字、true/false、null、陣列、物件)
  function canon(v, d) {
    if ((d || 0) > 20) throw new Error('影響摘要巢狀過深');
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'number') { if (!Number.isFinite(v)) throw new Error('影響摘要含有不是有限數字的值'); return JSON.stringify(v); }
    if (Array.isArray(v)) return '[' + v.map(x => canon(x, (d || 0) + 1)).join(',') + ']';
    if (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k], (d || 0) + 1)).join(',') + '}';
    throw new Error('影響摘要含有不支援的資料型態');
  }
  // 第 2 版的簽署內容 (approve 簽、verify 驗、主管核可前畫面顯示的都是這一段)
  const envelope = o => canon({ format: FORMAT, type: 'dq-approval', pack: { text: o.packText, sha256: o.sha256 },
    request: { requestedBy: o.requestedBy, requestedAt: o.requestedAt, impact: o.impact == null ? null : o.impact, packSha256: o.sha256 },
    approval: { approver: o.approver, approvedAt: o.approvedAt } });
  // 舊格式 (第 1 版) 的簽署內容
  const payloadV1 = (packText, approver, approvedAt) => JSON.stringify({ pack: packText, approver, approvedAt });
  const str = (v, n) => typeof v === 'string' && v.length <= n;
  const isoTime = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v);

  // 申請：影響摘要 (試跑結果) 綁定這一版更新包的雜湊
  async function request(pack, impact, by) {
    const packText = JSON.stringify(pack), h = await sha256(packText);
    const imp = impact == null ? null : Object.assign({}, impact, { packSha256: h });
    canon(imp);   // 不能序列化的影響摘要直接拒絕
    return { type: 'dq-approval-request', format: FORMAT, requestedAt: new Date().toISOString(), requestedBy: String(by || '').slice(0, 100), packText, sha256: h, impact: imp };
  }
  // 申請檔的檢查 (主管核可前)：格式、雜湊、影響摘要對應同一版更新包
  async function checkRequest(req) {
    if (!req || req.type !== 'dq-approval-request' || typeof req.packText !== 'string') throw new Error('這不是核可申請檔');
    if (await sha256(req.packText) !== req.sha256) throw new Error('核可申請檔的內容和申請時不同 (可能被改過)，不予核可');
    if (!str(req.requestedBy, 100) || !isoTime(req.requestedAt)) throw new Error('核可申請檔的申請人或申請時間格式不正確');
    if (req.impact != null) {
      if (typeof req.impact !== 'object' || Array.isArray(req.impact)) throw new Error('核可申請檔的影響摘要格式不正確');
      if (req.impact.packSha256 != null && req.impact.packSha256 !== req.sha256) throw new Error('影響摘要不是這一版更新包的試跑結果，不予核可');
      canon(req.impact);
    }
  }
  // 主管核可前顯示「真正要簽署的內容」(核可時間用按下核可時的時間)
  async function preview(req, approver) {
    await checkRequest(req);
    return envelope({ packText: req.packText, sha256: req.sha256, requestedBy: req.requestedBy, requestedAt: req.requestedAt, impact: req.impact, approver: String(approver || '').trim(), approvedAt: '（按下核可的時間）' });
  }
  function pemToDer(pem) {
    const body = String(pem).replace(/-----BEGIN [A-Z ]+-----|-----END [A-Z ]+-----|\s+/g, '');
    if (!/^[A-Za-z0-9+/=]+$/.test(body) || !/BEGIN PRIVATE KEY/.test(pem)) throw new Error('私鑰檔格式不正確：需要 PEM 格式 (-----BEGIN PRIVATE KEY-----)');
    return unb64(body);
  }
  // 主管核可：回傳「已核可」檔。申請檔的雜湊對不上 (被改過) 就不核可
  async function approve(req, pem, approver) {
    await checkRequest(req);
    if (!String(approver || '').trim()) throw new Error('請填核可人姓名');
    if (String(approver).trim().length > 100) throw new Error('核可人姓名太長');
    // 私鑰只在這個函式裡使用，不存到任何地方；用完 (成功或失敗) 就把位元組歸零、拿掉 JWK 的私鑰欄位、變數設為 null
    let priv = null, jwk = null, der = null, sig, publicKey;
    const approvedAt = new Date().toISOString(), who = String(approver).trim();
    const signed = envelope({ packText: req.packText, sha256: req.sha256, requestedBy: req.requestedBy, requestedAt: req.requestedAt, impact: req.impact, approver: who, approvedAt });
    try {
      try {
        der = pemToDer(pem);
        priv = await subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
        jwk = await subtle.exportKey('jwk', priv);
      } catch (e) { throw new Error(e.message && /PEM/.test(e.message) ? e.message : '私鑰無法使用：請確認是核可用的 ECDSA P-256 私鑰'); }
      publicKey = { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
      sig = await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, enc(signed));
    } finally {
      if (der) der.fill(0);
      if (jwk) { jwk.d = null; delete jwk.d; }
      der = null; jwk = null; priv = null; pem = null;
    }
    return { type: 'dq-approved-pack', format: FORMAT, packText: req.packText, sha256: req.sha256,
      approval: { approver: who, approvedAt, keyId: await keyIdOf(publicKey), requestedBy: req.requestedBy, requestedAt: req.requestedAt, impact: req.impact == null ? null : req.impact },
      publicKey, sig: b64(sig) };
  }
  // 驗證已核可檔：公鑰必須是這個版本固定的 (pins)，簽章必須正確。
  // 回傳 { ok, pack, approval, format, legacy, unsigned } 或 { ok: false, why }。approval 只放「有經過簽章」的欄位
  async function verify(file, pins) {
    try {
      if (!file || file.type !== 'dq-approved-pack' || typeof file.packText !== 'string' || !file.approval || typeof file.approval !== 'object' || !file.publicKey || typeof file.sig !== 'string') return { ok: false, why: '不是已核可的更新包' };
      const id = await keyIdOf(file.publicKey);
      if (!(pins || []).includes(id)) return { ok: false, why: `核可用的金鑰（${id}）不是這個版本核准的主管金鑰` };
      const key = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: file.publicKey.x, y: file.publicKey.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      const a = file.approval, sig = unb64(file.sig);
      const ok = data => subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, enc(data));
      if (file.format === FORMAT) {
        const h = await sha256(file.packText);
        if (file.sha256 !== h) return { ok: false, why: '更新包內容和簽署時的雜湊不同 (內容被改過)' };
        if (a.impact != null && a.impact.packSha256 !== h) return { ok: false, why: '影響摘要不是這一版更新包的試跑結果' };
        let data;
        try { data = envelope({ packText: file.packText, sha256: h, requestedBy: a.requestedBy, requestedAt: a.requestedAt, impact: a.impact, approver: a.approver, approvedAt: a.approvedAt }); }
        catch (e) { return { ok: false, why: '已核可檔的影響摘要格式不正確' }; }
        if (!await ok(data)) return { ok: false, why: '主管簽章不正確：更新包內容、申請人、申請時間、影響摘要、核可人或核可時間被改過' };
        return { ok: true, format: FORMAT, legacy: false, unsigned: [], pack: JSON.parse(file.packText),
          approval: { approver: a.approver, approvedAt: a.approvedAt, requestedBy: a.requestedBy, requestedAt: a.requestedAt, impact: a.impact, keyId: id } };
      }
      if (file.format != null) return { ok: false, why: `不支援的已核可檔格式（第 ${String(file.format).slice(0, 10)} 版）` };
      // 舊格式：只驗證更新包原文、核可人、核可時間；申請人與影響摘要沒有簽章，不回傳成已驗證的值
      if (!await ok(payloadV1(file.packText, a.approver, a.approvedAt))) return { ok: false, why: '主管簽章不正確：更新包內容、核可人或核可時間被改過' };
      return { ok: true, format: 1, legacy: true, unsigned: ['requestedBy', 'requestedAt', 'impact'], pack: JSON.parse(file.packText),
        approval: { approver: a.approver, approvedAt: a.approvedAt, keyId: id, requestedBy: null, requestedAt: null, impact: null, legacy: true } };
    } catch (e) { return { ok: false, why: '已核可檔格式不正確' }; }
  }
  return { request, approve, verify, preview, checkRequest, envelope, canon, FORMAT, sha256, keyIdOf };
});
