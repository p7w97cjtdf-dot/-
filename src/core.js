/*
 * 資料檢核引擎核心 (Data Quality Core)
 * - 固定長度文字檔解析
 * - 欄位型態 / 代碼 / 單筆 / 多筆 / 跨檔 檢核執行
 * - 瀏覽器 (window.DQ) 與 Node (module.exports) 共用
 */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.DQ = Object.assign(root.DQ || {}, m);
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---------- 日期工具 ----------
  function isValidDate(s) {
    if (!/^\d{8}$/.test(s)) return false;
    const y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
    if (y < 1800 || m < 1 || m > 12 || d < 1) return false;
    const dim = [31, (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return d <= dim[m - 1];
  }
  function toDate(s) {
    return new Date(Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)));
  }
  function fmtDate(d) {
    return String(d.getUTCFullYear()).padStart(4, '0') +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      String(d.getUTCDate()).padStart(2, '0');
  }
  // 加 n 年後減 1 天 (保險期間迄日推算)
  function addYearsMinusDay(s, n) {
    const y = +s.slice(0, 4) + n, m = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
    const dt = new Date(Date.UTC(y, m, d));
    if (dt.getUTCMonth() !== m) dt.setUTCDate(0); // 2/29 → 2/28
    dt.setUTCDate(dt.getUTCDate() - 1);
    return fmtDate(dt);
  }
  // 兩日期間之完整月數
  function monthsBetween(a, b) {
    const A = toDate(a), B = toDate(b);
    let m = (B.getUTCFullYear() - A.getUTCFullYear()) * 12 + (B.getUTCMonth() - A.getUTCMonth());
    if (B.getUTCDate() < A.getUTCDate()) m -= 1;
    return m;
  }
  // 足歲
  function ageAt(birth, on) {
    let a = +on.slice(0, 4) - +birth.slice(0, 4);
    if (on.slice(4) < birth.slice(4)) a -= 1;
    return a;
  }
  // 金額字串 (16 位整數 + 2 位小數) 轉顯示
  function fmtAmount(s) {
    if (!/^\d+$/.test(s || '')) return s;
    const n = BigInt(s);
    const int = (n / 100n).toLocaleString('en-US');
    return int + '.' + String(n % 100n).padStart(2, '0');
  }
  function num(s) { return /^\d+$/.test(s || '') ? Number(s) : NaN; }
  function big(s) { return /^\d+$/.test(s || '') ? BigInt(s) : null; }
  function isZero(s) { return /^0+$/.test(s || ''); }

  // ---------- 欄位填值 (產生固定長度) ----------
  function pad(field, value) {
    let v = value == null ? '' : String(value);
    if (field.type === '9') {
      v = v.replace(/\D/g, '');
      return v.padStart(field.len, '0').slice(-field.len);
    }
    return v.padEnd(field.len, ' ').slice(0, field.len);
  }
  function buildLine(layout, obj) {
    return layout.fields.map(f => pad(f, obj[f.key] != null ? obj[f.key] : f.default)).join('');
  }

  // ---------- 解析 ----------
  function parseFixedWidth(text, layout) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    // 檔尾的單一換行允許 (但手冊規定不能有空白行)
    let trailingNewline = false;
    if (lines.length && lines[lines.length - 1] === '') { lines.pop(); trailingNewline = true; }
    const records = lines.map((raw, i) => {
      const rec = { _line: i + 1, _raw: raw, _file: layout.id };
      for (const f of layout.fields) rec[f.key] = raw.substr(f.start - 1, f.len);
      return rec;
    });
    return { records, trailingNewline };
  }

  // CSV (逗號分隔，首列為欄位代號或中文名稱) → 固定長度記錄
  function parseCSV(text) {
    const rows = [];
    let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); rows.push(row); row = []; cur = '';
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(c => c !== ''));
  }
  function csvToFixedWidth(text, layout) {
    const rows = parseCSV(text.replace(/^﻿/, ''));
    if (!rows.length) return '';
    const header = rows[0].map(h => h.trim());
    const idx = layout.fields.map(f => {
      let k = header.indexOf(f.key);
      if (k < 0) k = header.indexOf(f.name);
      return k;
    });
    const useHeader = idx.filter(k => k >= 0).length >= Math.min(5, layout.fields.length);
    const body = useHeader ? rows.slice(1) : rows;
    return body.map(r => layout.fields.map((f, j) => {
      const k = useHeader ? idx[j] : j;
      const v = k >= 0 && r[k] != null ? r[k] : '';
      // CSV 中數字欄位常被 Excel 去掉前置 0，這裡補回
      return f.type === '9' && /^\d*$/.test(v) ? v.padStart(f.len, '0') : v.padEnd(f.len, ' ');
    }).join('')).join('\n') + '\n';
  }

  function recordsToCSV(layout, records) {
    const esc = v => /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    const head = layout.fields.map(f => f.key).join(',');
    return '﻿' + head + '\n' + records.map(r => layout.fields.map(f => esc(r[f.key])).join(',')).join('\n') + '\n';
  }

  // ---------- 檢核執行 ----------
  function makeIssue(base) {
    return Object.assign({ severity: 'error', fields: [], value: '', suggestion: '', fix: null }, base);
  }

  /**
   * 依欄位定義自動產生之「資料類型檢核」與「代碼檢核」
   */
  function fieldChecks(layout, rec, push) {
    for (const f of layout.fields) {
      const v = rec[f.key];
      const where = { field: f.key };
      if (v.length < f.len) continue; // 長度錯誤另行處理
      if (f.type === '9') {
        if (!/^\d+$/.test(v)) {
          push({ ruleId: f.typeRule || '10400', category: '格式', fields: [f.key], value: v,
            message: `${f.name}應為 ${f.len} 位數字(靠右、前補 0)，實際為「${v}」`,
            suggestion: /^\s*\d+\s*$/.test(v) ? `改為「${v.trim().padStart(f.len, '0')}」` : `請填入 ${f.len} 位數字`,
            fix: /^\s*\d+\s*$/.test(v) ? { field: f.key, value: v.trim().padStart(f.len, '0') } : null });
          continue;
        }
      } else {
        const charset = f.charset || /^[\x20-\x7E]*$/;
        if (!charset.test(v)) {
          push({ ruleId: f.typeRule || '10400', category: '格式', fields: [f.key], value: v,
            message: `${f.name}含不允許的字元：「${v}」${/[^\x00-\x7F]/.test(v) ? '(含全形或中文字)' : ''}`,
            suggestion: f.charsetHint || '僅能使用半形英數字' });
          continue;
        }
        if (f.leftAlign && /^\s+\S/.test(v)) {
          const fixed = v.trim().padEnd(f.len, ' ');
          push({ ruleId: f.typeRule || '10400', category: '格式', fields: [f.key], value: v,
            message: `${f.name}應靠左填列，後面補空白`, suggestion: `改為「${fixed}」`, fix: { field: f.key, value: fixed } });
          continue;
        }
      }
      if (f.notBlank && v.trim() === '') {
        push({ ruleId: f.typeRule || '10400', category: '缺漏', fields: [f.key], value: v,
          message: `${f.name}不可為空白`, suggestion: f.hint || '請補填此欄位' });
        continue;
      }
      if (f.notZero && /^[0\s]*$/.test(v)) {
        push({ ruleId: f.typeRule || '10400', category: '缺漏', fields: [f.key], value: v,
          message: `${f.name}不可為 0 或空白`, suggestion: f.hint || '請補填此欄位' });
        continue;
      }
      if (f.codes) {
        const val = f.trimCode ? v.trim() : v;
        const ok = typeof f.codes === 'function' ? f.codes(val, rec) : f.codes.includes(val);
        if (!ok) {
          const list = Array.isArray(f.codes) && f.codes.length <= 40 ? `；合法值：${f.codes.map(c => c.trim() || '(空白)').join('、')}` : '';
          push({ ruleId: f.codeRule || '20000', category: '代碼', fields: [f.key], value: v,
            message: `${f.name}代碼「${v}」不在${f.codeTable || '代碼表'}中`,
            suggestion: (f.codeHint || `請依${f.codeTable || '代碼表'}填列`) + list });
        }
      }
      void where;
    }
  }

  /**
   * 執行整套規則
   * @param ruleset 規則集 (例如 rulesets/life.js)
   * @param files { L: {name, text}, D: {name, text} }
   */
  function validate(ruleset, files, opts) {
    opts = opts || {};
    const issues = [];
    const data = {};
    const meta = {};
    const ruleMap = {};
    for (const r of ruleset.catalog) ruleMap[r.id] = r;

    for (const fid of Object.keys(ruleset.layouts)) {
      const layout = ruleset.layouts[fid];
      const file = files[fid];
      if (!file || file.text == null) { data[fid] = []; continue; }
      const { records, trailingNewline } = parseFixedWidth(file.text, layout);
      data[fid] = records;
      meta[fid] = { name: file.name, count: records.length, trailingNewline };

      const keyOf = rec => rec && rec._raw && layout.keyOf ? layout.keyOf(rec) : '';
      const push = (rec, iss) => {
        const issue = makeIssue(Object.assign({ file: fid, line: rec ? rec._line : 0, policy: keyOf(rec) }, iss));
        const def = ruleMap[issue.ruleId];
        if (def && def.severity && !iss.severity) issue.severity = def.severity;
        issues.push(issue);
      };

      // 檔案層級檢核
      if (layout.fileName && file.name) {
        const fn = file.name.replace(/^.*[\\/]/, '');
        if (!layout.fileName.re.test(fn)) {
          push(null, { ruleId: 'F001', category: '檔案', message: `檔名「${fn}」不符命名原則 ${layout.fileName.pattern}`,
            suggestion: `請改名為 ${layout.fileName.pattern}，例如 ${layout.fileName.example}`, severity: 'warning' });
        }
      }
      if (!records.length) {
        push(null, { ruleId: 'F002', category: '檔案', message: '檔案為空', suggestion: '若此檔無資料，請於上傳頁面勾選「此檔免上傳」' });
        continue;
      }

      // 長度 / 空白行 / 半形
      const good = [];
      for (const rec of records) {
        if (rec._raw === '') {
          push(rec, { ruleId: 'F003', category: '格式', message: '不能有空白行', suggestion: '刪除此空白行' });
          continue;
        }
        if (/[^\x00-\x7F]/.test(rec._raw)) {
          push(rec, { ruleId: 'F004', category: '格式', message: '含全形字或中文字 (限使用英數型態半形資料)',
            value: (rec._raw.match(/[^\x00-\x7F]+/) || [''])[0], suggestion: '將全形字元轉為半形，中文請移除' });
        }
        if (rec._raw.length !== layout.recordLength) {
          push(rec, { ruleId: '10300', category: '格式',
            message: `每筆長度應為 ${layout.recordLength}，實際為 ${rec._raw.length}`,
            suggestion: rec._raw.length < layout.recordLength ? '可能缺少欄位或數字欄未補前置 0，請檢查欄位對齊' : '可能有多餘字元或欄位溢位，請檢查欄位對齊' });
          continue;
        }
        good.push(rec);
      }

      for (const rec of good) {
        const p = iss => push(rec, iss);
        fieldChecks(layout, rec, p);
        for (const rule of (ruleset.recordRules[fid] || [])) {
          try { rule(rec, p, ruleset); } catch (e) { p({ ruleId: 'SYS', severity: 'warning', message: '規則執行例外：' + e.message }); }
        }
      }
      // 多筆檢核 (同一保單號碼)
      if (ruleset.groupRules && ruleset.groupRules[fid] && layout.keyOf) {
        const groups = new Map();
        for (const rec of good) {
          const k = layout.keyOf(rec);
          if (!groups.has(k)) groups.set(k, []);
          groups.get(k).push(rec);
        }
        for (const [k, recs] of groups) {
          for (const rule of ruleset.groupRules[fid]) rule(recs, (rec, iss) => push(rec, iss), k);
        }
        meta[fid].policies = groups.size;
      }
      data[fid] = good.concat(records.filter(r => !good.includes(r)));
    }

    // 跨檔檢核
    if (ruleset.crossRules && Object.keys(meta).length) {
      for (const rule of ruleset.crossRules) {
        rule(data, (fid, rec, iss) => {
          const layout = ruleset.layouts[fid];
          const issue = makeIssue(Object.assign({ file: fid, line: rec ? rec._line : 0,
            policy: rec && layout.keyOf ? layout.keyOf(rec) : '', category: '跨檔' }, iss));
          const def = ruleMap[issue.ruleId];
          if (def && def.severity && !iss.severity) issue.severity = def.severity;
          issues.push(issue);
        });
      }
    }

    // 去除同筆同規則重複
    const seen = new Set();
    const uniq = issues.filter(i => {
      const k = [i.file, i.line, i.ruleId, i.fields.join('|'), i.message].join('#');
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    uniq.forEach((i, n) => { i.id = n + 1; const d = ruleMap[i.ruleId]; i.ruleName = d ? d.name : ''; i.ref = d ? d.ref : ''; });

    return { ruleset: ruleset.id, issues: uniq, data, meta, summary: summarize(ruleset, uniq, meta), generatedAt: new Date().toISOString() };
  }

  function summarize(ruleset, issues, meta) {
    const byFile = {};
    for (const fid of Object.keys(meta)) {
      const bad = new Set(issues.filter(i => i.file === fid && i.severity === 'error' && i.line).map(i => i.line));
      byFile[fid] = { records: meta[fid].count, policies: meta[fid].policies || 0, badRecords: bad.size,
        passRate: meta[fid].count ? (meta[fid].count - bad.size) / meta[fid].count : 1 };
    }
    const count = (key) => issues.reduce((m, i) => { m[i[key]] = (m[i[key]] || 0) + 1; return m; }, {});
    return {
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity === 'warning').length,
      suspects: issues.filter(i => i.severity === 'suspect').length,
      byFile,
      byCategory: count('category'),
      byRule: count('ruleId'),
      fixable: issues.filter(i => i.fix).length,
    };
  }

  // 套用可自動修正之建議，回傳修正後文字檔
  function applyFixes(ruleset, result, fid, selectedIds) {
    const layout = ruleset.layouts[fid];
    const sel = selectedIds ? new Set(selectedIds) : null;
    const recs = result.data[fid].slice().sort((a, b) => a._line - b._line);
    const byLine = new Map(recs.map(r => [r._line, Object.assign({}, r)]));
    let applied = 0;
    for (const i of result.issues) {
      if (i.file !== fid || !i.fix || (sel && !sel.has(i.id))) continue;
      const r = byLine.get(i.line);
      if (!r || r._raw.length !== layout.recordLength) continue;
      const f = layout.fields.find(x => x.key === i.fix.field);
      if (!f) continue;
      r[f.key] = pad(f, i.fix.value);
      applied++;
    }
    const out = recs.map(r0 => {
      const r = byLine.get(r0._line);
      return r._raw.length === layout.recordLength ? layout.fields.map(f => r[f.key]).join('') : r._raw;
    }).filter(l => l !== '');
    return { text: out.join('\n') + '\n', applied };
  }

  return { isValidDate, toDate, fmtDate, addYearsMinusDay, monthsBetween, ageAt, fmtAmount, num, big, isZero,
    pad, buildLine, parseFixedWidth, parseCSV, csvToFixedWidth, recordsToCSV, validate, applyFixes, summarize };
});
