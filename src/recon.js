/*
 * 跨系統對帳與勾稽：
 *  1. controlRecon  上游系統 (新契約/理賠/保單管理) 控制總數 vs 申報明細彙總，差異自動歸因
 *  2. rollForward   上年度申報檔期末 vs 本年度期初，逐保單結轉與保額變動表
 *  3. statement     資產負債表 (含準備金) 勾稽：結轉、層級加總、資產=負債+權益、停用/錯置科目、與給付明細勾稽
 *  4. decode        退件訊息解碼：把籠統的錯誤代碼定位到具體的列、欄位與修正值
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = isNode
    ? { C: require('./core.js'), life: require('./rulesets/life.js'), fin: require('./rulesets/finance.js') }
    : { C: root.DQ, life: root.DQ.rulesets.life, fin: root.DQ.rulesets.finance };
  const m = factory(deps);
  if (isNode) module.exports = m; else root.DQ.recon = m;
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  const { C, life, fin } = deps;
  const L = life.layouts.L;
  const ACTIVE = ['XED', 'EOY'];
  const AMT_CHANGE = ['INN', 'DNN', 'PAU', 'ROL', 'CTC'];

  // ---------- 共用 ----------
  const cents = s => /^\d+$/.test(s || '') ? Number(s) : 0;               // 申報檔 18 位含 2 位小數
  function parseAmount(v) {                                                // CSV「1,234.5」→ 分
    const t = String(v == null ? '' : v).replace(/[,\s元]/g, '');
    if (t === '' || t === '-') return 0;
    if (!/^-?\d+(\.\d{1,2})?$/.test(t)) return NaN;
    const neg = t.startsWith('-'), [i, d = ''] = t.replace('-', '').split('.');
    const n = Number(i) * 100 + Number((d + '00').slice(0, 2));
    return neg ? -n : n;
  }
  const yuan = c => (c < 0 ? '-' : '') + (Math.abs(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  function csvObjects(text) {
    const rows = C.parseCSV(String(text || '').replace(/^﻿/, ''));
    if (!rows.length) return [];
    const head = rows[0].map(h => h.trim());
    return rows.slice(1).map((r, i) => { const o = { _line: i + 2 }; head.forEach((h, k) => { o[h] = (r[k] || '').trim(); }); return o; });
  }
  const month = d => `${d.slice(0, 4)}-${d.slice(4, 6)}`;
  function shiftMonth(p, n) { const y = +p.slice(0, 4), m = +p.slice(5, 7) - 1 + n; const d = new Date(Date.UTC(y, m, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
  function lastDay(p) { return C.fmtDate(new Date(Date.UTC(+p.slice(0, 4), +p.slice(5, 7), 0))); }
  const daysBetween = (a, b) => Math.round((C.toDate(b) - C.toDate(a)) / 86400000);
  function reportYear(res) {
    const n = res.meta.L && res.meta.L.name, m = n && n.match(/_(\d{4})/);
    return m ? m[1] : '2025';
  }
  function groups(recs) {
    const g = new Map();
    for (const r of recs) { const k = L.keyOf(r).trim(); if (!g.has(k)) g.set(k, []); g.get(k).push(r); }
    for (const v of g.values()) v.sort((a, b) => a.txnSeq.localeCompare(b.txnSeq) || a._line - b._line);
    return g;
  }
  const goodL = res => (res.data.L || []).filter(r => r._raw.length === L.recordLength);
  const goodD = res => (res.data.D || []).filter(r => r._raw.length === life.layouts.D.recordLength);
  const ref = (file, r, amt, date) => ({ file, line: r._line, policy: L.keyOf(r).trim(), amt, date, currency: r.currency });

  // 找出金額合計 = target、筆數 = k 之組合 (k ≤ 3)
  function subsetSum(cands, target, k) {
    const c = cands.slice(0, 40);
    if (k === 1) return (c.find(x => x.amt === target) && [c.find(x => x.amt === target)]) || null;
    if (k === 2) { for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) if (c[i].amt + c[j].amt === target) return [c[i], c[j]]; }
    if (k === 3) { for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) for (let l = j + 1; l < c.length; l++) if (c[i].amt + c[j].amt + c[l].amt === target) return [c[i], c[j], c[l]]; }
    return null;
  }

  // ---------- 1. 控制總數對帳 ----------
  const ITEMS = {
    NB: { name: '新契約件數/保額', source: '新契約系統' },
    CLM: { name: '死亡/失能理賠給付', source: '理賠系統' },
    BEN: { name: '生存/祝壽/滿期給付', source: '理賠系統' },
    INF: { name: '期末有效件數/保額', source: '保單管理系統' },
  };
  function aggregate(res) {
    const agg = new Map();
    const add = (item, period, rec) => {
      const k = item + '|' + period;
      if (!agg.has(k)) agg.set(k, { cnt: 0, amt: 0, recs: [] });
      const a = agg.get(k); a.cnt++; a.amt += rec.amt; a.recs.push(rec);
    };
    const Y = reportYear(res);
    for (const r of goodL(res)) if (r.addType === 'NEW' && C.isValidDate(r.addDate)) add('NB', month(r.addDate), ref('L', r, cents(r.sumInsuredTwd), r.addDate));
    for (const d of goodD(res)) if (C.isValidDate(d.payDate)) {
      const item = ['1', '2', '3'].includes(d.claimType) ? 'CLM' : 'BEN';
      add(item, month(d.payDate), Object.assign(ref('D', d, cents(d.paidAmtTwd), d.payDate), { orig: cents(d.paidAmtOrig) }));
    }
    for (const recs of groups(goodL(res)).values()) {
      const last = recs[recs.length - 1];
      if (ACTIVE.includes(last.exitType)) add('INF', Y, Object.assign(ref('L', last, cents(last.sumInsuredTwd), ''), { orig: cents(last.sumInsuredOrig) }));
    }
    return agg;
  }
  function filingFor(agg, item, period) {
    if (period.length === 7 || item === 'INF') return agg.get(item + '|' + period) || { cnt: 0, amt: 0, recs: [] };
    const out = { cnt: 0, amt: 0, recs: [] };   // 年度 = 各月合計
    for (const [k, a] of agg) if (k.startsWith(item + '|' + period)) { out.cnt += a.cnt; out.amt += a.amt; out.recs.push(...a.recs); }
    return out;
  }

  function controlRecon(res, controlText, extraIssues) {
    const ctl = csvObjects(controlText);
    const agg = aggregate(res);
    const rows = [];
    const seen = new Set();
    for (const c of ctl) {
      const item = (c['項目代號'] || '').toUpperCase(), period = c['期間'] || '';
      if (!ITEMS[item]) { rows.push({ line: c._line, item, period, status: '格式錯誤', explain: `項目代號「${item}」無法辨識 (可用 ${Object.keys(ITEMS).join('/')})` }); continue; }
      seen.add(item + '|' + period);
      const fil = filingFor(agg, item, period);
      const up = { cnt: Number(c['筆數'] || 0), amt: parseAmount(c['金額']) };
      rows.push({ line: c._line, source: c['來源系統'] || ITEMS[item].source, item, name: c['項目名稱'] || ITEMS[item].name, period, up, fil: { cnt: fil.cnt, amt: fil.amt }, recs: fil.recs,
        diff: { cnt: up.cnt - fil.cnt, amt: up.amt - fil.amt } });
    }
    // 申報有、上游沒有的月份 (僅限上游有提供月資料之項目)
    const monthlyItems = new Set(rows.filter(r => r.period && r.period.length === 7).map(r => r.item));
    for (const [k, a] of agg) {
      const [item, period] = k.split('|');
      if (!monthlyItems.has(item) || period.length !== 7 || seen.has(k)) continue;
      rows.push({ line: 0, source: ITEMS[item].source, item, name: ITEMS[item].name, period, up: { cnt: 0, amt: 0 }, fil: { cnt: a.cnt, amt: a.amt }, recs: a.recs, diff: { cnt: -a.cnt, amt: -a.amt }, missingUpstream: true });
    }
    rows.sort((a, b) => (a.item || '').localeCompare(b.item || '') || (a.period || '').localeCompare(b.period || ''));

    const issueRecs = new Map();
    for (const i of (res.issues || []).concat(extraIssues || [])) if (i.severity === 'error' && i.line) {
      const k = i.file + ':' + i.line; if (!issueRecs.has(k)) issueRecs.set(k, []); issueRecs.get(k).push(i);
    }
    const byKey = new Map(rows.filter(r => r.diff).map(r => [r.item + '|' + r.period, r]));

    for (const r of rows) {
      if (!r.diff) continue;
      if (r.diff.cnt === 0 && r.diff.amt === 0) { r.status = '一致'; continue; }
      if (Number.isNaN(r.up.amt)) { r.status = '格式錯誤'; r.explain = '上游金額格式無法解析'; continue; }
      // (a) 時間差：申報明細落在相鄰期間的結帳邊界附近
      if (r.period.length === 7 && r.diff.cnt !== 0 && Math.sign(r.diff.cnt) === Math.sign(r.diff.amt) && Math.abs(r.diff.cnt) <= 3) {
        const k = Math.abs(r.diff.cnt), target = Math.abs(r.diff.amt);
        let cands = [], where;
        if (r.diff.amt < 0) { // 申報在本期較多 → 本期邊界附近的明細被上游算到鄰期
          const first = r.period.replace('-', '') + '01', last = lastDay(r.period);
          cands = r.recs.filter(x => daysBetween(x.date, last) <= 7 || daysBetween(first, x.date) <= 7);
          where = '本期';
        } else {               // 上游在本期較多 → 申報把邊界明細放到鄰期
          const prev = filingFor(agg, r.item, shiftMonth(r.period, -1)), next = filingFor(agg, r.item, shiftMonth(r.period, 1));
          const pl = lastDay(shiftMonth(r.period, -1)), nf = shiftMonth(r.period, 1).replace('-', '') + '01';
          cands = prev.recs.filter(x => daysBetween(x.date, pl) <= 7).concat(next.recs.filter(x => daysBetween(nf, x.date) <= 7));
          where = '鄰期';
        }
        const hit = subsetSum(cands, target, k);
        if (hit) {
          const pair = [byKey.get(r.item + '|' + shiftMonth(r.period, 1)), byKey.get(r.item + '|' + shiftMonth(r.period, -1))].find(o => o && o.diff.cnt === -r.diff.cnt && o.diff.amt === -r.diff.amt);
          r.status = '時間差';
          r.records = hit;
          r.explain = `差異 ${yuan(r.diff.amt)} 元 / ${r.diff.cnt} 筆 = ${hit.map(x => `${x.file === 'D' ? '給付' : '承保'}第 ${x.line} 行 (${x.policy}，${x.date}，${yuan(x.amt)} 元)`).join('、')}。` +
            `${where === '本期' ? '申報依交易日計入本期，上游系統計入鄰期' : '申報計入鄰期，上游系統計入本期'}，屬結帳時點差異${pair ? `，與 ${pair.period} 之差異相互抵銷` : '；鄰期上游資料未提供，屬跨期差異'}。`;
          r.suggestion = '屬正常時間差，無需修正申報檔；請於對帳底稿註明，並確認兩系統截止日定義。';
          continue;
        }
      }
      // (b) 定義差：外幣保單以原幣計
      const fx = (r.recs || []).filter(x => x.currency && x.currency !== 'NTD' && x.orig != null);
      const fxDiff = fx.reduce((s, x) => s + x.orig - x.amt, 0);
      if (fx.length && r.diff.cnt === 0 && fxDiff === r.diff.amt) {
        r.status = '定義差';
        r.records = fx;
        r.explain = `差異 ${yuan(r.diff.amt)} 元恰等於 ${fx.length} 筆外幣保單「原幣金額 − 臺幣金額」合計，上游系統應是以原幣加總、未換算臺幣。`;
        r.suggestion = '統一以臺幣金額 (業務月報匯率換算) 對帳，或請上游提供臺幣口徑報表。';
        continue;
      }
      // (c) 與明細檢核錯誤相關
      const related = [];
      for (const x of r.recs || []) for (const i of issueRecs.get(x.file + ':' + x.line) || []) related.push(i);
      if (r.item === 'CLM' && r.diff.cnt > 0) for (const i of res.issues || []) if (i.ruleId === '30301_LD012') {
        const rec = (res.data.L || []).find(x => x._line === i.line);
        if (rec && [r.period, shiftMonth(r.period, -1)].includes(month(rec.exitDate))) related.push(i);
      }
      if (related.length) {
        r.status = '待查';
        r.related = related;
        r.explain = `差異 ${yuan(r.diff.amt)} 元 / ${r.diff.cnt} 筆無法以時間差解釋；此期間有 ${related.length} 項明細檢核錯誤可能是原因 (${[...new Set(related.map(i => i.ruleId))].join('、')})。`;
        r.suggestion = '先修正相關明細錯誤後重新對帳。';
        continue;
      }
      r.status = '待查';
      r.explain = r.missingUpstream ? '申報明細有此期間資料，上游控制總數未提供。'
        : r.diff.cnt > 0 ? `上游比申報多 ${r.diff.cnt} 筆 / ${yuan(r.diff.amt)} 元，申報明細中找不到可對應的時間差，疑似申報漏報。`
          : `申報比上游多 ${-r.diff.cnt} 筆 / ${yuan(-r.diff.amt)} 元，找不到可對應的時間差，疑似重複或上游漏列。`;
      r.suggestion = r.diff.cnt > 0 ? `請上游提供 ${r.period} 之明細清單，比對保單號碼找出申報漏報之資料。` : '請檢查是否重複申報。';
    }
    const issues = rows.filter(r => r.status && r.status !== '一致').map(r => ({
      ruleId: 'R001', severity: r.status === '時間差' || r.status === '定義差' ? 'warning' : 'error', category: '跨系統對帳', file: 'R', line: r.line,
      policy: '', fields: [], value: r.diff ? `${r.diff.cnt} 筆 / ${yuan(r.diff.amt)} 元` : '', message: `${r.source || ''} ${r.name || r.item} ${r.period}：${r.status}`, suggestion: r.suggestion || r.explain || '', explain: r.explain,
    }));
    const count = s => rows.filter(r => r.status === s).length;
    return { rows, issues, summary: { total: rows.length, ok: count('一致'), timing: count('時間差'), definition: count('定義差'), open: count('待查') + count('格式錯誤') } };
  }

  // ---------- 2. 期初/期末結轉 ----------
  function rollForward(res, priorText) {
    const cur = groups(goodL(res));
    const prior = priorText ? groups(C.parseFixedWidth(priorText, L).records.filter(r => r._raw.length === L.recordLength)) : null;
    const issues = [];
    const push = (rec, o) => issues.push(Object.assign({ severity: 'error', category: '期初期末結轉', file: 'L', line: rec ? rec._line : 0, policy: rec ? L.keyOf(rec).trim() : '', fields: [], value: '' }, o));
    const mv = { open: [0, 0], new: [0, 0], inc: [0, 0], dec: [0, 0], adj: [0, 0], unexplained: [0, 0], term: {}, close: [0, 0], closeActual: [0, 0], priorClose: [0, 0] };
    const TERM = { 死亡失能: ['DEA', 'ADS', 'TDI', 'ATS', 'ABD', 'DDA'], 滿期祝壽: ['MAD', 'HLM'], 解約撤銷: ['SRD', 'SRE', 'RES'], 停效失效: ['LNN', 'LOP'], 其他終止: [] };
    const termGroup = t => Object.keys(TERM).find(k => TERM[k].includes(t)) || '其他終止';

    if (prior) for (const [k, recs] of prior) {
      const last = recs[recs.length - 1];
      if (!ACTIVE.includes(last.exitType)) continue;
      mv.priorClose[0]++; mv.priorClose[1] += cents(last.sumInsuredTwd);
      if (!cur.has(k)) push(null, { ruleId: 'P001', policy: k, fields: ['policyNo'], value: `上年度期末保額 ${yuan(cents(last.sumInsuredTwd))}`,
        message: `保單 ${k} 上年度期末為有效保單，本年度申報檔查無資料`, suggestion: '持續有效保單每年都須填報 (加保別 XED)；若已於上年度終止，請更正上年度資料。' });
    }
    for (const [k, s] of cur) {
      const first = s[0], last = s[s.length - 1];
      const opening = ACTIVE.includes(first.addType);
      if (opening) {
        mv.open[0]++; mv.open[1] += cents(first.sumInsuredTwd);
        if (prior) {
          const p = prior.get(k), pl = p && p[p.length - 1];
          if (!pl || !ACTIVE.includes(pl.exitType)) push(first, { ruleId: 'P002', fields: ['addType'], value: first.addType,
            message: pl ? `本年度期初有效 (XED)，但上年度最後異動為 ${pl.exitType}(${life.tables.exitType[pl.exitType] || ''})，並非有效保單` : '本年度期初有效 (XED)，但上年度申報檔無此保單',
            suggestion: pl ? '確認上年度是否誤報終止，或本年度應為復效 / 新契約。' : '若為本年度新契約，加保別應為 NEW；否則請補報上年度資料。' });
          else if (pl.sumInsuredTwd !== first.sumInsuredTwd) push(first, { ruleId: 'P003', fields: ['sumInsuredTwd'], value: `${yuan(cents(pl.sumInsuredTwd))} → ${yuan(cents(first.sumInsuredTwd))}`,
            message: `期初保額 ${yuan(cents(first.sumInsuredTwd))} 元 ≠ 上年度期末保額 ${yuan(cents(pl.sumInsuredTwd))} 元`, delta: cents(first.sumInsuredTwd) - cents(pl.sumInsuredTwd),
            suggestion: '上年度期末與本年度期初應一致；若上年度末有增減額未報，請補報上年度異動。', fix: { field: 'sumInsuredTwd', value: pl.sumInsuredTwd } });
        }
      } else if (['NEW', 'NCT'].includes(first.addType)) { mv.new[0]++; mv.new[1] += cents(first.sumInsuredTwd); }
      for (let i = 1; i < s.length; i++) {
        const d = cents(s[i].sumInsuredTwd) - cents(s[i - 1].sumInsuredTwd);
        if (!d) continue;
        const t = s[i].addType;
        if (t === 'INN') mv.inc[1] += d;
        else if (t === 'DNN') mv.dec[1] += d;
        else if (AMT_CHANGE.includes(t)) mv.adj[1] += d;
        else {
          mv.unexplained[1] += d;
          push(s[i], { ruleId: 'P004', fields: ['sumInsuredTwd', 'addType'], value: `${yuan(cents(s[i - 1].sumInsuredTwd))} → ${yuan(cents(s[i].sumInsuredTwd))}`, delta: d,
            message: `保額變動 ${yuan(d)} 元，但加保別 ${t}(${life.tables.addType[t] || ''}) 不是保額異動，期初期末結轉兜不攏`,
            suggestion: `若保額確有變動，應拆成 ${d > 0 ? 'INN' : 'DNN'} 異動；否則改回上一筆保額 ${yuan(cents(s[i - 1].sumInsuredTwd))} 元`, fix: { field: 'sumInsuredTwd', value: s[i - 1].sumInsuredTwd } });
        }
      }
      if (ACTIVE.includes(last.exitType)) { mv.closeActual[0]++; mv.closeActual[1] += cents(last.sumInsuredTwd); }
      else { const g = termGroup(last.exitType); mv.term[g] = mv.term[g] || [0, 0]; mv.term[g][0]++; mv.term[g][1] += cents(last.sumInsuredTwd); }
    }
    const termSum = Object.values(mv.term).reduce((a, b) => [a[0] + b[0], a[1] + b[1]], [0, 0]);
    mv.close = [mv.open[0] + mv.new[0] - termSum[0], mv.open[1] + mv.new[1] + mv.inc[1] + mv.dec[1] + mv.adj[1] + mv.unexplained[1] - termSum[1]];
    return { hasPrior: !!prior, movement: mv, termSum, issues, summary: { issues: issues.length, priorDiff: prior ? [mv.open[0] - mv.priorClose[0], mv.open[1] - mv.priorClose[1]] : null } };
  }

  // ---------- 3. 財報勾稽 ----------
  function damerau1(a, b) {
    if (a === b || Math.abs(a.length - b.length) > 1) return false;
    if (a.length === b.length) {
      const diff = [...a].map((c, i) => c !== b[i] ? i : -1).filter(i => i >= 0);
      if (diff.length === 1) return true;
      return diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]];
    }
    const [s, l] = a.length < b.length ? [a, b] : [b, a];
    for (let i = 0; i < l.length; i++) if (l.slice(0, i) + l.slice(i + 1) === s) return true;
    return false;
  }
  function statement(stmtText, res) {
    const rows = csvObjects(stmtText).map(o => ({ line: o._line, code: o['科目代號'], name: o['科目名稱'], open: parseAmount(o['期初餘額']), inc: parseAmount(o['本期增加']), dec: parseAmount(o['本期減少']), close: parseAmount(o['期末餘額']) }));
    const issues = [];
    const push = (r, o) => issues.push(Object.assign({ severity: 'error', category: '財報勾稽', file: 'S', line: r ? r.line : 0, policy: '', fields: [], value: '', code: r ? r.code : '' }, o));
    const seen = new Map();
    const parentOf = code => { for (let k = code.length - 1; k >= 1; k--) if (fin.byCode.has(code.slice(0, k))) return code.slice(0, k); return null; };
    for (const r of rows) {
      for (const k of ['open', 'inc', 'dec', 'close']) if (Number.isNaN(r[k])) push(r, { ruleId: 'S009', value: k, message: `科目 ${r.code} 金額欄位格式錯誤`, suggestion: '金額只能有數字、千分位逗號與最多兩位小數' });
      if (seen.has(r.code)) push(r, { ruleId: 'S006', value: r.code, message: `科目代號 ${r.code} 重複 (另見第 ${seen.get(r.code)} 列)`, suggestion: '合併為一列' });
      seen.set(r.code, r.line);
      const acct = fin.byCode.get(r.code);
      if (!acct) {
        const sugg = fin.chart.filter(a => !a.until && a.code.length === r.code.length && damerau1(a.code, r.code));
        const best = sugg.find(a => a.name === r.name) || sugg.find(a => a.parent === parentOf(r.code)) || sugg[0];
        push(r, { ruleId: 'S001', value: r.code, message: `科目代號 ${r.code}「${r.name}」不存在於會計科目表`,
          suggestion: best ? `疑似代號錯置 (數字對調/誤植)，應為 ${best.code}「${best.name}」` : '請依會計科目表填列', fix: best ? { field: 'code', value: best.code } : null, suggest: best && best.code });
      } else if (acct.until) {
        const rep = fin.byCode.get(acct.replacedBy);
        push(r, { ruleId: 'S002', value: r.code, message: `科目 ${r.code}「${acct.name}」已於 ${acct.until} 停用`, suggestion: `請改用 ${rep.code}「${rep.name}」`, fix: { field: 'code', value: rep.code }, suggest: rep.code });
      } else if (r.name && r.name !== acct.name) push(r, { ruleId: 'S007', severity: 'warning', value: r.name, message: `科目 ${r.code} 名稱「${r.name}」與科目表「${acct.name}」不一致`, suggestion: `確認代號是否填錯；名稱應為「${acct.name}」` });
      if ([r.open, r.inc, r.dec, r.close].every(Number.isFinite) && r.open + r.inc - r.dec !== r.close)
        push(r, { ruleId: 'S003', value: `${yuan(r.open)} + ${yuan(r.inc)} − ${yuan(r.dec)} ≠ ${yuan(r.close)}`, delta: r.close - (r.open + r.inc - r.dec),
          message: `科目 ${r.code}「${r.name}」期初 + 增加 − 減少 = ${yuan(r.open + r.inc - r.dec)}，但期末填 ${yuan(r.close)}，差 ${yuan(r.close - (r.open + r.inc - r.dec))}`,
          suggestion: (() => { const exp = String(Math.abs(r.open + r.inc - r.dec)), got = String(Math.abs(r.close)); return exp.length === got.length && damerau1(exp, got) ? `期末餘額疑似數字對調，應為 ${yuan(r.open + r.inc - r.dec)}` : `確認期末餘額或本期增減金額`; })() });
    }
    // 層級加總 (未知/停用科目依代號前綴歸入上層)
    const byCode = new Map(rows.map(r => [r.code, r]));
    for (const p of rows) {
      const kids = rows.filter(r => r !== p && (fin.byCode.has(r.code) ? fin.byCode.get(r.code).parent : parentOf(r.code)) === p.code);
      if (!kids.length) continue;
      for (const [k, label] of [['open', '期初'], ['close', '期末']]) {
        const sum = kids.reduce((s, r) => s + (Number.isFinite(r[k]) ? r[k] : 0), 0);
        if (Number.isFinite(p[k]) && sum !== p[k]) push(p, { ruleId: 'S004', value: `${label} ${yuan(p[k])} vs ${yuan(sum)}`, delta: p[k] - sum,
          message: `${p.code}「${p.name}」${label}餘額 ${yuan(p[k])} ≠ 下層 ${kids.map(r => r.code).join('+')} 合計 ${yuan(sum)}，差 ${yuan(p[k] - sum)}`, suggestion: '檢查下層科目金額或上層加總公式' });
      }
    }
    const A = byCode.get('1'), Li = byCode.get('2'), E = byCode.get('3');
    if (A && Li && E) for (const [k, label] of [['open', '期初'], ['close', '期末']]) if (A[k] !== Li[k] + E[k])
      push(A, { ruleId: 'S005', value: `${yuan(A[k])} vs ${yuan(Li[k] + E[k])}`, delta: A[k] - (Li[k] + E[k]),
        message: `${label}資產總計 ${yuan(A[k])} ≠ 負債 ${yuan(Li[k])} + 權益 ${yuan(E[k])} = ${yuan(Li[k] + E[k])}，差 ${yuan(A[k] - Li[k] - E[k])}`, suggestion: '資產負債表不平，請依下方根因追查' });
    // 與給付明細勾稽
    const pay = byCode.get('2101');
    if (pay && res && goodD(res).length) {
      const Y = reportYear(res);
      const ds = goodD(res).filter(d => d.payDate.startsWith(Y));
      const total = ds.reduce((s, d) => s + cents(d.paidAmtTwd), 0);
      if (Number.isFinite(pay.dec) && pay.dec !== total) {
        const diff = total - pay.dec;
        const cands = ds.filter(d => d.payDate >= `${Y}1224`).map(d => ref('D', d, cents(d.paidAmtTwd), d.payDate));
        let hit = null;
        for (let k = 1; k <= 3 && !hit && diff > 0; k++) hit = subsetSum(cands, diff, k);
        push(pay, { ruleId: 'S008', severity: hit ? 'warning' : 'error', value: `${yuan(pay.dec)} vs ${yuan(total)}`, delta: diff,
          message: `應付保險給付本期減少 ${yuan(pay.dec)} ≠ 給付明細 ${Y} 年實際給付(臺幣)合計 ${yuan(total)}，差 ${yuan(diff)}`,
          explain: hit ? `差額恰為 ${hit.map(x => `給付第 ${x.line} 行 (${x.policy}，給付日 ${x.date}，${yuan(x.amt)} 元)`).join('、')}：年底前給付、會計於次年入帳之時間差。` : '',
          records: hit || undefined,
          suggestion: hit ? '屬跨年度時間差，請於附註揭露或調整入帳期間；申報明細不需修改。' : '請比對總帳應付保險給付沖銷明細與給付檔' });
      }
    }
    // 根因串連：相同差額的錯誤視為同一根因
    const chains = [];
    const withDelta = issues.filter(i => i.delta);
    const order = { S001: 0, S002: 0, S003: 1, S004: 2, S005: 3, S008: 4 };
    for (const i of withDelta) {
      if (i.chain != null) continue;
      const same = withDelta.filter(j => j.chain == null && Math.abs(j.delta) === Math.abs(i.delta)).sort((a, b) => order[a.ruleId] - order[b.ruleId] || (b.code || '').length - (a.code || '').length);
      if (same.length < 2) continue;
      const id = chains.length + 1;
      same.forEach((j, n) => { j.chain = id; j.chainRole = n === 0 ? '根因' : '連帶'; });
      chains.push({ id, delta: Math.abs(i.delta), root: same[0], effects: same.slice(1) });
    }
    for (const ch of chains) ch.root.explain = (ch.root.explain ? ch.root.explain + ' ' : '') + `此錯誤同時造成 ${ch.effects.map(e => `${e.ruleId}(${e.code})`).join('、')} 的差額 ${yuan(ch.delta)}，修正這一處即可一併解決。`;
    const err = issues.filter(i => i.severity === 'error');
    return { rows, issues, chains, summary: { rows: rows.length, errors: err.length, warnings: issues.length - err.length, balanced: !issues.some(i => i.ruleId === 'S005') } };
  }

  // ---------- 4. 退件訊息解碼 ----------
  const GENERIC = { '103': ['格式'], '104': ['格式', '缺漏'], '105': ['格式'], '2': ['代碼'], '3': ['多筆邏輯', '跨檔'] };
  const KEYWORDS = [
    [/欄位|格式|型態|長度|驗證|validation|field|format/i, ['格式', '代碼', '缺漏']],
    [/代碼|代號|code/i, ['代碼']],
    [/空白|缺漏|必填|missing|blank/i, ['缺漏']],
    [/邏輯|不合理|矛盾|logic/i, ['單筆邏輯', '多筆邏輯', '邏輯合理性']],
    [/日期|date/i, ['單筆邏輯', '格式']],
    [/對帳|勾稽|不平|兜不攏|差異|reconcil|balance/i, ['跨系統對帳', '財報勾稽', '期初期末結轉', '跨檔']],
    [/結轉|期初|期末|上年度/i, ['期初期末結轉']],
    [/給付|理賠|claim/i, ['跨檔']],
    [/科目|財報|資產|負債|準備金/i, ['財報勾稽']],
  ];
  function decode(text, ctx) {
    const all = (ctx.res ? ctx.res.issues : []).concat(ctx.extra || []);
    const catalog = (ctx.catalogs || []).flat();
    const findings = [];
    const used = new Set();
    const add = (clue, kind, explain, matches, rule) => { matches.forEach(i => used.add(i)); findings.push({ clue, kind, explain, matches, rule }); };
    const t = String(text || '');

    // 手冊檢核編號 (新：20200_L0612 / 舊：L0612、LU0611、LD00-01) 與本工具編號
    const codes = new Set([...t.matchAll(/\b(\d{5}_[A-Z]{1,2}\d{3,4}|(?:LU|LD|L|D)\d{3,4}|LD00-\d{2}|[SRPXFK]\d{3,4})\b/g)].map(m => m[1]));
    for (const code of codes) {
      const rules = catalog.filter(r => r.id === code || r.id.endsWith('_' + code) || r.ref === code || (r.ref || '').split('/').includes(code));
      const ids = new Set(rules.map(r => r.id).concat([code]));
      const matches = all.filter(i => ids.has(i.ruleId) || i.ruleId.endsWith('_' + code));
      const r = rules[0];
      add(code, '檢核編號', r ? `${r.id}：${r.name}（${r.level}，依據 ${r.ref}）` : '手冊檢核編號', matches, r);
    }
    // 籠統錯誤代碼
    for (const m of t.matchAll(/(?:error|err|錯誤|代碼|code)\s*[:：#]?\s*(\d{3,5})(?!_)/gi)) {
      const n = m[1];
      if ([...codes].some(c => c.startsWith(n))) continue;
      const cats = GENERIC[n.slice(0, 3)] || GENERIC[n[0]];
      const kw = KEYWORDS.filter(([re]) => re.test(t)).flatMap(([, c]) => c);
      const want = new Set(cats && n.length === 5 ? cats : kw.length ? kw : ['格式', '代碼', '缺漏']);
      const matches = all.filter(i => want.has(i.category) && i.severity === 'error');
      add(m[0], '籠統錯誤代碼', `「${n}」不是手冊的檢核編號，依${cats && n.length === 5 ? '代碼前綴' : '訊息關鍵字'}推定為「${[...want].join('、')}」類錯誤；以下依目前資料重新檢核後，列出所有符合的具體位置。`, matches);
    }
    // 行號 / 不符資料檔
    const lines = new Set([...t.matchAll(/第\s*(\d+)\s*(?:行|列|筆)|(?:line|row)\s*#?\s*(\d+)/gi)].map(m => +(m[1] || m[2])));
    for (const m of t.matchAll(/^(\d{6})\|/gm)) lines.add(+m[1]);
    for (const n of lines) add(`第 ${n} 行`, '行號', '該行的所有檢核問題', all.filter(i => i.line === n && i.file !== 'S' && i.file !== 'R'), null);
    // 欄位名稱
    for (const f of life.layouts.L.fields.concat(life.layouts.D.fields)) {
      if (f.name.length >= 3 && t.includes(f.name) && !findings.some(x => x.clue === f.name)) add(f.name, '欄位名稱', `與「${f.name}」相關的問題`, all.filter(i => (i.fields || []).includes(f.key)), null);
    }
    // 沒有任何可辨識的線索：用關鍵字
    if (!findings.length && t.trim()) {
      const kw = new Set(KEYWORDS.filter(([re]) => re.test(t)).flatMap(([, c]) => c));
      add(t.trim().slice(0, 40), '關鍵字', kw.size ? `依訊息關鍵字推定為「${[...kw].join('、')}」類錯誤` : '訊息中沒有可辨識的代碼或關鍵字，列出所有錯誤', all.filter(i => i.severity === 'error' && (!kw.size || kw.has(i.category))));
    }
    // 依規則彙總，次數多者優先 (最可能的退件主因)
    for (const f of findings) {
      const by = new Map();
      for (const i of f.matches) { if (!by.has(i.ruleId)) by.set(i.ruleId, []); by.get(i.ruleId).push(i); }
      f.groups = [...by.entries()].map(([ruleId, items]) => ({ ruleId, name: (catalog.find(r => r.id === ruleId) || {}).name || items[0].message, items })).sort((a, b) => b.items.length - a.items.length);
    }
    return { findings, located: used.size };
  }

  return { parseAmount, yuan, csvObjects, aggregate, controlRecon, rollForward, statement, decode, ITEMS, subsetSum };
});
