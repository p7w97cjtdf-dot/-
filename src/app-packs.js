/* 法規更新分頁：規則更新包的匯入／啟用／下載，以及不用 AI 的新增檢查、新增欄位、停用內建檢查 */
(function () {
  'use strict';
  const { DQ } = window;
  const app = DQ.app, P = DQ.rulePacks, dsl = DQ.dsl, LB = DQ.labels;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const FILES = ['L', 'D', 'CL', 'CD', 'AL', 'AD'].filter(k => app.base.layouts[k]);
  const LOCAL = 'local';
  const OPS = [['eq', '等於'], ['ne', '不等於'], ['in', '是其中之一'], ['notIn', '不是其中之一'], ['gt', '大於'], ['gte', '大於或等於'], ['lt', '小於'], ['lte', '小於或等於'],
    ['notBlank', '不可空白'], ['notZero', '不可為 0'], ['isDate', '是合法日期'], ['startsWith', '開頭是'], ['matches', '符合格式（進階）']];
  const WOPS = [['eq', '等於'], ['ne', '不等於'], ['in', '是其中之一'], ['gte', '大於或等於'], ['lte', '小於或等於'], ['startsWith', '開頭是'], ['isZero', '為 0'], ['isBlank', '為空白']];
  const NOVAL = ['notBlank', 'notZero', 'isDate', 'isZero', 'isBlank'];
  const note = (sel, t) => { $(sel).textContent = t; };
  const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
  // 所有內建檢查 (含客戶／商品、對帳、合理性)：停用時用來確認編號存在
  const allCatalog = () => app.base.catalog.concat(DQ.rulesets.finance.catalog, DQ.master.catalog, DQ.anomaly.catalog);
  const layouts = () => app.activeRules().layouts;

  // ---------- 表單選項 ----------
  const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
  function fillFiles() {
    const html = FILES.map(k => opt(k, LB.SHEET[k])).join('');
    $('#nr-file').innerHTML = html; $('#nf-file').innerHTML = html;
    $('#nr-op').innerHTML = OPS.map(([v, t]) => opt(v, t)).join('');
    $('#nr-wop').innerHTML = WOPS.map(([v, t]) => opt(v, t)).join('');
    fillFields();
  }
  function fillFields() {
    const lay = layouts()[$('#nr-file').value];
    const fields = lay.fields.filter(f => f.key !== 'reserved' || true);
    const list = fields.map(f => opt(f.key, `${f.name}${f.added ? '（新欄位）' : ''}（第 ${f.start}${f.len > 1 ? '–' + (f.start + f.len - 1) : ''} 字）`)).join('');
    $('#nr-field').innerHTML = list;
    $('#nr-wfield').innerHTML = opt('', '（不限）') + list;
    $('#nr-efield').innerHTML = opt('', '（不限）') + fields.filter(f => f.type === '9' && f.len === 8).map(f => opt(f.key, f.name)).join('');
    preview();
  }
  $('#nr-file').addEventListener('change', fillFields);

  // ---------- 由表單組出規則 ----------
  const split = v => String(v).split(/[,，、\s]+/).map(x => x.trim()).filter(Boolean);
  function cond(field, op, value) {
    const c = { field, op };
    if (NOVAL.includes(op)) return c;
    if (op === 'in' || op === 'notIn') c.values = split(value); else c.value = String(value).trim();
    return c;
  }
  function formRule() {
    const file = $('#nr-file').value, op = $('#nr-op').value, value = $('#nr-value').value;
    if (!NOVAL.includes(op) && !value.trim()) return { error: '請填「值」' };
    const msg = $('#nr-msg').value.trim();
    const r = { id: 'U' + Date.now().toString(36).toUpperCase(), name: msg || '自訂檢查', file, scope: 'record', severity: $('#nr-sev').value, assert: cond($('#nr-field').value, op, value), message: msg || '不符合自訂檢查', suggestion: $('#nr-basis').value.trim() ? `依據：${$('#nr-basis').value.trim()}` : '請依最新法規確認', ref: $('#nr-basis').value.trim() || undefined };
    const wf = $('#nr-wfield').value;
    if (wf) { if (!NOVAL.includes($('#nr-wop').value) && !$('#nr-wvalue').value.trim()) return { error: '「只檢查符合條件的資料」請填值，或把欄位改回「不限」' }; r.when = cond(wf, $('#nr-wop').value, $('#nr-wvalue').value); }
    const ef = $('#nr-efield').value, ed = $('#nr-efrom').value;
    if (ef && ed) r.effective = { field: ef, from: ed.replace(/-/g, '') };
    const errs = dsl.validateRule(P.withEffective(r), layouts());
    return errs.length ? { error: errs.join('；') } : { rule: r };
  }
  function preview() {
    const out = formRule();
    if (out.error) return note('#nr-preview', '');
    const d = dsl.describe(P.withEffective(out.rule), layouts());
    $('#nr-preview').textContent = `${LB.SHEET[out.rule.file]}：${d.when ? `當 ${d.when}，` : '每一筆'}必須 ${d.assert}；不符合時顯示「${out.rule.message}」（${LB.SEV[out.rule.severity]}）`;
  }
  document.querySelectorAll('#view-updates .form-grid input, #view-updates .form-grid select').forEach(el => el.addEventListener('input', preview));

  // ---------- 本機更新包 ----------
  function localPack() {
    let x = app.state.packs.find(p => p.pack.id === LOCAL);
    if (!x) { x = { pack: P.normalize({ id: LOCAL, name: '本機自訂更新', issuedAt: today() }), on: true }; app.state.packs = app.state.packs.concat(x); }
    return x;
  }
  const save = () => app.setPacks(app.state.packs.slice());

  $('#btn-nr-add').onclick = () => {
    const out = formRule();
    if (out.error) return note('#nr-note', out.error);
    const x = localPack();
    x.pack.rules.push(out.rule); x.pack.issuedAt = today(); x.on = true;
    save();
    const hits = (app.state.all || []).filter(i => i.ruleId === out.rule.id).length;
    note('#nr-note', app.state.res ? `已加入。目前的資料有 ${hits} 個地方不符合，已列在「檢查結果」。` : '已加入。放入資料後就會一起檢查。');
    $('#nr-msg').value = ''; preview();
  };
  $('#btn-nf-add').onclick = () => {
    const f = { file: $('#nf-file').value, key: 'F' + Date.now().toString(36).toUpperCase(), name: $('#nf-name').value.trim(), start: +$('#nf-start').value, len: +$('#nf-len').value, type: $('#nf-type').value };
    const vals = split($('#nf-values').value); if (vals.length) f.values = vals;
    if (!f.name) return note('#nf-note', '請填欄位名稱');
    const x = localPack();
    const v = P.validate(Object.assign({}, x.pack, { fields: [f], rules: [], disable: [] }), app.base, app.state.packs.filter(p => p !== x).map(p => p.pack));
    if (v.errors.length) return note('#nf-note', v.errors.join('；'));
    x.pack.fields.push(f); x.pack.issuedAt = today(); save(); fillFields();
    note('#nf-note', `已新增「${f.name}」，可以在上方「新增一條檢查」選這個欄位。`);
  };
  $('#btn-dis-add').onclick = () => {
    const id = $('#dis-id').value.trim();
    const c = allCatalog().find(r => r.id.toUpperCase() === id.toUpperCase());
    if (!c) return note('#dis-note', `找不到檢核編號「${id}」。可以在「檢查項目一覽」查詢編號。`);
    const x = localPack();
    if (!x.pack.disable.includes(c.id)) x.pack.disable.push(c.id);
    x.pack.disableWhy = Object.assign({}, x.pack.disableWhy, { [c.id]: $('#dis-why').value.trim() });
    x.pack.issuedAt = today(); save();
    note('#dis-note', `已停用 ${c.id}「${c.name}」。`);
    $('#dis-id').value = ''; $('#dis-why').value = '';
  };

  // ---------- 匯入／下載 ----------
  $('#file-pack').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const pack = P.normalize(JSON.parse(await f.text()), f.name.replace(/\.json$/i, ''));
      const base = Object.assign({}, app.base, { catalog: allCatalog() });
      const v = P.validate(pack, base, app.state.packs.filter(x => x.pack.id !== pack.id).map(x => x.pack));
      const bad = v.rules.filter(r => r.errors.length);
      app.setPacks(app.state.packs.filter(x => x.pack.id !== pack.id).concat({ pack, on: true }));
      fillFields();
      note('#pack-note', `已匯入「${pack.name}」：${P.summary(pack)}。` + (v.errors.length || bad.length ? `有 ${v.errors.length + bad.length} 項無法使用，已略過（見下方說明）。` : '已套用到檢查結果。'));
    } catch (err) { note('#pack-note', `「${f.name}」不是規則更新包，或檔案內容有誤：${err.message}`); }
  });
  const download = x => app.download(`rule-pack-${String(x.pack.id).replace(/[^\w.-]/g, '_')}.json`, JSON.stringify(x.pack, null, 2) + '\n', 'application/json');
  $('#btn-pack-export').onclick = () => { const x = app.state.packs.find(p => p.pack.id === LOCAL); if (!x) return note('#pack-note', '本機還沒有自訂更新。'); download(x); };

  // ---------- 清單 ----------
  function render() {
    const packs = app.state.packs, all = app.state.all || [], hidden = app.state.disabledCount || {};
    $('#tc-updates').textContent = packs.filter(x => x.on).length || '';
    $('#dis-ids').innerHTML = allCatalog().slice(0, 2000).map(r => `<option value="${esc(r.id)}">${esc(r.name)}</option>`).join('');
    const ol = app.state.officialLoaded;
    $('#pack-official').textContent = ol ? (ol.count ? `已從公開網站取得 ${ol.count} 個官方更新包，打開工具時會自動檢查有沒有新版。` : '已檢查公開網站：目前沒有官方發布的法規更新。') : '尚未取得官方更新（直接開啟檔案或沒有網路時不會自動更新）。';
    if (!packs.length) { $('#pack-list').innerHTML = '<p class="hint">目前沒有套用任何法規更新，使用內建規則檢查。</p>'; return; }
    const base = Object.assign({}, app.base, { catalog: allCatalog() });
    $('#pack-list').innerHTML = packs.map((x, k) => {
      const p = x.pack, ids = new Set(p.rules.map(r => r.id).concat(p.fields.map(f => `${p.id}:${f.key}`)));
      const found = all.filter(i => ids.has(i.ruleId)).length, hid = p.disable.reduce((s, id) => s + (hidden[id] || 0), 0);
      const v = P.validate(p, base, packs.filter(y => y !== x).map(y => y.pack));
      const probs = v.errors.concat(v.rules.filter(r => r.errors.length).map(r => `${r.id}：${r.errors.join('、')}`));
      const lay = layouts();
      const items = p.id === LOCAL ? [
        ...p.rules.map((r, i) => { const d = dsl.describe(P.withEffective(r), lay); return `<li><span>${esc(LB.SHEET[r.file] || r.file)}：${d.when ? `當 ${esc(d.when)}，` : ''}必須 ${esc(d.assert)}<span class="hint">　${esc(r.message)}</span></span><button class="chip" data-del="rules" data-i="${i}">移除</button></li>`; }),
        ...p.fields.map((f, i) => `<li><span>新欄位：${esc(LB.SHEET[f.file] || f.file)}「${esc(f.name)}」第 ${f.start}${f.len > 1 ? '–' + (f.start + f.len - 1) : ''} 字${f.values ? `，允許 ${esc(f.values.join('、'))}` : ''}</span><button class="chip" data-del="fields" data-i="${i}">移除</button></li>`),
        ...p.disable.map((id, i) => `<li><span>停用 ${esc(id)}${p.disableWhy && p.disableWhy[id] ? `<span class="hint">　${esc(p.disableWhy[id])}</span>` : ''}</span><button class="chip" data-del="disable" data-i="${i}">恢復</button></li>`),
      ] : [];
      return `<article class="pack${x.on ? '' : ' off'}">
        <div class="pack-head">
          <label class="switch"><input type="checkbox" data-on="${k}"${x.on ? ' checked' : ''}> 使用中</label>
          <div><b>${esc(p.name)}</b>${x.official ? '<span class="official">官方發布・自動套用</span>' : ''}${p.version ? `<span class="hint">　第 ${esc(p.version)} 版</span>` : ''}
            <div class="hint">${[p.issuedAt && `發布 ${p.issuedAt.replace(/^(\d{4})(\d\d)(\d\d)$/, '$1/$2/$3')}`, p.basis && `依據：${p.basis}`].filter(Boolean).map(esc).join('　')}</div></div>
          <div class="pack-acts"><button class="chip" data-dl="${k}">下載</button>${x.official ? '' : `<button class="chip" data-rm="${k}">移除</button>`}</div>
        </div>
        <p>${esc(P.summary(p))}${x.on && app.state.res ? `　<span class="hint">目前的資料：新檢查找到 ${found} 個問題${p.disable.length ? `；停用的檢查隱藏了 ${hid} 個問題` : ''}</span>` : ''}</p>
        ${p.note ? `<p class="hint">${esc(p.note)}</p>` : ''}
        ${items.length ? `<ul class="pack-items">${items.join('')}</ul>` : ''}
        ${probs.length ? `<p class="pack-warn">無法使用、已略過：${esc(probs.join('；'))}</p>` : ''}
      </article>`;
    }).join('');
  }
  $('#pack-list').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const packs = app.state.packs;
    if (b.dataset.dl) return download(packs[+b.dataset.dl]);
    if (b.dataset.rm) { const x = packs[+b.dataset.rm]; if (!confirm(`移除「${x.pack.name}」？之後要使用需重新匯入。`)) return; app.setPacks(packs.filter(y => y !== x)); fillFields(); return; }
    if (b.dataset.del) { const x = localPack(); x.pack[b.dataset.del].splice(+b.dataset.i, 1); save(); fillFields(); }
  });
  $('#pack-list').addEventListener('change', e => { const k = e.target.dataset.on; if (k == null) return; app.state.packs[+k].on = e.target.checked; save(); fillFields(); });

  const prev = app.onRun;
  app.onRun = () => { if (prev) prev(); render(); };
  const prevSet = app.setPacks;
  app.setPacks = list => { prevSet(list); render(); };
  fillFiles(); render();
})();
