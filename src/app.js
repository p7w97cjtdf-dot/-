/* 介面控制 */
(function () {
  'use strict';
  const { DQ } = window;
  // BASE：內建規則；rs：加上自訂規則與法規更新包之後實際使用的規則 (每次檢查前重算)
  const BASE = DQ.rulesets.all, fin = DQ.rulesets.finance, R = DQ.recon;
  let rs = BASE;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LB = DQ.labels, SEV = LB.SEV, SHEET = LB.SHEET;
  const yuan = R.yuan;
  let INTRO = '檢查已完成。按「請 AI 整理重點」，AI 會用白話說明問題主要出在哪裡、先改什麼，以及被退件的可能性。';

  const state = { files: {}, res: null, sel: null, cat: '', customRules: [], audit: [] };
  // 稽核軌跡：放入哪些檔案、檢查結果、改了哪些值、下載了什麼 (含檔案內容的 SHA-256，可事後比對檔案有沒有被動過)
  // 只存在這個畫面，關掉就沒有；匯出時遮蔽個資
  function audit(action, detail, hashOf) {
    const e = { at: new Date(), action, detail, sha: '' };
    state.audit.push(e);
    if (typeof hashOf === 'string' && window.crypto && crypto.subtle) sha256(hashOf).then(h => { e.sha = h; }).catch(() => {});
  }
  // 匯入並套用的規則與內建規則合併
  function activeRules() {
    const base = state.customRules.length ? DQ.dsl.extend(BASE, state.customRules) : BASE;
    const out = DQ.rulePacks.apply(base, state.packs.filter(x => x.on).map(x => x.pack));
    state.disabled = out.disabled;
    return (rs = out.ruleset);
  }
  // 法規更新包 (src/rule-packs.js)：存在這台電腦的瀏覽器
  state.packs = [];
  try { const saved = JSON.parse(localStorage.getItem('dq-rule-packs') || '[]'); if (Array.isArray(saved)) state.packs = saved.filter(x => x && x.pack).map(x => ({ pack: DQ.rulePacks.normalize(x.pack), on: x.on !== false, imported: !!x.imported })); } catch (e) { /* 無法讀取時忽略 */ }
  // 官方發布的更新包 (rules/updates/index.json)：打開工具時自動下載並套用，不存進瀏覽器；使用者可在本機關閉
  const officialOff = () => { try { return new Set(JSON.parse(localStorage.getItem('dq-official-off') || '[]')); } catch (e) { return new Set(); } };
  const offKey = p => `${p.id}@${p.version || ''}`;
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // 停用的檢查隱藏了多少問題 (結果畫面與報告都要寫出來，不讓問題「默默消失」)
  function hiddenNote() {
    const h = state.disabledCount || {}, ids = Object.keys(h), n = ids.reduce((t, k) => t + h[k], 0);
    return n ? `注意：法規更新停用了 ${ids.length} 項檢查（${ids.slice(0, 5).join('、')}${ids.length > 5 ? '…' : ''}），隱藏了 ${n} 個問題；如果更新包的來源不確定，請到「法規更新」關掉後重新檢查。` : '';
  }
  async function loadOfficial() {
    const bases = location.protocol.startsWith('http') ? [''] : [];
    bases.push('https://p7w97cjtdf-dot.github.io/-/');  // 單一檔案的線上版：改從公開網站讀取
    for (const b of bases) {
      try {
        const idx = await (await fetch(b + 'rules/updates/index.json', { cache: 'no-cache' })).json();
        const packs = [];
        state.officialRejected = [];
        for (const ent of idx.packs || []) {
          // index.json 的每一項可以是檔名，或 { file, sha256 }：有 sha256 時內容必須完全相同 (被改過就不套用)
          const f = typeof ent === 'string' ? ent : ent && ent.file, want = ent && ent.sha256;
          try {
            const text = await (await fetch(b + 'rules/updates/' + encodeURIComponent(f), { cache: 'no-cache' })).text();
            if (want && await sha256(text) !== String(want).toLowerCase()) { state.officialRejected.push(`${f}：內容和發布時登記的雜湊值不同`); continue; }
            const p = DQ.rulePacks.normalize(JSON.parse(text), f);
            const v = DQ.rulePacks.validate(p, Object.assign({}, BASE, { catalog: BASE.catalog.concat(DQ.rulesets.finance.catalog, DQ.master.catalog, DQ.anomaly.catalog) }), packs);
            if (v.errors.length) { state.officialRejected.push(`${f}：${v.errors.join('；')}`); continue; }
            packs.push(p);
          } catch (e) { /* 單一檔案讀不到就略過 */ }
        }
        const off = officialOff();
        state.packs = packs.map(p => ({ pack: p, on: !off.has(offKey(p)), official: true })).concat(state.packs.filter(x => !x.official && !packs.some(p => p.id === x.pack.id)));
        state.officialLoaded = { at: new Date(), count: packs.length };
        // 第一次看到某版官方更新時提示一次
        let seen; try { seen = new Set(JSON.parse(localStorage.getItem('dq-official-seen') || '[]')); } catch (e) { seen = new Set(); }
        const fresh = packs.filter(p => !seen.has(offKey(p)));
        if (fresh.length) {
          $('#update-notice').hidden = false;
          $('#update-notice').innerHTML = `已自動套用最新法規更新：${fresh.map(p => esc(p.name + (p.version ? ` 第 ${p.version} 版` : '') + (p.basis ? `（${p.basis}）` : ''))).join('、')}。<a href="#updates" data-goto="updates">查看內容</a>`;
          try { localStorage.setItem('dq-official-seen', JSON.stringify([...seen, ...fresh.map(offKey)])); } catch (e) { /* ignore */ }
        }
        if (DQ.app && DQ.app.setPacks) DQ.app.setPacks(state.packs);
        return;
      } catch (e) { /* 這個位置讀不到，換下一個 */ }
    }
  }
  try { const saved = JSON.parse(localStorage.getItem('dq-custom-rules') || '[]'); if (Array.isArray(saved)) state.customRules = saved.filter(r => !DQ.dsl.validateRule(r, BASE.layouts).length); } catch (e) { /* 無法讀取時忽略 */ }

  // ---------- 檔案 ----------
  const SLOTS = ['L', 'D', 'prior', 'control', 'statement', 'products', 'customers', 'CL', 'CD', 'AL', 'AD'];
  const DETAIL = ['L', 'D', 'CL', 'CD', 'AL', 'AD'];  // 固定長度的明細檔 (依規則集檢查)
  function setFile(fid, name, text, fromSheet) {
    if (DETAIL.includes(fid) && /\.csv$/i.test(name)) { text = DQ.csvToFixedWidth(text, rs.layouts[fid]); name = name.replace(/\.csv$/i, '.txt'); }
    state.files[fid] = { name, text, fromSheet: !!fromSheet };
    audit('放入資料', `${SLOT_NAME[fid] || fid}：${name}（${text.split(/\r?\n/).filter(Boolean).length.toLocaleString()} 行）`, text);
    $('#name-' + fid).textContent = name;
  }
  function guessSlot(name, fallback) {
    if (/^CRL/i.test(name) || /癌症.*(保單|承保)/.test(name)) return 'CL';
    if (/^CRD/i.test(name) || /癌症.*(理賠|給付)/.test(name)) return 'CD';
    if (/^PAL/i.test(name) || /傷害.*(保單|承保)/.test(name)) return 'AL';
    if (/^PAD/i.test(name) || /傷害.*(理賠|給付)/.test(name)) return 'AD';
    if (/^LFD/i.test(name) || /理賠|給付|claim/i.test(name)) return 'D';
    if (/去年|上年度|prior/i.test(name)) return 'prior';
    if (/^LFL/i.test(name)) { const y = name.match(/_(\d{4})/), cur = state.files.L && state.files.L.name.match(/_(\d{4})/); return y && cur && +y[1] < +cur[1] ? 'prior' : 'L'; }
    if (/^(保單|承保)|policy/i.test(name)) return 'L';
    if (/控制|系統總數|control/i.test(name)) return 'control';
    if (/商品|product/i.test(name)) return 'products';
    if (/客戶|customer/i.test(name)) return 'customers';
    if (/資產負債|財報|statement|balance/i.test(name)) return 'statement';
    return fallback;
  }
  // Excel 活頁簿：依工作表名稱分配到各檔案 (src/workbook.js)
  const BOOK = /\.(xlsx|xlsm|xls|ods)$/i;
  async function readWorkbook(file) {
    if (!window.XLSX) { $('#sample-note').textContent = '讀取 Excel 的元件沒有載入成功：工具的 vendor 資料夾可能不完整。請重新下載整個工具資料夾，或改用網址開啟。'; return; }
    let wb;
    const buf = await file.arrayBuffer();
    try { wb = XLSX.read(buf, { type: 'array' }); }
    catch (e) { $('#sample-note').textContent = `「${file.name}」無法開啟：檔案可能已損毀或設有密碼。請在 Excel 打開後另存新檔（.xlsx，不設密碼）再試一次。`; return; }
    const { got, from, blank } = DQ.workbook.slots(XLSX, wb);
    if (!got.L && !got.D && blank.length) { $('#sample-note').textContent = `「${file.name}」的工作表只有標題列、還沒有資料。請從第二列開始填入保單資料或理賠資料，再放進來。`; return; }
    if (!Object.keys(got).length) { $('#sample-note').textContent = `「${file.name}」裡找不到可以辨識的工作表。工作表名稱需包含：保單資料、理賠資料、客戶資料、商品資料、去年保單資料、系統總數或資產負債表`; return; }
    const fs = DQ.workbook.files(got);
    for (const [slot, f] of Object.entries(fs)) { state.files[slot] = f; $('#name-' + slot).textContent = `工作表「${from[slot]}」`; }
    audit('放入資料', `${file.name}：${Object.keys(fs).map(k => `${from[k]}（${fs[k].text.split(/\r?\n/).filter(Boolean).length.toLocaleString()} 行）`).join('、')}`, null);
    const entry = state.audit[state.audit.length - 1];
    if (window.crypto && crypto.subtle) crypto.subtle.digest('SHA-256', buf).then(b => { entry.sha = [...new Uint8Array(b)].map(v => v.toString(16).padStart(2, '0')).join(''); }).catch(() => {});
    state.key = state.reconKey = state.masterKey = state.anomalyKey = null;
    $('#sample-note').textContent = `已讀取「${file.name}」的 ${Object.keys(got).length} 張工作表：${Object.keys(got).map(k => from[k]).join('、')}`;
    run();
  }
  // 文字檔與 CSV：先當 UTF-8 讀，失敗時改用 Big5 (Windows 的 Excel「另存 CSV」預設是 Big5)
  function decodeText(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, ''); }
    catch (e) { return new TextDecoder('big5').decode(buf); }
  }
  // 申報檔是純文字：前 64KB 出現 NUL 或大量控制字元，就是壓縮檔、圖片等其他檔案 (安全測試 T07)
  function looksBinary(buf) {
    const b = new Uint8Array(buf, 0, Math.min(buf.byteLength, 65536));
    let ctl = 0;
    for (const c of b) { if (c === 0) return true; if (c < 9 || (c > 13 && c < 32)) ctl++; }
    return b.length > 0 && ctl / b.length > 0.01;
  }
  const notText = name => { $('#sample-note').textContent = `「${name}」看起來不是文字檔（可能是壓縮檔、圖片或其他程式的檔案），沒有讀取。申報資料請放 .txt、.csv 或 Excel 檔。`; };
  async function readFile(fid, file) {
    if (BOOK.test(file.name)) { readWorkbook(file); return; }
    const buf = await file.arrayBuffer();
    if (looksBinary(buf)) { notText(file.name); return; }
    setFile(fid, file.name, decodeText(buf));
    run();
  }
  for (const fid of SLOTS) {
    const input = $('#file-' + fid), drop = $('#drop-' + fid);
    input.addEventListener('change', () => input.files[0] && readFile(fid, input.files[0]));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); for (const f of e.dataTransfer.files) readFile(guessSlot(f.name, fid), f); });
  }
  // 上方的大框：Excel 依工作表名稱分配；文字檔、CSV 依檔名判斷是哪一份資料
  // 檔名看不出來時，依第一行的長度判斷是哪一種申報檔
  const BY_LENGTH = Object.fromEntries(DETAIL.filter(k => rs.layouts[k]).map(k => [rs.layouts[k].recordLength, k]));
  async function readMany(files) {
    const unknown = [];
    for (const f of files) {
      if (BOOK.test(f.name)) { readWorkbook(f); continue; }
      let slot = guessSlot(f.name, null);
      if (!slot && /\.txt$/i.test(f.name)) {
        const buf = await f.arrayBuffer();
        if (looksBinary(buf)) { notText(f.name); continue; }
        const text = decodeText(buf), first = text.split(/\r?\n/)[0];
        slot = BY_LENGTH[first.length] || null;
        if (slot) { setFile(slot, f.name, text); run(); continue; }
      }
      if (slot) readFile(slot, f); else unknown.push(f.name);
    }
    if (unknown.length) {
      $('#sample-note').textContent = `看不出「${unknown.join('」「')}」是哪一份資料，請展開下方「分別放入各份資料」，放進對應的格子。`;
      document.querySelector('details.more').open = true;
    }
  }
  $('#file-book').addEventListener('change', e => { readMany([...e.target.files]); e.target.value = ''; });
  const book = $('#drop-book');
  book.addEventListener('dragover', e => { e.preventDefault(); book.classList.add('over'); });
  book.addEventListener('dragleave', () => book.classList.remove('over'));
  book.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); book.classList.remove('over'); readMany([...e.dataTransfer.files]); });
  // 檔案沒拖進框內時，瀏覽器預設會直接打開檔案、離開這個頁面：改成一樣讀取
  document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); if (!e.target.closest('.drop')) readMany([...e.dataTransfer.files]); });

  // ---------- 執行 ----------
  const SLOT_NAME = Object.assign({ control: '系統總數', statement: '資產負債表', products: '商品資料', customers: '客戶資料' }, SHEET);
  function run() {
    const f = state.files;
    // 沒有保單資料也沒有理賠資料時無法檢查：說明還缺什麼，不顯示「0 個問題」
    if (!DETAIL.some(k => f[k])) {
      document.body.classList.add('no-data');
      $('#sample-note').textContent = `已放入：${Object.keys(f).filter(k => f[k]).map(k => SLOT_NAME[k]).join('、')}。還需要保單資料或理賠資料 (壽險、癌症險或傷害險) 才能開始檢查。`;
      return;
    }
    document.body.classList.remove('no-data');
    const t0 = performance.now();
    state.res = DQ.validate(activeRules(), Object.fromEntries(DETAIL.filter(k => f[k]).map(k => [k, f[k]])));
    // 客戶資料、商品資料：指向承保檔某一列的問題併入明細檢核 (可用欄位尺規與自動修正)
    state.cust = f.customers && f.L ? DQ.master.customers(state.res, f.customers.text) : null;
    state.prod = f.products && f.L ? DQ.master.products(state.res, f.products.text) : null;
    const mst = [].concat(state.cust ? state.cust.issues : [], state.prod ? state.prod.issues : []);
    let nextId = state.res.issues.length;
    for (const i of mst) if (i.file === 'L') {
      const d = DQ.master.catalog.find(c => c.id === i.ruleId);
      state.res.issues.push(Object.assign(i, { id: ++nextId, ruleName: d ? d.name : '', ref: d ? d.ref : '' }));
    }
    // 資料邏輯合理性：疑似異常 (不計入錯誤)
    state.anom = f.L || f.D ? DQ.anomaly.check(state.res, f.customers && f.customers.text) : null;
    for (const i of state.anom ? state.anom.issues : []) {
      const d = DQ.anomaly.catalog.find(c => c.id === i.ruleId);
      state.res.issues.push(Object.assign(i, { id: ++nextId, ref: d ? d.ref : '' }));
    }
    state.disabledCount = {};
    const drop = list => list.filter(i => { if (!state.disabled.has(i.ruleId)) return true; state.disabledCount[i.ruleId] = (state.disabledCount[i.ruleId] || 0) + 1; return false; });
    state.res.issues = drop(state.res.issues);
    state.res.summary = DQ.summarize(rs, state.res.issues, state.res.meta);
    state.roll = f.L ? R.rollForward(state.res, f.prior && f.prior.text) : null;
    state.ctl = f.control ? R.controlRecon(state.res, f.control.text, state.roll ? state.roll.issues : []) : null;
    state.stmt = f.statement ? R.statement(f.statement.text, state.res) : null;
    state.elapsed = performance.now() - t0;
    console.info(`[檢核耗時] ${(state.elapsed / 1000).toFixed(3)} 秒：承保 ${(f.L && state.res.meta.L) ? state.res.meta.L.count : 0} 筆、給付 ${(f.D && state.res.meta.D) ? state.res.meta.D.count : 0} 筆，${Object.values(f).filter(Boolean).length} 個檔案`);
    state.extra = [].concat(state.roll ? state.roll.issues : [], state.ctl ? state.ctl.issues : [], state.stmt ? state.stmt.issues : [], mst.filter(i => i.file !== 'L'));
    state.extra = drop(state.extra);
    // 對帳、客戶與商品等段落 (報告會逐段列出) 也拿掉停用的檢查，畫面與報告一致
    for (const o of [state.roll, state.ctl, state.stmt, state.cust, state.prod]) if (o && o.issues) o.issues = o.issues.filter(i => !state.disabled.has(i.ruleId));
    // 全部工作表的問題併成一張結果表 (明細、客戶、商品、上年度、控制總數、資產負債表)
    for (const i of state.res.issues) i.sheet = SHEET[i.file];
    for (const i of state.roll ? state.roll.issues : []) i.sheet = i.line ? SHEET.L : SHEET.prior;
    const cat = fin.catalog.concat(DQ.master.catalog);
    for (const i of state.extra) {
      if (!i.sheet) i.sheet = SHEET[i.file] || i.file;
      if (i.id == null) i.id = ++nextId;
      const d = cat.find(c => c.id === i.ruleId); if (d && !i.ruleName) { i.ruleName = d.name; i.ref = i.ref || d.ref; }
    }
    state.all = state.res.issues.concat(state.extra.filter(i => !state.res.issues.includes(i)));
    state.sel = null; state.aiSummary = null;
    renderSummary(); renderCats(); renderTable(); renderDetail(); renderRecon(); renderReport(); renderRules(); renderDecodeExamples();
    { const c = sev => state.all.filter(i => i.severity === sev).length, h = Object.values(state.disabledCount || {}).reduce((t, n) => t + n, 0);
      audit('檢查', `必須修改 ${c('error')}、建議確認 ${c('warning')}、請人工判斷 ${c('suspect')}${h ? `；停用的檢查隱藏 ${h} 個` : ''}`); }
    // 手機上資料一放進來就捲到結果區 (上傳區在畫面上方會佔掉整個螢幕)
    if (window.matchMedia('(max-width: 720px)').matches) requestAnimationFrame(() => $('#summary').scrollIntoView({ block: 'start', behavior: 'smooth' }));
    if (DQ.app && DQ.app.onRun) DQ.app.onRun();
    $('#dec-out').innerHTML = ''; $('#dec-ai').textContent = '';
    $('#ai-box').hidden = true; $('#ai-out').className = 'ai-out'; $('#ai-out').textContent = '';
    const reconErr = state.extra.filter(i => i.severity === 'error').length;
    $('#tc-check').textContent = state.all.filter(i => i.severity === 'error').length || '';
    $('#tc-recon').textContent = reconErr || '';
  }

  // ---------- 明細檢核 ----------
  function hitCount(key) { return key.filter(k => state.res.issues.some(i => i.ruleId === k.ruleId && (!k.policy || (i.policy || '').trim() === k.policy))).length; }
  // 摘要：四個重點數字；其他資訊 (耗時、範例錯誤找到幾個) 放在下方一行小字
  // 只要有一筆要修改就不能顯示 100%：無條件捨去到小數一位 (29,395 筆中 52 筆有問題 → 99.8%，不是四捨五入成 100%)
  const okPct = (n, bad) => !bad ? '100' : String(Math.min(99.9, Math.floor((n - bad) / n * 1000) / 10));
  function renderSummary() {
    const s = state.res.summary, all = state.all;
    const n = sev => all.filter(i => i.severity === sev).length;
    const fixable = all.filter(i => i.fix && state.res.issues.includes(i)).length;
    const ICON = { err: '!', warn: '?', suspect: '…', ok: '✓', fix: '↺' };
    const tile = (cls, k, v, sub) => `<div class="tile ${cls}"><div><span class="k">${k}</span><span class="v">${v}</span><span class="s">${sub}</span></div><span class="tile-i" aria-hidden="true">${ICON[cls] || ''}</span></div>`;
    $('#summary').innerHTML =
      tile(n('error') ? 'err' : 'ok', SEV.error, n('error'), n('error') ? LB.SEV_HINT.error : '沒有必須修改的地方，可以送出') +
      tile(n('warning') ? 'warn' : 'ok', SEV.warning, n('warning'), LB.SEV_HINT.warning) +
      tile(n('suspect') ? 'suspect' : 'ok', SEV.suspect, n('suspect'), LB.SEV_HINT.suspect) +
      tile('fix', '可以一鍵修改', fixable, '工具知道正確的值');
    const recs = Object.entries(s.byFile).map(([fid, b]) => `${SHEET[fid]} ${b.records} 筆`).join('、');
    const allMst = [].concat(state.cust ? state.cust.issues : [], state.prod ? state.prod.issues : []);
    const found = state.key ? `　範例刻意放的錯誤找到：保單與理賠 ${hitCount(state.key)}/${state.key.length}、客戶與商品 ${state.masterKey.filter(k => allMst.some(i => i.ruleId === k.ruleId && i.policy === k.policy)).length}/${state.masterKey.length}。` : '';
    const nRec = Object.values(s.byFile).reduce((t, b) => t + b.records, 0), nBad = Object.values(s.byFile).reduce((t, b) => t + b.badRecords, 0);
    $('#run-status').className = 'run-status ' + (n('error') ? 'bad' : 'ok');
    // 一筆資料都沒讀到時不能顯示「100% 沒有問題」(安全測試 T07)
    if (!nRec) $('#run-status').className = 'run-status bad';
    const cut = Object.values(s.byFile).some(b => b.truncated);
    if (cut) { $('#run-status').className = 'run-status bad'; $('#run-status').innerHTML = `<i></i><span>問題超過 ${DQ.MAX_ISSUES.toLocaleString()} 項，只列出前 ${DQ.MAX_ISSUES.toLocaleString()} 項；檔案可能整個格式不對，請先改最常見的問題再檢查</span>`; }
    else $('#run-status').innerHTML = nRec ? `<i></i><span>已檢查 ${nRec.toLocaleString()} 筆資料・${okPct(nRec, nBad)}% 沒有必須修改的問題</span>` : '<i></i><span>沒有讀到任何資料，請確認檔案內容</span>';
    $('#summary-note').textContent = `已檢查 ${recs}，共 ${Object.values(state.files).filter(Boolean).length} 份資料，花了 ${(state.elapsed / 1000).toFixed(2)} 秒。${found}`;
    const hn = hiddenNote(); $('#hidden-note').hidden = !hn; $('#hidden-note').textContent = hn;
  }
  function renderCats() {
    // 「資料」篩選：只列出有問題的工作表
    const cur = $('#f-file').value, sheets = [...new Set(state.all.map(i => i.sheet).filter(Boolean))];
    $('#f-file').innerHTML = '<option value="">全部資料</option>' + sheets.map(n => `<option${n === cur ? ' selected' : ''}>${esc(n)}</option>`).join('');
    const byCat = {};
    for (const i of state.all) byCat[i.category] = (byCat[i.category] || 0) + 1;
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    if ($('#cats')) $('#cats').innerHTML = cats.map(([c, n]) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${state.cat === c}">${esc(LB.cat(c))}<b>${n}</b></button>`).join('');
    if ($('#cats')) $('#cats').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; state.cat = state.cat === b.dataset.cat ? '' : b.dataset.cat; $('#f-cat').value = state.cat; renderCats(); renderTable(); };
    $('#f-cat').innerHTML = '<option value="">全部問題類型</option>' + cats.map(([c]) => `<option value="${esc(c)}"${c === state.cat ? ' selected' : ''}>${esc(LB.cat(c))}</option>`).join('');
  }
  function filtered() {
    const sev = $('#f-sev').value, sheet = $('#f-file').value, cat = $('#f-cat').value, q = $('#f-q').value.trim().toLowerCase();
    return state.all.filter(i => (!sev || i.severity === sev) && (!sheet || i.sheet === sheet) && (!cat || i.category === cat) &&
      (!q || [i.policy, i.ruleId, i.ruleName, i.message, DQ.report.fieldLabel(rs, i), i.value].join(' ').toLowerCase().includes(q)));
  }
  // 表格的「欄位」只列前兩個，其餘在右側說明中看
  function shortFields(i) {
    const names = DQ.report.fieldLabel(rs, i).replace(/欄\d+ /g, '').split('、').filter(Boolean);
    return names.length > 2 ? `${names.slice(0, 2).join('、')} 等 ${names.length} 欄` : names.join('、');
  }
  function renderTable() {
    const list = filtered(), open = state.all.filter(i => i.severity !== 'suspect').length;
    $('#issue-count').textContent = state.all.length ? (list.length === state.all.length ? `${open} 項待處理` : `顯示 ${list.length} / ${state.all.length} 項`) : '';
    $('#issue-count').className = 'count-pill' + (state.all.some(i => i.severity === 'error') ? ' err' : '');
    // 問題很多時只畫前 500 項 (一次畫幾萬項會讓瀏覽器卡住)；其餘用篩選或下載問題清單查看
    const SHOW = 500, more = list.length - SHOW;
    $('#issue-list').innerHTML = list.length ? list.slice(0, SHOW).map(i => {
      const val = String(i.value == null ? '' : i.value).trim();
      const fixable = i.fix && state.res.issues.includes(i);
      return `<div class="issue ${i.severity}${state.sel === i.id ? ' sel' : ''}" data-id="${i.id}" role="listitem" tabindex="0">
        <div class="issue-main">
          <div class="issue-top"><span class="sev-tag ${i.severity}">${SEV[i.severity]}</span><span class="issue-where">${esc(i.sheet || '')} ${rowLabel(i)}${(i.policy || i.code) ? `・<span class="mono">${esc((i.policy || i.code).trim())}</span>` : ''}</span></div>
          <p class="issue-msg">${esc(i.message)}</p>
          ${shortFields(i) || val ? `<p class="issue-sub">${shortFields(i) ? esc(shortFields(i)) : ''}${val ? `${shortFields(i) ? '：' : ''}<span class="mono">${esc(val.replace(/ /g, '·').slice(0, 40))}</span>` : ''}</p>` : ''}
        </div>
        <div class="issue-side">${i.fix ? `<span class="hint">建議改成</span><b class="mono">${esc(String(i.fix.value).slice(0, 24))}</b>${fixable ? '<span class="pill">可一鍵修改</span>' : ''}` : ''}</div>
      </div>`;
    }).join('') + (more > 0 ? `<p class="empty">還有 ${more.toLocaleString()} 項沒有列出。請用上方的篩選縮小範圍，或按「下載問題清單」查看全部。</p>` : '') : `<p class="empty">${state.all.length ? '沒有符合條件的問題' : '沒有發現任何問題，資料可以送出。'}</p>`;
  }
  // 行號：文字檔為第 N 筆；由 Excel 匯入時換算成 Excel 列號 (第 1 列為標題)；CSV 工作表為檔案中的列號
  function rowLabel(i) {
    if (!i.line) return '';
    if (i.file === 'L' || i.file === 'D') { const f = state.files[i.file]; return f && f.fromSheet ? `第 ${i.line + 1} 列` : `第 ${i.line} 行`; }
    return `第 ${i.line} 列`;
  }
  ['#f-sev', '#f-file', '#f-q'].forEach(s => $(s).addEventListener('input', renderTable));
  $('#f-cat').addEventListener('input', () => { state.cat = $('#f-cat').value; renderCats(); renderTable(); });
  $('#issue-list').addEventListener('click', e => { const r = e.target.closest('[data-id]'); if (r) select(+r.dataset.id); });
  $('#issue-list').addEventListener('keydown', e => { const r = e.target.closest('[data-id]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(+r.dataset.id); } });
  function select(id, quiet) {
    state.sel = id; renderTable(); renderDetail();
    const r = $(`#issue-list [data-id="${id}"]`); if (r && !quiet) r.scrollIntoView({ block: 'nearest' });
    // 手機 / 窄螢幕：詳情在清單下方，選取後捲到詳情
    if (!quiet && window.matchMedia('(max-width: 1100px)').matches) $('#detail').scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function ruler(lay, raw, hitFields) {
    const marks = new Array(raw.length).fill(false);
    for (const k of hitFields) { const f = lay.field(k); if (f) for (let p = f.start - 1; p < f.start - 1 + f.len; p++) marks[p] = true; }
    const W = 50, rows = [];
    for (let s = 0; s < Math.max(raw.length, 1); s += W) {
      let line = `<span class="tick">${String(s + 1).padStart(3, '0')}│</span>`, open = false;
      for (let p = s; p < Math.min(s + W, raw.length); p++) {
        if (marks[p] && !open) { line += '<mark>'; open = true; }
        if (!marks[p] && open) { line += '</mark>'; open = false; }
        line += raw[p] === ' ' ? '·' : esc(raw[p]);
      }
      if (open) line += '</mark>';
      rows.push(line);
    }
    return rows.join('\n');
  }
  function renderDetail() {
    const el = $('#detail');
    const i = state.res && state.all.find(x => x.id === state.sel);
    if (!i) {
      el.innerHTML = `<div class="detail-head"><div><h3>問題說明</h3><p class="hint">點清單中任一個問題</p></div></div>
        <p class="hint">這裡會說明問題在哪裡、依據哪一條規定、建議怎麼改；需要時可以展開那一行的原始資料。</p>`;
      return;
    }
    const lay = rs.layouts[i.file] || { title: i.sheet, recordLength: -1, fields: [], field: () => null, keyOf: () => '' };
    const rec = i.line ? (state.res.data[i.file] || []).find(r => r._line === i.line) : null;
    const okLen = rec && rec._raw.length === lay.recordLength;
    const all = okLen ? lay.fields.map(f => ({ f, hit: i.fields.includes(f.key) })) : [];
    const hits = all.filter(x => x.hit), rest = all.filter(x => !x.hit);
    const row = ({ f, hit }) => `<tr class="${hit ? 'hit' : ''}"><td class="num">${f.no}</td><td>${esc(f.name)}</td><td class="num mono">${f.start}-${f.start + f.len - 1}</td><td class="v">${esc(rec[f.key])}</td></tr>`;
    // 原始資料預設收合；摘要顯示出問題欄位的字元起迄 (多個欄位分別列出，例：第 87–94、117–124 字)
    const spans = hits.map(x => x.f).sort((a, b) => a.start - b.start).map(f => f.len > 1 ? `${f.start}–${f.start + f.len - 1}` : `${f.start}`);
    const range = spans.length ? `（第 ${spans.join('、')} 字）` : '';
    const siblings = okLen && i.file === 'L' ? state.res.data.L.filter(r => r !== rec && r._raw.length === lay.recordLength && lay.keyOf(r) === lay.keyOf(rec)) : [];
    const fixable = i.fix && state.res.issues.includes(i);
    el.innerHTML = `
      <div class="detail-head">
        <div><h3>問題說明</h3><p class="hint">${esc(i.sheet || lay.title)} ${rowLabel(i) || ''}${i.policy ? `・保單 <span class="mono">${esc(i.policy.trim())}</span>` : ''}${i.code ? `・科目 <span class="mono">${esc(i.code)}</span>` : ''}</p></div>
        <span class="sev-tag ${i.severity}">${SEV[i.severity]}</span>
      </div>
      <section class="d-sec"><p class="d-label">問題</p>
        <div class="d-box ${i.severity}"><b>${esc(i.message)}</b>
          <dl class="kv">
            <dt>欄位</dt><dd>${esc(DQ.report.fieldLabel(rs, i) || '-')}</dd>
            ${i.value !== '' ? `<dt>目前的值</dt><dd class="mono">${esc(String(i.value).replace(/ /g, '·'))}</dd>` : ''}
          </dl>
          <p class="hint">${esc(LB.SEV_HINT[i.severity] || '')}</p></div></section>
      <section class="d-sec"><p class="d-label">建議修正方式</p>
        <div class="d-box plain">${esc(i.suggestion || '請人工確認')}
          ${i.fix ? `<dl class="kv"><dt>建議修正值</dt><dd class="mono fixval">${esc(i.fix.value)}</dd></dl>` : ''}</div></section>
      <section class="d-sec"><p class="d-label">依據的規定</p>
        <div class="d-box basis"><b>${esc(i.ruleName || LB.cat(i.category))}</b>
          <dl class="kv"><dt>規則編號</dt><dd class="mono">${esc(i.ruleId)}</dd>${i.ref ? `<dt>出處</dt><dd>${esc(i.ref)}</dd>` : ''}</dl></div></section>
      ${rec ? `<details class="raw"><summary>顯示原始資料${range}</summary>
        <p class="hint">左邊數字是第幾個字；「·」代表空白；黃色是有問題的地方。</p>
        <div class="ruler">${ruler(lay, rec._raw, i.fields)}</div>
        ${hits.length ? `<table class="fields"><tbody>${hits.map(row).join('')}</tbody></table>` : ''}
        ${rest.length ? `<details><summary class="hint">看這一行的其他 ${rest.length} 個欄位</summary><table class="fields"><tbody>${rest.map(row).join('')}</tbody></table></details>` : ''}
      </details>` : ''}
      ${siblings.length ? `<div><div class="label">同一張保單的其他資料</div><table class="fields"><tbody>${[rec].concat(siblings).sort((a, b) => a.txnSeq.localeCompare(b.txnSeq)).map(r => `<tr class="${r === rec ? 'hit' : ''}"><td class="num">第${r._line}行</td><td class="v">${r.txnSeq}</td><td class="v">${r.addType} ${r.addDate}</td><td class="v">→ ${r.exitType} ${r.exitDate}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div class="ai-explain"><button class="btn ghost small ai-btn" id="btn-explain">請 AI 用白話解釋</button><p class="ai-notice">按下後會把這個問題和相關欄位送給 AI（Claude），不會送出整筆資料；身分證號、姓名、地址、電話、Email 會先遮蔽。</p><div class="ask" id="explain-out"></div></div>
      <div class="detail-foot">
        <button class="linkish" type="button" id="btn-detail-list">匯出稽核軌跡</button>
        ${fixable ? `<button class="btn cta" id="btn-fix-one" title="${esc(lay.field(i.fix.field).name)} → ${esc(i.fix.value)}">改成建議的值</button>` : '<span class="hint">這個問題需要人工確認後修改</span>'}
      </div>`;
    $('#btn-detail-list').onclick = exportAudit;
    const one = $('#btn-fix-one');
    if (one) one.onclick = () => applyFix([i.id]);
    $('#btn-explain').onclick = async () => {
      const out = $('#explain-out');
      if (!DQ.ai.available()) { out.textContent = DQ.ai.OFFLINE; return; }
      out.textContent = 'AI 說明中…';
      try { showAI(out, await DQ.ai.explain(rs, state.res, i, reconCtx())); } catch (e) { out.textContent = e.message; }
    };
  }

  // ---------- 修正 / 下載 ----------
  let saver = null;
  if (window.claude && window.claude.use) window.claude.use('downloads').then(d => { saver = d; }, () => {});
  // 檔名一律用英數字：有些瀏覽器會丟掉中文檔名，存成沒有副檔名的「download」，打開就變亂碼
  async function download(name, data, type) {
    if (name !== state.auditName) audit('下載', name, typeof data === 'string' ? data : null);
    if (saver) {
      try { await saver.save({ filename: name, data }); }
      catch (e) { $('#action-note').textContent = e && e.code === 'declined' ? '已取消下載。' : '這裡無法下載檔案。'; }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: type || 'text/plain;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function applyFix(ids) {
    let total = 0;
    // 先記下要改的值 (改之前的值 → 建議的值)
    const sel = ids ? new Set(ids) : null;
    for (const i of state.res.issues) {
      if (!i.fix || !DETAIL.includes(i.file) || !state.files[i.file] || (sel && !sel.has(i.id))) continue;
      const lay = rs.layouts[i.file], f = lay && lay.field(i.fix.field), rec = (state.res.data[i.file] || []).find(r => r._line === i.line);
      if (!f || !rec || rec._raw.length !== lay.recordLength) continue;
      audit('修改', `${SHEET[i.file]} ${rowLabel(i)}${i.policy ? ` ${i.policy.trim()}` : ''} ${f.name}：「${String(rec[f.key]).trim()}」→「${String(i.fix.value).trim()}」（${i.ruleId}）`);
    }
    state.changed = state.changed || new Set();
    for (const fid of DETAIL) {
      if (!state.files[fid]) continue;
      const out = DQ.applyFixes(rs, state.res, fid, ids);
      if (out.applied) { state.files[fid] = Object.assign({}, state.files[fid], { text: out.text }); total += out.applied; state.changed.add(fid); }
    }
    // 與問題清單「N 項待處理」同一個算法 (全部工作表的必須修改＋建議確認)
    const pending = () => state.all.filter(i => i.severity === 'error' || i.severity === 'warning').length;
    const before = pending();
    run();
    const after = pending();
    $('#action-note').textContent = total ? `已修改 ${total} 個地方，問題從 ${before} 個減為 ${after} 個。可以下載改好的資料。` : '沒有工具可以自動修改的地方。';
    return { total, before, after };
  }
  $('#btn-fix').onclick = () => applyFix(null);
  // 使用者自己的檔名若含中文，去掉中文字，避免存成「download」
  const safeName = (name, fallback) => { const n = String(name || '').replace(/[^\x21-\x7e]/g, ''); return /^[^.]+\.\w+$/.test(n) ? n : fallback; };
  // 下載改過的明細檔 (沒有改過時下載保單資料)
  $('#btn-dl-fixed').onclick = () => {
    const ids = DETAIL.filter(k => state.files[k] && state.changed && state.changed.has(k));
    for (const k of ids.length ? ids : DETAIL.filter(x => state.files[x]).slice(0, 1)) download(safeName(state.files[k].name, `fixed_${k}.txt`), state.files[k].text);
  };
  // 問題清單：Excel 檔 (不會有編碼問題)；Excel 元件未載入時改用 CSV (含 BOM，Excel 也能正確顯示中文)
  $('#btn-dl-csv').onclick = () => {
    const rows = DQ.report.toRows(rs, state.res, state.extra);
    if (window.XLSX) {
      const ws = XLSX.utils.aoa_to_sheet(rows), wb = XLSX.utils.book_new();
      ws['!cols'] = [6, 14, 12, 6, 18, 18, 24, 16, 18, 48, 40, 18, 14].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, '問題清單');
      download('issues_list.xlsx', new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else download('issues_list.csv', DQ.report.toCSV(rs, state.res, state.extra), 'text/csv;charset=utf-8');
  };
  $('#btn-dl-reject').onclick = () => download('reject_' + safeName(state.files.L && state.files.L.name, 'policies.txt'), DQ.report.toRejectFile(rs, state.res, 'L'));
  // 稽核軌跡：CSV (含 BOM，Excel 可直接開)；內容先遮蔽個資，避免轉寄時外流
  async function exportAudit() {
    await new Promise(r => setTimeout(r, 50));   // 等雜湊值算完
    const q = v => { v = String(v == null ? '' : v); if (/^[=+@\t\r]|^-[^\d]/.test(v)) v = "'" + v; return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const ctx = DQ.aiPayload.context(state.res || { data: {} }, reconCtx());
    const p2 = n => String(n).padStart(2, '0'), ts = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
    const rows = [['時間', '動作', '內容', '檔案內容 SHA-256']].concat(state.audit.map(e => [ts(e.at), e.action, DQ.pii.redact(e.detail, ctx).text, e.sha]));
    const head = `# 申報資料檢核助手 稽核軌跡（${ts(new Date())} 匯出）\r\n# ${$('#rule-version').textContent}\r\n`;
    const d = new Date(); state.auditName = `audit_trail_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.csv`;
    download(state.auditName, '\uFEFF' + head + rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n', 'text/csv;charset=utf-8');
  }
  $('#btn-dl-audit').onclick = exportAudit;
  $('#btn-dl-report').onclick = () => download('check_report.html', reportHTML(), 'text/html;charset=utf-8');

  // ---------- 跨系統對帳 ----------
  const STATUS_CLS = { 一致: 'ok', 時間差: 'info', 定義差: 'info', 待查: 'bad', 格式錯誤: 'bad' };
  function renderRecon() {
    // 控制總數
    if (!state.ctl) { $('#ctl-chips').innerHTML = '<span class="hint">還沒有放入「系統總數」資料。</span>'; $('#ctl-table tbody').innerHTML = ''; }
    else {
      const s = state.ctl.summary;
      $('#ctl-chips').innerHTML = [['一致', s.ok], ['時間差', s.timing], ['定義差', s.definition], ['待查', s.open]].map(([k, n]) => `<span class="st ${STATUS_CLS[k]}">${LB.status(k)} <b>${n}</b></span>`).join('');
      const only = $('#ctl-diff-only').checked;
      const rows = state.ctl.rows.filter(r => !only || r.status !== '一致');
      $('#ctl-table tbody').innerHTML = rows.length ? rows.map(r => r.up ? `<tr>
        <td>${esc(r.source)}</td><td>${esc(r.name)}</td><td class="mono">${esc(r.period)}</td>
        <td class="num">${r.up.cnt} 筆<br>${yuan(r.up.amt)} 元</td><td class="num">${r.fil.cnt} 筆<br>${yuan(r.fil.amt)} 元</td>
        <td class="num ${r.diff.cnt || r.diff.amt ? 'neg' : ''}">${r.diff.cnt} 筆<br>${yuan(r.diff.amt)}</td>
        <td><span class="st ${STATUS_CLS[r.status]}">${LB.status(r.status)}</span></td>
        <td class="explain">${esc(r.explain || '')}${r.suggestion ? `<div class="hint">${esc(r.suggestion)}</div>` : ''}${(r.related || []).length ? `<div>${[...new Set(r.related.map(i => i.id).filter(Boolean))].slice(0, 6).map(id => `<button class="chip jump" data-id="${id}">相關問題 #${id}</button>`).join(' ')}</div>` : ''}</td></tr>`
        : `<tr><td colspan="8">${esc(r.explain)}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">申報資料的加總和各系統的總數完全相符。</td></tr>';
    }
    // 客戶與商品資料
    const mstAll = [].concat(state.cust ? state.cust.issues : [], state.prod ? state.prod.issues : []);
    if (!state.cust && !state.prod) { $('#mst-chips').innerHTML = '<span class="hint">還沒有放入客戶資料或商品資料。</span>'; $('#mst-table tbody').innerHTML = ''; }
    else {
      $('#mst-chips').innerHTML = (state.cust ? `<span class="st ${state.cust.issues.length ? 'bad' : 'ok'}">客戶資料 ${state.cust.summary.rows} 列（${state.cust.summary.people} 人），問題 <b>${state.cust.issues.length}</b></span>` : '') +
        (state.prod ? ` <span class="st ${state.prod.issues.length ? 'bad' : 'ok'}">商品 ${state.prod.summary.products} 項（已停售 ${state.prod.summary.stopped}），問題 <b>${state.prod.issues.length}</b></span>` : '') +
        (mstAll.some(i => i.fix) ? ` <span class="st ok">可用客戶資料自動修改 <b>${mstAll.filter(i => i.fix).length}</b></span>` : '');
      $('#mst-table tbody').innerHTML = mstAll.length ? mstAll.map(i => `<tr><td><span class="badge ${i.severity}">${SEV[i.severity]}</span></td>
        <td class="num">${i.file === 'L' && i.id ? `<button class="chip jump" data-id="${i.id}">${SHEET.L} ${rowLabel(i)}</button>` : `${SHEET[i.file]} 第 ${i.line} 列`}</td>
        <td class="mono">${esc((i.policy || '').trim())}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}${i.fix ? ` <span class="pill">→ ${esc(i.fix.value)}</span>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="5" class="empty">客戶資料、商品資料和保單資料都對得上。</td></tr>';
    }
    // 結轉
    if (state.roll) {
      const m = state.roll.movement, row = (k, c, a, cls) => `<tr class="${cls || ''}"><td>${k}</td><td class="num">${c == null ? '' : c.toLocaleString()}</td><td class="num">${a == null ? '' : yuan(a)}</td></tr>`;
      const priorDiff = state.roll.hasPrior ? [m.open[0] - m.priorClose[0], m.open[1] - m.priorClose[1]] : null;
      $('#roll-table tbody').innerHTML =
        (state.roll.hasPrior ? row('去年底仍有效（去年申報）', m.priorClose[0], m.priorClose[1], 'muted') : '') +
        row('今年初有效', m.open[0], m.open[1], 'strong') +
        (priorDiff && (priorDiff[0] || priorDiff[1]) ? row('　和去年底的差異', priorDiff[0], priorDiff[1], 'bad') : '') +
        row('＋ 今年新保單', m.new[0], m.new[1]) + row('＋ 保額增加', null, m.inc[1]) + row('－ 保額減少', null, m.dec[1]) +
        row('± 繳清、展期、轉換', null, m.adj[1]) + (m.unexplained[1] ? row('± 保額變了卻沒有對應的異動', null, m.unexplained[1], 'bad') : '') +
        Object.entries(m.term).map(([k, v]) => row(`－ 結束：${k}`, -v[0], -v[1])).join('') +
        row('＝ 今年底應有效（推算）', m.close[0], m.close[1], 'strong') + row('今年底有效（申報資料）', m.closeActual[0], m.closeActual[1], m.close[1] === m.closeActual[1] ? 'muted' : 'bad');
      const iss = state.roll.issues;
      $('#roll-issues tbody').innerHTML = iss.length ? iss.map(i => `<tr><td><span class="badge ${i.severity}">${SEV[i.severity]}</span></td><td class="mono">${esc(i.policy)}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}</td></tr>`).join('')
        : `<tr><td colspan="4" class="empty">${state.roll.hasPrior ? '去年底和今年初的保單一張不少、保額相同；今年保額的變動也都有對應的異動。' : '放入去年保單資料後，可以逐張核對去年底和今年初是否接得上。'}</td></tr>`;
    }
    // 財報
    if (!state.stmt) { $('#stmt-banner').innerHTML = '<p class="hint">還沒有放入資產負債表。</p>'; $('#stmt-chains').innerHTML = ''; $('#stmt-table tbody').innerHTML = ''; return; }
    const st = state.stmt;
    $('#stmt-banner').innerHTML = `<div class="banner ${st.summary.balanced ? 'ok' : 'bad'}"><b>${st.summary.balanced ? '資產 = 負債 + 權益，報表是平的' : '資產不等於負債加權益，報表不平'}</b>　${SEV.error} ${st.summary.errors} 項、${SEV.warning} ${st.summary.warnings} 項</div>`;
    $('#stmt-chains').innerHTML = st.chains.map(ch => `<div class="chain"><div class="label">源頭只有一個：改好它，另外 ${ch.effects.length} 個問題會一起消失</div>
      <div class="chain-root"><span class="badge error">源頭</span> <span class="mono">${esc(ch.root.code)}</span> ${esc(ch.root.message)}<div class="hint">${esc(ch.root.suggestion)}</div></div>
      <div class="chain-fx">${ch.effects.map(e => `<div>↳ <span class="mono">${e.ruleId} ${esc(e.code)}</span> ${esc(e.message)}</div>`).join('')}</div></div>`).join('') +
      st.issues.filter(i => !i.chain).map(i => `<div class="chain single"><span class="badge ${i.severity}">${SEV[i.severity]}</span> <span class="mono">${esc(i.code)}</span> ${esc(i.message)}<div class="hint">${esc(i.explain || '')} ${esc(i.suggestion)}</div></div>`).join('');
    const byRow = new Map();
    for (const i of st.issues) { if (!byRow.has(i.line)) byRow.set(i.line, []); byRow.get(i.line).push(i); }
    $('#stmt-table tbody').innerHTML = st.rows.map(r => {
      const iss = byRow.get(r.line) || [];
      const depth = r.code.length <= 1 ? 0 : r.code.length <= 2 ? 1 : 2;
      return `<tr class="${iss.some(i => i.severity === 'error') ? 'row-bad' : iss.length ? 'row-warn' : ''} d${depth}"><td class="mono">${esc(r.code)}</td><td class="ind">${esc(r.name)}</td>
        <td class="num">${yuan(r.open)}</td><td class="num">${yuan(r.inc)}</td><td class="num">${yuan(r.dec)}</td><td class="num">${yuan(r.close)}</td>
        <td>${iss.map(i => `<span class="badge ${i.severity}" title="${esc(i.message)}">${SEV[i.severity]}${i.chainRole ? '・' + (i.chainRole === '根因' ? '源頭' : '受影響') : ''}</span>`).join(' ')}</td></tr>`;
    }).join('');
  }
  $('#ctl-diff-only').addEventListener('change', renderRecon);
  document.addEventListener('click', e => {
    const j = e.target.closest('.jump'); if (!j) return;
    showTab('check'); select(+j.dataset.id);
  });

  // ---------- 退件解碼 ----------
  function renderDecodeExamples() {
    const i = state.res.issues.find(x => x.file === 'L' && x.line > 10 && x.fields.length);
    const ex = document.querySelectorAll('.chip.ex');
    if (i && ex[3]) ex[3].textContent = `第 ${i.line} 行資料有誤，${rs.layouts.L.field(i.fields[0]).name}錯誤`;
  }
  document.querySelectorAll('.chip.ex').forEach(b => b.onclick = () => { $('#dec-text').value = b.textContent; decodeNow(); });
  const KIND = { 檢核編號: '規則編號', 手冊錯誤代碼: '手冊上的錯誤代碼', 籠統錯誤代碼: '只有代碼的通知', 行號: '行號', 欄位名稱: '欄位', 關鍵字: '關鍵字' };
  function decodeNow() {
    const text = $('#dec-text').value;
    state.decoded = R.decode(text, { res: state.res, extra: state.extra, catalogs: [rs.catalog, fin.catalog] });
    const d = state.decoded;
    $('#dec-ai').textContent = '';
    $('#dec-out').innerHTML = d.findings.length ? `<p class="hint">找到 ${d.located} 個對應的問題。</p>` + d.findings.map(f => `
      <div class="finding">
        <div class="f-head"><span class="badge info">${esc(KIND[f.kind] || f.kind)}</span> <b class="mono">${esc(f.clue)}</b></div>
        <p>${esc(f.explain)}</p>
        ${f.matches.length ? f.groups.map(g => `<details ${f.groups.length <= 3 ? 'open' : ''}><summary><span class="mono">${esc(g.ruleId)}</span> ${esc(g.name)} <b>${g.items.length} 筆</b></summary>
          <div class="table-wrap flat"><table><thead><tr><th>位置</th><th>保單／科目</th><th>欄位</th><th>目前的值</th><th>問題</th><th>建議怎麼改</th></tr></thead><tbody>
          ${g.items.slice(0, 50).map(i => `<tr><td class="num">${i.id && (i.file === 'L' || i.file === 'D') ? `<button class="chip jump" data-id="${i.id}">${SHEET[i.file]} ${rowLabel(i)}</button>` : `${SHEET[i.file] || ''}${i.line ? ' 第 ' + i.line + ' 列' : ''}`}</td>
            <td class="mono">${esc((i.policy || i.code || '').trim())}</td><td>${esc(i.file === 'L' || i.file === 'D' ? DQ.report.fieldLabel(rs, i).replace(/欄\d+ /g, '') : '')}</td>
            <td class="mono">${esc(String(i.value).trim())}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}${i.fix ? ` <span class="pill">→ ${esc(i.fix.value)}</span>` : ''}</td></tr>`).join('')}
          </tbody></table></div></details>`).join('') : '<p class="hint">目前的資料裡沒有這個問題：可能已經改好了，或退件時用的是另一個版本的檔案。</p>'}
      </div>`).join('') : '<p class="hint">請貼上退件通知的內容。</p>';
  }
  $('#btn-decode').onclick = decodeNow;
  $('#btn-decode-ai').onclick = async () => {
    const out = $('#dec-ai');
    if (!$('#dec-text').value.trim()) { out.textContent = '請先貼上退件通知的內容。'; return; }
    if (!state.decoded) decodeNow();
    if (!DQ.ai.available()) { out.textContent = DQ.ai.OFFLINE; return; }
    out.className = 'ai-out'; out.textContent = 'AI 正在閱讀退件通知…';
    try { showAI(out, await DQ.ai.decode($('#dec-text').value, state.decoded, state.res, reconCtx())); out.className = 'ai-out done'; } catch (e) { out.textContent = e.message; }
  };

  // ---------- AI ----------
  const reconCtx = () => ({ ctl: state.ctl, roll: state.roll, stmt: state.stmt, cust: state.cust, prod: state.prod });
  // AI 回覆一律加上「AI 產出」標示
  function showAI(out, text) { out.innerHTML = `<div class="ai-tag">${esc(DQ.ai.LABEL)}</div><div class="ai-text">${esc(text)}</div><p class="ai-redact">${esc(DQ.ai.redactionNote())}</p>`; }
  $('#btn-ai').onclick = async () => {
    const out = $('#ai-out');
    $('#ai-box').hidden = false;
    if (!DQ.ai.available()) { out.textContent = DQ.ai.OFFLINE; return; }
    $('#btn-ai').disabled = true; out.className = 'ai-out'; out.textContent = 'AI 正在整理重點…';
    try {
      state.aiSummary = await DQ.ai.summarize(rs, state.res, reconCtx());
      out.className = 'ai-out done'; showAI(out, state.aiSummary); renderReport();
    } catch (e) { out.textContent = e.message; }
    $('#btn-ai').disabled = false;
  };

  // ---------- 報告 / 規則 ----------
  function reportHTML() { return DQ.report.toHTML(rs, state.res, { elapsed: state.elapsed, aiSummary: state.aiSummary, hidden: hiddenNote(), totals: { error: state.all.filter(i => i.severity === 'error').length, warning: state.all.filter(i => i.severity === 'warning').length, suspect: state.all.filter(i => i.severity === 'suspect').length }, packs: state.packs.filter(x => x.on).map(x => x.pack), recon: { ctl: state.ctl, roll: state.roll, stmt: state.stmt, cust: state.cust, prod: state.prod } }); }
  function renderReport() { $('#report-frame').srcdoc = reportHTML(); }
  // 手冊頁碼 (rules/rules.js)：PDF 頁碼與頁面上印的頁碼
  const SRCDOC = { rules: '檢核規則手冊', manual: '填報手冊' };
  function pageOf(id) {
    const src = window.DQ.ruleSource, r = src && src.rules.concat(src.toolRules).find(x => x.id === id);
    if (!r) {
      const pk = rs.catalog.find(x => x.id === id && x.pack);
      if (pk) return `<span>法規更新：${esc(pk.ref || '')}</span>`;
      const own = rs.catalog.find(x => x.id === id && x.product), prod = own && rs.products.find(p => p.id === own.product);
      return own ? `<span>${esc(prod.name)}填報手冊 ${esc(own.ref)}</span>` : '<span class="hint">自訂規則</span>';
    }
    const s = r.source;
    if (s.doc === 'tool') return `<span class="hint" title="${esc(s.note || '')}">本工具另外加的</span>`;
    return `<span title="${esc((s.note ? s.note + '；' : '') + (s.program ? `檢核程式說明表 PDF 第 ${s.program} 頁` : ''))}">${SRCDOC[s.doc]} 第 ${s.page} 頁</span>`;
  }
  function renderRules() {
    const q = $('#r-q').value.trim().toLowerCase();
    const by = {};
    for (const i of state.res.issues.concat(state.extra || [])) by[i.ruleId] = (by[i.ruleId] || 0) + 1;
    const cat = activeRules().catalog.concat(fin.catalog, DQ.master.catalog, DQ.anomaly.catalog);
    const st = DQ.ruleStats.count();
    const list = cat.filter(r => !q || [r.id, r.name, r.level, r.ref].join(' ').toLowerCase().includes(q));
    const packN = cat.filter(c => c.pack).length, imported = cat.length - st.total - st.extTotal - packN;
    $('#rules-meta').textContent = `個人壽險共 ${st.total} 條檢查規則：${st.cats.map(c => `${c.name} ${c.n}`).join('、')}${st.ext.map(e => `；${e.name} ${e.n} 條`).join('')}${packN ? `；法規更新 ${packN} 條` : ''}${imported > 0 ? `；另有自訂規則 ${imported} 條` : ''}`;
    $('#rule-table tbody').innerHTML = list.map(r => `<tr><td class="mono">${esc(r.id)}</td><td>${esc(LB.level(r.level))}</td><td>${esc(r.name)}</td><td>${pageOf(r.id)}</td><td><span class="badge ${r.severity}">${SEV[r.severity]}</span></td><td class="num">${by[r.id] || ''}</td></tr>`).join('');
    $('#layout-table tbody').innerHTML = rs.layouts.L.fields.map(f => `<tr><td class="num">${f.no}</td><td>${esc(f.name)}</td><td class="num">${f.start}</td><td class="num">${f.start + f.len - 1}</td><td>${f.type === '9' ? '數字' : '英數字'}，${f.len} 個字</td></tr>`).join('');
    $('#chart-table tbody').innerHTML = fin.chart.map(a => `<tr><td class="mono">${a.code}</td><td class="ind d${a.code.length <= 1 ? 0 : a.code.length <= 2 ? 1 : 2}">${esc(a.name)}</td><td>${a.until ? `<span class="badge warning">${a.until} 起停用，改用 ${a.replacedBy}</span>` : ''}</td></tr>`).join('');
  }
  $('#r-q').addEventListener('input', renderRules);

  // ---------- 分頁 ----------
  // 進階功能 (頁尾)：切換後回到頁首；每個進階頁上方有「回到檢查結果」
  function showTab(view) {
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    if (view !== 'check') window.scrollTo({ top: $('#view-' + view).offsetTop - 12 });
  }
  document.querySelectorAll('.view:not(#view-check)').forEach(v => v.insertAdjacentHTML('afterbegin', '<button class="back" type="button">← 回到檢查結果</button>'));
  document.addEventListener('click', e => { if (e.target.closest('.back')) showTab('check'); });
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.view));
  const hash = (location.hash || '').slice(1);

  // AI 只在線上版可用 (使用開啟者自己的 Claude 帳號)；在電腦上直接開啟時說明原因
  DQ.ai.ready.then(ok => {
    document.body.classList.toggle('no-ai', !ok);
    const was = $('#ai-out').textContent === INTRO;
    INTRO = ok ? INTRO + '（使用你自己的 Claude 帳號，第一次使用時會詢問是否允許。）' : DQ.ai.OFFLINE;
    if (was && !$('#ai-box').hidden) $('#ai-out').textContent = INTRO;
  });

  // 提供給規則匯入分頁使用
  DQ.app = {
    state, run, showTab, select, download, applyFix, rowLabel,
    setPacks(list) {
      state.packs = list;
      try {
        localStorage.setItem('dq-rule-packs', JSON.stringify(list.filter(x => !x.official)));
        localStorage.setItem('dq-official-off', JSON.stringify(list.filter(x => x.official && !x.on).map(x => offKey(x.pack))));
      } catch (e) { /* ignore */ }
      if (state.res) run(); else activeRules(); renderVersion();
    },
    loadOfficial,
    activeRules, base: BASE,
    setCustomRules(rules) { state.customRules = rules; try { localStorage.setItem('dq-custom-rules', JSON.stringify(rules)); } catch (e) { /* ignore */ } run(); },
  };

  // 手機上清單預設收起 (主要用逐筆確認)，按「看全部清單」展開
  $('#btn-list').onclick = () => { const on = document.body.classList.toggle('show-list'); $('#btn-list').setAttribute('aria-expanded', on); $('#btn-list').textContent = on ? '收起清單' : '看全部清單'; };
  // 頁尾：各險種規則的版本與條數
  function renderVersion() {
    const st = DQ.ruleStats.count(), MANUAL = { cancer: '個人癌症保險填報手冊', accident: '新式傷害保險填報手冊' };
    const on = state.packs.filter(x => x.on);
    $('#rule-version').textContent = `檢查依據：人壽保險業個人壽險填報手冊與檢核規則（2025 填報年度，${st.total} 條）` +
      st.ext.map(e => `、${MANUAL[e.key] || e.name}（${e.version} 年版，${e.n} 條）`).join('') + '。' +
      (on.length ? `另套用法規更新：${on.map(x => x.pack.name + (x.pack.version ? ` 第 ${x.pack.version} 版` : '')).join('、')}。` : '');
  }
  activeRules(); renderVersion();
  $('#link-updates').onclick = e => { e.preventDefault(); showTab('updates'); };
  document.addEventListener('click', e => { const a = e.target.closest('[data-goto]'); if (a) { e.preventDefault(); showTab(a.dataset.goto); } });
  // 打開時不載入任何資料：只顯示拖放框
  document.body.classList.add('no-data');
  $('#sample-note').textContent = '還沒有資料。把申報文字檔或 Excel 拖到上方的框。';
  if (['check', 'recon', 'decode', 'report', 'rules', 'updates'].includes(hash)) showTab(hash);
})();
