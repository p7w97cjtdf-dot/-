/* 介面控制 */
(function () {
  'use strict';
  const { DQ } = window;
  const rs = DQ.rulesets.life, fin = DQ.rulesets.finance, R = DQ.recon;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SEV = { error: '錯誤', warning: '警告' };
  const FILE = { L: '承保', D: '給付', S: '財報', R: '對帳' };
  const yuan = R.yuan;
  let INTRO = '規則引擎已完成逐欄檢核與對帳。按「產生 AI 分析摘要」，由 Claude 歸納錯誤的根本原因、修正優先順序與退件風險。';

  const state = { files: {}, res: null, sel: null, cat: '', customRules: [] };
  // 匯入並套用的規則與內建規則合併
  function activeRules() { return state.customRules.length ? DQ.dsl.extend(rs, state.customRules) : rs; }
  try { const saved = JSON.parse(localStorage.getItem('dq-custom-rules') || '[]'); if (Array.isArray(saved)) state.customRules = saved.filter(r => !DQ.dsl.validateRule(r, rs.layouts).length); } catch (e) { /* 無法讀取時忽略 */ }

  // ---------- 檔案 ----------
  const SLOTS = ['L', 'D', 'prior', 'control', 'statement'];
  function setFile(fid, name, text) {
    if ((fid === 'L' || fid === 'D') && /\.csv$/i.test(name)) { text = DQ.csvToFixedWidth(text, rs.layouts[fid]); name = name.replace(/\.csv$/i, '.txt'); }
    state.files[fid] = { name, text };
    $('#name-' + fid).textContent = name;
  }
  function guessSlot(name, fallback) {
    if (/^LFD/i.test(name)) return 'D';
    if (/^LFL/i.test(name)) { const y = name.match(/_(\d{4})/), cur = state.files.L && state.files.L.name.match(/_(\d{4})/); return y && cur && +y[1] < +cur[1] ? 'prior' : 'L'; }
    if (/控制|control/i.test(name)) return 'control';
    if (/資產負債|財報|statement|balance/i.test(name)) return 'statement';
    return fallback;
  }
  function readFile(fid, file) {
    const fr = new FileReader();
    fr.onload = () => { setFile(fid, file.name, String(fr.result)); run(); };
    fr.readAsText(file, 'utf-8');
  }
  for (const fid of SLOTS) {
    const input = $('#file-' + fid), drop = $('#drop-' + fid);
    input.addEventListener('change', () => input.files[0] && readFile(fid, input.files[0]));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); for (const f of e.dataTransfer.files) readFile(guessSlot(f.name, fid), f); });
  }
  function loadSample(inject) {
    const g = DQ.mock.generate({ inject });
    setFile('L', g.names.L, g.L); setFile('D', g.names.D, g.D);
    setFile('prior', g.names.prior, g.prior); setFile('control', g.names.control, g.control); setFile('statement', g.names.statement, g.statement);
    $('#sample-note').textContent = inject ? `已載入模擬資料：明細 ${g.key.length} 項錯誤、對帳與財報 ${g.reconKey.length} 項差異` : '已載入正確的模擬資料';
    state.key = inject ? g.key : null; state.reconKey = inject ? g.reconKey : null;
    run();
  }
  $('#btn-dirty').onclick = () => loadSample(true);
  $('#btn-clean').onclick = () => loadSample(false);

  // ---------- 執行 ----------
  function run() {
    const f = state.files;
    state.res = DQ.validate(activeRules(), { L: f.L, D: f.D });
    state.roll = f.L ? R.rollForward(state.res, f.prior && f.prior.text) : null;
    state.ctl = f.control ? R.controlRecon(state.res, f.control.text, state.roll ? state.roll.issues : []) : null;
    state.stmt = f.statement ? R.statement(f.statement.text, state.res) : null;
    state.extra = [].concat(state.roll ? state.roll.issues : [], state.ctl ? state.ctl.issues : [], state.stmt ? state.stmt.issues : []);
    state.sel = null; state.aiSummary = null;
    renderSummary(); renderCats(); renderTable(); renderDetail(); renderRecon(); renderReport(); renderRules(); renderDecodeExamples();
    if (DQ.app && DQ.app.onRun) DQ.app.onRun();
    $('#dec-out').innerHTML = ''; $('#dec-ai').textContent = '';
    $('#ai-out').className = 'ai-out'; $('#ai-out').textContent = INTRO;
    const reconErr = state.extra.filter(i => i.severity === 'error').length;
    $('#tc-check').textContent = state.res.summary.errors || '';
    $('#tc-recon').textContent = reconErr || '';
  }

  // ---------- 明細檢核 ----------
  function hitCount(key) { return key.filter(k => state.res.issues.some(i => i.ruleId === k.ruleId && (!k.policy || (i.policy || '').trim() === k.policy))).length; }
  function renderSummary() {
    const s = state.res.summary;
    const tiles = Object.entries(s.byFile).map(([fid, b]) => `
      <div class="tile ${b.passRate === 1 ? 'ok' : ''}"><span class="k">${rs.layouts[fid].title}通過率</span>
        <span class="v">${(b.passRate * 100).toFixed(1)}%</span>
        <span class="s">${b.records} 筆${b.policies ? `・${b.policies} 張保單` : ''}・${b.badRecords} 筆有錯</span>
        <span class="meter"><i style="width:${b.passRate * 100}%"></i></span></div>`).join('');
    const det = state.key ? `<div class="tile ok"><span class="k">注入錯誤偵測</span><span class="v">${hitCount(state.key)}/${state.key.length}</span><span class="s">模擬資料的解答比對</span></div>` : '';
    $('#summary').innerHTML = tiles +
      `<div class="tile ${s.errors ? 'err' : 'ok'}"><span class="k">錯誤</span><span class="v">${s.errors}</span><span class="s">${s.errors ? '修正後才能申報' : '可申報'}</span></div>
       <div class="tile ${s.warnings ? 'warn' : 'ok'}"><span class="k">警告</span><span class="v">${s.warnings}</span><span class="s">建議確認的合理性問題</span></div>
       <div class="tile"><span class="k">可自動修正</span><span class="v">${s.fixable}</span><span class="s">有明確修正值</span></div>${det}
       <div class="cats" id="cats"></div>`;
  }
  function renderCats() {
    const cats = Object.entries(state.res.summary.byCategory).sort((a, b) => b[1] - a[1]);
    $('#cats').innerHTML = cats.map(([c, n]) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${state.cat === c}">${esc(c)}<b>${n}</b></button>`).join('');
    $('#cats').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; state.cat = state.cat === b.dataset.cat ? '' : b.dataset.cat; $('#f-cat').value = state.cat; renderCats(); renderTable(); };
    $('#f-cat').innerHTML = '<option value="">全部類別</option>' + cats.map(([c]) => `<option${c === state.cat ? ' selected' : ''}>${esc(c)}</option>`).join('');
  }
  function filtered() {
    const sev = $('#f-sev').value, file = $('#f-file').value, cat = $('#f-cat').value, q = $('#f-q').value.trim().toLowerCase();
    return state.res.issues.filter(i => (!sev || i.severity === sev) && (!file || i.file === file) && (!cat || i.category === cat) &&
      (!q || [i.policy, i.ruleId, i.ruleName, i.message, DQ.report.fieldLabel(rs, i), i.value].join(' ').toLowerCase().includes(q)));
  }
  function renderTable() {
    const list = filtered();
    $('#issue-count').textContent = `${list.length} / ${state.res.issues.length}`;
    $('#issue-table tbody').innerHTML = list.length ? list.map(i => `
      <tr data-id="${i.id}" class="${state.sel === i.id ? 'sel' : ''}">
        <td class="sev"><i class="${i.severity}" title="${SEV[i.severity]}"></i></td>
        <td class="num">${FILE[i.file]}${i.line || '-'}</td>
        <td class="mono">${esc((i.policy || '').trim())}</td>
        <td class="mono">${esc(i.ruleId)}</td>
        <td>${esc(DQ.report.fieldLabel(rs, i).replace(/欄\d+ /g, ''))}</td>
        <td>${esc(i.message)}${i.fix ? '<span class="pill">可修正</span>' : ''}</td>
      </tr>`).join('') : `<tr><td colspan="6" class="empty">${state.res.issues.length ? '沒有符合篩選條件的問題' : '沒有發現任何問題，資料可申報。'}</td></tr>`;
  }
  ['#f-sev', '#f-file', '#f-q'].forEach(s => $(s).addEventListener('input', renderTable));
  $('#f-cat').addEventListener('input', () => { state.cat = $('#f-cat').value; renderCats(); renderTable(); });
  $('#issue-table tbody').addEventListener('click', e => { const tr = e.target.closest('tr[data-id]'); if (tr) select(+tr.dataset.id); });
  function select(id) { state.sel = id; renderTable(); renderDetail(); const tr = $(`#issue-table tr[data-id="${id}"]`); if (tr) tr.scrollIntoView({ block: 'nearest' }); }

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
    const i = state.res && state.res.issues.find(x => x.id === state.sel);
    if (!i) {
      el.innerHTML = `<h3>選取一個問題</h3><p class="hint">這裡會顯示該筆資料的欄位位置（字元起迄）、同保單的其他異動、修正建議，並可請 AI 解釋。</p><p class="hint">「·」代表空白；黃色標示為出問題的欄位。</p>`;
      return;
    }
    const lay = rs.layouts[i.file];
    const rec = (state.res.data[i.file] || []).find(r => r._line === i.line);
    const okLen = rec && rec._raw.length === lay.recordLength;
    const all = okLen ? lay.fields.map(f => ({ f, hit: i.fields.includes(f.key) })) : [];
    const hits = all.filter(x => x.hit), rest = all.filter(x => !x.hit);
    const row = ({ f, hit }) => `<tr class="${hit ? 'hit' : ''}"><td class="num">${f.no}</td><td>${esc(f.name)}</td><td class="num mono">${f.start}-${f.start + f.len - 1}</td><td class="v">${esc(rec[f.key])}</td></tr>`;
    const siblings = okLen && i.file === 'L' ? state.res.data.L.filter(r => r !== rec && r._raw.length === lay.recordLength && lay.keyOf(r) === lay.keyOf(rec)) : [];
    el.innerHTML = `
      <div><span class="badge ${i.severity}">${SEV[i.severity]}</span> <span class="mono">${esc(i.ruleId)}</span></div>
      <h3>${esc(i.message)}</h3>
      <dl class="kv">
        <dt>檢核項目</dt><dd>${esc(i.ruleName || '-')}</dd>
        <dt>依據</dt><dd>${esc(i.ref || '-')}</dd>
        <dt>位置</dt><dd>${lay.title} 第 ${i.line || '-'} 行${i.policy ? `・保單 <span class="mono">${esc(i.policy.trim())}</span>` : ''}</dd>
        <dt>欄位</dt><dd>${esc(DQ.report.fieldLabel(rs, i) || '-')}</dd>
        ${i.value !== '' ? `<dt>欄位值</dt><dd class="mono">${esc(String(i.value).replace(/ /g, '·'))}</dd>` : ''}
      </dl>
      <div class="fixbox"><div><b>修正建議：</b>${esc(i.suggestion || '請人工確認')}</div>
        ${i.fix ? `<div><button class="btn small" id="btn-fix-one">套用此修正</button> <span class="mono hint">${esc(lay.field(i.fix.field).name)} → ${esc(i.fix.value)}</span></div>` : ''}</div>
      ${rec ? `<div><div class="label">原始資料（每列 50 字元，左側為起始位置）</div><div class="ruler">${ruler(lay, rec._raw, i.fields)}</div></div>` : ''}
      ${hits.length ? `<table class="fields"><tbody>${hits.map(row).join('')}</tbody></table>` : ''}
      ${rest.length ? `<details><summary class="hint">顯示其餘 ${rest.length} 個欄位</summary><table class="fields"><tbody>${rest.map(row).join('')}</tbody></table></details>` : ''}
      ${siblings.length ? `<div><div class="label">同保單其他異動</div><table class="fields"><tbody>${[rec].concat(siblings).sort((a, b) => a.txnSeq.localeCompare(b.txnSeq)).map(r => `<tr class="${r === rec ? 'hit' : ''}"><td class="num">第${r._line}行</td><td class="v">${r.txnSeq}</td><td class="v">${r.addType} ${r.addDate}</td><td class="v">→ ${r.exitType} ${r.exitDate}</td></tr>`).join('')}</tbody></table></div>` : ''}
      <div><button class="btn ghost small" id="btn-explain">請 AI 解釋這個問題</button><div class="ask" id="explain-out"></div></div>`;
    const one = $('#btn-fix-one');
    if (one) one.onclick = () => applyFix([i.id]);
    $('#btn-explain').onclick = async () => {
      const key = apiKey(), out = $('#explain-out');
      if (!key && !DQ.ai.usesPlatform()) { out.textContent = '請先在上方「AI 分析」輸入 Anthropic API key。'; return; }
      out.textContent = 'Claude 分析中…';
      try { out.textContent = await DQ.ai.explain(key, rs, state.res, i); } catch (e) { out.textContent = 'AI 呼叫失敗：' + e.message; }
    };
  }

  // ---------- 修正 / 下載 ----------
  let saver = null;
  if (window.claude && window.claude.use) window.claude.use('downloads').then(d => { saver = d; }, () => {});
  async function download(name, text, type) {
    if (saver) {
      try { await saver.save({ filename: name, data: text }); }
      catch (e) { $('#action-note').textContent = e && e.code === 'declined' ? '已取消下載。' : '此處無法下載檔案。'; }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: type || 'text/plain;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function applyFix(ids) {
    let total = 0;
    for (const fid of ['L', 'D']) {
      if (!state.files[fid]) continue;
      const out = DQ.applyFixes(rs, state.res, fid, ids);
      if (out.applied) { state.files[fid] = { name: state.files[fid].name, text: out.text }; total += out.applied; }
    }
    const before = state.res.summary.errors + state.res.summary.warnings;
    run();
    const after = state.res.summary.errors + state.res.summary.warnings;
    $('#action-note').textContent = total ? `已套用 ${total} 項修正，問題由 ${before} 項降為 ${after} 項。修正後檔案可下載。` : '沒有可套用的修正。';
  }
  $('#btn-fix').onclick = () => applyFix(null);
  $('#btn-dl-fixed').onclick = () => state.files.L && download(state.files.L.name, state.files.L.text);
  $('#btn-dl-csv').onclick = () => download('檢核問題清單.csv', DQ.report.toCSV(rs, state.res, state.extra), 'text/csv;charset=utf-8');
  $('#btn-dl-reject').onclick = () => download('不符資料_' + (state.files.L ? state.files.L.name : 'LFL.txt'), DQ.report.toRejectFile(rs, state.res, 'L'));
  $('#btn-dl-report').onclick = () => download('檢核報告.html', reportHTML(), 'text/html;charset=utf-8');

  // ---------- 跨系統對帳 ----------
  const STATUS_CLS = { 一致: 'ok', 時間差: 'info', 定義差: 'info', 待查: 'bad', 格式錯誤: 'bad' };
  function renderRecon() {
    // 控制總數
    if (!state.ctl) { $('#ctl-chips').innerHTML = '<span class="hint">尚未匯入上游控制總數 CSV（欄位：來源系統, 項目代號, 項目名稱, 期間, 筆數, 金額）。</span>'; $('#ctl-table tbody').innerHTML = ''; }
    else {
      const s = state.ctl.summary;
      $('#ctl-chips').innerHTML = [['一致', s.ok], ['時間差', s.timing], ['定義差', s.definition], ['待查', s.open]].map(([k, n]) => `<span class="st ${STATUS_CLS[k]}">${k} <b>${n}</b></span>`).join('');
      const only = $('#ctl-diff-only').checked;
      const rows = state.ctl.rows.filter(r => !only || r.status !== '一致');
      $('#ctl-table tbody').innerHTML = rows.length ? rows.map(r => r.up ? `<tr>
        <td>${esc(r.source)}</td><td>${esc(r.name)}</td><td class="mono">${esc(r.period)}</td>
        <td class="num">${r.up.cnt} 筆<br>${yuan(r.up.amt)}</td><td class="num">${r.fil.cnt} 筆<br>${yuan(r.fil.amt)}</td>
        <td class="num ${r.diff.cnt || r.diff.amt ? 'neg' : ''}">${r.diff.cnt} 筆<br>${yuan(r.diff.amt)}</td>
        <td><span class="st ${STATUS_CLS[r.status]}">${r.status}</span></td>
        <td class="explain">${esc(r.explain || '')}${r.suggestion ? `<div class="hint">${esc(r.suggestion)}</div>` : ''}${(r.related || []).length ? `<div>${[...new Set(r.related.map(i => i.id).filter(Boolean))].slice(0, 6).map(id => `<button class="chip jump" data-id="${id}">明細 #${id}</button>`).join(' ')}</div>` : ''}</td></tr>`
        : `<tr><td colspan="8">${esc(r.explain)}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">上游控制總數與申報明細完全一致。</td></tr>';
    }
    // 結轉
    if (state.roll) {
      const m = state.roll.movement, row = (k, c, a, cls) => `<tr class="${cls || ''}"><td>${k}</td><td class="num">${c == null ? '' : c.toLocaleString()}</td><td class="num">${a == null ? '' : yuan(a)}</td></tr>`;
      const priorDiff = state.roll.hasPrior ? [m.open[0] - m.priorClose[0], m.open[1] - m.priorClose[1]] : null;
      $('#roll-table tbody').innerHTML =
        (state.roll.hasPrior ? row('上年度申報期末有效', m.priorClose[0], m.priorClose[1], 'muted') : '') +
        row('期初有效', m.open[0], m.open[1], 'strong') +
        (priorDiff && (priorDiff[0] || priorDiff[1]) ? row('　與上年度期末差異', priorDiff[0], priorDiff[1], 'bad') : '') +
        row('＋ 新契約', m.new[0], m.new[1]) + row('＋ 保額增加 (INN)', null, m.inc[1]) + row('－ 保額減少 (DNN)', null, m.dec[1]) +
        row('± 繳清 / 展期 / 契約轉換', null, m.adj[1]) + (m.unexplained[1] ? row('± 保額變動但無對應異動', null, m.unexplained[1], 'bad') : '') +
        Object.entries(m.term).map(([k, v]) => row(`－ 終止：${k}`, -v[0], -v[1])).join('') +
        row('＝ 期末有效（推算）', m.close[0], m.close[1], 'strong') + row('期末有效（申報明細）', m.closeActual[0], m.closeActual[1], m.close[1] === m.closeActual[1] ? 'muted' : 'bad');
      const iss = state.roll.issues;
      $('#roll-issues tbody').innerHTML = iss.length ? iss.map(i => `<tr><td class="mono">${i.ruleId}</td><td class="mono">${esc(i.policy)}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}</td></tr>`).join('')
        : `<tr><td colspan="4" class="empty">${state.roll.hasPrior ? '期初與上年度期末逐保單一致，年度內保額變動皆有對應異動。' : '匯入上年度承保檔後，可逐保單核對上年度期末與本年度期初。'}</td></tr>`;
    }
    // 財報
    if (!state.stmt) { $('#stmt-banner').innerHTML = '<p class="hint">尚未匯入資產負債表 CSV（欄位：科目代號, 科目名稱, 期初餘額, 本期增加, 本期減少, 期末餘額）。</p>'; $('#stmt-chains').innerHTML = ''; $('#stmt-table tbody').innerHTML = ''; return; }
    const st = state.stmt;
    $('#stmt-banner').innerHTML = `<div class="banner ${st.summary.balanced ? 'ok' : 'bad'}"><b>${st.summary.balanced ? '資產 = 負債 + 權益，資產負債表平衡' : '資產負債表不平衡'}</b>　${st.summary.errors} 項錯誤、${st.summary.warnings} 項提醒</div>`;
    $('#stmt-chains').innerHTML = st.chains.map(ch => `<div class="chain"><div class="label">根因分析：一個錯誤造成 ${ch.effects.length + 1} 個檢核不通過</div>
      <div class="chain-root"><span class="badge error">根因</span> <span class="mono">${esc(ch.root.code)}</span> ${esc(ch.root.message)}<div class="hint">${esc(ch.root.suggestion)}</div></div>
      <div class="chain-fx">${ch.effects.map(e => `<div>↳ <span class="mono">${e.ruleId} ${esc(e.code)}</span> ${esc(e.message)}</div>`).join('')}</div></div>`).join('') +
      st.issues.filter(i => !i.chain).map(i => `<div class="chain single"><span class="badge ${i.severity}">${i.ruleId}</span> <span class="mono">${esc(i.code)}</span> ${esc(i.message)}<div class="hint">${esc(i.explain || '')} ${esc(i.suggestion)}</div></div>`).join('');
    const byRow = new Map();
    for (const i of st.issues) { if (!byRow.has(i.line)) byRow.set(i.line, []); byRow.get(i.line).push(i); }
    $('#stmt-table tbody').innerHTML = st.rows.map(r => {
      const iss = byRow.get(r.line) || [];
      const depth = r.code.length <= 1 ? 0 : r.code.length <= 2 ? 1 : 2;
      return `<tr class="${iss.some(i => i.severity === 'error') ? 'row-bad' : iss.length ? 'row-warn' : ''} d${depth}"><td class="mono">${esc(r.code)}</td><td class="ind">${esc(r.name)}</td>
        <td class="num">${yuan(r.open)}</td><td class="num">${yuan(r.inc)}</td><td class="num">${yuan(r.dec)}</td><td class="num">${yuan(r.close)}</td>
        <td>${iss.map(i => `<span class="badge ${i.severity}" title="${esc(i.message)}">${i.ruleId}${i.chainRole ? '・' + i.chainRole : ''}</span>`).join(' ')}</td></tr>`;
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
  function decodeNow() {
    const text = $('#dec-text').value;
    state.decoded = R.decode(text, { res: state.res, extra: state.extra, catalogs: [rs.catalog, fin.catalog] });
    const d = state.decoded;
    $('#dec-ai').textContent = '';
    $('#dec-out').innerHTML = d.findings.length ? `<p class="hint">已定位 ${d.located} 個具體問題。</p>` + d.findings.map(f => `
      <div class="finding">
        <div class="f-head"><span class="badge info">${esc(f.kind)}</span> <b class="mono">${esc(f.clue)}</b></div>
        <p>${esc(f.explain)}</p>
        ${f.matches.length ? f.groups.map(g => `<details ${f.groups.length <= 3 ? 'open' : ''}><summary><span class="mono">${esc(g.ruleId)}</span> ${esc(g.name)} <b>${g.items.length} 筆</b></summary>
          <div class="table-wrap flat"><table><thead><tr><th>位置</th><th>保單/科目</th><th>欄位</th><th>值</th><th>問題</th><th>修正建議</th></tr></thead><tbody>
          ${g.items.slice(0, 50).map(i => `<tr><td class="num">${i.id && (i.file === 'L' || i.file === 'D') ? `<button class="chip jump" data-id="${i.id}">${FILE[i.file]}第 ${i.line} 行</button>` : `${FILE[i.file] || ''}${i.line ? ' 第 ' + i.line + ' 列' : ''}`}</td>
            <td class="mono">${esc((i.policy || i.code || '').trim())}</td><td>${esc(i.file === 'L' || i.file === 'D' ? DQ.report.fieldLabel(rs, i).replace(/欄\d+ /g, '') : '')}</td>
            <td class="mono">${esc(String(i.value).trim())}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}${i.fix ? ` <span class="pill">→ ${esc(i.fix.value)}</span>` : ''}</td></tr>`).join('')}
          </tbody></table></div></details>`).join('') : '<p class="hint">目前資料未重現此錯誤：可能已修正，或退件所依據的是另一版本的檔案。</p>'}
      </div>`).join('') : '<p class="hint">請輸入退件訊息。</p>';
  }
  $('#btn-decode').onclick = decodeNow;
  $('#btn-decode-ai').onclick = async () => {
    const key = apiKey(), out = $('#dec-ai');
    if (!$('#dec-text').value.trim()) { out.textContent = '請先貼上退件訊息。'; return; }
    if (!state.decoded) decodeNow();
    if (!key && !DQ.ai.usesPlatform()) { out.textContent = '請先在「明細檢核」分頁的 AI 分析輸入 Anthropic API key。'; return; }
    out.className = 'ai-out'; out.textContent = 'Claude 正在解讀退件訊息…';
    try { out.textContent = await DQ.ai.decode(key, $('#dec-text').value, state.decoded); out.className = 'ai-out done'; } catch (e) { out.textContent = 'AI 呼叫失敗：' + e.message; }
  };

  // ---------- AI ----------
  function apiKey() {
    const v = $('#api-key').value.trim();
    try { if (v) localStorage.setItem('dq-api-key', v); } catch (e) { /* 無法儲存時忽略 */ }
    return v;
  }
  try { $('#api-key').value = localStorage.getItem('dq-api-key') || ''; } catch (e) { /* ignore */ }
  // 本機設定檔 config.local.js (不進版控) 可預先帶入 key
  if (!$('#api-key').value && window.DQ_CONFIG && window.DQ_CONFIG.apiKey) $('#api-key').value = window.DQ_CONFIG.apiKey;
  $('#btn-ai').onclick = async () => {
    const key = apiKey(), out = $('#ai-out');
    if (!key && !DQ.ai.usesPlatform()) { out.textContent = '請輸入 Anthropic API key。金鑰只保存在你的瀏覽器，用來直接呼叫 Claude API。'; return; }
    $('#btn-ai').disabled = true; out.className = 'ai-out'; out.textContent = 'Claude 正在分析檢核與對帳結果…';
    try {
      state.aiSummary = await DQ.ai.summarize(key, rs, state.res, { ctl: state.ctl, roll: state.roll, stmt: state.stmt });
      out.className = 'ai-out done'; out.textContent = state.aiSummary; renderReport();
    } catch (e) { out.textContent = 'AI 呼叫失敗：' + e.message; }
    $('#btn-ai').disabled = false;
  };

  // ---------- 報告 / 規則 ----------
  function reportHTML() { return DQ.report.toHTML(rs, state.res, { aiSummary: state.aiSummary, recon: { ctl: state.ctl, roll: state.roll, stmt: state.stmt } }); }
  function renderReport() { $('#report-frame').srcdoc = reportHTML(); }
  function renderRules() {
    const q = $('#r-q').value.trim().toLowerCase();
    const by = {};
    for (const i of state.res.issues.concat(state.extra || [])) by[i.ruleId] = (by[i.ruleId] || 0) + 1;
    const cat = activeRules().catalog.concat(fin.catalog);
    const list = cat.filter(r => !q || [r.id, r.name, r.level, r.ref].join(' ').toLowerCase().includes(q));
    $('#rules-meta').textContent = `共 ${cat.length} 條檢核規則（資料類型、代碼、單筆、多筆、跨檔、邏輯合理性、跨系統對帳、期初期末結轉、財報勾稽）`;
    $('#rule-table tbody').innerHTML = list.map(r => `<tr><td class="mono">${esc(r.id)}</td><td>${esc(r.level)}</td><td>${esc(r.name)}</td><td>${esc(r.ref)}</td><td><span class="badge ${r.severity}">${SEV[r.severity]}</span></td><td class="num">${by[r.id] || ''}</td></tr>`).join('');
    $('#layout-table tbody').innerHTML = rs.layouts.L.fields.map(f => `<tr><td class="num">${f.no}</td><td>${esc(f.name)}</td><td class="num">${f.start}</td><td class="num">${f.start + f.len - 1}</td><td class="mono">${f.type}(${String(f.len).padStart(2, '0')})</td></tr>`).join('');
    $('#chart-table tbody').innerHTML = fin.chart.map(a => `<tr><td class="mono">${a.code}</td><td class="ind d${a.code.length <= 1 ? 0 : a.code.length <= 2 ? 1 : 2}">${esc(a.name)}</td><td>${a.until ? `<span class="badge warning">${a.until} 停用 → ${a.replacedBy}</span>` : ''}</td></tr>`).join('');
  }
  $('#r-q').addEventListener('input', renderRules);

  // ---------- 分頁 ----------
  function showTab(view) {
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
  }
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.view));
  const hash = (location.hash || '').slice(1);

  // 線上頁面：使用平台內建 Claude，隱藏 API key 欄位
  DQ.ai.ready.then(ok => {
    if (!ok) return;
    $('#api-key').hidden = true;
    const was = $('#ai-out').textContent === INTRO;
    INTRO += '（使用你的 Claude 帳號，不需 API key；第一次使用時會詢問是否允許。）';
    if (was) $('#ai-out').textContent = INTRO;
  });

  // 提供給規則匯入分頁使用
  DQ.app = {
    state, run, showTab, select, apiKey: () => apiKey(), download,
    setCustomRules(rules) { state.customRules = rules; try { localStorage.setItem('dq-custom-rules', JSON.stringify(rules)); } catch (e) { /* ignore */ } run(); },
  };

  loadSample(true);
  if (state.res.issues.length) select(state.res.issues.find(i => i.line && i.fields.length).id);
  if (['check', 'recon', 'decode', 'report', 'rules'].includes(hash)) showTab(hash);
})();
