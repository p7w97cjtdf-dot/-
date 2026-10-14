/*
 * 檢核結果報告：文字 / CSV / 獨立 HTML 報告
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const core = isNode ? require('./core.js') : root.DQ;
  const m = factory(core);
  if (isNode) module.exports = m; else root.DQ.report = m;
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = x => (x * 100).toFixed(1) + '%';
  const SEV = { error: '錯誤', warning: '警告' };

  function fieldLabel(rs, i) {
    const lay = rs.layouts[i.file];
    if (!lay) return '';
    return (i.fields || []).map(k => { const f = lay && lay.field(k); return f ? `欄${f.no} ${f.name}` : k; }).join('、');
  }

  // 依規則彙總 (同一規則的問題聚合，便於看出系統性錯誤)
  function topRules(rs, res, n) {
    const m = new Map();
    for (const i of res.issues) {
      if (!m.has(i.ruleId)) m.set(i.ruleId, { ruleId: i.ruleId, name: i.ruleName || i.message, severity: i.severity, count: 0, sample: i, files: new Set() });
      const e = m.get(i.ruleId); e.count++; e.files.add(i.file);
    }
    return [...m.values()].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1) || b.count - a.count).slice(0, n || 999);
  }

  function toText(rs, res) {
    const s = res.summary, out = [];
    out.push(`== 資料檢核結果：${rs.name} ==`);
    for (const [fid, b] of Object.entries(s.byFile)) out.push(`${rs.layouts[fid].title}：${b.records} 筆，有錯誤 ${b.badRecords} 筆，通過率 ${pct(b.passRate)}`);
    out.push(`錯誤 ${s.errors} 項、警告 ${s.warnings} 項、可自動修正 ${s.fixable} 項`);
    out.push('');
    for (const i of res.issues) {
      out.push(`[${SEV[i.severity]}] ${i.file === 'L' ? '承保' : '給付'}第 ${i.line} 行 ${i.policy ? '保單 ' + i.policy.trim() + ' ' : ''}(${i.ruleId}) ${fieldLabel(rs, i)}`);
      out.push(`   問題：${i.message}${i.value !== '' ? `  [值：${String(i.value).trim() || '(空白)'}]` : ''}`);
      if (i.suggestion) out.push(`   建議：${i.suggestion}`);
    }
    return out.join('\n');
  }

  const TITLE = { S: '資產負債表', R: '控制總數對帳' };
  const titleOf = (rs, f) => rs.layouts[f] ? rs.layouts[f].title : TITLE[f] || f;
  function toCSV(rs, res, extra) {
    const head = ['序號', '嚴重度', '檔案', '行號', '保單號碼', '檢核編號', '檢核項目', '類別', '欄位', '欄位值', '問題說明', '修正建議', '可自動修正'];
    const q = v => { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    const all = res.issues.concat((extra || []).map((i, n) => Object.assign({ id: res.issues.length + n + 1 }, i)));
    const rows = all.map(i => [i.id, SEV[i.severity], titleOf(rs, i.file), i.line, (i.policy || i.code || '').trim(), i.ruleId, i.ruleName || '', i.category, fieldLabel(rs, i), i.value, i.message + (i.explain ? '；' + i.explain : ''), i.suggestion, i.fix ? '是' : '']);
    return '﻿' + [head].concat(rows).map(r => r.map(q).join(',')).join('\n') + '\n';
  }

  // 保發中心風格的「不符資料檔」：原始資料列 + 錯誤代碼
  function toRejectFile(rs, res, fid) {
    const bad = new Map();
    for (const i of res.issues) if (i.file === fid && i.severity === 'error' && i.line) {
      if (!bad.has(i.line)) bad.set(i.line, []);
      bad.get(i.line).push(i.ruleId);
    }
    const recs = (res.data[fid] || []).filter(r => bad.has(r._line)).sort((a, b) => a._line - b._line);
    return recs.map(r => `${String(r._line).padStart(6, '0')}|${[...new Set(bad.get(r._line))].join(';')}|${r._raw}`).join('\n') + (recs.length ? '\n' : '');
  }

  function toHTML(rs, res, opts) {
    opts = opts || {};
    const s = res.summary;
    const tops = topRules(rs, res, 15);
    const cats = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]);
    const maxCat = Math.max(1, ...cats.map(c => c[1]));
    const rows = res.issues.map(i => `<tr class="${i.severity}"><td>${i.id}</td><td><span class="sev ${i.severity}">${SEV[i.severity]}</span></td><td>${i.file === 'L' ? '承保' : '給付'}</td><td class="num">${i.line || '-'}</td><td class="mono">${esc((i.policy || '').trim())}</td><td class="mono">${esc(i.ruleId)}</td><td>${esc(fieldLabel(rs, i))}</td><td class="mono">${esc(String(i.value).trim())}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}</td></tr>`).join('');
    const fileCards = Object.entries(s.byFile).map(([fid, b]) => `<div class="card"><div class="k">${esc(rs.layouts[fid].title)}</div><div class="v">${pct(b.passRate)}</div><div class="s">${b.records} 筆，錯誤 ${b.badRecords} 筆${b.policies ? `，${b.policies} 張保單` : ''}</div></div>`).join('');
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>資料檢核報告</title><style>
:root{--bg:#fff;--fg:#1d2433;--mut:#5d6779;--line:#e3e7ee;--err:#c62828;--errbg:#fdecea;--warn:#a15c00;--warnbg:#fff4e0;--acc:#1f6f5c}
@media (prefers-color-scheme:dark){:root{--bg:#14171c;--fg:#e6e9ef;--mut:#9aa3b2;--line:#2a2f38;--err:#ff8a80;--errbg:#3a1f1f;--warn:#ffcc80;--warnbg:#3a2e1a;--acc:#6fd3b8}}
body{font-family:system-ui,-apple-system,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;background:var(--bg);color:var(--fg);margin:0;padding:24px 16px;line-height:1.5}
main{max-width:1200px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
.meta{color:var(--mut);font-size:13px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:16px}
.card{border:1px solid var(--line);border-radius:10px;padding:12px 14px}.card .k{font-size:12px;color:var(--mut)}.card .v{font-size:26px;font-weight:700}.card .s{font-size:12px;color:var(--mut)}
.v.err{color:var(--err)}.v.warn{color:var(--warn)}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{position:sticky;top:0;background:var(--bg);font-weight:600}.num{text-align:right;font-variant-numeric:tabular-nums}.mono{font-family:ui-monospace,Menlo,Consolas,monospace;white-space:pre}
.sev{font-size:12px;padding:1px 6px;border-radius:4px}.sev.error{background:var(--errbg);color:var(--err)}.sev.warning{background:var(--warnbg);color:var(--warn)}
.bar{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px}.bar span:first-child{width:90px}.bar i{display:block;height:10px;background:var(--acc);border-radius:3px}
.ai{border-left:3px solid var(--acc);padding:4px 14px;white-space:pre-wrap}.scroll{overflow-x:auto}
@media print{th{position:static}}</style></head><body><main>
<h1>資料品質檢核報告｜${esc(rs.name)}</h1>
<div class="meta">產生時間：${esc(new Date(res.generatedAt).toLocaleString('zh-TW'))}　檔案：${Object.entries(res.meta).map(([k, m]) => esc(m.name || rs.layouts[k].title)).join('、')}</div>
<div class="cards">${fileCards}<div class="card"><div class="k">錯誤</div><div class="v err">${s.errors}</div><div class="s">需修正後才能申報</div></div><div class="card"><div class="k">警告</div><div class="v warn">${s.warnings}</div><div class="s">建議確認之合理性問題</div></div><div class="card"><div class="k">可自動修正</div><div class="v">${s.fixable}</div><div class="s">有明確修正值</div></div></div>
${opts.aiSummary ? `<h2>AI 分析摘要</h2><div class="ai">${esc(opts.aiSummary)}</div>` : ''}
${reconHTML(opts.recon)}
<h2>明細檢核：問題類別分布</h2>${cats.map(([c, n]) => `<div class="bar"><span>${esc(c)}</span><i style="width:${Math.max(2, n / maxCat * 60)}%"></i><span>${n}</span></div>`).join('')}
<h2>最常見的檢核錯誤</h2><div class="scroll"><table><thead><tr><th>檢核編號</th><th>檢核項目</th><th>嚴重度</th><th class="num">次數</th><th>範例說明</th><th>修正建議</th></tr></thead><tbody>
${tops.map(t => `<tr><td class="mono">${esc(t.ruleId)}</td><td>${esc(t.name)}</td><td><span class="sev ${t.severity}">${SEV[t.severity]}</span></td><td class="num">${t.count}</td><td>${esc(t.sample.message)}</td><td>${esc(t.sample.suggestion)}</td></tr>`).join('')}</tbody></table></div>
<h2>問題明細（${res.issues.length} 項）</h2><div class="scroll"><table><thead><tr><th>#</th><th>嚴重度</th><th>檔案</th><th class="num">行號</th><th>保單號碼</th><th>檢核編號</th><th>欄位</th><th>欄位值</th><th>問題說明</th><th>修正建議</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="meta">檢核依據：${esc(rs.name)} 填報手冊與檢核規則；檢核編號沿用手冊「(新)檢核編號」，X 開頭為本工具補充之邏輯合理性檢核。</p>
</main></body></html>`;
  }

  function reconHTML(r) {
    if (!r) return '';
    const y = c => (c < 0 ? '-' : '') + (Math.abs(c) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
    let h = '';
    if (r.ctl) {
      const s = r.ctl.summary, rows = r.ctl.rows.filter(x => x.status !== '一致' && x.up);
      h += `<h2>跨系統對帳：上游控制總數</h2><p>共 ${s.total} 項：一致 ${s.ok}、時間差 ${s.timing}、定義差 ${s.definition}、待查 ${s.open}。</p>` +
        (rows.length ? `<div class="scroll"><table><thead><tr><th>來源系統</th><th>項目</th><th>期間</th><th class="num">差異</th><th>判定</th><th>說明</th></tr></thead><tbody>${rows.map(x => `<tr><td>${esc(x.source)}</td><td>${esc(x.name)}</td><td class="mono">${esc(x.period)}</td><td class="num">${x.diff.cnt} 筆 / ${y(x.diff.amt)}</td><td>${esc(x.status)}</td><td>${esc(x.explain)}</td></tr>`).join('')}</tbody></table></div>` : '');
    }
    if (r.roll) {
      const m = r.roll.movement;
      h += `<h2>期初 / 期末結轉</h2><p>期初有效 ${m.open[0]} 件 / ${y(m.open[1])} 元${r.roll.hasPrior ? `（上年度期末 ${m.priorClose[0]} 件 / ${y(m.priorClose[1])} 元）` : ''}；期末有效 ${m.closeActual[0]} 件 / ${y(m.closeActual[1])} 元；結轉問題 ${r.roll.issues.length} 項。</p>` +
        (r.roll.issues.length ? `<div class="scroll"><table><thead><tr><th>檢核</th><th>保單號碼</th><th>問題</th><th>建議</th></tr></thead><tbody>${r.roll.issues.map(i => `<tr><td class="mono">${i.ruleId}</td><td class="mono">${esc(i.policy)}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}</td></tr>`).join('')}</tbody></table></div>` : '');
    }
    if (r.stmt) {
      h += `<h2>財報勾稽：資產負債表</h2><p>${r.stmt.summary.balanced ? '資產 = 負債 + 權益，報表平衡。' : '資產負債表不平衡。'}錯誤 ${r.stmt.summary.errors} 項、提醒 ${r.stmt.summary.warnings} 項。</p>` +
        (r.stmt.issues.length ? `<div class="scroll"><table><thead><tr><th>檢核</th><th>科目</th><th>根因</th><th>問題</th><th>建議</th></tr></thead><tbody>${r.stmt.issues.map(i => `<tr><td class="mono">${i.ruleId}</td><td class="mono">${esc(i.code)}</td><td>${esc(i.chainRole || '')}</td><td>${esc(i.message)}</td><td>${esc((i.explain ? i.explain + ' ' : '') + i.suggestion)}</td></tr>`).join('')}</tbody></table></div>` : '');
    }
    return h;
  }

  return { toText, toCSV, toHTML, toRejectFile, topRules, fieldLabel };
});
