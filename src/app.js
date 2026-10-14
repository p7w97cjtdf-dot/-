/* 介面控制 */
(function () {
  'use strict';
  const { DQ } = window;
  const rs = DQ.rulesets.life, fin = DQ.rulesets.finance, R = DQ.recon;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LB = DQ.labels, SEV = LB.SEV, SHEET = LB.SHEET;
  const yuan = R.yuan;
  let INTRO = '檢查已完成。按「請 AI 整理重點」，AI 會用白話說明問題主要出在哪裡、先改什麼，以及被退件的可能性。';

  const state = { files: {}, res: null, sel: null, cat: '', customRules: [] };
  // 匯入並套用的規則與內建規則合併
  function activeRules() { return state.customRules.length ? DQ.dsl.extend(rs, state.customRules) : rs; }
  try { const saved = JSON.parse(localStorage.getItem('dq-custom-rules') || '[]'); if (Array.isArray(saved)) state.customRules = saved.filter(r => !DQ.dsl.validateRule(r, rs.layouts).length); } catch (e) { /* 無法讀取時忽略 */ }

  // ---------- 檔案 ----------
  const SLOTS = ['L', 'D', 'prior', 'control', 'statement', 'products', 'customers'];
  function setFile(fid, name, text, fromSheet) {
    if ((fid === 'L' || fid === 'D') && /\.csv$/i.test(name)) { text = DQ.csvToFixedWidth(text, rs.layouts[fid]); name = name.replace(/\.csv$/i, '.txt'); }
    state.files[fid] = { name, text, fromSheet: !!fromSheet };
    $('#name-' + fid).textContent = name;
  }
  function guessSlot(name, fallback) {
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
    if (!window.XLSX) { $('#sample-note').textContent = '讀取 Excel 的元件沒有載入成功（可能是網路或公司防火牆擋住）。請確認網路後重新整理頁面，或請 IT 開放 cdnjs.cloudflare.com。'; return; }
    let wb;
    try { wb = XLSX.read(await file.arrayBuffer(), { type: 'array' }); }
    catch (e) { $('#sample-note').textContent = `「${file.name}」無法開啟：檔案可能已損毀或設有密碼。請在 Excel 打開後另存新檔（.xlsx，不設密碼）再試一次。`; return; }
    const { got, from, blank } = DQ.workbook.slots(XLSX, wb);
    if (!got.L && !got.D && blank.length) { $('#sample-note').textContent = `「${file.name}」的工作表只有標題列、還沒有資料。請從第二列開始填入保單資料或理賠資料，再放進來。`; return; }
    if (!Object.keys(got).length) { $('#sample-note').textContent = `「${file.name}」裡找不到可以辨識的工作表。工作表名稱需包含：保單資料、理賠資料、客戶資料、商品資料、去年保單資料、系統總數或資產負債表`; return; }
    const fs = DQ.workbook.files(got);
    for (const [slot, f] of Object.entries(fs)) { state.files[slot] = f; $('#name-' + slot).textContent = `工作表「${from[slot]}」`; }
    state.key = state.reconKey = state.masterKey = state.anomalyKey = null;
    $('#sample-note').textContent = `已讀取「${file.name}」的 ${Object.keys(got).length} 張工作表：${Object.keys(got).map(k => from[k]).join('、')}`;
    run();
  }
  // 文字檔與 CSV：先當 UTF-8 讀，失敗時改用 Big5 (Windows 的 Excel「另存 CSV」預設是 Big5)
  function decodeText(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, ''); }
    catch (e) { return new TextDecoder('big5').decode(buf); }
  }
  async function readFile(fid, file) {
    if (BOOK.test(file.name)) { readWorkbook(file); return; }
    setFile(fid, file.name, decodeText(await file.arrayBuffer()));
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
  function readMany(files) {
    const unknown = [];
    for (const f of files) {
      if (BOOK.test(f.name)) { readWorkbook(f); continue; }
      const slot = guessSlot(f.name, null);
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
  const SLOT_NAME = { L: '保單資料', D: '理賠資料', prior: '去年保單資料', control: '系統總數', statement: '資產負債表', products: '商品資料', customers: '客戶資料' };
  function run() {
    const f = state.files;
    // 沒有保單資料也沒有理賠資料時無法檢查：說明還缺什麼，不顯示「0 個問題」
    if (!f.L && !f.D) {
      document.body.classList.add('no-data');
      $('#sample-note').textContent = `已放入：${Object.keys(f).filter(k => f[k]).map(k => SLOT_NAME[k]).join('、')}。還需要保單資料或理賠資料才能開始檢查。`;
      return;
    }
    document.body.classList.remove('no-data');
    const t0 = performance.now();
    state.res = DQ.validate(activeRules(), { L: f.L, D: f.D });
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
    state.res.summary = DQ.summarize(rs, state.res.issues, state.res.meta);
    state.roll = f.L ? R.rollForward(state.res, f.prior && f.prior.text) : null;
    state.ctl = f.control ? R.controlRecon(state.res, f.control.text, state.roll ? state.roll.issues : []) : null;
    state.stmt = f.statement ? R.statement(f.statement.text, state.res) : null;
    state.elapsed = performance.now() - t0;
    console.info(`[檢核耗時] ${(state.elapsed / 1000).toFixed(3)} 秒：承保 ${(f.L && state.res.meta.L) ? state.res.meta.L.count : 0} 筆、給付 ${(f.D && state.res.meta.D) ? state.res.meta.D.count : 0} 筆，${Object.values(f).filter(Boolean).length} 個檔案`);
    state.extra = [].concat(state.roll ? state.roll.issues : [], state.ctl ? state.ctl.issues : [], state.stmt ? state.stmt.issues : [], mst.filter(i => i.file !== 'L'));
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
  function renderSummary() {
    const s = state.res.summary, all = state.all;
    const n = sev => all.filter(i => i.severity === sev).length;
    const fixable = all.filter(i => i.fix && state.res.issues.includes(i)).length;
    const tile = (cls, k, v, sub) => `<div class="tile ${cls}"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${sub}</span></div>`;
    $('#summary').innerHTML =
      tile(n('error') ? 'err' : 'ok', SEV.error, n('error'), n('error') ? LB.SEV_HINT.error : '沒有必須修改的地方，可以送出') +
      tile(n('warning') ? 'warn' : 'ok', SEV.warning, n('warning'), LB.SEV_HINT.warning) +
      tile(n('suspect') ? 'suspect' : 'ok', SEV.suspect, n('suspect'), LB.SEV_HINT.suspect) +
      tile('fix', '可以一鍵修改', fixable, '工具知道正確的值');
    const recs = Object.entries(s.byFile).map(([fid, b]) => `${SHEET[fid]} ${b.records} 筆`).join('、');
    const allMst = [].concat(state.cust ? state.cust.issues : [], state.prod ? state.prod.issues : []);
    const found = state.key ? `　範例刻意放的錯誤找到：保單與理賠 ${hitCount(state.key)}/${state.key.length}、客戶與商品 ${state.masterKey.filter(k => allMst.some(i => i.ruleId === k.ruleId && i.policy === k.policy)).length}/${state.masterKey.length}。` : '';
    $('#summary-note').textContent = `已檢查 ${recs}，共 ${Object.values(state.files).filter(Boolean).length} 份資料，花了 ${(state.elapsed / 1000).toFixed(2)} 秒。${found}`;
  }
  function renderCats() {
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
  function renderTable() {
    const list = filtered();
    $('#issue-count').textContent = `${list.length} / ${state.all.length}`;
    $('#issue-table tbody').innerHTML = list.length ? list.map(i => `
      <tr data-id="${i.id}" class="${state.sel === i.id ? 'sel' : ''}">
        <td class="sev"><i class="${i.severity}" title="${SEV[i.severity]}"></i></td>
        <td class="where">${esc(i.sheet || '')} <span class="num">${rowLabel(i)}</span></td>
        <td class="mono">${esc((i.policy || i.code || '').trim())}</td>
        <td>${esc(DQ.report.fieldLabel(rs, i).replace(/欄\d+ /g, ''))}</td>
        <td class="mono val">${esc(String(i.value == null ? '' : i.value).replace(/ /g, '·'))}</td>
        <td>${esc(i.message)}</td>
        <td class="mono">${i.fix ? `${esc(i.fix.value)}${state.res.issues.includes(i) ? '<span class="pill">可一鍵修改</span>' : ''}` : ''}</td>
      </tr>`).join('') : `<tr><td colspan="7" class="empty">${state.all.length ? '沒有符合條件的問題' : '沒有發現任何問題，資料可以送出。'}</td></tr>`;
  }
  // 行號：文字檔為第 N 筆；由 Excel 匯入時換算成 Excel 列號 (第 1 列為標題)；CSV 工作表為檔案中的列號
  function rowLabel(i) {
    if (!i.line) return '';
    if (i.file === 'L' || i.file === 'D') { const f = state.files[i.file]; return f && f.fromSheet ? `第 ${i.line + 1} 列` : `第 ${i.line} 行`; }
    return `第 ${i.line} 列`;
  }
  ['#f-sev', '#f-file', '#f-q'].forEach(s => $(s).addEventListener('input', renderTable));
  $('#f-cat').addEventListener('input', () => { state.cat = $('#f-cat').value; renderCats(); renderTable(); });
  $('#issue-table tbody').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) select(+tr.dataset.id); });
  function select(id, quiet) { state.sel = id; renderTable(); renderDetail(); const tr = $(`#issue-table tr[data-id="${id}"]`); if (tr && !quiet) tr.scrollIntoView({ block: 'nearest' }); }

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
      el.innerHTML = `<h3>點左邊任一個問題</h3><p class="hint">這裡會說明問題在哪裡、建議怎麼改，需要時可以展開那一行的原始資料。</p>`;
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
    el.innerHTML = `
      <div><span class="badge ${i.severity}">${SEV[i.severity]}</span> <span class="hint">${esc(LB.SEV_HINT[i.severity] || '')}</span></div>
      <h3>${esc(i.message)}</h3>
      <dl class="kv">
        <dt>檢查項目</dt><dd>${esc(i.ruleName || LB.cat(i.category))}</dd>
        <dt>位置</dt><dd>${esc(i.sheet || lay.title)} ${rowLabel(i) || ''}${i.code ? `・科目 <span class="mono">${esc(i.code)}</span>` : ''}${i.policy ? `・保單 <span class="mono">${esc(i.policy.trim())}</span>` : ''}</dd>
        <dt>欄位</dt><dd>${esc(DQ.report.fieldLabel(rs, i) || '-')}</dd>
        ${i.value !== '' ? `<dt>目前的值</dt><dd class="mono">${esc(String(i.value).replace(/ /g, '·'))}</dd>` : ''}
        ${i.fix ? `<dt>建議修正值</dt><dd class="mono fixval">${esc(i.fix.value)}</dd>` : ''}
        <dt>規則編號</dt><dd class="mono">${esc(i.ruleId)}${i.ref ? `<span class="hint">（${esc(i.ref)}）</span>` : ''}</dd>
      </dl>
      <div class="fixbox"><div><b>建議怎麼改：</b>${esc(i.suggestion || '請人工確認')}</div>
        ${i.fix && state.res.issues.includes(i) ? `<div><button class="btn small" id="btn-fix-one">改成建議的值</button> <span class="mono hint">${esc(lay.field(i.fix.field).name)} → ${esc(i.fix.value)}</span></div>` : ''}</div>
      ${rec ? `<details class="raw"><summary>顯示原始資料${range}</summary>
        <p class="hint">左邊數字是第幾個字；「·」代表空白；黃色是有問題的地方。</p>
        <div class="ruler">${ruler(lay, rec._raw, i.fields)}</div>
        ${hits.length ? `<table class="fields"><tbody>${hits.map(row).join('')}</tbody></table>` : ''}
        ${rest.length ? `<details><summary class="hint">看這一行的其他 ${rest.length} 個欄位</summary><table class="fields"><tbody>${rest.map(row).join('')}</tbody></table></details>` : ''}
      </details>` : ''}
      ${siblings.length ? `<div><div class="label">同一張保單的其他資料</div><table class="fields"><tbody>${[rec].concat(siblings).sort((a, b) => a.txnSeq.localeCompare(b.txnSeq)).map(r => `<tr class="${r === rec ? 'hit' : ''}"><td class="num">第${r._line}行</td><td class="v">${r.txnSeq}</td><td class="v">${r.addType} ${r.addDate}</td><td class="v">→ ${r.exitType} ${r.exitDate}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div><button class="btn ghost small ai-btn" id="btn-explain">請 AI 用白話解釋</button><p class="ai-notice">按下後會把這個問題和相關欄位送給 AI（Claude），不會送出整筆資料。</p><div class="ask" id="explain-out"></div></div>`;
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
    for (const fid of ['L', 'D']) {
      if (!state.files[fid]) continue;
      const out = DQ.applyFixes(rs, state.res, fid, ids);
      if (out.applied) { state.files[fid] = Object.assign({}, state.files[fid], { text: out.text }); total += out.applied; }
    }
    const before = state.res.summary.errors + state.res.summary.warnings;
    run();
    const after = state.res.summary.errors + state.res.summary.warnings;
    $('#action-note').textContent = total ? `已修改 ${total} 個地方，問題從 ${before} 個減為 ${after} 個。可以下載改好的資料。` : '沒有工具可以自動修改的地方。';
    return { total, before, after };
  }
  $('#btn-fix').onclick = () => applyFix(null);
  // 使用者自己的檔名若含中文，去掉中文字，避免存成「download」
  const safeName = (name, fallback) => { const n = String(name || '').replace(/[^\x21-\x7e]/g, ''); return /^[^.]+\.\w+$/.test(n) ? n : fallback; };
  $('#btn-dl-fixed').onclick = () => state.files.L && download(safeName(state.files.L.name, 'fixed_policies.txt'), state.files.L.text);
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
  function showAI(out, text) { out.innerHTML = `<div class="ai-tag">${esc(DQ.ai.LABEL)}</div><div class="ai-text">${esc(text)}</div>`; }
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
  function reportHTML() { return DQ.report.toHTML(rs, state.res, { elapsed: state.elapsed, aiSummary: state.aiSummary, recon: { ctl: state.ctl, roll: state.roll, stmt: state.stmt, cust: state.cust, prod: state.prod } }); }
  function renderReport() { $('#report-frame').srcdoc = reportHTML(); }
  // 手冊頁碼 (rules/rules.js)：PDF 頁碼與頁面上印的頁碼
  const SRCDOC = { rules: '檢核規則手冊', manual: '填報手冊' };
  function pageOf(id) {
    const src = window.DQ.ruleSource, r = src && src.rules.concat(src.toolRules).find(x => x.id === id);
    if (!r) return '<span class="hint">自訂規則</span>';
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
    const imported = cat.length - st.total;
    $('#rules-meta').textContent = `共 ${st.total} 條檢查規則：${st.cats.map(c => `${c.name} ${c.n}`).join('、')}${imported ? `；另有自訂規則 ${imported} 條` : ''}`;
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
    setCustomRules(rules) { state.customRules = rules; try { localStorage.setItem('dq-custom-rules', JSON.stringify(rules)); } catch (e) { /* ignore */ } run(); },
  };

  // 手機上清單預設收起 (主要用逐筆確認)，按「看全部清單」展開
  $('#btn-list').onclick = () => { const on = document.body.classList.toggle('show-list'); $('#btn-list').setAttribute('aria-expanded', on); $('#btn-list').textContent = on ? '收起清單' : '看全部清單'; };
  // 打開時不載入任何資料：只顯示拖放框
  document.body.classList.add('no-data');
  $('#sample-note').textContent = '還沒有資料。把申報文字檔或 Excel 拖到上方的框。';
  if (['check', 'recon', 'decode', 'report', 'rules'].includes(hash)) showTab(hash);
})();
