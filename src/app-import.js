/* 規則匯入分頁 */
(function () {
  'use strict';
  const { DQ } = window;
  const rs = DQ.rulesets.life, RI = DQ.ruleImport, dsl = DQ.dsl, S = DQ.ruleSamples, app = DQ.app;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FILE = { L: '承保檔', D: '給付檔' };
  const SEV = { error: '錯誤', warning: '警告' };
  const ST = { 可執行: 'ok', 與內建相同: 'info', 疑似轉錯: 'bad', 格式錯誤: 'bad' };

  const st = { pdf: null, pages: [], reviewed: [], unconvertible: [], source: '' };
  let cleanFiles = null;
  const clean = () => cleanFiles || (cleanFiles = (g => ({ L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D } }))(DQ.mock.generate({})));
  const current = () => ({ L: app.state.files.L, D: app.state.files.D });
  const note = (sel, t) => { $(sel).textContent = t; };

  // ---------- 讀取文件 ----------
  $('#file-rule').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    $('#name-rule').textContent = f.name; st.source = f.name;
    $('#imp-pages').hidden = true;
    try {
      const buf = await f.arrayBuffer();
      if (/\.pdf$/i.test(f.name)) {
        note('#conv-note', '讀取 PDF 中…');
        const out = await RI.pdfText(new Uint8Array(buf), 1, 9999, (i, n) => note('#conv-note', `讀取 PDF 第 ${i} / ${n} 頁…`));
        st.pages = out.text.split(/\n\n(?=［第 \d+ 頁］)/);
        // 建議頁數：含檢核編號或「檢核」字樣最集中的一段
        const score = st.pages.map(p => (p.match(/\d{5}_[A-Z]{1,2}\d{3,4}|檢核/g) || []).length);
        let best = 0, bestSum = -1;
        for (let i = 0; i < score.length; i++) { const sum = score.slice(i, i + 18).reduce((a, b) => a + b, 0); if (sum > bestSum) { bestSum = sum; best = i; } }
        $('#pg-from').value = best + 1; $('#pg-to').value = Math.min(out.pages, best + 18);
        $('#pg-from').max = $('#pg-to').max = out.pages;
        $('#imp-pages').hidden = false;
        note('#pg-note', `共 ${out.pages} 頁；建議先轉換檢核條文最集中的第 ${best + 1}–${Math.min(out.pages, best + 18)} 頁（一次 20 頁內較快）`);
        fillPages();
      } else if (/\.docx$/i.test(f.name)) {
        $('#rule-text').value = await RI.docxText(buf);
      } else {
        $('#rule-text').value = new TextDecoder('utf-8').decode(buf);
      }
      note('#conv-note', `已讀取 ${$('#rule-text').value.length.toLocaleString()} 字`);
    } catch (err) { note('#conv-note', '讀取失敗：' + err.message); }
  });
  function fillPages() {
    const a = Math.max(1, +$('#pg-from').value), b = Math.min(st.pages.length, +$('#pg-to').value);
    $('#rule-text').value = st.pages.slice(a - 1, b).join('\n\n');
    note('#conv-note', `第 ${a}–${b} 頁，${$('#rule-text').value.length.toLocaleString()} 字，約分 ${RI.chunk($('#rule-text').value).length} 段轉換`);
  }
  $('#btn-pages').onclick = fillPages;
  $('#ex-company').onclick = () => { $('#rule-text').value = S.company; st.source = '公司內部核保規則（範例）'; note('#conv-note', '已載入範例：公司內部核保規則（內建檢核沒有的規則）'); };
  $('#ex-manual').onclick = () => { $('#rule-text').value = S.manual; st.source = '填報手冊檢核條文節錄（範例）'; note('#conv-note', '已載入範例：手冊條文節錄（可和內建規則對照轉換正確性）'); };

  // ---------- 轉換 ----------
  $('#btn-convert').onclick = async () => {
    const text = $('#rule-text').value.trim();
    if (!text) return note('#conv-note', '請先上傳規則文件或貼上條文。');
    const key = app.apiKey();
    if (!key && !DQ.ai.usesPlatform()) return note('#conv-note', '需要 Claude：請在「明細檢核」分頁的 AI 分析輸入 Anthropic API key，或按「載入預先轉換結果」。');
    $('#btn-convert').disabled = true;
    try {
      const out = await RI.convert(text, p => DQ.ai.convertRules(key, p), (i, n) => note('#conv-note', i < n ? `Claude 轉換中：第 ${i + 1} / ${n} 段…（每段約 30–90 秒）` : '轉換完成，試跑驗證中…'));
      st.unconvertible = out.unconvertible;
      show(out.rules, out.failures.length ? `${out.failures.length} 段轉換失敗（${out.failures.map(f => `第 ${f.part} 段：${f.message}`).join('；')}）` : '');
    } catch (err) { note('#conv-note', 'AI 轉換失敗：' + err.message); }
    $('#btn-convert').disabled = false;
  };
  $('#btn-preconverted').onclick = () => {
    const t = $('#rule-text').value;
    const which = t.includes('核保與理賠作業規範') ? ['company'] : t.includes('參、欄位檢核') ? ['manual'] : ['manual', 'company'];
    if (!t.trim()) { $('#rule-text').value = S.manual + '\n\n' + S.company; st.source = '範例文件'; }
    st.unconvertible = which.includes('company') ? S.converted.companyUnconvertible : [];
    show(which.flatMap(w => S.converted[w]), '', '預先轉換結果（開發時由 Claude 依相同格式說明轉出，供無法連線 AI 時展示）');
  };

  // ---------- 審核畫面 ----------
  function show(rules, warn, label) {
    st.reviewed = RI.review(rules, { base: rs, current: current(), clean: clean() });
    const n = s => st.reviewed.filter(r => r.status === s).length;
    $('#imp-result').hidden = false;
    $('#imp-meta').textContent = `${label || `來源：${st.source || '貼上的文字'}`}。共 ${st.reviewed.length} 條規則${st.unconvertible.length ? `，${st.unconvertible.length} 條無法轉換` : ''}。${warn || ''}`;
    $('#imp-chips').innerHTML = ['可執行', '與內建相同', '疑似轉錯', '格式錯誤'].map(s => `<span class="st ${ST[s]}">${s} <b>${n(s)}</b></span>`).join('');
    renderCards();
    note('#conv-note', `轉出 ${st.reviewed.length} 條規則（AI 產出），請對照原文檢查後勾選套用。`);
    $('#imp-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderCards() {
    $('#imp-cards').innerHTML = st.reviewed.map((r, k) => {
      const rule = r.rule, hits = r.hits || [];
      const statusNote = {
        可執行: '格式正確，正確範例資料上不觸發。',
        與內建相同: '與內建規則編號相同，預設不重複套用；可用來對照 AI 轉換是否正確。',
        疑似轉錯: `在正確範例資料上觸發 ${r.cleanHits} 筆：條件可能寫反或過嚴，請對照原文。`,
        格式錯誤: '規則無法執行：' + r.errors.join('；'),
      }[r.status];
      return `<article class="rule-card ${ST[r.status]}">
        <div class="rc-head">
          <label class="rc-check"><input type="checkbox" data-k="${k}" ${r.enabled ? 'checked' : ''} ${r.errors.length ? 'disabled' : ''}> 套用</label>
          <span class="st ${ST[r.status]}">${r.status}</span>
          <span class="ai-tag">AI 產出</span>
          <span class="mono">${esc(rule.id)}</span>
          <b>${esc(rule.name || '')}</b>
          <span class="hint">${FILE[rule.file] || rule.file}・${rule.scope === 'policy' ? '同保單多筆' : '單筆'}・${SEV[rule.severity] || '錯誤'}</span>
        </div>
        ${r.text ? `<div class="rc-logic">${r.text.when ? `<div><span class="kw">當</span>${esc(r.text.when)}</div>` : ''}<div><span class="kw">必須</span>${esc(r.text.assert)}</div></div>` : ''}
        ${rule.source ? `<blockquote class="rc-src">${esc(rule.source)}${rule.ref ? `<cite>${esc(rule.ref)}</cite>` : ''}</blockquote>` : ''}
        <div class="rc-test"><span class="${r.status === '疑似轉錯' || r.status === '格式錯誤' ? 'bad' : ''}">${esc(statusNote)}</span>
          ${r.errors.length ? '' : `<span>目前資料：<b>${hits.length}</b> 筆不通過${hits.length ? '：' + hits.slice(0, 4).map(h => `${FILE[h.file].slice(0, 2)}第 ${h.line} 行 <span class="mono">${esc(h.policy.trim())}</span>`).join('、') + (hits.length > 4 ? ' …' : '') : ''}</span>`}</div>
        <details><summary class="hint">規則 JSON</summary><pre class="rc-json">${esc(JSON.stringify(rule, null, 2))}</pre></details>
      </article>`;
    }).join('');
    $('#imp-unconv').innerHTML = st.unconvertible.length ? `<h3 class="mt">無法轉換的條文</h3>${st.unconvertible.map(u => `<div class="chain single"><span class="st bad">無法轉換</span> ${esc(u.source)}<div class="hint">${esc(u.reason)}</div></div>`).join('')}` : '';
  }
  $('#imp-cards').addEventListener('change', e => { const k = e.target.dataset.k; if (k != null) st.reviewed[+k].enabled = e.target.checked; });

  // ---------- 套用 / 匯出 / 匯入 ----------
  $('#btn-apply').onclick = () => {
    const pick = st.reviewed.filter(r => r.enabled && !r.errors.length).map(r => r.rule);
    if (!pick.length) return note('#conv-note', '沒有勾選任何規則。');
    const before = app.state.res.issues.length;
    const ids = new Set(pick.map(r => r.id));
    app.setCustomRules(app.state.customRules.filter(r => !ids.has(r.id)).concat(pick));
    const added = app.state.res.issues.filter(i => i.imported && ids.has(i.ruleId)).length;
    note('#conv-note', `已套用 ${pick.length} 條規則，明細檢核新增 ${added} 項問題（${before} → ${app.state.res.issues.length}）。`);
    $('#imp-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('#btn-dl-rules').onclick = () => app.download('檢核規則.json', JSON.stringify(st.reviewed.filter(r => r.enabled).map(r => r.rule), null, 2), 'application/json');
  $('#file-rules-json').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      st.source = f.name; st.unconvertible = data.unconvertible || [];
      show(Array.isArray(data) ? data : data.rules || [], '', `來源：${f.name}`);
      showTab('import');
    } catch (err) { note('#conv-note', 'JSON 格式錯誤：' + err.message); }
  });
  const showTab = v => app.showTab(v);
  $('#btn-clear-rules').onclick = () => { app.setCustomRules([]); note('#conv-note', '已移除所有匯入規則。'); };

  function renderApplied() {
    const rules = app.state.customRules, issues = app.state.res ? app.state.res.issues : [];
    $('#applied-count').textContent = rules.length ? `${rules.length} 條` : '';
    $('#tc-import').textContent = rules.length || '';
    $('#applied-list').innerHTML = rules.length ? rules.map(r => {
      const d = dsl.describe(r, rs.layouts), hits = issues.filter(i => i.ruleId === r.id && i.imported);
      return `<div class="applied-row"><span class="mono">${esc(r.id)}</span><span><b>${esc(r.name)}</b> <span class="ai-tag">AI 產出</span><span class="hint">${d.when ? `當 ${esc(d.when)}，` : ''}必須 ${esc(d.assert)}</span></span>
        <span>${hits.length ? `<button class="chip jump" data-id="${hits[0].id}">${hits.length} 筆不通過</button>` : '<span class="hint">0 筆</span>'}</span>
        <button class="chip" data-remove="${esc(r.id)}">移除</button></div>`;
    }).join('') : '<p class="hint">尚未套用任何匯入規則。</p>';
  }
  $('#applied-list').addEventListener('click', e => {
    const b = e.target.closest('[data-remove]'); if (!b) return;
    app.setCustomRules(app.state.customRules.filter(r => r.id !== b.dataset.remove));
  });
  app.onRun = renderApplied;
  renderApplied();
})();
