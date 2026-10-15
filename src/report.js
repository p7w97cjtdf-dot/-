/*
 * 檢核結果報告：文字 / CSV / 獨立 HTML 報告
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const core = isNode ? require('./core.js') : root.DQ;
  const labels = isNode ? require('./labels.js') : root.DQ.labels;
  const m = factory(core, labels);
  if (isNode) module.exports = m; else root.DQ.report = m;
})(typeof self !== 'undefined' ? self : this, function (C, LB) {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pct = x => (x * 100).toFixed(1) + '%';
  const SEV = LB.SEV, SHEET = LB.SHEET;

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
    out.push(`${SEV.error} ${s.errors} 項、${SEV.warning} ${s.warnings} 項、${SEV.suspect} ${s.suspects || 0} 項、可一鍵修改 ${s.fixable} 項`);
    out.push('');
    for (const i of res.issues) {
      out.push(`[${SEV[i.severity]}] ${SHEET[i.file] || i.file} 第 ${i.line} 行 ${i.policy ? '保單 ' + i.policy.trim() + ' ' : ''}(${i.ruleId}) ${fieldLabel(rs, i)}`);
      out.push(`   問題：${i.message}${i.value !== '' ? `  [值：${String(i.value).trim() || '(空白)'}]` : ''}`);
      if (i.suggestion) out.push(`   建議：${i.suggestion}`);
    }
    return out.join('\n');
  }

  // 問題清單 (下載用)：第一列為標題；Excel 與 CSV 共用
  function toRows(rs, res, extra) {
    const head = ['序號', '狀況', '資料', '行號', '保單號碼／科目', '問題類型', '檢查項目', '欄位', '目前的值', '問題說明', '建議怎麼改', '建議的值', '規則編號'];
    const all = res.issues.concat((extra || []).filter(i => !res.issues.includes(i)).map((i, n) => Object.assign({ id: res.issues.length + n + 1 }, i)));
    return [head].concat(all.map(i => [i.id, SEV[i.severity] || i.severity, i.sheet || SHEET[i.file] || i.file, i.line || '', (i.policy || i.code || '').trim(), LB.cat(i.category), i.ruleName || '',
      fieldLabel(rs, i).replace(/欄\d+ /g, ''), String(i.value == null ? '' : i.value).trim(), i.message + (i.explain ? '；' + i.explain : ''), i.suggestion || '', i.fix ? i.fix.value : '', i.ruleId]));
  }
  // CSV：加上 BOM 與 Windows 換行，Excel 直接開啟中文不會變亂碼
  function toCSV(rs, res, extra) {
    const q = v => { v = String(v == null ? '' : v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    return '\uFEFF' + toRows(rs, res, extra).map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
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
    const cats = Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]).map(([c, n]) => [LB.cat(c), n]);
    const maxCat = Math.max(1, ...cats.map(c => c[1]));
    const rows = res.issues.map(i => `<tr class="${i.severity}"><td>${i.id}</td><td><span class="sev ${i.severity}">${SEV[i.severity]}</span></td><td>${SHEET[i.file] || i.file}</td><td class="num">${i.line || '-'}</td><td class="mono">${esc((i.policy || '').trim())}</td><td>${esc(fieldLabel(rs, i).replace(/欄\d+ /g, ''))}</td><td class="mono">${esc(String(i.value).trim())}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}</td></tr>`).join('');
    const fileCards = Object.entries(s.byFile).map(([fid, b]) => `<div class="card"><div class="k">${SHEET[fid]}正確的比例</div><div class="v">${pct(b.passRate)}</div><div class="s">共 ${b.records} 筆${b.policies ? `（${b.policies} 張保單）` : ''}，${b.badRecords} 筆要修改</div></div>`).join('');
    return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>資料檢查報告</title><style>
:root{--bg:#fff;--fg:#1d2433;--mut:#5d6779;--line:#e3e7ee;--err:#c62828;--errbg:#fdecea;--warn:#a15c00;--warnbg:#fff4e0;--acc:#1f6f5c}
@media (prefers-color-scheme:dark){:root{--bg:#14171c;--fg:#e6e9ef;--mut:#9aa3b2;--line:#2a2f38;--err:#ff8a80;--errbg:#3a1f1f;--warn:#ffcc80;--warnbg:#3a2e1a;--acc:#6fd3b8}}
body{font-family:system-ui,-apple-system,"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif;background:var(--bg);color:var(--fg);margin:0;padding:24px 16px;line-height:1.5}
main{max-width:1200px;margin:0 auto}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:28px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
.meta{color:var(--mut);font-size:13px}.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:16px}
.card{border:1px solid var(--line);border-radius:10px;padding:12px 14px}.card .k{font-size:12px;color:var(--mut)}.card .v{font-size:26px;font-weight:700}.card .s{font-size:12px;color:var(--mut)}
.v.err{color:var(--err)}.v.warn{color:var(--warn)}table{border-collapse:collapse;width:100%;font-size:13px}th,td{border-bottom:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
th{position:sticky;top:0;background:var(--bg);font-weight:600}.num{text-align:right;font-variant-numeric:tabular-nums}.mono{font-family:ui-monospace,Menlo,Consolas,monospace;white-space:pre}
.sev{font-size:12px;padding:1px 6px;border-radius:4px}.sev.error{background:var(--errbg);color:var(--err)}.sev.warning{background:var(--warnbg);color:var(--warn)}.sev.suspect{background:#ecfeff;color:#0e7490}
.bar{display:flex;align-items:center;gap:8px;margin:4px 0;font-size:13px}.bar span:first-child{width:90px}.bar i{display:block;height:10px;background:var(--acc);border-radius:3px}
.ai{border-left:3px solid var(--acc);padding:4px 14px;white-space:pre-wrap}.ai-tag{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border:1px solid #7c3aed;color:#6d28d9;border-radius:4px;vertical-align:middle}.scroll{overflow-x:auto}
@media print{th{position:static}}</style></head><body><main>
<h1>資料檢查報告｜${esc(rs.name)}</h1>
<div class="meta">產生時間：${esc(new Date(res.generatedAt).toLocaleString('zh-TW'))}　資料：${Object.entries(res.meta).map(([k, m]) => esc(m.name || rs.layouts[k].title)).join('、')}${opts.elapsed != null ? `　檢查花了 ${(opts.elapsed / 1000).toFixed(2)} 秒` : ''}${(rs.products || [rs]).filter(p => Object.keys(res.meta).some(k => p.layouts && p.layouts[k])).map((p, i) => `${i ? '、' : '<br>規則依據：'}${esc(p.name)}${/\d{4}/.test(p.name) ? '' : `（${esc(p.version)} 年版手冊）`}`).join('')}${(opts.packs || []).length ? `<br>另套用法規更新：${opts.packs.map(p => esc(p.name + (p.version ? ` 第 ${p.version} 版` : '') + (p.basis ? `（${p.basis}）` : ''))).join('、')}` : ''}</div>
<div class="cards">${fileCards}<div class="card"><div class="k">${SEV.error}</div><div class="v err">${s.errors}</div><div class="s">${LB.SEV_HINT.error}</div></div><div class="card"><div class="k">${SEV.warning}</div><div class="v warn">${s.warnings}</div><div class="s">${LB.SEV_HINT.warning}</div></div><div class="card"><div class="k">${SEV.suspect}</div><div class="v" style="color:#0e7490">${s.suspects || 0}</div><div class="s">${LB.SEV_HINT.suspect}</div></div><div class="card"><div class="k">可以一鍵修改</div><div class="v">${s.fixable}</div><div class="s">工具知道正確的值</div></div></div>
${opts.aiSummary ? `<h2>AI 整理的重點 <span class="ai-tag">AI 產生</span></h2><p class="meta">以下由 AI（Claude）依檢查結果產生，送出前已遮住姓名、身分證號和地址；僅供參考，哪些要改以檢查結果為準。</p><div class="ai">${esc(opts.aiSummary)}</div>` : ''}
${reconHTML(opts.recon)}
<h2>保單與理賠資料：各類問題的數量</h2>${cats.map(([c, n]) => `<div class="bar"><span>${esc(c)}</span><i style="width:${Math.max(2, n / maxCat * 60)}%"></i><span>${n}</span></div>`).join('')}
<h2>最常出現的問題</h2><div class="scroll"><table><thead><tr><th>檢查項目</th><th>狀況</th><th class="num">次數</th><th>例子</th><th>建議怎麼改</th></tr></thead><tbody>
${tops.map(t => `<tr><td>${esc(t.name)}</td><td><span class="sev ${t.severity}">${SEV[t.severity]}</span></td><td class="num">${t.count}</td><td>${esc(t.sample.message)}</td><td>${esc(t.sample.suggestion)}</td></tr>`).join('')}</tbody></table></div>
<h2>全部問題（${res.issues.length} 項）</h2><div class="scroll"><table><thead><tr><th>#</th><th>狀況</th><th>資料</th><th class="num">行號</th><th>保單號碼</th><th>欄位</th><th>目前的值</th><th>問題說明</th><th>建議怎麼改</th></tr></thead><tbody>${rows}</tbody></table></div>
<p class="meta">檢查依據：個人壽險填報手冊與檢核規則（2025 填報年度），以及本工具另外加的合理性檢查。</p>
</main></body></html>`;
  }

  function reconHTML(r) {
    if (!r) return '';
    const y = c => (c < 0 ? '-' : '') + (Math.abs(c) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
    let h = '';
    if (r.ctl) {
      const s = r.ctl.summary, rows = r.ctl.rows.filter(x => x.status !== '一致' && x.up);
      h += `<h2>和各系統的總數比對</h2><p>共 ${s.total} 項：${LB.status('一致')} ${s.ok}、${LB.status('時間差')} ${s.timing}、${LB.status('定義差')} ${s.definition}、${LB.status('待查')} ${s.open}。</p>` +
        (rows.length ? `<div class="scroll"><table><thead><tr><th>系統</th><th>項目</th><th>期間</th><th class="num">差多少</th><th>原因</th><th>說明</th></tr></thead><tbody>${rows.map(x => `<tr><td>${esc(x.source)}</td><td>${esc(x.name)}</td><td class="mono">${esc(x.period)}</td><td class="num">${x.diff.cnt} 筆 / ${y(x.diff.amt)} 元</td><td>${esc(LB.status(x.status))}</td><td>${esc(x.explain)}</td></tr>`).join('')}</tbody></table></div>` : '');
    }
    if (r.roll) {
      const m = r.roll.movement;
      h += `<h2>去年底和今年初是否接得上</h2><p>今年初有效 ${m.open[0]} 件／保額 ${y(m.open[1])} 元${r.roll.hasPrior ? `（去年底 ${m.priorClose[0]} 件／${y(m.priorClose[1])} 元）` : ''}；今年底有效 ${m.closeActual[0]} 件／${y(m.closeActual[1])} 元；接不上的地方 ${r.roll.issues.length} 項。</p>` +
        (r.roll.issues.length ? `<div class="scroll"><table><thead><tr><th>狀況</th><th>保單號碼</th><th>問題</th><th>建議</th></tr></thead><tbody>${r.roll.issues.map(i => `<tr><td>${SEV[i.severity]}</td><td class="mono">${esc(i.policy)}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}</td></tr>`).join('')}</tbody></table></div>` : '');
    }
    const mst = [].concat(r.cust ? r.cust.issues : [], r.prod ? r.prod.issues : []);
    if (r.cust || r.prod) {
      h += `<h2>客戶資料與商品資料</h2><p>${r.cust ? `客戶資料 ${r.cust.summary.rows} 列（${r.cust.summary.people} 人）` : ''}${r.cust && r.prod ? '；' : ''}${r.prod ? `商品資料 ${r.prod.summary.products} 項` : ''}；問題 ${mst.length} 項，其中 ${mst.filter(i => i.fix).length} 項可用客戶資料自動修改。</p>` +
        (mst.length ? `<div class="scroll"><table><thead><tr><th>狀況</th><th>位置</th><th>保單號碼</th><th>問題</th><th>建議</th></tr></thead><tbody>${mst.map(i => `<tr><td>${SEV[i.severity]}</td><td>${(SHEET[i.file] || i.file) + ' 第 ' + i.line + (i.file === 'L' ? ' 行' : ' 列')}</td><td class="mono">${esc((i.policy || '').trim())}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}</td></tr>`).join('')}</tbody></table></div>` : '');
    }
    if (r.stmt) {
      h += `<h2>資產負債表加總檢查</h2><p>${r.stmt.summary.balanced ? '資產 = 負債 + 權益，報表是平的。' : '資產不等於負債加權益，報表不平。'}${SEV.error} ${r.stmt.summary.errors} 項、${SEV.warning} ${r.stmt.summary.warnings} 項。</p>` +
        (r.stmt.issues.length ? `<div class="scroll"><table><thead><tr><th>狀況</th><th>科目</th><th>源頭／受影響</th><th>問題</th><th>建議</th></tr></thead><tbody>${r.stmt.issues.map(i => `<tr><td>${SEV[i.severity]}</td><td class="mono">${esc(i.code)}</td><td>${i.chainRole ? (i.chainRole === '根因' ? '源頭' : '受影響') : ''}</td><td>${esc(i.message)}</td><td>${esc((i.explain ? i.explain + ' ' : '') + i.suggestion)}</td></tr>`).join('')}</tbody></table></div>` : '');
    }
    return h;
  }

  return { toText, toRows, toCSV, toHTML, toRejectFile, topRules, fieldLabel };
});
