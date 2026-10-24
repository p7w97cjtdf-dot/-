/*
 * 逐筆確認：一次看一個問題，大卡片顯示有問題的值，下方用大按鈕決定「改成建議的值」或「先不改」。
 * 手機上是主要的操作方式，電腦上也可以從「逐筆確認」按鈕開啟。
 * 選擇「改」的項目在最後一次套用 (套用會重新檢查，問題編號會改變，所以不能邊看邊改)。
 */
(function () {
  'use strict';
  const { DQ } = window;
  const app = DQ.app, LB = DQ.labels, rs = DQ.rulesets.all;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ORDER = { error: 0, warning: 1, suspect: 2 };
  const SEGMENTS = 10;
  let list = [], pos = 0, decisions = new Map();

  const el = $('#review');
  const canFix = i => i.fix && app.state.res.issues.includes(i);

  function open() {
    list = app.state.all.slice().sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || (a.sheet || '').localeCompare(b.sheet || '') || (a.line || 0) - (b.line || 0));
    pos = 0; decisions = new Map();
    if (!list.length) return;
    el.hidden = false; document.body.classList.add('reviewing');
    if (app.onBack) app.onBack('review', close);   // 手機的返回鍵回到總覽
    render();
    el.querySelector('.rv-card').focus();
  }
  function close() { el.hidden = true; document.body.classList.remove('reviewing'); if (app.doneBack) app.doneBack('review'); }

  // 進度：固定 10 段，依完成比例填滿 (圖示風格)
  function progress() {
    const done = pos / list.length;
    return Array.from({ length: SEGMENTS }, (_, k) => {
      const fill = Math.max(0, Math.min(1, done * SEGMENTS - k));
      return `<span class="rv-seg"><i style="width:${(fill * 100).toFixed(0)}%"></i></span>`;
    }).join('');
  }

  function render() {
    if (pos >= list.length) return renderDone();
    const i = list[pos];
    const field = DQ.report.fieldLabel(rs, i).replace(/欄\d+ /g, '');
    const value = String(i.value == null ? '' : i.value).trim();
    const where = [i.sheet, app.rowLabel(i), (i.policy || i.code || '').trim()].filter(Boolean).join('・');
    const big = value.length && value.length <= 14 ? value : (field || LB.cat(i.category));
    const rec = i.line && (app.state.res.data[i.file] || []).find(r => r._line === i.line);
    el.innerHTML = `
      <div class="rv-top">
        <button type="button" class="rv-quit">← 結束</button>
        <div class="rv-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${list.length}" aria-valuenow="${pos}" aria-label="已確認 ${pos} / ${list.length}">${progress()}</div>
        <span class="rv-count">${pos + 1}/${list.length}</span>
      </div>
      <span class="rv-pill ${i.severity}">${esc(LB.SEV[i.severity])}</span>
      <div class="rv-card" tabindex="-1">
        <div class="rv-big ${big === value ? 'mono' : ''}">${esc(big.replace(/ /g, '·'))}</div>
        <div class="rv-sub">${esc(field && big === value ? field : '')}${field && big === value ? '・' : ''}${esc(where)}</div>
        ${rec ? `<button type="button" class="rv-chip rv-raw">顯示原始資料</button><pre class="rv-rawtext" hidden>${esc(rec._raw.replace(/ /g, '·'))}</pre>` : ''}
      </div>
      <p class="rv-q">${esc(i.message)}</p>
      <p class="rv-hint">建議怎麼改：${esc(i.suggestion || '請人工確認')}</p>
      <div class="rv-choices">
        ${canFix(i)
          ? `<button type="button" class="rv-choice" data-act="fix">改成<br><b class="mono">${esc(i.fix.value)}</b></button><button type="button" class="rv-choice" data-act="skip">先不改</button>`
          : `<button type="button" class="rv-choice" data-act="later">記下來<br>稍後處理</button><button type="button" class="rv-choice" data-act="skip">${i.severity === 'error' ? '下一個' : '沒問題，下一個'}</button>`}
      </div>
      ${pos > 0 ? '<button type="button" class="rv-back">← 上一個</button>' : ''}`;
  }

  function renderDone() {
    const fix = [...decisions].filter(([, a]) => a === 'fix').map(([i]) => i);
    const later = [...decisions].filter(([, a]) => a === 'later').length;
    el.innerHTML = `
      <div class="rv-top"><button type="button" class="rv-quit">← 結束</button><div class="rv-bar">${progress()}</div><span class="rv-count">${list.length}/${list.length}</span></div>
      <div class="rv-card rv-done" tabindex="-1">
        <div class="rv-big">完成</div>
        <div class="rv-sub">確認了 ${list.length} 個問題：選擇修改 ${fix.length} 個、記下來 ${later} 個</div>
      </div>
      <div class="rv-choices one">
        ${fix.length ? `<button type="button" class="rv-choice primary" data-act="apply">套用 ${fix.length} 個修改</button>` : ''}
        <button type="button" class="rv-choice" data-act="list">下載問題清單</button>
        <button type="button" class="rv-choice" data-act="close">回到總覽</button>
      </div>
      <p class="rv-hint" id="rv-note"></p>`;
  }

  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.classList.contains('rv-quit')) return close();
    if (b.classList.contains('rv-back')) { pos = Math.max(0, pos - 1); return render(); }
    if (b.classList.contains('rv-raw')) { const p = el.querySelector('.rv-rawtext'); p.hidden = !p.hidden; b.textContent = p.hidden ? '顯示原始資料' : '隱藏原始資料'; return; }
    const act = b.dataset.act; if (!act) return;
    if (act === 'apply') {
      const ids = [...decisions].filter(([, a]) => a === 'fix').map(([i]) => i.id);
      const r = app.applyFix(ids);
      el.querySelector('#rv-note').textContent = `已修改 ${r.total} 個地方，問題從 ${r.before} 個減為 ${r.after} 個。`;
      b.outerHTML = '<button type="button" class="rv-choice primary" data-act="fixed">下載改好的保單資料</button>';
      decisions = new Map();
      return;
    }
    if (act === 'fixed') return $('#btn-dl-fixed').click();
    if (act === 'list') return $('#btn-dl-csv').click();
    if (act === 'close') return close();
    decisions.set(list[pos], act);
    pos++; render();
    const card = el.querySelector('.rv-card'); if (card) card.focus();
  });
  document.addEventListener('keydown', e => { if (!el.hidden && e.key === 'Escape') close(); });
  $('#btn-review').addEventListener('click', open);
  DQ.review = { open, close };
})();
