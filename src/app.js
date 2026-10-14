/* 介面控制 */
(function () {
  'use strict';
  const { DQ } = window;
  const rs = DQ.rulesets.life;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SEV = { error: '錯誤', warning: '警告' };
  const FILE = { L: '承保', D: '給付' };

  const state = { files: {}, res: null, sel: null, cat: '' };

  // ---------- 檔案 ----------
  function setFile(fid, name, text) {
    if (/\.csv$/i.test(name)) { text = DQ.csvToFixedWidth(text, rs.layouts[fid]); name = name.replace(/\.csv$/i, '.txt'); }
    state.files[fid] = { name, text };
    $('#name-' + fid).textContent = name;
  }
  function readFile(fid, file) {
    const fr = new FileReader();
    fr.onload = () => { setFile(fid, file.name, String(fr.result)); run(); };
    fr.readAsText(file, 'utf-8');
  }
  for (const fid of ['L', 'D']) {
    const input = $('#file-' + fid), drop = $('#drop-' + fid);
    input.addEventListener('change', () => input.files[0] && readFile(fid, input.files[0]));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('over');
      for (const f of e.dataTransfer.files) readFile(/^LFD/i.test(f.name) ? 'D' : /^LFL/i.test(f.name) ? 'L' : fid, f);
    });
  }
  function loadSample(inject) {
    const g = DQ.mock.generate({ inject });
    setFile('L', g.names.L, g.L); setFile('D', g.names.D, g.D);
    $('#sample-note').textContent = inject ? `已載入模擬資料：${g.key.length} 項刻意注入的錯誤（欄位、格式、邏輯、跨檔）` : '已載入正確的模擬資料';
    state.key = inject ? g.key : null;
    run();
  }
  $('#btn-dirty').onclick = () => loadSample(true);
  $('#btn-clean').onclick = () => loadSample(false);

  // ---------- 檢核 ----------
  function run() {
    state.res = DQ.validate(rs, state.files);
    state.sel = null;
    renderSummary(); renderCats(); renderTable(); renderDetail(); renderReport(); renderRules();
    $('#ai-out').className = 'ai-out';
    $('#ai-out').textContent = '規則引擎已完成逐欄檢核。按「產生 AI 分析摘要」，由 Claude 歸納錯誤的根本原因、修正優先順序與退件風險。';
  }

  function renderSummary() {
    const s = state.res.summary;
    const tiles = Object.entries(s.byFile).map(([fid, b]) => `
      <div class="tile ${b.passRate === 1 ? 'ok' : ''}"><span class="k">${rs.layouts[fid].title}通過率</span>
        <span class="v">${(b.passRate * 100).toFixed(1)}%</span>
        <span class="s">${b.records} 筆${b.policies ? `・${b.policies} 張保單` : ''}・${b.badRecords} 筆有錯</span>
        <span class="meter"><i style="width:${b.passRate * 100}%"></i></span></div>`).join('');
    const det = state.key ? (() => {
      const hit = state.key.filter(k => state.res.issues.some(i => i.ruleId === k.ruleId && (!k.policy || (i.policy || '').trim() === k.policy))).length;
      return `<div class="tile ok"><span class="k">注入錯誤偵測</span><span class="v">${hit}/${state.key.length}</span><span class="s">模擬資料的解答比對</span></div>`;
    })() : '';
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
  $('#issue-table tbody').addEventListener('click', e => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return;
    state.sel = +tr.dataset.id; renderTable(); renderDetail();
  });

  // ---------- 明細：欄位尺規 ----------
  function ruler(lay, raw, hitFields) {
    const marks = new Array(raw.length).fill(false);
    for (const k of hitFields) { const f = lay.field(k); if (f) for (let p = f.start - 1; p < f.start - 1 + f.len; p++) marks[p] = true; }
    const W = 50, rows = [];
    for (let s = 0; s < Math.max(raw.length, 1); s += W) {
      let line = `<span class="tick">${String(s + 1).padStart(3, '0')}│</span>`;
      let open = false;
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
      el.innerHTML = `<h3>選取一個問題</h3><p class="hint">右側會顯示該筆資料的欄位位置（字元起迄）、同保單的其他異動、修正建議，並可請 AI 解釋。</p>
        <p class="hint">「·」代表空白；黃色標示為出問題的欄位。</p>`;
      return;
    }
    const lay = rs.layouts[i.file];
    const rec = (state.res.data[i.file] || []).find(r => r._line === i.line);
    const okLen = rec && rec._raw.length === lay.recordLength;
    const fieldsHtml = okLen ? lay.fields.map(f => ({ f, hit: i.fields.includes(f.key) })) : [];
    const hits = fieldsHtml.filter(x => x.hit), rest = fieldsHtml.filter(x => !x.hit);
    const row = ({ f, hit }) => `<tr class="${hit ? 'hit' : ''}"><td class="num">${f.no}</td><td>${esc(f.name)}</td><td class="num mono">${f.start}-${f.start + f.len - 1}</td><td class="v">${esc(rec[f.key])}</td></tr>`;
    const siblings = okLen && lay.keyOf && i.file === 'L' ? state.res.data.L.filter(r => r !== rec && r._raw.length === lay.recordLength && lay.keyOf(r) === lay.keyOf(rec)) : [];
    el.innerHTML = `
      <div><span class="badge ${i.severity}">${SEV[i.severity]}</span> <span class="mono">${esc(i.ruleId)}</span></div>
      <h3>${esc(i.message)}</h3>
      <dl class="kv">
        <dt>檢核項目</dt><dd>${esc(i.ruleName || '-')}</dd>
        <dt>依據</dt><dd>${esc(i.ref || '-')}</dd>
        <dt>位置</dt><dd>${rs.layouts[i.file].title} 第 ${i.line || '-'} 行${i.policy ? `・保單 <span class="mono">${esc(i.policy.trim())}</span>` : ''}</dd>
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
      const key = apiKey(); const out = $('#explain-out');
      if (!key) { out.textContent = '請先在上方「AI 分析」輸入 Anthropic API key。'; return; }
      out.textContent = 'Claude 分析中…';
      try { out.textContent = await DQ.ai.explain(key, rs, state.res, i); } catch (e) { out.textContent = 'AI 呼叫失敗：' + e.message; }
    };
  }

  // ---------- 修正 / 下載 ----------
  function download(name, text, type) {
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
    const keep = state.key; run(); state.key = keep; renderSummary(); renderCats();
    const after = state.res.summary.errors + state.res.summary.warnings;
    $('#action-note').textContent = total ? `已套用 ${total} 項修正，問題由 ${before} 項降為 ${after} 項。修正後檔案可下載。` : '沒有可套用的修正。';
  }
  $('#btn-fix').onclick = () => applyFix(null);
  $('#btn-dl-fixed').onclick = () => state.files.L && download(state.files.L.name, state.files.L.text);
  $('#btn-dl-csv').onclick = () => download('檢核問題清單.csv', DQ.report.toCSV(rs, state.res), 'text/csv;charset=utf-8');
  $('#btn-dl-reject').onclick = () => download('不符資料_' + (state.files.L ? state.files.L.name : 'LFL.txt'), DQ.report.toRejectFile(rs, state.res, 'L'));
  $('#btn-dl-report').onclick = () => download('檢核報告.html', DQ.report.toHTML(rs, state.res, { aiSummary: state.aiSummary }), 'text/html;charset=utf-8');

  // ---------- AI ----------
  function apiKey() {
    const v = $('#api-key').value.trim();
    try { if (v) localStorage.setItem('dq-api-key', v); } catch (e) { /* 無法儲存時忽略 */ }
    return v;
  }
  try { $('#api-key').value = localStorage.getItem('dq-api-key') || ''; } catch (e) { /* ignore */ }
  $('#btn-ai').onclick = async () => {
    const key = apiKey(), out = $('#ai-out');
    if (!key) { out.textContent = '請輸入 Anthropic API key。金鑰只保存在你的瀏覽器，用來直接呼叫 Claude API。'; return; }
    $('#btn-ai').disabled = true; out.className = 'ai-out'; out.textContent = 'Claude 正在分析檢核結果…';
    try {
      state.aiSummary = await DQ.ai.summarize(key, rs, state.res);
      out.className = 'ai-out done'; out.textContent = state.aiSummary; renderReport();
    } catch (e) { out.textContent = 'AI 呼叫失敗：' + e.message; }
    $('#btn-ai').disabled = false;
  };

  // ---------- 報告 / 規則 ----------
  function renderReport() { $('#report-frame').srcdoc = DQ.report.toHTML(rs, state.res, { aiSummary: state.aiSummary }); }
  function renderRules() {
    const q = $('#r-q').value.trim().toLowerCase();
    const by = state.res ? state.res.summary.byRule : {};
    const list = rs.catalog.filter(r => !q || [r.id, r.name, r.level, r.ref].join(' ').toLowerCase().includes(q));
    $('#rules-meta').textContent = `共 ${rs.catalog.length} 條檢核規則（資料類型、代碼、單筆、多筆、跨檔、邏輯合理性）`;
    $('#rule-table tbody').innerHTML = list.map(r => `<tr><td class="mono">${esc(r.id)}</td><td>${esc(r.level)}</td><td>${esc(r.name)}</td><td>${esc(r.ref)}</td><td><span class="badge ${r.severity}">${SEV[r.severity]}</span></td><td class="num">${by[r.id] || ''}</td></tr>`).join('');
    $('#layout-table tbody').innerHTML = rs.layouts.L.fields.map(f => `<tr><td class="num">${f.no}</td><td>${esc(f.name)}</td><td class="num">${f.start}</td><td class="num">${f.start + f.len - 1}</td><td class="mono">${f.type}(${String(f.len).padStart(2, '0')})</td></tr>`).join('');
  }
  $('#r-q').addEventListener('input', renderRules);

  // ---------- 分頁 ----------
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + b.dataset.view; });
  });

  loadSample(true);
  // 預設選取第一個問題，讓畫面一開啟就看得到欄位尺規
  if (state.res.issues.length) { state.sel = state.res.issues.find(i => i.line && i.fields.length).id; renderTable(); renderDetail(); }
})();
