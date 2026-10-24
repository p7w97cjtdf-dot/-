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
  // 標題列要符合這份資料的格式：申報明細檔 (保單、理賠…) 至少八成欄位名稱對得上；其他資料要有工具會用到的欄位。
  // 名稱對、欄位不對 (例如自己整理的摘要表) 的工作表不採用，並列出缺了哪些欄位
  const NEED = {
    customers: ['保單編號', '保單序號', '角色', '證件編號', '姓名', '出生日期', '性別'],
    products: ['商品代號', '商品名稱', '險種', '停售日'],
    control: ['項目代號', '期間', '筆數', '金額'],
    statement: ['科目代號', '科目名稱', '期初餘額', '本期增加', '本期減少', '期末餘額'],
  };
  const norm = h => String(h == null ? '' : h).replace(/^\uFEFF/, '').trim().replace(/（/g, '(').replace(/）/g, ')').replace(/\s+/g, '');
  function headProblem(slot, head) {
    const h = new Set((head || []).map(norm));
    const lay = slot === 'prior' ? L : all.layouts[slot];
    if (lay && lay.fields) {
      // 沒有標題列 (第一列就是資料) 的 CSV：欄位數剛好等於申報格式時照欄位順序讀
      if (head && head.length === lay.fields.length && !/[\u4e00-\u9fff]/.test(head.join(''))) return '';
      const miss = lay.fields.filter(f => !h.has(norm(f.key)) && !h.has(norm(f.name)));
      if (miss.length <= lay.fields.length * 0.2) return '';
      return `欄位對不上「${NAMES[slot]}」的申報格式：需要 ${lay.fields.length} 個欄位，這張只對到 ${lay.fields.length - miss.length} 個（缺 ${miss.slice(0, 4).map(f => f.name).join('、')} 等）`;
    }
    const miss = (NEED[slot] || []).filter(k => !h.has(k));
    return miss.length ? `欄位對不上「${NAMES[slot]}」的格式：缺 ${miss.join('、')}` : '';
  }
  // 依工作表名稱分配，名稱不符時依標題列判斷：回傳 { slot: csv文字 } 與 { slot: 工作表名稱 }
  // 兩張工作表都像保單資料、又沒有名稱可判斷時，日期較早的那張當作去年保單資料
  // 只有標題列 (例如還沒填的空白範本) 的工作表視為沒有資料，列在 blank
  function slots(XLSX, wb) {
    const got = {}, from = {}, unknown = [], blank = [], skipped = [];   // skipped：沒有用到的工作表 (名稱、原因)
    const toCsv = name => XLSX.utils.sheet_to_csv(wb.Sheets[name], { blankrows: false, rawNumbers: true });
    const headOf = name => (XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, blankrows: false })[0]) || [];
    const hasRows = csv => csv.split(/\r?\n/).filter(l => l.replace(/,/g, '').trim()).length > 1;
    for (const name of wb.SheetNames) {
      const hit = SHEET_SLOT.find(([k]) => name.includes(k));
      const bad = hit && !got[hit[1]] ? headProblem(hit[1], headOf(name)) : '';
      if (bad) skipped.push({ name, why: bad });
      else if (hit && !got[hit[1]]) { const c = toCsv(name); if (hasRows(c)) { got[hit[1]] = c; from[hit[1]] = name; } else blank.push(name); }
      else if (!hit) unknown.push(name);
      else skipped.push({ name, why: `和「${from[hit[1]]}」是同一種資料，只用第一張` });
    }
    for (const name of unknown) {
      const head = headOf(name);
      let slot = bySignature(head);
      if (slot && headProblem(slot, head)) slot = null;
      if (slot === 'L' && got.L) slot = got.prior ? null : 'prior';
      if (slot && !got[slot]) { const c = toCsv(name); if (hasRows(c)) { got[slot] = c; from[slot] = name; } else blank.push(name); }
      else skipped.push({ name, why: slot ? '同一種資料已經有一張' : '不是申報資料（例如說明頁）' });
    }
    if (got.L && got.prior && !SHEET_SLOT.some(([k, v]) => v === 'prior' && from.prior.includes(k))) {
      const lastYear = csvText => { const r = C.parseFixedWidth(C.csvToFixedWidth(csvText, L), L).records; return r.map(x => x.startDate).filter(d => C.isValidDate(d)).sort().pop() || ''; };
      if (lastYear(got.prior) > lastYear(got.L)) { [got.L, got.prior] = [got.prior, got.L]; [from.L, from.prior] = [from.prior, from.L]; }
    }
    return { got, from, blank, skipped };
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

  // .xlsx 是壓縮檔：讀取前先看壓縮檔目錄，算出解開後的總大小與檔案數 (不實際解壓)。
  // 小檔案解開後膨脹成幾 GB 的「壓縮炸彈」會讓瀏覽器卡死，超過上限就不讀取。不是 ZIP 格式 (例如舊版 .xls) 回傳 null
  const ZIP_MAX_BYTES = 800 * 1048576, ZIP_MAX_ENTRIES = 5000;
  function zipStats(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    if (u8.length < 22 || dv.getUint32(0, true) !== 0x04034b50) return null;
    let eocd = -1;
    for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) return { bad: '找不到壓縮檔目錄' };
    const entries = dv.getUint16(eocd + 10, true), cdOff = dv.getUint32(eocd + 16, true);
    if (entries === 0xffff || cdOff === 0xffffffff) return { bad: '超大型壓縮格式 (ZIP64)' };
    let p = cdOff, total = 0, n = 0;
    while (n < entries && p + 46 <= u8.length && dv.getUint32(p, true) === 0x02014b50) {
      const size = dv.getUint32(p + 24, true);
      if (size === 0xffffffff) return { bad: '超大型壓縮格式 (ZIP64)' };
      total += size; n++;
      p += 46 + dv.getUint16(p + 28, true) + dv.getUint16(p + 30, true) + dv.getUint16(p + 32, true);
    }
    if (n !== entries) return { bad: '壓縮檔目錄不完整' };
    return { entries: n, total, ratio: total / Math.max(1, u8.length) };
  }
  function zipProblem(buf) {
    const z = zipStats(buf);
    if (!z) return '';
    if (z.bad) return z.bad;
    if (z.entries > ZIP_MAX_ENTRIES) return `內含 ${z.entries} 個檔案，超過 ${ZIP_MAX_ENTRIES} 個`;
    if (z.total > ZIP_MAX_BYTES) return `解開後有 ${Math.round(z.total / 1048576)} MB，超過 ${ZIP_MAX_BYTES / 1048576} MB`;
    return '';
  }
  return { SHEET_SLOT, NAMES, sheets, extSheets, slots, files, headProblem, zipStats, zipProblem };
});
