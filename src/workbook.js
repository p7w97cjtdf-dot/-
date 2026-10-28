/*
 * Excel 活頁簿：
 *  - sheets(g)：由模擬資料組出試用活頁簿的 7 張工作表 (tools/export-workbook.js 與 tests/run.html 共用)
 *  - slots(XLSX, wb)：依工作表名稱分配到工具的 7 個上傳格 (網頁與 tests/run.html 共用)
 *  - files(got)：把各工作表轉成檢核引擎的輸入 (承保/給付/上年度轉回固定長度格式)
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('./core.js') : root.DQ;
  const life = isNode ? require('./rulesets/life.js') : root.DQ.rulesets.life;
  const all = isNode ? require('./rulesets/index.js') : root.DQ.rulesets.all;
  const m = factory(C, life, all);
  if (isNode) module.exports = m; else root.DQ.workbook = m;
})(typeof self !== 'undefined' ? self : this, function (C, life, all) {
  'use strict';
  const L = life.layouts.L, D = life.layouts.D;
  // 工作表名稱包含這些字就分配到對應的上傳格 (「去年保單資料」要先於「保單」比對)；舊名稱 (承保、給付、上年度、控制總數) 也接受
  // 癌症險、傷害險的工作表名稱也含「保單」「理賠」，要先比對
  const SHEET_SLOT = [['癌症險保單', 'CL'], ['癌症險理賠', 'CD'], ['癌症保單', 'CL'], ['癌症理賠', 'CD'], ['傷害險保單', 'AL'], ['傷害險理賠', 'AD'], ['傷害保單', 'AL'], ['傷害理賠', 'AD'], ['上年度', 'prior'], ['去年', 'prior'], ['承保', 'L'], ['保單', 'L'], ['給付', 'D'], ['理賠', 'D'], ['控制總數', 'control'], ['系統總數', 'control'], ['資產負債', 'statement'], ['商品', 'products'], ['客戶', 'customers']];
  const NAMES = { L: '保單資料', D: '理賠資料', customers: '客戶資料', products: '商品資料', prior: '去年保單資料', control: '系統總數', statement: '資產負債表', CL: '癌症險保單資料', CD: '癌症險理賠資料', AL: '傷害險保單資料', AD: '傷害險理賠資料' };
  const EXT = ['CL', 'CD', 'AL', 'AD'];

  const recs = (text, lay) => C.parseFixedWidth(text, lay).records.filter(r => r._raw.length === lay.recordLength);
  const fixed = (text, lay) => ({ header: lay.fields.map(f => f.name), rows: recs(text, lay).map(r => lay.fields.map(f => r[f.key])) });
  const csv = text => { const rows = C.parseCSV(text.replace(/^﻿/, '')); return { header: rows[0], rows: rows.slice(1) }; };

  // 7 張工作表 (資產負債表金額為數字，其餘皆為文字以保留前置 0)
  function sheets(g) {
    const st = csv(g.statement);
    return {
      保單資料: fixed(g.L, L), 理賠資料: fixed(g.D, D), 客戶資料: csv(g.customers), 商品資料: csv(g.products),
      去年保單資料: fixed(g.prior, L), 系統總數: csv(g.control),
      資產負債表: { header: st.header, rows: st.rows.map(r => [r[0], r[1], ...r.slice(2).map(Number)]) },
    };
  }

  // 癌症險 / 傷害險試用活頁簿：每個明細檔一張工作表
  function extSheets(g) {
    const out = {};
    for (const k of EXT) if (g[k] && all.layouts[k]) out[NAMES[k]] = fixed(g[k], all.layouts[k]);
    return out;
  }
  // 名稱看不出來時，改看第一列標題 (例如使用者把工作表命名為 Sheet1)
  function bySignature(head) {
    const h = new Set(head.map(x => String(x || '').replace(/^\uFEFF/, '').trim()));
    const has = (...k) => k.every(x => h.has(x));
    if (has('承保範圍代號', '暴露數')) return 'CL';
    if (has('罹患癌症種類(ICD-10)', '給付項目')) return 'CD';
    if (has('契約變更型態代號', '意外死亡保險金額')) return 'AL';
    if (has('給付類別代號', '事故原因代號')) return 'AD';
    if (has('給付類別', '保單編號')) return 'D';
    if (has('加保別', '退保別', '保單編號')) return 'L';
    if (has('角色', '姓名', '證件編號')) return 'customers';
    if (has('商品代號', '停售日')) return 'products';
    if (has('來源系統', '項目代號')) return 'control';
    if (has('科目代號', '期末餘額')) return 'statement';
    return null;
  }
  // ---------- 自動調整：欄位名稱與值的格式 ----------
  // 使用者自己整理的表格常見的寫法差異，放入時直接改成申報格式，改了什麼都列出來
  const COLS = {
    customers: ['保單編號', '保單序號', '角色', '證件編號', '姓名', '出生日期', '性別', '郵遞區號', '地址'],
    products: ['商品代號', '商品名稱', '險種', '繳費年期', '起售日', '停售日', '替代代號'],
    control: ['來源系統', '項目代號', '項目名稱', '期間', '筆數', '金額'],
    statement: ['科目代號', '科目名稱', '期初餘額', '本期增加', '本期減少', '期末餘額'],
  };
  // 一定要有的欄位 (其餘沒有時補空白)
  const NEED = {
    customers: ['保單編號', '保單序號', '角色', '證件編號', '姓名', '出生日期', '性別'],
    products: ['商品代號', '商品名稱', '險種', '停售日'],
    control: ['項目代號', '期間', '筆數', '金額'],
    statement: ['科目代號', '科目名稱', '期初餘額', '期末餘額'],
  };
  // 常見的同義欄位名稱
  const SYN = { 保單號碼: '保單編號', 保單號: '保單編號', 身分證號: '證件編號', 身分證字號: '證件編號', 身分證統一編號: '證件編號', 證號: '證件編號',
    出生年月日: '出生日期', 生日: '出生日期', 聯絡地址: '地址', 住址: '地址', 通訊地址: '地址', 會計科目代碼: '科目代號', 科目代碼: '科目代號', 會計科目代號: '科目代號',
    會計科目名稱: '科目名稱', 會計科目: '科目名稱', 停售日期: '停售日', 起售日期: '起售日', 險別: '險種', 資料總筆數: '筆數', 總筆數: '筆數', 件數: '筆數',
    資料總金額: '金額', 總金額: '金額', 系統名稱: '來源系統', 系統: '來源系統', 生效日期: '保險期間起日', 保單生效日: '保險期間起日', 契約生效日: '保險期間起日' };
  const half = v => String(v == null ? '' : v).replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/　/g, ' ');
  const norm = h => half(h).replace(/^﻿/, '').trim().replace(/\s+/g, '');
  const bare = h => norm(h).replace(/[(（][^)）]*[)）]/g, '');   // 去掉括號裡的說明，例：角色(要保人/被保險人) → 角色
  // 目標欄位：申報明細檔用欄位定義 (名稱或英文代號)，其他資料用 COLS
  function targets(slot) {
    const lay = slot === 'prior' ? L : all.layouts[slot];
    if (lay && lay.fields) return lay.fields.map(f => ({ name: f.name, keys: [norm(f.name), norm(f.key)], f }));
    return (COLS[slot] || []).map(n => ({ name: n, keys: [norm(n)] }));
  }
  // 使用者的欄位名稱對到第幾個目標欄位
  function mapHead(slot, head) {
    const t = targets(slot), idx = new Map();
    t.forEach((x, j) => x.keys.forEach(k => { if (!idx.has(k)) idx.set(k, j); }));
    const used = new Set();
    return (head || []).map(h => {
      for (const c of [norm(h), bare(h), SYN[norm(h)], SYN[bare(h)]].filter(Boolean)) {
        const j = idx.get(norm(c));
        if (j != null && !used.has(j)) { used.add(j); return j; }
      }
      return -1;
    });
  }
  // 日期：2025/1/1、2025-01-01、2025.1.1、民國 114/1/1、1140101、Excel 的日期格子 (序號) → 20250101
  function toYmd(v) {
    const s = half(v).trim().replace(/^(民國|中華民國)/, '');
    if (!s || /^\d{8}$/.test(s)) return s;
    if (/^\d{5}(\.\d+)?$/.test(s) && +s >= 10000 && +s <= 80000) return new Date(Date.UTC(1899, 11, 30) + Math.floor(+s) * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
    let m = s.match(/^(\d{2,4})[/\-.年](\d{1,2})[/\-.月](\d{1,2})日?$/);
    if (m) return String(m[1].length <= 3 ? +m[1] + 1911 : +m[1]) + m[2].padStart(2, '0') + m[3].padStart(2, '0');
    m = s.match(/^(\d{3})(\d{2})(\d{2})$/);
    if (m) return String(+m[1] + 1911) + m[2] + m[3];
    return s;
  }
  const isDate = x => x.f ? /Date$|^birthDate$/.test(x.f.key) : /^(出生日期|起售日|停售日)$/.test(x.name);
  const isSex = x => (x.f ? x.f.key === 'sex' : x.name === '性別');
  // 表格 (第一列是欄位名稱) 改成這份資料的標準格式。回傳 { rows, notes } 或 { problem }
  function normalize(slot, aoa) {
    const head = (aoa[0] || []).map(v => String(v == null ? '' : v));
    const t = targets(slot), map = mapHead(slot, head);
    const lay = slot === 'prior' ? L : all.layouts[slot];
    const data = aoa.slice(1).filter(r => r.some(c => String(c == null ? '' : c).trim() !== ''));
    // 沒有標題列 (第一列就是資料)、欄位數剛好等於申報格式：照欄位順序讀，不調整
    if (lay && lay.fields && head.length === lay.fields.length && !/[一-鿿]/.test(head.join('')) && map.every(j => j < 0)) return { rows: aoa, notes: [] };
    // 資產負債表只有「本期增減」：正數放增加、負數放減少
    const net = slot === 'statement' ? head.findIndex(h => /^本期增減/.test(bare(h))) : -1;
    const hit = new Set(map.filter(j => j >= 0));
    const name = slot === 'prior' ? '去年保單資料' : NAMES[slot];
    if (lay && lay.fields) {
      if (hit.size < lay.fields.length * 0.5) {
        const miss = t.filter((x, j) => !hit.has(j));
        return { problem: `欄位對不上「${name}」的申報格式：需要 ${t.length} 個欄位，這張只對到 ${hit.size} 個（缺 ${miss.slice(0, 4).map(x => x.name).join('、')} 等），無法自動補齊` };
      }
    } else {
      const have = new Set([...hit].map(j => t[j].name)); if (net >= 0) { have.add('本期增加'); have.add('本期減少'); }
      const miss = (NEED[slot] || []).filter(n => !have.has(n));
      if (miss.length) return { problem: `欄位對不上「${name}」的格式：缺 ${miss.join('、')}，無法自動補齊` };
    }
    const notes = [], renamed = [], filled = [];
    head.forEach((h, i) => { const j = map[i]; if (j >= 0 && norm(h) !== t[j].keys[0] && norm(h) !== (t[j].keys[1] || '')) renamed.push(`${String(h).trim()}→${t[j].name}`); });
    t.forEach((x, j) => { if (!hit.has(j) && !(net >= 0 && /^本期(增加|減少)$/.test(x.name))) filled.push(x.name); });
    const cnt = { date: 0, code: 0, num: 0, net: 0 };
    const col = new Map(map.map((j, i) => [j, i]));
    const rows = data.map(r => t.map((x, j) => {
      if (net >= 0 && (x.name === '本期增加' || x.name === '本期減少') && !col.has(j)) {
        const v = Number(String(r[net] == null ? '' : r[net]).replace(/,/g, '')); if (!Number.isFinite(v)) return '';
        cnt.net += x.name === '本期增加' ? 1 : 0; return String(x.name === '本期增加' ? Math.max(v, 0) : Math.max(-v, 0));
      }
      if (!col.has(j)) return lay ? ' ' : '';   // 缺的欄位補空白 (檢查時會標出來)
      const raw = r[col.get(j)], s0 = String(raw == null ? '' : raw);
      let v = s0;
      if (isDate(x)) v = toYmd(s0);
      else if (isSex(x)) v = ({ 男: '1', 女: '2', M: '1', F: '2' })[s0.trim()] || s0;
      else if (x.name === '角色') v = ({ 要保人: '1', 被保險人: '2' })[s0.trim()] || s0;
      else if (x.f && x.f.type === '9' && /^[\d,，]+$/.test(s0.trim()) && /[,，]/.test(s0)) v = s0.replace(/[,，]/g, '').trim();
      if (v !== s0) cnt[isDate(x) ? 'date' : x.f && x.f.type === '9' && !isSex(x) ? 'num' : 'code']++;
      return v;
    }));
    if (renamed.length) notes.push(`欄位名稱 ${renamed.length} 個（${renamed.slice(0, 3).join('、')}${renamed.length > 3 ? ' 等' : ''}）`);
    if (cnt.date) notes.push(`日期格式 ${cnt.date} 格`);
    if (cnt.code) notes.push(`男女、角色改代碼 ${cnt.code} 格`);
    if (cnt.num) notes.push(`去掉千分位 ${cnt.num} 格`);
    if (cnt.net) notes.push(`「本期增減」拆成本期增加、本期減少（${cnt.net} 列）`);
    if (filled.length && lay) notes.push(`缺 ${filled.length} 個欄位已補空白（檢查時會標出）`);
    return { rows: [t.map(x => x.name)].concat(rows), notes };
  }
  const toCsvText = rows => rows.map(r => r.map(v => { v = String(v == null ? '' : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n') + '\n';
  // CSV 文字版：回傳 { text, notes } 或 { problem }
  function normalizeCsv(slot, text) {
    const n = normalize(slot, C.parseCSV(String(text).replace(/^﻿/, '')));
    return n.problem ? n : { text: toCsvText(n.rows), notes: n.notes };
  }
  // 相容舊介面：欄位對不上時回傳原因
  function headProblem(slot, head) { return normalize(slot, [head || []]).problem || ''; }
  // 名稱看不出是哪一份資料時，看欄位最多對得上哪一種申報明細檔 (至少一半)
  function guessByHead(head, slots) {
    let best = null, bs = 0;
    for (const k of slots) { const t = targets(k); if (!t.length) continue; const sc = mapHead(k, head).filter(j => j >= 0).length / t.length; if (sc >= 0.5 && sc > bs) { best = k; bs = sc; } }
    return best;
  }
  // 依工作表名稱分配，名稱不符時依標題列判斷：回傳 { slot: csv文字 } 與 { slot: 工作表名稱 }
  // 兩張工作表都像保單資料、又沒有名稱可判斷時，日期較早的那張當作去年保單資料
  // 只有標題列 (例如還沒填的空白範本) 的工作表視為沒有資料，列在 blank
  // 錯誤解答 (試用資料附的「刻意放了哪些錯誤」)：不是申報資料，用來對照檢查結果。
  // 第一列要有「檢核編號」，以及「保單」「案例」或「預期問題說明」其中之一 (試用資料的錯誤解答 CSV／工作表就是這個格式)
  function isAnswerKey(head) {
    const h = (head || []).map(v => String(v == null ? '' : v).replace(/\s+/g, ''));
    return h.includes('檢核編號') && h.some(v => /保單|案例|預期問題/.test(v));
  }
  // 回傳 [{ category, file, ruleId, policy, desc }]；policy 只取保單號碼／序號 (例如 P250000001/A01)
  function answerKey(aoa) {
    const h = (aoa[0] || []).map(v => String(v == null ? '' : v).replace(/\s+/g, ''));
    const at = re => h.findIndex(v => re.test(v));
    const c = { cat: at(/^分類/), file: at(/資料檔|檔別/), rule: at(/^檢核編號/), pol: at(/保單|案例/), desc: at(/預期問題|問題說明|說明/) };
    const get = (r, k) => c[k] >= 0 ? String(r[c[k]] == null ? '' : r[c[k]]).trim() : '';
    return aoa.slice(1).filter(r => r && r.some(v => String(v == null ? '' : v).trim())).map(r => ({
      category: get(r, 'cat'), file: get(r, 'file'), ruleId: get(r, 'rule'), policy: get(r, 'pol'), desc: get(r, 'desc'),
    }));
  }
  // 對照：每一項錯誤解答在檢查結果裡有沒有找到 (檢核編號相同；有寫保單時保單也要相同)
  function checkAnswers(key, issues) {
    const pol = i => String(i.policy || i.code || '').trim();
    const rows = key.map(k => {
      if (!k.ruleId) return Object.assign({ status: 'manual' }, k);
      const hit = issues.some(i => i.ruleId === k.ruleId && (!k.policy || pol(i) === k.policy));
      return Object.assign({ status: hit ? 'found' : 'missing' }, k);
    });
    return { rows, total: rows.filter(r => r.status !== 'manual').length, found: rows.filter(r => r.status === 'found').length, manual: rows.filter(r => r.status === 'manual').length };
  }
  function slots(XLSX, wb) {
    const got = {}, from = {}, unknown = [], blank = [], skipped = [], fixed = {};   // skipped：沒有用到的工作表 (名稱、原因)；fixed：自動調整了什麼
    const aoaOf = name => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false, raw: true, defval: '' });
    const take = (slot, name) => {
      const n = normalize(slot, aoaOf(name));
      if (n.problem) { skipped.push({ name, why: n.problem }); return; }
      if (n.rows.length < 2) { blank.push(name); return; }
      got[slot] = toCsvText(n.rows); from[slot] = name; if (n.notes.length) fixed[slot] = n.notes;
    };
    for (const name of wb.SheetNames) {
      const hit = SHEET_SLOT.find(([k]) => name.includes(k));
      if (hit && !got[hit[1]]) take(hit[1], name);
      else if (!hit) unknown.push(name);
      else skipped.push({ name, why: `和「${from[hit[1]]}」是同一種資料，只用第一張` });
    }
    for (const name of unknown) {
      const head = (aoaOf(name)[0] || []).map(String);
      let slot = bySignature(head.map(bare).concat(head.map(h => SYN[bare(h)]).filter(Boolean), head.map(norm))) || guessByHead(head, ['L', 'D', ...EXT]);
      if (slot === 'L' && got.L) slot = got.prior ? null : 'prior';
      if (slot && !got[slot]) take(slot, name);
      else skipped.push({ name, why: slot ? '同一種資料已經有一張' : '不是申報資料（例如說明頁）' });
    }
    if (got.L && got.prior && !SHEET_SLOT.some(([k, v]) => v === 'prior' && from.prior.includes(k))) {
      const lastYear = csvText => { const r = C.parseFixedWidth(C.csvToFixedWidth(csvText, L), L).records; return r.map(x => x.startDate).filter(d => C.isValidDate(d)).sort().pop() || ''; };
      if (lastYear(got.prior) > lastYear(got.L)) { [got.L, got.prior] = [got.prior, got.L]; [from.L, from.prior] = [from.prior, from.L]; [fixed.L, fixed.prior] = [fixed.prior, fixed.L]; }
    }
    return { got, from, blank, skipped, fixed };
  }


  // 由承保資料推得公司代號與填報年度，產生符合命名原則的檔名 (對帳依填報年度彙總)
  function files(got) {
    let co = '01', year = String(new Date().getFullYear() - 1);
    if (got.L) {
      const r = C.parseFixedWidth(C.csvToFixedWidth(got.L, L), L).records;
      if (r[0]) co = r[0].company;
      const ys = r.flatMap(x => [x.addDate, x.exitDate]).filter(d => C.isValidDate(d)).map(d => d.slice(0, 4));
      if (ys.length) year = ys.sort().pop();
    }
    // 癌症險、傷害險：公司代號與年度取自自己的保單資料 (檔名規則：前綴＋填報年度＋公司代號)
    const ext = k => { const lay = all.layouts[k[0] === 'C' ? 'CL' : 'AL'], t = got[k[0] === 'C' ? 'CL' : 'AL']; if (!t || !lay) return [co, year]; const r = C.parseFixedWidth(C.csvToFixedWidth(t, lay), lay).records[0]; return r ? [r.company, (r.addYear || r.year || year)] : [co, year]; };
    const names = { CL: `CRL${ext('CL')[1]}${ext('CL')[0]}.txt`, CD: `CRD${ext('CD')[1]}${ext('CD')[0]}.txt`, AL: `PAL${ext('AL')[1]}${ext('AL')[0]}.txt`, AD: `PAD${ext('AD')[1]}${ext('AD')[0]}.txt`, L: `LFL${co}_${year}.txt`, D: `LFD${co}_${year}.txt`, prior: `LFL${co}_${year - 1}.txt`, control: `控制總數_${year}.csv`, statement: `資產負債表_${year}.csv`, products: `商品資料_${year}.csv`, customers: `客戶資料_${year}.csv` };
    const out = {};
    for (const [slot, text] of Object.entries(got)) {
      const lay = slot === 'D' ? D : (slot === 'L' || slot === 'prior') ? L : EXT.includes(slot) ? all.layouts[slot] : null;
      out[slot] = { name: names[slot], text: lay ? C.csvToFixedWidth(text, lay) : text, fromSheet: true };
    }
    return out;
  }

  // .xlsx / .ods / .docx 是 ZIP 壓縮檔：交給 Excel 元件解析 (XLSX.read) 之前，先只讀壓縮檔的目錄做預檢 (不實際解壓)。
  // 小檔案解開後膨脹成幾 GB 的「壓縮炸彈」、或特製的目錄 (長度、位置對不上、互相重疊) 會讓瀏覽器卡死或判讀錯誤：
  // 任何一項不通過就不解析。上限依實測：1 萬張保單的 Excel 檔 7.3 MB、解開後 98 MB (最大的工作表 48 MB)、
  // 壓縮比約 13 倍，讀取時記憶體高峰約 380 MB；試用資料的壓縮比 9–12 倍。
  const ZIP_LIMITS = Object.freeze({
    maxArchive: 50 * 1048576,    // 壓縮檔本身
    maxTotal: 100 * 1048576,     // 解開後的總大小
    maxEntry: 50 * 1048576,      // 單一項目解開後的大小
    maxEntries: 2000,            // 項目數 (一般 Excel 檔約 20–40 個)
    maxRatio: 100,               // 壓縮比 (整個檔案，以及解開後超過 1 MB 的單一項目)
    ratioFloor: 1048576,         // 單一項目小於這個大小時不看壓縮比 (很小的 XML 壓縮比本來就高)
  });
  const SIG = { local: 0x04034b50, central: 0x02014b50, eocd: 0x06054b50, zip64eocd: 0x06064b50, zip64loc: 0x07064b50 };
  const MB = n => `${Math.round(n / 1048576 * 10) / 10} MB`;
  // 回傳 null (不是 ZIP，例如舊版 .xls)、{ bad: 原因 }，或 { entries, total, compressed, ratio, maxEntry, maxRatio }
  function zipStats(buf, limits) {
    // 讀到檔案範圍外 (特製或截斷的檔案) 時 DataView 會丟出例外：一律當成結構不正確、拒絕
    try { return zipStats0(buf, limits); } catch (e) { return { bad: '壓縮檔的結構不正確 (檔案可能不完整或被改過)' }; }
  }
  function zipStats0(buf, limits) {
    const L = Object.assign({}, ZIP_LIMITS, limits);
    const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), len = u8.length;
    if (len < 4 || dv.getUint32(0, true) !== SIG.local) return null;
    if (len > L.maxArchive) return { bad: `壓縮檔本身有 ${MB(len)}，超過 ${MB(L.maxArchive)}` };
    if (len < 22) return { bad: '壓縮檔不完整 (太短)' };
    // 目錄結尾 (EOCD)：從檔尾往前找，後面只能接它自己的註解
    let eocd = -1;
    for (let i = len - 22; i >= Math.max(0, len - 22 - 65535); i--) if (dv.getUint32(i, true) === SIG.eocd && i + 22 + dv.getUint16(i + 20, true) === len) { eocd = i; break; }
    if (eocd < 0) return { bad: '找不到壓縮檔目錄，或目錄後面有多餘的資料 (檔案可能不完整或被改過)' };
    if (eocd >= 20 && dv.getUint32(eocd - 20, true) === SIG.zip64loc) return { bad: '使用超大型壓縮格式 (ZIP64)，工具不支援' };
    const disk = dv.getUint16(eocd + 4, true), cdDisk = dv.getUint16(eocd + 6, true), here = dv.getUint16(eocd + 8, true), entries = dv.getUint16(eocd + 10, true);
    const cdSize = dv.getUint32(eocd + 12, true), cdOff = dv.getUint32(eocd + 16, true);
    if (entries === 0xffff || here === 0xffff || cdSize === 0xffffffff || cdOff === 0xffffffff) return { bad: '使用超大型壓縮格式 (ZIP64)，工具不支援' };
    if (disk !== 0 || cdDisk !== 0 || here !== entries) return { bad: '分割成多個檔案的壓縮檔，工具不支援' };
    if (!entries) return { bad: '壓縮檔是空的' };
    if (entries > L.maxEntries) return { bad: `內含 ${entries} 個項目，超過 ${L.maxEntries} 個` };
    if (cdOff + cdSize !== eocd) return { bad: '壓縮檔目錄的位置或長度對不上 (檔案可能不完整或被改過)' };
    let p = cdOff, total = 0, compressed = 0, maxEntry = 0, maxRatio = 0;
    const spans = [], names = new Set();
    for (let n = 0; n < entries; n++) {
      if (p + 46 > eocd || dv.getUint32(p, true) !== SIG.central) return { bad: '壓縮檔目錄不完整' };
      const flags = dv.getUint16(p + 8, true), method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
      const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true), loc = dv.getUint32(p + 42, true);
      const end = p + 46 + nlen + xlen + clen;
      if (end > eocd) return { bad: '壓縮檔目錄的項目長度超出範圍' };
      if (csize === 0xffffffff || usize === 0xffffffff || loc === 0xffffffff) return { bad: '使用超大型壓縮格式 (ZIP64)，工具不支援' };
      for (let x = p + 46 + nlen; x + 4 <= p + 46 + nlen + xlen; x += 4 + dv.getUint16(x + 2, true)) if (dv.getUint16(x, true) === 0x0001) return { bad: '使用超大型壓縮格式 (ZIP64)，工具不支援' };
      if (flags & 1) return { bad: '壓縮檔有密碼保護' };
      if (method !== 0 && method !== 8) return { bad: `使用不支援的壓縮方式 (${method})` };
      if (method === 0 && csize !== usize) return { bad: '未壓縮項目的大小對不上' };
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
      if (names.has(name)) return { bad: `壓縮檔裡有重複的項目「${name.slice(0, 40)}」` };
      names.add(name);
      // 對應的檔案標頭 (local header) 要在目錄之前、位置正確，資料不能超出範圍
      if (loc + 30 > cdOff || dv.getUint32(loc, true) !== SIG.local) return { bad: '壓縮檔項目的位置對不上 (檔案可能不完整或被改過)' };
      const data = loc + 30 + dv.getUint16(loc + 26, true) + dv.getUint16(loc + 28, true);
      if (data + csize > cdOff) return { bad: '壓縮檔項目的長度超出範圍 (檔案可能不完整或被改過)' };
      spans.push([loc, data + csize]);
      if (usize > L.maxEntry) return { bad: `其中「${name.slice(0, 40)}」解開後有 ${MB(usize)}，超過單一項目 ${MB(L.maxEntry)}` };
      const r = usize / Math.max(1, csize);
      if (usize >= L.ratioFloor && r > L.maxRatio) return { bad: `其中「${name.slice(0, 40)}」的壓縮比約 ${Math.round(r).toLocaleString()} 倍，超過 ${L.maxRatio} 倍 (可能是壓縮炸彈)` };
      total += usize; compressed += csize; maxEntry = Math.max(maxEntry, usize); if (usize >= L.ratioFloor) maxRatio = Math.max(maxRatio, r);
      if (total > L.maxTotal) return { bad: `解開後超過 ${MB(L.maxTotal)}` };
      p = end;
    }
    if (p !== eocd) return { bad: '壓縮檔目錄的長度對不上 (檔案可能不完整或被改過)' };
    // 項目的資料不能互相重疊 (重疊是讓少量資料解開很多次的壓縮炸彈手法)
    spans.sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < spans.length; i++) if (spans[i][0] < spans[i - 1][1]) return { bad: '壓縮檔的項目互相重疊 (可能是壓縮炸彈)' };
    const ratio = total / Math.max(1, len);
    if (total >= L.ratioFloor && ratio > L.maxRatio) return { bad: `解開後有 ${MB(total)}，壓縮比約 ${Math.round(ratio).toLocaleString()} 倍，超過 ${L.maxRatio} 倍 (可能是壓縮炸彈)` };
    return { entries, total, compressed, ratio, maxEntry, maxRatio };
  }
  // Excel 讀取元件 (SheetJS) 的版本檢查：0.18.5 有已知的特製檔案解析風險 (原型污染 CVE-2023-30533 於 0.19.3 修補、
  // 正規表示式阻斷 CVE-2024-22363 於 0.20.2 修補)，官方修補版本至少要 0.20.3。回傳 { version, ok }
  const XLSX_MIN = '0.20.3';
  const verNum = v => String(v || '0').split('.').map(n => parseInt(n, 10) || 0);
  function libStatus(X) {
    const v = X && X.version ? String(X.version) : '', a = verNum(v), b = verNum(XLSX_MIN);
    let ok = !!v;
    for (let i = 0; ok && i < 3; i++) { if (a[i] > b[i]) break; if (a[i] < b[i]) ok = false; }
    return { version: v || '（沒有載入）', ok, min: XLSX_MIN };
  }
  // 預檢結果：'' 表示通過 (或不是 ZIP)，其他是拒絕的原因
  function zipProblem(buf, limits) {
    const z = zipStats(buf, limits);
    return z && z.bad ? z.bad : '';
  }
  return { SHEET_SLOT, NAMES, sheets, extSheets, slots, files, headProblem, normalize, normalizeCsv, guessByHead, toYmd, zipStats, zipProblem, ZIP_LIMITS, libStatus, XLSX_MIN, isAnswerKey, answerKey, checkAnswers };
});
