/*
 * 個人資料遮罩 (送給外部 AI 之前一律經過這裡)
 *
 *  身分證字號／居留證號   A123456789 → A123****89      (前 4 碼＋末 2 碼；大小寫、新舊式居留證皆可)
 *  姓名                   資料中出現的姓名、或「姓名：」「要保人：」等標示後的姓名 → 王○明
 *  地址                   「臺北市信義區松仁路 100 號 5 樓」→ 臺北市信義區[已遮蔽地址]
 *                         只有路名門牌、沒有縣市的地址 (松仁路100號) → [已遮蔽地址]
 *  手機／市話             0912-345-678 → 0912***678；(02)2345-6789 → (02)****6789；+886 912 345 678 也可
 *  Email                  wang@example.com → w***@example.com
 *  信用卡／帳號           4 碼一組的卡號 → ****-****-****-1234；「帳號：」後的數字 → [已遮蔽帳號]
 *
 *  出生日期               「出生日期：0790101」「生日 1990/01/01」→ 出生日期：[已遮蔽生日]
 *
 * 遮罩前先把全形英數字轉成半形 (Ａ１２３… → A123…)；證號中間夾空白或連字號 (A 123 456 789) 也會遮罩。
 * guard(text, ctx)：遮罩後再掃描一次，仍偵測到疑似個資就丟出錯誤 (停止送出)，不會「漏過去」。
 * 保單號碼、賠案號碼等外觀像證號的代碼，只要出現在申報資料的對應欄位 (ctx.exempt)，就不遮罩。
 */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.DQ = root.DQ || {}; root.DQ.pii = m; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const CJK = '\\u3400-\\u9fff\\uf900-\\ufaff';
  const D = '0-9０-９';
  // 身分證：英文字母＋1/2 (性別)；新式居留證：英文字母＋8/9；舊式居留證：兩個英文字母＋8 碼
  const TWID = /(?<![A-Za-z0-9])([A-Za-z][1289]\d{8}|[A-Za-z][A-Da-d]\d{8})(?![A-Za-z0-9])/g;
  // 證號中間夾空白或連字號 (A 123-456-789)
  const TWID_LOOSE = /(?<![A-Za-z0-9])[A-Za-z][\s-]?(?:[1289]|[A-Da-d])(?:[\s-]?\d){8}(?![A-Za-z0-9])/g;
  const BIRTH = new RegExp(`((?:出生(?:日期|年月日)?|生日)\\s*[:：=]?\\s*)(?:民國\\s*)?\\d{2,4}\\s*[年/.-]?\\s*\\d{1,2}\\s*[月/.-]?\\s*\\d{1,2}\\s*日?`, 'g');
  const MOBILE = /(?<![0-9])(?:\+?886[\s-]?|0)9\d{2}[\s-]?\d{3}[\s-]?\d{3}(?![0-9])/g;
  // 市話：需有區碼括號或分隔符號，避免誤判一般數字 (金額、日期)
  const LANDLINE = /(?<![0-9])(?:\(0\d{1,3}\)\s?|0\d{1,3}[\s-])\d{3,4}[\s-]?\d{4}(?:\s?(?:#|轉|ext\.?)\s?\d{1,5})?(?![0-9])/gi;
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  const CARD = /(?<![0-9])\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{1,7}(?![0-9])/g;
  const ACCOUNT = new RegExp(`((?:銀行|存款|匯款|帳戶|戶)?帳號\\s*[:：=]?\\s*)[0-9][0-9\\s-]{5,20}[0-9]`, 'g');
  // 地址 1：縣市＋鄉鎮市區開頭，後面接到標點為止
  const ADDR_CITY = new RegExp(`([${CJK}]{2}[縣市][${CJK}]{1,3}?[區鄉鎮市])[^\\s」』"'，,、。；;)）…\\]\\[]{2,}`, 'g');
  // 地址 2：沒有縣市，但有「路／街／大道」＋門牌號 (必須有「號」，避免把「通路別」之類的字誤判為地址)
  const ADDR_ROAD = new RegExp(`[${CJK}]{1,6}(?:路|街|大道)(?:[${D}一二三四五六七八九十]{1,3}段)?(?:[${D}一二三四五六七八九十]{1,4}巷)?(?:[${D}]{1,4}弄)?[${D}]{1,5}(?:之[${D}]{1,3})?號(?:之[${D}]{1,3})?(?:[${D}一二三四五六七八九十]{1,3}樓(?:之[${D}]{1,3})?)?(?:[${D}]{1,4}室)?`, 'g');
  const ADDR_VILLAGE = new RegExp(`[${CJK}]{1,4}[村里][${D}]{1,3}鄰[^\\s，,、。；;)）]{0,20}`, 'g');
  // 有標示的姓名：「姓名：王小明」「要保人：王小明」(必須有分隔符號，避免把「被保險人身份」誤判)
  const NAME_LABEL = new RegExp(`((?:姓名|名字|全名)\\s*[:：=]?\\s*|(?:要保人|被保險人|受益人|聯絡人|負責人|申請人|客戶)\\s*[:：=]\\s*)([${CJK}·．]{2,5})`, 'g');

  const TYPES = { birth: '出生日期', id: '身分證／居留證', name: '姓名', address: '地址', phone: '電話', email: 'Email', card: '卡號／帳號' };

  const maskTwId = s => s.slice(0, 4) + '****' + s.slice(-2);
  const maskName = s => { const c = [...s]; return c.length <= 2 ? c[0] + '○' : c[0] + '○'.repeat(c.length - 2) + c[c.length - 1]; };
  const maskMobile = s => { const d = s.replace(/[^\d]/g, ''); const local = d.startsWith('886') ? '0' + d.slice(3) : d; return local.slice(0, 4) + '***' + local.slice(-3); };
  const maskLandline = s => { const main = s.replace(/\s?(?:#|轉|ext\.?)\s?\d{1,5}$/i, ''); const area = (main.match(/^\(?0\d{1,3}\)?/) || [''])[0].replace(/[()]/g, ''); return `(${area})****${main.replace(/[^\d]/g, '').slice(-4)}`; };
  const maskEmail = s => { const [u, d] = s.split('@'); return u[0] + '***@' + d; };

  // ctx：{ names: [姓名], ids: Set|陣列 [已知證號], exempt: Set [保單號碼等不遮罩的代碼] }
  function norm(ctx) {
    ctx = ctx || {};
    return {
      names: [...(ctx.names || [])].map(n => String(n).trim()).filter(n => [...n].length >= 2).sort((a, b) => b.length - a.length),
      ids: [...(ctx.ids || [])].map(x => String(x).trim()).filter(x => x.length >= 6),
      exempt: ctx.exempt instanceof Set ? ctx.exempt : new Set(ctx.exempt || ctx.policies || []),
    };
  }

  // 全形英數字轉半形，避免「Ａ１２３４５６７８９」「０９１２…」躲過比對 (標點不轉，原文照舊)
  const half = v => String(v == null ? '' : v).replace(/[\uff10-\uff19\uff21-\uff3a\uff41-\uff5a]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
  // 姓名中間夾空白 (王 小 明) 也要比對得到
  const nameRe = nm => new RegExp([...nm].map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'), 'g');

  function redact(text, ctx) {
    const c = norm(ctx), counts = {};
    const hit = (t, n) => { counts[t] = (counts[t] || 0) + (n || 1); };
    let s = half(text);
    // 1. 資料中已知的證號與姓名 (精確比對，涵蓋格式不標準的證號)
    for (const id of c.ids) if (!c.exempt.has(id) && s.includes(id)) { const n = s.split(id).length - 1; s = s.split(id).join(maskTwId(id)); hit('id', n); }
    for (const nm of c.names) s = s.replace(nameRe(nm), () => { hit('name'); return maskName(nm); });
    // 2. 樣式比對
    s = s.replace(EMAIL, m => { hit('email'); return maskEmail(m); });
    s = s.replace(TWID, m => { if (c.exempt.has(m)) return m; hit('id'); return maskTwId(m); });
    s = s.replace(TWID_LOOSE, m => { const id = m.replace(/[\s-]/g, ''); if (c.exempt.has(id)) return m; hit('id'); return maskTwId(id); });
    s = s.replace(BIRTH, (_, lab) => { hit('birth'); return lab + '[已遮蔽生日]'; });
    s = s.replace(CARD, m => { hit('card'); return '****-****-****-' + m.replace(/[^\d]/g, '').slice(-4); });
    s = s.replace(ACCOUNT, (_, lab) => { hit('card'); return lab + '[已遮蔽帳號]'; });
    s = s.replace(MOBILE, m => { hit('phone'); return maskMobile(m); });
    s = s.replace(LANDLINE, m => { hit('phone'); return maskLandline(m); });
    s = s.replace(NAME_LABEL, (_, lab, nm) => { if (/○/.test(nm)) return lab + nm; hit('name'); return lab + maskName(nm); });
    s = s.replace(ADDR_CITY, (m, p) => { if (m.endsWith('[已遮蔽地址]')) return m; hit('address'); return p + '[已遮蔽地址]'; });
    s = s.replace(ADDR_ROAD, () => { hit('address'); return '[已遮蔽地址]'; });
    s = s.replace(ADDR_VILLAGE, () => { hit('address'); return '[已遮蔽地址]'; });
    return { text: s, counts };
  }

  // 掃描：回傳仍可辨識的個資 [{ type, sample }] (sample 只顯示部分，避免在畫面上再露出)
  function scan(text, ctx) {
    const c = norm(ctx), s = half(text), out = [];
    const peek = v => String(v).slice(0, 2) + '…';
    for (const id of c.ids) if (!c.exempt.has(id) && s.includes(id)) out.push({ type: 'id', sample: peek(id) });
    for (const nm of c.names) if (nameRe(nm).test(s)) out.push({ type: 'name', sample: peek(nm) });
    const each = (re, type, skip) => { for (const m of s.matchAll(re)) if (!(skip && skip(m))) out.push({ type, sample: peek(m[0]) }); };
    each(TWID, 'id', m => c.exempt.has(m[0]));
    each(TWID_LOOSE, 'id', m => c.exempt.has(m[0].replace(/[\s-]/g, '')));
    each(BIRTH, 'birth', m => /\[已遮蔽生日\]/.test(m[0]));
    each(EMAIL, 'email'); each(MOBILE, 'phone'); each(LANDLINE, 'phone'); each(CARD, 'card');
    each(ACCOUNT, 'card', m => /\[已遮蔽帳號\]/.test(m[0]));
    each(NAME_LABEL, 'name', m => /○/.test(m[2]));
    each(ADDR_CITY, 'address', m => /\[已遮蔽地址\]$/.test(m[0]));
    each(ADDR_ROAD, 'address'); each(ADDR_VILLAGE, 'address');
    return out;
  }

  // 送出前的最後關卡：遮罩後再掃描，仍有疑似個資就停止送出
  function guard(text, ctx) {
    const r = redact(text, ctx);
    const left = scan(r.text, ctx);
    if (left.length) {
      const err = new Error(`偵測到可能的個人資料（${[...new Set(left.map(x => TYPES[x.type]))].join('、')}）無法完全遮蔽，已停止送出給 AI。`);
      err.code = 'pii_blocked'; err.left = left;
      throw err;
    }
    return r;
  }

  const describe = counts => Object.entries(counts || {}).filter(([, n]) => n).map(([t, n]) => `${TYPES[t]} ${n} 處`).join('、');

  return { redact, scan, guard, describe, maskTwId, maskName, TYPES };
});
