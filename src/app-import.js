/* 規則匯入分頁 */
(function () {
  'use strict';
  const { DQ } = window;
  const rs = DQ.rulesets.life, RI = DQ.ruleImport, dsl = DQ.dsl, S = DQ.ruleSamples, app = DQ.app;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FILE = { L: '保單資料', D: '理賠資料' };
  const SEV = DQ.labels.SEV;
  const ST = { 可執行: 'ok', 與內建相同: 'info', 疑似轉錯: 'bad', 格式錯誤: 'bad' };
  // 審核結果的白話名稱 (內部狀態名稱不變)
  const STN = { 可執行: '可以使用', 與內建相同: '和原本的檢查重複', 疑似轉錯: '可能轉錯了', 格式錯誤: '無法使用' };

  const st = { pdf: null, pages: [], reviewed: [], unconvertible: [], source: '' };
  let cleanFiles = null;
  const clean = () => cleanFiles || (cleanFiles = (g => ({ L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D } }))(DQ.mock.generate({})));
  const current = () => ({ L: app.state.files.L, D: app.state.files.D });
  const note = (sel, t) => { $(sel).textContent = t; };

  // ---------- 讀取文件 ----------
  $('#file-rule').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 25 * 1048576) return note('#conv-note', '規則文件超過 25 MB，沒有讀取；請只選取相關章節，或拆成較小的文件。');
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
        note('#pg-note', `共 ${out.pages} 頁；規則最集中的是第 ${best + 1}–${Math.min(out.pages, best + 18)} 頁，建議先轉換這些頁（一次 20 頁內較快）`);
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
  $('#ex-company').onclick = () => { $('#rule-text').value = S.company; st.source = '公司內部規則（範例）'; note('#conv-note', '已載入範例：公司內部規則（原本檢核沒有的規則）'); };
  $('#ex-manual').onclick = () => { $('#rule-text').value = S.manual; st.source = '填報手冊條文（範例）'; note('#conv-note', '已載入範例：填報手冊條文（可和原建規則對照轉換正確性）'); };

  // ---------- 轉換 ----------
  $('#btn-convert').onclick = async () => {
    const text = $('#rule-text').value.trim();
    if (!text) return note('#conv-note', '請先放入規則文件，或直接貼上規則。');
    if (!DQ.ai.available()) return note('#conv-note', DQ.ai.OFFLINE + '可以先按「使用範例的轉換結果」看看效果。');
    $('#btn-convert').disabled = true;
    try {
      // 整份文件的轉換算一次 AI 操作：分段送出時只需貼一次 Dify 金鑰，全部完成後清除
      const out = await DQ.ai.op(() => RI.convert(text, p => DQ.ai.convertRules(p), (i, n) => note('#conv-note', i < n ? `AI 轉換中：第 ${i + 1} / ${n} 段…（每段約 30–90 秒）` : '轉換完成，正在用範例資料試跑…')));
      st.unconvertible = out.unconvertible;
      show(out.rules, out.failures.length ? `${out.failures.length} 段沒有轉換成功（${out.failures.map(f => `第 ${f.part} 段：${f.message}`).join('；')}）` : '');
    } catch (err) { note('#conv-note', err.message); }
    $('#btn-convert').disabled = false;
  };
  $('#btn-preconverted').onclick = () => {
    const t = $('#rule-text').value;
    const which = t.includes('核保與理賠作業規範') ? ['company'] : t.includes('參、欄位檢核') ? ['manual'] : ['manual', 'company'];
    if (!t.trim()) { $('#rule-text').value = S.manual + '\n\n' + S.company; st.source = '範例文件'; }
    st.unconvertible = which.includes('company') ? S.converted.companyUnconvertible : [];
    show(which.flatMap(w => S.converted[w]), '', '範例的轉換結果（事先用 AI 轉好，讓沒有 AI 時也能看到效果）');
  };

  // ---------- 審核畫面 ----------
  function show(rules, warn, label) {
    st.reviewed = RI.review(rules, { base: rs, current: current(), clean: clean() });
    const n = s => st.reviewed.filter(r => r.status === s).length;
    $('#imp-result').hidden = false;
    $('#imp-meta').textContent = `${label || `來源：${st.source || '貼上的文字'}`}。共 ${st.reviewed.length} 條規則${st.unconvertible.length ? `，${st.unconvertible.length} 條無法轉換` : ''}。${warn || ''}`;
    DQ.safe($('#imp-chips')).innerHTML = ['可執行', '與內建相同', '疑似轉錯', '格式錯誤'].map(s => `<span class="st ${ST[s]}">${STN[s]} <b>${n(s)}</b></span>`).join('');
    renderCards();
    note('#conv-note', `AI 轉出 ${st.reviewed.length} 條規則，請對照原文確認後勾選使用。`);
    $('#imp-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderCards() {
    DQ.safe($('#imp-cards')).innerHTML = st.reviewed.map((r, k) => {
      const rule = r.rule, hits = r.hits || [];
      const statusNote = {
        可執行: '可以執行，在全部正確的範例資料上沒有誤報。',
        與內建相同: '原本的檢查已經有這條，預設不重複使用；可用來確認 AI 轉得對不對。',
        疑似轉錯: `在全部正確的範例資料上也報了 ${r.cleanHits} 筆問題：條件可能寫反或太嚴，請對照原文。`,
        格式錯誤: '這條規則無法執行：' + r.errors.join('；'),
      }[r.status];
      return `<article class="rule-card ${ST[r.status]}">
        <div class="rc-head">
          <label class="rc-check"><input type="checkbox" data-k="${k}" ${r.enabled ? 'checked' : ''} ${r.errors.length ? 'disabled' : ''}> 套用</label>
          <span class="st ${ST[r.status]}">${STN[r.status]}</span>
          <span class="ai-tag">AI 產生</span>
          <span class="mono">${esc(rule.id)}</span>
          <b>${esc(rule.name || '')}</b>
          <span class="hint">${FILE[rule.file] || rule.file}・${rule.scope === 'policy' ? '同一張保單的多筆資料' : '每一筆資料'}・${SEV[rule.severity] || SEV.error}</span>
        </div>
        ${r.text ? `<div class="rc-logic">${r.text.when ? `<div><span class="kw">當</span>${esc(r.text.when)}</div>` : ''}<div><span class="kw">必須</span>${esc(r.text.assert)}</div></div>` : ''}
        ${rule.source ? `<blockquote class="rc-src">${esc(rule.source)}${rule.ref ? `<cite>${esc(rule.ref)}</cite>` : ''}</blockquote>` : ''}
        <div class="rc-test"><span class="${r.status === '疑似轉錯' || r.status === '格式錯誤' ? 'bad' : ''}">${esc(statusNote)}</span>
          ${r.errors.length ? '' : `<span>目前的資料：<b>${hits.length}</b> 筆不符合${hits.length ? '：' + hits.slice(0, 4).map(h => `${FILE[h.file]}第 ${h.line} 行 <span class="mono">${esc(h.policy.trim())}</span>`).join('、') + (hits.length > 4 ? ' …' : '') : ''}</span>`}</div>
        <details><summary class="hint">技術細節</summary><pre class="rc-json">${esc(JSON.stringify(rule, null, 2))}</pre></details>
      </article>`;
    }).join('');
    DQ.safe($('#imp-unconv')).innerHTML = st.unconvertible.length ? `<h3 class="mt">無法轉換的條文</h3>${st.unconvertible.map(u => `<div class="chain single"><span class="st bad">無法轉換</span> ${esc(u.source)}<div class="hint">${esc(u.reason)}</div></div>`).join('')}` : '';
  }
  $('#imp-cards').addEventListener('change', e => { const k = e.target.dataset.k; if (k != null) st.reviewed[+k].enabled = e.target.checked; });

  // ---------- 套用 / 匯出 / 匯入 ----------
  $('#btn-apply').onclick = () => {
    const pick = st.reviewed.filter(r => r.enabled && !r.errors.length).map(r => r.rule);
    if (!pick.length) return note('#conv-note', '沒有勾選任何規則。');
    app.addDraftRules(pick, 'ai');
    note('#conv-note', `已把 ${pick.length} 條規則放進「本機自訂更新」。所有規則更新都要主管核可才會套用：請到「法規更新」試跑並申請主管核可。`);
    $('#imp-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  $('#btn-dl-rules').onclick = () => app.download('custom_rules.json', JSON.stringify(st.reviewed.filter(r => r.enabled).map(r => r.rule), null, 2), 'application/json');
  $('#file-rules-json').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 2 * 1048576) return note('#conv-note', '規則備份超過 2 MB，沒有讀取；請確認內容，或拆成較小的檔案。');
    try {
      const data = JSON.parse(await f.text());
      st.source = f.name; st.unconvertible = data.unconvertible || [];
      show(Array.isArray(data) ? data : data.rules || [], '', `來源：${f.name}`);
      showTab('import');
    } catch (err) { note('#conv-note', '這個備份檔無法讀取：' + err.message); }
  });
  const showTab = v => app.showTab(v);
  const local = () => app.state.packs.find(x => x.pack.id === 'local');
  const dropAi = keep => { const x = local(); if (!x) return; x.pack.rules = x.pack.rules.filter(keep); x.approvedFile = null; x.approval = null; x.verified = false; app.setPacks(app.state.packs.slice()); };
  $('#btn-clear-rules').onclick = () => { dropAi(r => r.src !== 'ai'); note('#conv-note', '已移除 AI 產生的自訂規則。'); };

  function renderApplied() {
    const x = local(), rules = x ? x.pack.rules.filter(r => r.src === 'ai') : [], issues = app.state.res ? app.state.res.issues : [], ok = x && app.usable(x);
    $('#applied-count').textContent = rules.length ? `${rules.length} 條` : '';
    $('#tc-import').textContent = rules.length || '';
    DQ.safe($('#applied-list')).innerHTML = rules.length ? rules.map(r => {
      const d = dsl.describe(r, rs.layouts), hits = issues.filter(i => i.ruleId === r.id && i.imported);
      return `<div class="applied-row"><span class="mono">${esc(r.id)}</span><span><b>${esc(r.name)}</b> <span class="ai-tag">AI 產生</span><span class="hint">${d.when ? `當 ${esc(d.when)}，` : ''}必須 ${esc(d.assert)}</span></span>
        <span>${!ok ? '<span class="unofficial">待主管核可</span>' : hits.length ? `<button class="chip jump" data-id="${hits[0].id}">${hits.length} 筆不符合</button>` : '<span class="hint">0 筆</span>'}</span>
        <button class="chip" data-remove="${esc(r.id)}">移除</button></div>`;
    }).join('') : '<p class="hint">目前沒有使用自訂規則。</p>';
  }
  $('#applied-list').addEventListener('click', e => {
    const b = e.target.closest('[data-remove]'); if (!b) return;
    dropAi(r => r.id !== b.dataset.remove);
  });
  app.onRun = renderApplied;
  renderApplied();
})();
