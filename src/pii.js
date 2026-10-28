/*
 * 個人資料遮罩 (送給外部 AI 之前一律經過這裡)
 *
 *  身分證字號／居留證號   A123456789 → ***                (完全替換；大小寫、新舊式居留證皆可)
 *  姓名                   資料中出現的姓名、「姓名：」「要保人：」等標示後的姓名；
 *                         「被保險人／要保人／受益人」後面緊接的 2–4 個中文字 (有沒有冒號都算；「與」「資料」等一般字詞除外) → 王○明
 *  地址                   「臺北市信義區松仁路 100 號 5 樓」→ 臺北市信義區[已遮蔽地址]
 *                         只有路名門牌、沒有縣市的地址 (松仁路100號) → [已遮蔽地址]
 *  手機／市話             0912-345-678、(02)2345-6789、+886 912 345 678 → ***
 *  Email                  wang@example.com、wang [at] example [dot] com → ***
 *  信用卡／帳號           4 碼一組的卡號、13–19 碼連續數字且通過信用卡檢查碼 (Luhn) → 只留末 4 碼；「帳號：」後的數字 → [已遮蔽帳號]
 *  護照號碼、統一編號     「護照」「護照號碼」「統編」「統一編號」後面的號碼 → [已遮蔽號碼]
 *
 *  出生日期               「出生日期：0790101」「生日 1990/01/01」→ 出生日期：[已遮蔽生日]
 *                         沒有寫「生日」也遮：「民國79年1月1日生」「1990/01/01 生」「出生於 79.01.01」(「生效」不算)
 *
 * 遮罩前先把文字「正規化」(canon)，避免用變形的寫法躲過比對：
 *  - 全形英數字與符號轉半形 (Ａ１２３＠．－ → A123@.-)、全形空白轉半形
 *  - 拿掉看不見的字元 (零寬空白、軟連字號等)，各種破折號統一成 -
 *  - 寫開的 Email 符號換回來：[at]、(at)、{at} → @；[dot]、(dot) → .
 *  - 逐字拆開的寫法合併回來 (王 小 明 → 王小明；臺 北 市 信 義 區 → 臺北市信義區)；一般句子的空白不動
 * 證號與手機中間穿插空白或符號 (A 123-456.789、0 9 1 2 3 4 5 6 7 8、0912_345_678、A*1*2*3…) 也會遮罩；
 * 為了不把兩個連在一起的日期誤當手機，數字分組要符合常見寫法 (4-3-3、4-6、2-2-2-2-2、逐字分開…)。
 * guard(text, ctx)：遮罩後再掃描一次 (同樣先正規化)，仍偵測到疑似個資就丟出錯誤 (停止送出、說明是哪一類)，不會「漏過去」。
 * 保單號碼、賠案號碼等外觀像證號的代碼，只要出現在申報資料的對應欄位 (ctx.exempt)，就不遮罩；
 * 但內容其實是身分證／居留證格式、而且檢查碼正確時，仍然遮罩 (避免把證號填在保單號碼欄位而外流)。
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
  // 穿插的分隔符號：空白、連字號、點、底線、斜線、星號、直線等 (每處最多 3 個)
  const SEPC = '\\s\\-._/\\\\*·•|~+=';
  const SEP = `[${SEPC}]{0,3}`;
  const SEPS = new RegExp(`[${SEPC}]+`, 'g');
  const TWID_LOOSE = new RegExp(`(?<![A-Za-z0-9])[A-Za-z](?:${SEP}[A-Za-z0-9]){9}(?![A-Za-z0-9])`, 'g');
  const BIRTH = new RegExp(`((?:出生(?:日期|年月日)?|生日)\\s*[:：=]?\\s*)(?:民國\\s*)?\\d{2,4}\\s*[年/.-]?\\s*\\d{1,2}\\s*[月/.-]?\\s*\\d{1,2}\\s*日?`, 'g');
  // 沒有寫「生日」的生日：日期後面接「生」(不含「生效」「生存」) 或前面是「出生於」
  const DATE = `(?:民國\\s*)?(?:\\d{2,4}\\s*[年/.-]\\s*\\d{1,2}\\s*[月/.-]\\s*\\d{1,2}\\s*日?|\\d{7,8})`;
  const BIRTH_SUFFIX = new RegExp(`(?<![0-9])${DATE}(?=\\s*生(?!效|存|產|活|命|育))`, 'g');
  const BIRTH_PREFIX = new RegExp(`(出生(?:於|在|日|時間)\\s*[:：]?\\s*)${DATE}`, 'g');
  const MOBILE = /(?<![0-9])(?:\+?886[\s-]?|0)9\d{2}[\s-]?\d{3}[\s-]?\d{3}(?![0-9])/g;
  const MOBILE_LOOSE = new RegExp(`(?<![0-9A-Za-z])(?:\\+?${SEP}8${SEP}8${SEP}6${SEP}|0${SEP})9(?:${SEP}\\d){8}(?![0-9])`, 'g');
  // 市話：需有區碼括號或分隔符號，避免誤判一般數字 (金額、日期)
  const LANDLINE = /(?<![0-9A-Za-z_])(?:[(（]0\d{1,3}[)）]\s?|0\d{1,3}[\s.-])\d{3,4}[\s.-]?\d{4}(?:\s?(?:#|轉|ext\.?)\s?\d{1,5})?(?![0-9])/gi;
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
  // 刻意寫開的 Email：wang @ example . com、wang[at]example[dot]com、wang(at)example(dot)com
  const AT = '(?:\\s*@\\s*|\\s*[\\[({<]\\s*(?:at|@)\\s*[\\])}>]\\s*)', DOT = '(?:\\s*\\.\\s*|\\s*[\\[({<]\\s*(?:dot|\\.)\\s*[\\])}>]\\s*)';
  const EMAIL_LOOSE = new RegExp(`[A-Za-z0-9._%+-]+${AT}[A-Za-z0-9-]+(?:${DOT}[A-Za-z0-9-]+)*${DOT}[A-Za-z]{2,}(?![A-Za-z0-9])`, 'gi');
  const CARD = /(?<![0-9])\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{1,7}(?![0-9])/g;
  // 連續 13–19 碼、2–6 開頭 (信用卡發卡機構的號碼範圍；補零的金額 000… 不算)，再用 Luhn 檢查碼確認
  const CARD_RUN = /(?<![0-9A-Za-z])[2-6]\d{12,18}(?![0-9A-Za-z])/g;
  // 護照、統一編號：標示後面的號碼
  const PASSPORT = /((?:護照|passport)(?:號碼|號|編號|no\.?|number)?\s*[:：=#]?\s*)([A-Za-z]{0,2}\d{6,10}[A-Za-z]?)(?![A-Za-z0-9])/gi;
  const TAXID = /((?:統一編號|統編)(?:號碼)?\s*[:：=#]?\s*)(\d{8})(?![0-9])/g;
  const ACCOUNT = new RegExp(`((?:銀行|存款|匯款|帳戶|戶)?帳號\\s*[:：=]?\\s*)[0-9][0-9\\s-]{5,20}[0-9]`, 'g');
  // 地址 1：縣市＋鄉鎮市區開頭，後面接到標點為止
  const ADDR_CITY = new RegExp(`([${CJK}]{2}[縣市][${CJK}]{1,3}?[區鄉鎮市])[^\\s」』"'，,、。；;)）…\\]\\[]{2,}`, 'g');
  // 地址 2：沒有縣市，但有「路／街／大道」＋門牌號 (必須有「號」，避免把「通路別」之類的字誤判為地址)
  const ADDR_ROAD = new RegExp(`[${CJK}]{1,6}(?:路|街|大道)\\s?(?:[${D}一二三四五六七八九十]{1,3}段)?(?:[${D}一二三四五六七八九十]{1,4}巷)?(?:[${D}]{1,4}弄)?[${D}]{1,5}\\s?(?:之[${D}]{1,3})?號(?:之[${D}]{1,3})?(?:[${D}一二三四五六七八九十]{1,3}樓(?:之[${D}]{1,3})?)?(?:[${D}]{1,4}室)?`, 'g');
  const ADDR_VILLAGE = new RegExp(`[${CJK}]{1,4}[村里][${D}]{1,3}鄰[^\\s，,、。；;)）]{0,20}`, 'g');
  // 有標示的姓名：「姓名：王小明」「要保人：王小明」(必須有分隔符號，避免把「被保險人身份」誤判)
  // 「被保險人王小明」：沒有冒號也遮；後面接的是一般字詞 (與、及、資料、身份、年齡、須…) 就不是姓名
  // 角色詞與姓名之間可能夾一般空格或全形空格 (零寬字元在 half() 已先移除)：仍要遮，避免用空格繞過
  const NAME_ROLE = new RegExp(`(要保人|被保險人|受益人)([ \\u3000]{0,3})([${CJK}]{2,4})`, 'g');
  const NOT_NAME = /^(?:與|及|和|或|的|之|為|是|須|需|應|不|未|已|有|在|於|若|如|等|同|兼|即|但|並|皆|都|也|則|所|可|仍|請|以|由|對|給|跟|把|被|將|會|要|身份|身分|資料|證號|證件|姓名|性別|生日|出生|年齡|年紀|職業|地址|電話|關係|代號|代碼|欄位|編號|類別|類型|人數|筆數|名單|名稱|簽名|簽章|本人|配偶|子女|父母|保險|投保|承保|理賠|給付|申請|變更|資格|條件|權益|義務|死亡|殘廢|失能|住院|一人|二人|相同|不同|欄|檔|別|數|身|年|人|性|國籍|戶籍|通訊|聯絡|帳戶|銀行|住所|住址|居所|郵遞|郵寄|比|較|大於|小於|晚於|早於|超過|滿|歲|年滿|未滿|或要保|及要保|與要保|和要保|欄|填|填寫|填報|不得|必須|必要|資訊|是否|為何|均|各|每|[一二兩三四五六七八九十多另該此其本換改變])/;
  const HONOR = /(?:先生|小姐|女士|太太|君|氏)$/;
  const NAME_LABEL = new RegExp(`((?:姓名|名字|全名)\\s*[:：=]?\\s*|(?:要保人|被保險人|受益人|聯絡人|負責人|申請人|客戶)\\s*[:：=]\\s*)([${CJK}](?:[·．.・*_\\-]?[${CJK}]){1,4})`, 'g');

  const TYPES = { birth: '出生日期', id: '身分證／居留證', name: '姓名', address: '地址', phone: '電話', email: 'Email', card: '卡號／帳號', doc: '護照／統一編號' };

  // 身分證、新式居留證 (第 2 碼 1/2/8/9)、舊式居留證 (第 2 碼 A–D) 的檢查碼
  const LETTER = 'ABCDEFGHJKLMNPQRSTUVXYWZIO';   // A=10 … 依內政部編碼順序
  function twIdValid(v) {
    const id = String(v || '').toUpperCase();
    if (!/^[A-Z][1289A-D]\d{8}$/.test(id)) return false;
    const a = LETTER.indexOf(id[0]) + 10;
    const second = /\d/.test(id[1]) ? +id[1] : (LETTER.indexOf(id[1]) + 10) % 10;
    const digits = [second, ...id.slice(2).split('').map(Number)];
    let sum = Math.floor(a / 10) + (a % 10) * 9;
    for (let i = 0; i < 8; i++) sum += digits[i] * (8 - i);
    sum += digits[8];
    return sum % 10 === 0;
  }
  // 信用卡號 Luhn 檢查碼
  function luhn(d) {
    let sum = 0;
    for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; }
    return sum % 10 === 0;
  }
  // 不遮罩的代碼 (保單號碼等)：內容其實是檢查碼正確的身分證號時，仍然遮罩
  const exemptOk = (c, id) => c.exempt.has(id) && !twIdValid(id);

  const STAR = '***';
  const maskTwId = () => STAR;
  // 姓名遮罩：預設保留姓與最後一字 (王○明)；opts.fullName 時完全遮蔽 (○○○)
  const opts = { fullName: false };
  const setOptions = o => { if (o && typeof o.fullName === 'boolean') opts.fullName = o.fullName; return Object.assign({}, opts); };
  const maskName = s => { const c = [...s]; if (opts.fullName) return '○'.repeat(Math.max(2, c.length)); return c.length <= 2 ? c[0] + '○' : c[0] + '○'.repeat(c.length - 2) + c[c.length - 1]; };
  // 合併多個上下文 (呼叫時傳入的、App 從已放入的客戶資料建立的)
  const mergeCtx = (...list) => {
    const out = { names: new Set(), ids: new Set(), exempt: new Set() };
    for (const c of list) if (c) { for (const n of c.names || []) out.names.add(n); for (const i of c.ids || []) out.ids.add(i); for (const e of c.exempt || c.policies || []) out.exempt.add(e); }
    for (const i of out.ids) out.exempt.delete(i);
    return { names: [...out.names], ids: out.ids, exempt: out.exempt };
  };
  // 角色後面接的 2–4 個字：去掉「先生」「小姐」等稱謂；是一般字詞就不當姓名
  // 姓名後面常接的動詞或助詞的第一個字 (被保險人陳大文投保 → 陳大文)
  const TRAIL = new Set([...'投申於在的已未為是有要與及來去說表填資身出性年住同等於並和或因於經對向將被由請領給辦']);
  function roleName(nm) {
    if (/○/.test(nm) || NOT_NAME.test(nm)) return '';
    nm = nm.replace(HONOR, '');
    while ([...nm].length > 2 && TRAIL.has([...nm].pop())) nm = [...nm].slice(0, -1).join('');
    return [...nm].length >= 2 ? nm : '';
  }
  // 證號：去掉分隔符號後要是合法的證號樣式；分組要是常見寫法 (逐字分開、A 123 456 789、A123 456 789…)
  const groups = m => m.split(SEPS).filter(Boolean).map(g => g.length).join(',');
  const ID_GROUPS = new Set(['1,9', '1,3,3,3', '4,3,3', '4,6', '5,5', '2,4,4', '1,4,5', '1,1,8', '6,4', '3,3,4', '1,5,4']);
  function looseId(m) {
    const id = m.replace(SEPS, '');
    if (!/^(?:[A-Za-z][1289]\d{8}|[A-Za-z][A-Da-d]\d{8})$/.test(id)) return null;
    const g = groups(m);
    return g === '10' || ID_GROUPS.has(g) || (/^[A-Za-z]{2}/.test(id) && g === '2,8') || /^1(,1){9}$/.test(g) ? id : null;
  }
  // 手機：10 碼 09 開頭 (或 +886 9 開頭)；分組要是常見寫法，避免把「0911231 1001231」這種兩個民國日期誤判
  const MOB_GROUPS = new Set(['10', '4,3,3', '4,6', '2,4,4', '2,2,2,2,2', '3,3,4', '7,3', '4,2,2,2', '3,7', '1,3,3,3', '1,9', '2,8', '2,2,3,3']);
  const INTL_GROUPS = new Set(['9', '3,3,3', '3,6', '1,4,4', '1,8', '1,2,3,3', '3,3,3']);
  function looseMobile(m) {
    const d = m.replace(/[^\d]/g, '');
    if (/^8869\d{8}$/.test(d)) { const rest = m.replace(/^\+?(?:[^\d]*8){2}[^\d]*6/, ''), g = groups(rest); return INTL_GROUPS.has(g) || /^1(,1){8}$/.test(g); }
    if (!/^09\d{8}$/.test(d)) return false;
    const g = groups(m);
    return MOB_GROUPS.has(g) || /^1(,1){9}$/.test(g);
  }
  const maskMobile = () => STAR;
  const maskLandline = () => STAR;
  const maskEmail = () => STAR;

  // ctx：{ names: [姓名], ids: Set|陣列 [已知證號], exempt: Set [保單號碼等不遮罩的代碼] }
  function norm(ctx) {
    ctx = ctx || {};
    return {
      names: [...(ctx.names || [])].map(n => canon(n).replace(/\s+/g, '').trim()).filter(n => [...n].length >= 2).sort((a, b) => b.length - a.length),
      ids: [...(ctx.ids || [])].map(x => canon(x).trim()).filter(x => x.length >= 6),
      exempt: ctx.exempt instanceof Set ? ctx.exempt : new Set(ctx.exempt || ctx.policies || []),
    };
  }

  // 正規化：全形英數字與符號轉半形、拿掉看不見的字元、破折號統一、中文字 (與數字) 之間的空白拿掉
  // 全形標點「，：；（）」保留 (中文的一般寫法，也是地址、姓名比對的邊界)
  const KEEP = new Set(['，', '：', '；', '（', '）', '！', '？', '、']);
  // 逐字拆開的寫法 (王 小 明、臺 北 市 信 義 區 松 仁 路 100 號)：單一中文字或一串數字之間只隔空白，合併回來；
  // 一般句子 (聯絡 陳大文 先生、金額 1000) 的空白不動
  const CJ = `[${CJK}]`;
  const SPACED = new RegExp(`(?<![${CJK}0-9A-Za-z./_-])(?:(?:${CJ}|\\d{1,4})[ \\t]+){2,}(?:${CJ}|\\d{1,4})(?![${CJK}0-9])`, 'g');
  const canon = v => String(v == null ? '' : v)
    .replace(/[\u200b-\u200f\u2028-\u202f\u2060-\u206f\ufeff\u00ad\u180e\u034f\u061c\u115f\u1160\u3164\uffa0]/g, m => /[\u2028\u2029\u202f]/.test(m) ? ' ' : '')
    .replace(/[\uff01-\uff5e]/g, ch => KEEP.has(ch) ? ch : String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
    .replace(/[\u2010-\u2015\u2212\ufe58\ufe63\u30fc\uff70\u2043\u2e3a\u2e3b\u301c\u2053\ufe31\ufe32]/g, '-')
    .replace(/\s*[[(（{<［【]\s*at\s*[\])）}>］】]\s*/gi, '@')
    .replace(/\s*[[(（{<［【]\s*dot\s*[\])）}>］】]\s*/gi, '.')
    .replace(SPACED, m => new RegExp(CJ).test(m) ? m.replace(/[ \t]+/g, '') : m);   // 只有數字的 (卡號 4111 1111…) 不動
  const half = canon;
  // 姓名中間夾空白或符號 (王 小 明、王.小.明、王*小*明) 也要比對得到
  const nameRe = nm => new RegExp([...nm].map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(`[${SEPC}・]*`), 'g');

  function redact(text, ctx) {
    const c = norm(ctx), counts = {};
    const hit = (t, n) => { counts[t] = (counts[t] || 0) + (n || 1); };
    let s = half(text);
    // 1. 資料中已知的證號與姓名 (精確比對，涵蓋格式不標準的證號)
    for (const id of c.ids) if (!exemptOk(c, id) && s.includes(id)) { const n = s.split(id).length - 1; s = s.split(id).join(maskTwId(id)); hit('id', n); }
    for (const nm of c.names) s = s.replace(nameRe(nm), () => { hit('name'); return maskName(nm); });
    // 2. 樣式比對
    s = s.replace(EMAIL, m => { hit('email'); return maskEmail(m); });
    s = s.replace(EMAIL_LOOSE, m => { hit('email'); return maskEmail(m); });
    s = s.replace(TWID, m => { if (exemptOk(c, m)) return m; hit('id'); return maskTwId(m); });
    s = s.replace(TWID_LOOSE, m => { const id = looseId(m); if (!id || exemptOk(c, id)) return m; hit('id'); return maskTwId(id); });
    s = s.replace(BIRTH, (_, lab) => { hit('birth'); return lab + '[已遮蔽生日]'; });
    s = s.replace(BIRTH_PREFIX, (_, lab) => { hit('birth'); return lab + '[已遮蔽生日]'; });
    s = s.replace(BIRTH_SUFFIX, () => { hit('birth'); return '[已遮蔽生日]'; });
    s = s.replace(PASSPORT, (_, lab) => { hit('doc'); return lab + '[已遮蔽號碼]'; });
    s = s.replace(TAXID, (_, lab) => { hit('doc'); return lab + '[已遮蔽號碼]'; });
    s = s.replace(CARD, m => { hit('card'); return '****-****-****-' + m.replace(/[^\d]/g, '').slice(-4); });
    s = s.replace(CARD_RUN, m => { if (c.exempt.has(m) || !luhn(m)) return m; hit('card'); return '*'.repeat(m.length - 4) + m.slice(-4); });
    s = s.replace(ACCOUNT, (_, lab) => { hit('card'); return lab + '[已遮蔽帳號]'; });
    s = s.replace(MOBILE, m => { hit('phone'); return maskMobile(m); });
    s = s.replace(MOBILE_LOOSE, m => { if (!looseMobile(m)) return m; hit('phone'); return maskMobile(m); });
    s = s.replace(LANDLINE, m => { hit('phone'); return maskLandline(m); });
    s = s.replace(NAME_ROLE, (m, role, sep, nm) => { const n = roleName(nm); if (!n) return m; hit('name'); return role + sep + maskName(n) + nm.slice(n.length); });
    s = s.replace(NAME_LABEL, (_, lab, nm) => { if (/○/.test(nm)) return lab + nm; hit('name'); return lab + maskName(nm.replace(/[^\u3400-\u9fff\uf900-\ufaff]/g, '')); });
    s = s.replace(ADDR_CITY, (m, p) => { if (m.endsWith('[已遮蔽地址]')) return m; hit('address'); return p + '[已遮蔽地址]'; });
    s = s.replace(ADDR_ROAD, () => { hit('address'); return '[已遮蔽地址]'; });
    s = s.replace(ADDR_VILLAGE, () => { hit('address'); return '[已遮蔽地址]'; });
    return { text: s, counts };
  }

  // 掃描：回傳仍可辨識的個資 [{ type, sample }] (sample 只顯示部分，避免在畫面上再露出)
  function scan(text, ctx) {
    const c = norm(ctx), s = half(text), out = [];
    const peek = v => String(v).slice(0, 2) + '…';
    for (const id of c.ids) if (!exemptOk(c, id) && s.includes(id)) out.push({ type: 'id', sample: peek(id) });
    for (const nm of c.names) if (nameRe(nm).test(s)) out.push({ type: 'name', sample: peek(nm) });
    const each = (re, type, skip) => { for (const m of s.matchAll(re)) if (!(skip && skip(m))) out.push({ type, sample: peek(m[0]) }); };
    each(TWID, 'id', m => exemptOk(c, m[0]));
    each(TWID_LOOSE, 'id', m => { const id = looseId(m[0]); return !id || exemptOk(c, id); });
    each(BIRTH, 'birth', m => /\[已遮蔽生日\]/.test(m[0]));
    each(BIRTH_PREFIX, 'birth'); each(BIRTH_SUFFIX, 'birth');
    each(PASSPORT, 'doc'); each(TAXID, 'doc');
    each(CARD_RUN, 'card', m => c.exempt.has(m[0]) || !luhn(m[0]));
    each(NAME_ROLE, 'name', m => /○/.test(m[3]) || !roleName(m[3]));
    each(EMAIL, 'email'); each(EMAIL_LOOSE, 'email'); each(MOBILE, 'phone'); each(MOBILE_LOOSE, 'phone', m => !looseMobile(m[0])); each(LANDLINE, 'phone'); each(CARD, 'card');
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

  return { redact, scan, guard, describe, canon, twIdValid, luhn, maskTwId, maskName, TYPES, setOptions, mergeCtx };
});
