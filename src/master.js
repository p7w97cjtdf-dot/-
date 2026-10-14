/*
 * 主檔比對：客戶資料、商品資料 與 申報明細 交叉檢核
 *  - 客戶資料：身分證檢查碼、性別、出生日期、郵遞區號與地址、同一人資料一致、
 *              要保人/被保險人關係、被保險人資料與承保檔一致 (承保檔欄位不合法時以客戶資料為修正值)
 *  - 商品資料：商品代號存在、停售後仍使用舊代號 (給替代代號)、起售日、險種、繳費年期
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const deps = isNode
    ? { C: require('./core.js'), life: require('./rulesets/life.js'), R: require('./recon.js'), D: require('./sample-data.js') }
    : { C: root.DQ, life: root.DQ.rulesets.life, R: root.DQ.recon, D: root.DQ.sampleData };
  const m = factory(deps);
  if (isNode) module.exports = m; else root.DQ.master = m;
})(typeof self !== 'undefined' ? self : this, function (deps) {
  'use strict';
  const { C, life, R, D } = deps;
  const L = life.layouts.L;
  const ZIP = D.ZIP;

  const catalog = [
    ['C001', '身分證／居留證號碼檢查碼', 'error'], ['C002', '性別與證號第 2 碼一致', 'error'], ['C003', '出生日期合法', 'error'],
    ['C004', '郵遞區號與地址一致', 'error'], ['C005', '同一證號之姓名、出生日期、性別一致', 'error'], ['C006', '承保保單須有要保人與被保險人資料', 'error'],
    ['C007', '客戶資料之保單須存在於承保檔', 'error'], ['C008', '被保險人出生日期、性別與承保檔一致', 'error'], ['C009', '被保險人身份與要保人關係一致', 'error'],
    ['PM01', '商品代號存在於商品資料', 'error'], ['PM02', '起保日不晚於商品停售日（不使用已停售舊代號）', 'error'], ['PM03', '起保日不早於商品起售日', 'error'],
    ['PM04', '險種與保險商品類別編號一致', 'error'], ['PM05', '繳費期間與商品繳費年期一致', 'warning'], ['PM06', '商品資料本身一致', 'error'],
  ].map(([id, name, severity]) => ({ id, name, severity, level: id.startsWith('C') ? '客戶資料' : '商品資料', ref: id.startsWith('C') ? '客戶資料' : '商品資料' }));

  // ---------- 身分證 ----------
  const LETTERS = 'ABCDEFGHJKLMNPQRSTUVXYWZIO';   // A=10 … Z=33, I=34, O=35
  function idCheck(id) {
    id = String(id || '').trim().toUpperCase();
    if (!/^[A-Z][1289]\d{8}$/.test(id)) return { ok: false, reason: '格式應為 1 個英文字母 + 9 位數字（第 2 碼 1/2，新式居留證 8/9）' };
    const n = LETTERS.indexOf(id[0]) + 10;
    let s = Math.floor(n / 10) + (n % 10) * 9;
    for (let i = 1; i < 9; i++) s += +id[i] * (9 - i);
    const check = (10 - (s % 10)) % 10;
    return +id[9] === check ? { ok: true } : { ok: false, reason: `檢查碼錯誤，依前 9 碼計算末碼應為 ${check}`, expected: id.slice(0, 9) + check };
  }
  function makeId(letter, sexDigit, digits7) {
    const body = letter + sexDigit + digits7;
    for (let c = 0; c < 10; c++) if (idCheck(body + c).ok) return body + c;
    return null;
  }

  // ---------- 地址 ----------
  const norm = s => String(s || '').replace(/台/g, '臺').trim();
  function zipFromAddress(addr) {
    const a = norm(addr);
    for (const [z, [city, dist]] of Object.entries(ZIP)) if (city && a.startsWith(city) && a.slice(city.length).startsWith(dist)) return z;
    return null;
  }
  function addressOk(zip, addr) {
    const e = ZIP[zip]; if (!e) return { ok: false, reason: `郵遞區號 ${zip} 不在郵遞區號表` };
    const a = norm(addr), [city, dist] = e;
    if (city === dist ? a.startsWith(city) : (a.startsWith(city) && a.slice(city.length).startsWith(dist))) return { ok: true };
    const z = zipFromAddress(a);
    return { ok: false, reason: `郵遞區號 ${zip} 為${city}${dist === city ? '' : dist}，地址卻是「${a.slice(0, 6)}…」`, expected: z };
  }

  const firstRecords = res => {
    const m = new Map();
    for (const r of (res.data.L || [])) if (r._raw.length === L.recordLength) {
      const k = r.policyNo.trim() + '/' + r.policySeq.trim();
      if (!m.has(k) || r.txnSeq < m.get(k).txnSeq) m.set(k, r);
    }
    return m;
  };

  // ---------- 客戶資料 ----------
  function customers(res, csvText) {
    const rows = R.csvObjects(csvText).map(o => ({ line: o._line, policy: (o['保單編號'] || '') + '/' + (o['保單序號'] || ''), role: o['角色'], id: (o['證件編號'] || '').toUpperCase(), name: o['姓名'], birth: o['出生日期'], sex: o['性別'], zip: o['郵遞區號'], addr: o['地址'] }));
    const issues = [];
    const C_ = (r, o) => issues.push(Object.assign({ severity: 'error', category: '客戶資料', file: 'C', line: r ? r.line : 0, policy: r ? r.policy : '', fields: [], value: '' }, o));
    const ROLE = { 1: '要保人', 2: '被保險人' };
    for (const r of rows) {
      const who = `${ROLE[r.role] || '角色 ' + r.role} ${r.name}`;
      const ic = idCheck(r.id);
      if (!ic.ok) C_(r, { ruleId: 'C001', value: r.id, message: `${who} 證件編號 ${r.id} ${ic.reason}`, suggestion: ic.expected ? `確認證號；若末碼誤植應為 ${ic.expected}` : '依證件填寫正確號碼' });
      else if (/^[A-Z][12]/.test(r.id) && r.id[1] !== r.sex) C_(r, { ruleId: 'C002', value: `${r.id} / ${r.sex}`, message: `${who} 性別填 ${r.sex}，但證號第 2 碼為 ${r.id[1]}（1 男 2 女）`, suggestion: `性別應為 ${r.id[1]}，或確認證號` });
      if (!C.isValidDate(r.birth)) C_(r, { ruleId: 'C003', value: r.birth, message: `${who} 出生日期 ${r.birth} 不是合法日期`, suggestion: '格式 YYYYMMDD (西元)' });
      const ac = addressOk(r.zip, r.addr);
      if (!ac.ok) C_(r, { ruleId: 'C004', value: `${r.zip} ${r.addr}`, message: `${who} ${ac.reason}`, suggestion: ac.expected ? `依地址應為 ${ac.expected}` : '確認郵遞區號或地址' });
    }
    // 同一證號
    const byId = new Map();
    for (const r of rows) { if (!byId.has(r.id)) byId.set(r.id, []); byId.get(r.id).push(r); }
    for (const [id, rs] of byId) {
      if (rs.length < 2) continue;
      for (const [k, label] of [['name', '姓名'], ['birth', '出生日期'], ['sex', '性別']]) {
        const vals = [...new Set(rs.map(r => r[k]))];
        if (vals.length > 1) {
          const count = v => rs.filter(r => r[k] === v).length;
          const major = vals.slice().sort((a, b) => count(b) - count(a))[0];
          const odd = rs.filter(r => r[k] !== major);
          for (const r of odd) C_(r, { ruleId: 'C005', value: `${id} ${label} ${r[k]}`, message: `證號 ${id} 在其他 ${rs.length - 1} 筆資料的${label}為「${major}」，本筆為「${r[k]}」`,
            suggestion: count(major) > 1 ? `多數資料為「${major}」，建議更正本筆` : `請以證件確認正確${label}（另見保單 ${rs.filter(x => x !== r).map(x => x.policy.split('/')[0]).join('、')}）` });
        }
      }
    }
    // 與承保檔比對
    const firsts = firstRecords(res);
    const byPolicy = new Map();
    for (const r of rows) { if (!byPolicy.has(r.policy)) byPolicy.set(r.policy, {}); byPolicy.get(r.policy)[r.role] = r; }
    const fixes = [];
    for (const [k, rec] of firsts) {
      const p = byPolicy.get(k);
      if (!p || !p['1'] || !p['2']) { C_(null, { ruleId: 'C006', file: 'L', line: rec._line, policy: k, fields: ['policyNo'], value: k, message: `保單 ${k} 在客戶資料缺少${!p ? '要保人與被保險人' : !p['1'] ? '要保人' : '被保險人'}`, suggestion: '補齊客戶資料' }); continue; }
      const ins = p['2'], own = p['1'];
      for (const [f, cf, label] of [['birthDate', 'birth', '出生日期'], ['sex', 'sex', '性別']]) {
        if (rec[f] === ins[cf]) continue;
        const lBad = f === 'birthDate' ? !C.isValidDate(rec[f]) : !['1', '2'].includes(rec[f]);
        const cOk = f === 'birthDate' ? C.isValidDate(ins[cf]) : ['1', '2'].includes(ins[cf]);
        const insConsistent = !rows.some(o => o.id === ins.id && o[cf] !== ins[cf]);
        const issue = { ruleId: 'C008', file: 'L', line: rec._line, policy: k, fields: [f], value: `承保 ${rec[f]} / 客戶 ${ins[cf]}`,
          message: `被保險人${label}：承保檔為 ${rec[f]}，客戶資料為 ${ins[cf]}（${ins.name}）`,
          suggestion: lBad && cOk ? `承保檔的值不合法，依客戶資料更正為 ${ins[cf]}` : insConsistent ? '兩個來源不一致，請以要保書或證件確認' : '客戶資料本身也不一致（見 C005），請以證件確認',
          fix: lBad && cOk && insConsistent ? { field: f, value: ins[cf] } : null };
        C_(null, issue); fixes.push(issue);
      }
      const same = own.id === ins.id;
      if (rec.insuredRelation === '1' && !same) C_(null, { ruleId: 'C009', file: 'L', line: rec._line, policy: k, fields: ['insuredRelation'], value: `本人 / ${own.id}≠${ins.id}`, message: `承保檔被保險人身份為本人(1)，但要保人 ${own.name}(${own.id}) 與被保險人 ${ins.name}(${ins.id}) 證號不同`, suggestion: own.name === ins.name ? '同名但證號不同，疑似證號誤植，請確認' : '確認被保險人身份代號或客戶資料' });
      if (rec.insuredRelation !== '1' && same) C_(null, { ruleId: 'C009', file: 'L', line: rec._line, policy: k, fields: ['insuredRelation'], value: rec.insuredRelation, message: `要保人與被保險人為同一人，但承保檔被保險人身份為 ${rec.insuredRelation}`, suggestion: '應為 1（本人）', fix: { field: 'insuredRelation', value: '1' } });
      if (C.isValidDate(own.birth) && C.isValidDate(ins.birth)) {
        if (rec.insuredRelation === '3' && ins.birth <= own.birth) C_(null, { ruleId: 'C009', file: 'L', line: rec._line, policy: k, fields: ['insuredRelation'], value: `子女 ${ins.birth} / 要保人 ${own.birth}`, message: '被保險人身份為子女(3)，但被保險人比要保人年長', suggestion: '確認身份代號或出生日期' });
        if (rec.insuredRelation === '4' && ins.birth >= own.birth) C_(null, { ruleId: 'C009', file: 'L', line: rec._line, policy: k, fields: ['insuredRelation'], value: `父母 ${ins.birth} / 要保人 ${own.birth}`, message: '被保險人身份為父母(4)，但被保險人比要保人年輕', suggestion: '確認身份代號或出生日期' });
      }
    }
    for (const [k, p] of byPolicy) if (!firsts.has(k)) { const r = p['1'] || p['2']; C_(r, { ruleId: 'C007', value: k, message: `客戶資料的保單 ${k} 在承保檔中不存在`, suggestion: '確認保單號碼，或刪除多餘資料' }); }
    return { rows, issues, summary: { rows: rows.length, people: byId.size, errors: issues.filter(i => i.severity === 'error').length, fixable: fixes.filter(i => i.fix).length } };
  }

  // ---------- 商品資料 ----------
  function damerau1(a, b) {
    if (a === b || a.length !== b.length) return false;
    const d = [...a].map((c, i) => c !== b[i] ? i : -1).filter(i => i >= 0);
    return d.length === 1 || (d.length === 2 && d[1] === d[0] + 1 && a[d[0]] === b[d[1]] && a[d[1]] === b[d[0]]);
  }
  function products(res, csvText) {
    const rows = R.csvObjects(csvText).map(o => ({ line: o._line, code: (o['商品代號'] || '').trim(), name: o['商品名稱'], kind: o['險種'], payYears: o['繳費年期'], start: o['起售日'] || '', stop: o['停售日'] || '', replace: o['替代代號'] || '' }));
    const issues = [];
    const P_ = (r, o) => issues.push(Object.assign({ severity: 'error', category: '商品資料', file: 'P', line: r ? r.line : 0, policy: '', fields: [], value: '' }, o));
    const byCode = new Map();
    for (const r of rows) {
      if (byCode.has(r.code)) P_(r, { ruleId: 'PM06', value: r.code, message: `商品代號 ${r.code} 重複`, suggestion: '合併為一列' });
      byCode.set(r.code, r);
    }
    for (const r of rows) {
      if (r.stop && r.start && r.stop < r.start) P_(r, { ruleId: 'PM06', value: `${r.start}~${r.stop}`, message: `商品 ${r.code} 停售日早於起售日`, suggestion: '確認起售日與停售日' });
      if (r.replace && !byCode.has(r.replace)) P_(r, { ruleId: 'PM06', value: r.replace, message: `商品 ${r.code} 的替代代號 ${r.replace} 不在商品資料中`, suggestion: '補上替代商品資料' });
      if (r.stop && !r.replace) P_(r, { ruleId: 'PM06', severity: 'warning', value: r.code, message: `停售商品 ${r.code} 沒有替代代號`, suggestion: '補上替代代號，方便更正誤用舊代號的保單' });
    }
    const used = new Map();
    for (const [k, rec] of firstRecords(res)) {
      const code = rec.productCode.trim(), p = byCode.get(code);
      used.set(code, (used.get(code) || 0) + 1);
      const L_ = o => issues.push(Object.assign({ severity: 'error', category: '商品資料', file: 'L', line: rec._line, policy: k, fields: ['productCode'], value: code }, o));
      if (!p) {
        const near = rows.filter(r => damerau1(r.code, code));
        const best = near.find(r => r.code.slice(0, 13) === rec.productClass) || near[0];
        L_({ ruleId: 'PM01', message: `保險商品編號 ${code} 不在商品資料中`, suggestion: best ? `疑似代號誤植，應為 ${best.code}「${best.name}」` : '確認商品代號，或補上商品資料', fix: best ? { field: 'productCode', value: best.code } : null });
        continue;
      }
      if (p.stop && C.isValidDate(rec.startDate) && rec.startDate > p.stop) {
        const rp = byCode.get(p.replace);
        L_({ ruleId: 'PM02', message: `商品 ${code}「${p.name}」已於 ${p.stop} 停售，保單 ${rec.startDate} 起保仍使用舊代號`, suggestion: rp ? `改用替代代號 ${rp.code}「${rp.name}」` : '確認保單適用的商品', fix: rp && rp.code.slice(0, 13) === rec.productClass ? { field: 'productCode', value: rp.code } : null });
      }
      if (p.start && C.isValidDate(rec.startDate) && rec.startDate < p.start) L_({ ruleId: 'PM03', message: `保單 ${rec.startDate} 起保，早於商品 ${code} 起售日 ${p.start}`, suggestion: '確認商品代號或起保日' });
      if (p.kind && rec.productClass.slice(3, 5) !== p.kind) L_({ ruleId: 'PM04', fields: ['productClass'], value: rec.productClass, message: `保險商品類別編號第 4-5 碼為 ${rec.productClass.slice(3, 5)}，商品資料險種為 ${p.kind}「${p.name}」`, suggestion: '確認商品類別編號或商品代號' });
      if (p.payYears && !['0', '5'].includes(rec.payFreq) && rec.payTerm !== p.payYears) L_({ ruleId: 'PM05', severity: 'warning', fields: ['payTerm'], value: `${rec.payTerm} / ${p.payYears}`, message: `繳費期間 ${rec.payTerm} 與商品繳費年期 ${p.payYears} 不同`, suggestion: '確認繳費期間或商品代號' });
    }
    return { rows, issues, used, summary: { products: rows.length, stopped: rows.filter(r => r.stop).length, errors: issues.filter(i => i.severity === 'error').length } };
  }

  return { catalog, idCheck, makeId, addressOk, zipFromAddress, customers, products, ZIP };
});
