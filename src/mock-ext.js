/*
 * 模擬資料：癌症保險、傷害保險的承保檔與給付檔 (固定長度文字檔)。
 * inject: true 時注入各式錯誤，key 為解答：每個錯誤列出應被哪些檢核編號找到、在哪張保單。
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('./core.js') : root.DQ;
  const X = isNode ? require('./rulesets/ext-common.js') : root.DQ.rulesets.extCommon;
  const cancer = isNode ? require('./rulesets/cancer.js') : root.DQ.rulesets.cancer;
  const accident = isNode ? (() => { try { return require('./rulesets/accident.js'); } catch (e) { return null; } })() : root.DQ.rulesets.accident;
  const m = factory(C, X, cancer, accident);
  if (isNode) module.exports = m; else root.DQ.mockExt = m;
})(typeof self !== 'undefined' ? self : this, function (C, X, cancer, accident) {
  'use strict';
  const { fmtDate, addYearsMinusDay, buildLine } = C;
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const p2 = n => String(n).padStart(2, '0'), p3 = n => String(n).padStart(3, '0');
  const OCC_LOW = X.occ.codes.filter(c => ['1', '2', '3'].includes(X.occ.classOf[c]));

  // ================= 癌症保險 =================
  const COVER = {
    stage: [2, 3, 4, 5, 9, 13, 15, 16],          // 分期給付型
    lump: [2, 22, 23],                            // 一次金型
    med: [2, 8, 9, 10, 11, 13, 14, 15, 16, 25],   // 醫療型
    death: [1, 2, 22, 13],                        // 含非癌身故
  };
  const bits = list => Array.from({ length: 50 }, (_, i) => list.includes(i + 1) ? '1' : '0').join('');
  const ICD_F = ['C509', 'C539', 'C56', 'C349', 'C189', 'C73'], ICD_M = ['C61', 'C349', 'C220', 'C169', 'C189'];

  function generateCancer(opts) {
    opts = Object.assign({ seed: 20251101, policies: 100, company: '01', year: 2025, inject: false }, opts);
    const rand = rng(opts.seed), ri = (a, b) => a + Math.floor(rand() * (b - a + 1)), pick = a => a[Math.floor(rand() * a.length)];
    const Y = opts.year, CO = opts.company, L = cancer.layouts.CL, D = cancer.layouts.CD;
    const jan1 = `${Y}0101`, dec31 = `${Y}1231`;
    const exp = (a, b) => X.exposure(a, b, Y);
    const date = (y, m, d) => `${y}${p2(m)}${p2(d)}`;
    const SCEN = ['keep', 'keepJan', 'new', 'newJan', 'lapse', 'lapseRnn', 'surrender', 'maturity', 'dca', 'dea', 'claim', 'claim', 'keep', 'claim', 'w80', 'lapseRnn'];
    const pols = [], Ds = [];
    for (let i = 0; i < opts.policies; i++) {
      const scen = i < SCEN.length ? SCEN[i] : pick(['keep', 'keep', 'keep', 'keepJan', 'new', 'claim', 'lapse', 'surrender']);
      const sy = scen === 'new' || scen === 'newJan' ? Y : scen === 'maturity' ? Y - 10 : ri(2008, Y - 2);
      const sm = ['keepJan', 'newJan'].includes(scen) ? 1 : ri(scen === 'new' ? 2 : 1, scen === 'new' ? 10 : 12), sd = ['keepJan', 'newJan'].includes(scen) ? 1 : ri(scen === 'maturity' ? 2 : 2, 28);
      const start = date(sy, sm, sd);
      const sex = pick(['1', '2']);
      const birth = date(sy - ri(22, 58), ri(1, 12), ri(1, 28));
      const a0 = X.insAge(birth, start);
      const kind = scen === 'dea' ? 'death' : scen === 'claim' || scen === 'dca' ? 'stage' : pick(['stage', 'lump', 'med']);
      const termCode = scen === 'maturity' ? 'T010' : scen === 'w80' ? 'W080' : sy >= Y - 15 ? pick(['Y999', 'Y999', 'Y999', 'T020']) : 'Y999';
      const end = termCode === 'Y999' ? '99991231' : termCode === 'W080' ? addYearsMinusDay(start, 80 - a0) : addYearsMinusDay(start, +termCode.slice(1));
      const v2 = start >= '20150701';
      const pc = v2 ? `2${CO}321MZ1A${p3(1 + i % 9)}1${termCode === 'Y999' ? '3' : '2'}A11Z10000000` : `2${CO}321M11A${p3(1 + i % 9)}00`;
      const cov = COVER[kind];
      const daily = cov.includes(13) ? pick([1000, 2000, 3000]) : 0;
      const base = {
        company: CO, policyNo: `CA${Y - 2000}${String(10000 + i).slice(1)}${CO}`, policySeq: pick(['01', 'A01']), seq: '00000',
        productVer: v2 ? '2' : '1', productCode: pc, waitDays: pick(['090', '090', '030']), channel: pick(['1', '1', '2', '4']), salesMethod: pick(['1', '1', '3', '7']),
        termCode, startDate: start, endDate: end, idType: '0', idNo: '0000000000', sex, birthDate: birth, medExam: '2', bodyClass: '1', relation: pick(['1', '1', '2', '3']),
        occCode: start >= '20150301' ? pick(OCC_LOW) : '00000000', payerZip: pick(X.T.zip), insuredZip: pick(X.T.zip), disabilityCat: '000', disabilityLevel: '0', currency: 'NTD',
        coverage: bits(cov), firstCancerAmt: cov.some(b => (b >= 3 && b <= 7) || b === 22) ? String(pick([300000, 500000, 1000000])) : '0', dailyHospAmt: String(daily),
        maxBenefit: pick(['999999999999999', '5000000', '3000000']), addYear: String(Y), companyPlanCode: `CA${kind.toUpperCase().slice(0, 2)}${p2(1 + i % 9)}`, histType: '   ', reserved: '00000000000000000',
      };
      const ann = date(Y, sm, sd), annM1 = X.plusDays(ann, -1);
      const n = Y - sy; // XEN 那一段的保單年度
      const seg = (add, ex, py, from, to) => Object.assign({}, base, { addType: add, exitType: ex, policyYear: p3(py), insAge: p3(a0 + py - 1), exposure: exp(from, to) });
      let recs;
      const mid = (a, b) => X.plusDays(a, Math.floor(X.dayDiff(a, b) * (0.3 + rand() * 0.4)));
      if (scen === 'keepJan') recs = [seg('EDN', 'EDD', n + 1, jan1, dec31)];
      else if (scen === 'new') recs = [seg('NEW', 'XED', 1, start, dec31)];
      else if (scen === 'newJan') recs = [seg('NEW', 'EDD', 1, jan1, dec31)];
      else if (scen === 'maturity') recs = [seg('XEN', 'MAD', n, jan1, end)];
      else {
        const first = seg('XEN', 'EDD', n, jan1, annM1);
        if (scen === 'keep' || scen === 'claim' || scen === 'w80') recs = [first, seg('EDN', 'XED', n + 1, ann, dec31)];
        else if (scen === 'lapse') { const lp = mid(ann, dec31); recs = [first, seg('EDN', 'LNN', n + 1, ann, X.plusDays(lp, -1))]; }
        else if (scen === 'lapseRnn') { const lp = mid(ann, dec31), rn = X.plusDays(lp, 40); recs = [first, seg('EDN', 'LNN', n + 1, ann, X.plusDays(lp, -1)), seg('RNN', 'XED', n + 1, rn, dec31)]; }
        else if (scen === 'surrender') { const sr = mid(ann, dec31); recs = [first, seg('EDN', 'SRD', n + 1, ann, X.plusDays(sr, -1))]; }
        else if (scen === 'dca' || scen === 'dea') { const dd = mid(ann, X.plusDays(dec31, -40)); recs = [first, seg('EDN', scen === 'dca' ? 'DCA' : 'DEA', n + 1, ann, dd)]; base._death = dd; }
      }
      if (recs.length > 1) recs.forEach((r, k) => { r.seq = String(k + 1).padStart(5, '0'); });
      pols.push({ scen, base, recs });
      // 給付
      const icd = c => c.padEnd(7, ' ');
      const cl = (item, ev, amt, o) => Ds.push(Object.assign({ company: CO, policyNo: base.policyNo, policySeq: base.policySeq, claimNo: `K${Y}${String(Ds.length + 1).padStart(5, '0')}`,
        eventDate: ev, payDate: X.plusDays(ev, ri(10, 25)), icd: icd(o && o.icd || pick(sex === '1' ? ICD_M : ICD_F)), item, hospDays: '0', payAmt: String(amt), occCode: base.occCode, year: String(Y), reserved: '00000000000000000000' }, o && o.extra));
      if (scen === 'claim') {
        const c = pick(sex === '1' ? ICD_M : ICD_F), e1 = date(Y, ri(1, 4), ri(1, 28));
        cl('005', e1, base.firstCancerAmt, { icd: c });
        const e2 = X.plusDays(e1, ri(5, 20)), days = ri(4, 18);
        cl('013', e2, days * daily, { icd: c, extra: { hospDays: String(days) } });
        cl('009', e2, pick([20000, 40000, 60000]), { icd: c });
        cl('015', X.plusDays(e2, ri(20, 60)), pick([8000, 12000, 20000]), { icd: c });
      }
      if (scen === 'dca') {
        const c = pick(sex === '1' ? ICD_M : ICD_F);
        cl('005', date(Y, 1, ri(5, 20)), base.firstCancerAmt, { icd: c });
        cl('002', base._death, pick([200000, 300000]), { icd: c });
      }
      if (scen === 'dea') cl('001', base._death, pick([100000, 200000]), { icd: '0000000' });
    }
    for (const d of Ds) if (d.payDate > dec31) d.payDate = dec31;

    const key = [];
    if (opts.inject) injectCancer(pols, Ds, key, { Y, rand, ri, pick, exp, date });
    const lines = [];
    for (const p of pols) for (const r of p.recs) lines.push(r._line != null ? r._line : buildLine(L, r));
    const dl = Ds.map(d => d._line != null ? d._line : buildLine(D, d));
    const names = { CL: `CRL${Y}${CO}.txt`, CD: `CRD${Y}${CO}.txt` };
    return { CL: lines.join('\n') + '\n', CD: dl.join('\n') + '\n', names, key, year: Y };
  }

  // 注入錯誤：每一項寫明應被找到的檢核編號 (rules) 與保單
  function injectCancer(pols, Ds, key, h) {
    const by = s => pols.filter(p => p.scen === s);
    const used = new Set();
    const take = s => { const p = by(s).find(x => !used.has(x)); if (p) used.add(p); return p; };
    const pk = p => `${p.base.policyNo}/${p.base.policySeq}`;
    const add = (p, rules, what, file) => key.push({ rules, policy: pk(p), file: file || 'CL', what });
    const all = (p, k, v) => p.recs.forEach(r => { r[k] = v; });
    let p;
    if ((p = take('keep'))) { all(p, 'waitDays', '120'); add(p, ['CRL245_01'], '等待期間 120 天，超過 90 天'); }
    if ((p = take('keep'))) { all(p, 'waitDays', '045'); add(p, ['CRL245_02'], '等待期間 45 天，不是 10 的倍數'); }
    if ((p = take('new'))) { all(p, 'channel', '7'); add(p, ['CRL201_07'], '通路別填 7，不在代號表內'); }
    if ((p = take('new'))) { all(p, 'termCode', 'Y999'); all(p, 'endDate', '20991231'); add(p, ['CRL203_03'], '終身 (Y999) 但迄日不是 99991231'); }
    if ((p = take('keepJan'))) { all(p, 'addType', 'XEN'); add(p, ['CRL248_04', 'CRL259_02'], '起日 0101 卻填加保別 XEN'); }
    if ((p = take('newJan'))) { all(p, 'exitType', 'XED'); add(p, ['CRL248_05'], '起日 0101 的新契約年底退保別填 XED (應為 EDD)'); }
    if ((p = take('new'))) { all(p, 'birthDate', '19850230'); add(p, ['CRL239_17'], '出生日期 2 月 30 日不存在'); }
    if ((p = take('keepJan'))) { all(p, 'birthDate', h.date(+p.base.startDate.slice(0, 4) + 1, 3, 3)); add(p, ['CRL244'], '出生日期晚於保險起日'); }
    if ((p = take('new'))) { all(p, 'occCode', '00000000'); add(p, ['CRL204_21'], '2015 年後起保，職業代碼卻是 00000000'); }
    if ((p = take('keepJan'))) { all(p, 'occCode', '99999999'); add(p, ['CRL201_21'], '職業代碼 99999999 不在職業分類表'); }
    if ((p = take('new'))) { all(p, 'disabilityLevel', '2'); add(p, ['CRL233_01'], '身心障礙類別 000 卻有障礙等級 2'); }
    const st = pols.filter(x => !used.has(x) && x.recs.length === 1 && x.base.coverage[1] === '1' && x.base.coverage[4] === '1');
    if ((p = st[0])) { used.add(p); all(p, 'coverage', p.base.coverage.slice(0, 21) + '1' + p.base.coverage.slice(22)); add(p, ['CRL202_05'], '承保範圍同時有分期罹癌 (第 3~7 碼) 與不分類型 (第 22 碼)'); }
    if ((p = st[1])) { used.add(p); all(p, 'firstCancerAmt', '0'); add(p, ['CRL238_28'], '有初次罹癌保障，但保險金額為 0'); }
    const noHosp = pols.filter(x => !used.has(x) && x.recs.length === 1 && x.base.coverage[12] === '0');
    if ((p = noHosp[0])) { used.add(p); all(p, 'dailyHospAmt', '2000'); add(p, ['CRL241_01'], '沒有住院保障，但每日住院給付金額填 2000'); }
    if ((p = take('new'))) { all(p, 'maxBenefit', '0'); add(p, ['CRL238_30'], '癌症給付上限金額填 0'); }
    if ((p = take('new'))) { all(p, 'policyYear', '002'); all(p, 'insAge', String(+p.recs[0].insAge + 1).padStart(3, '0')); add(p, ['CRL259_01'], '新契約的保單年度填 2'); }
    if ((p = take('keepJan'))) { all(p, 'insAge', String(+p.recs[0].insAge + 3).padStart(3, '0')); add(p, ['CRL234_01'], '保險年齡多了 3 歲'); }
    if ((p = take('surrender'))) { p.recs[1].exposure = '1000000'; add(p, ['CRL264_03', 'CRL304_02'], '解約那一筆的暴露數填 1 (全年)'); }
    if ((p = take('lapseRnn'))) { p.recs[2].addType = 'EDN'; add(p, ['CRL302_06'], '停效 (LNN) 之後的加保別寫成 EDN，應為 RNN 復效'); }
    if ((p = take('maturity'))) { p.recs[0].exitType = 'EDD'; add(p, ['CRL309_03', 'CRL309_02'], '保險今年到期，但退保別填 EDD 而非 MAD'); }
    if ((p = take('lapseRnn'))) { p.recs[2].exposure = '0900000'; add(p, ['CRL304_04'], '停效又復效，同一保單年度暴露數合計大於 1'); }
    // 給付
    const dOf = s => { const q = by(s).find(x => !used.has(x)); if (q) used.add(q); return q ? Ds.filter(d => d.policyNo === q.base.policyNo) : []; };
    const claims = by('claim').filter(x => !used.has(x));
    const nc = () => claims.find(x => !used.has(x));
    const cd = (q, item) => Ds.find(d => d.policyNo === q.base.policyNo && d.item === item);
    const addD = (q, rules, what) => key.push({ rules, policy: pk(q), file: 'CD', what });
    let q;
    if ((q = nc())) { used.add(q); const d = cd(q, '015'); d.payDate = X.plusDays(d.eventDate, -3); addD(q, ['CRD240_01'], '給付日期早於事故日期'); }
    if ((q = nc())) { used.add(q); cd(q, '013').hospDays = '0'; addD(q, ['CRD241_01'], '住院給付 (013) 的住院日數填 0'); }
    if ((q = nc())) { used.add(q); const d = cd(q, '009'); d.icd = (d.icd.trim().slice(0, 3) + '.' + (d.icd.trim().slice(3) || '9')).padEnd(7, ' '); addD(q, ['CRD205_01'], '癌症種類寫成有小數點的 ICD 代碼'); }
    if ((q = nc())) { used.add(q); cd(q, '015').payAmt = '0'; addD(q, ['CRD246'], '化學治療給付金額填 0'); }
    if ((q = nc())) { used.add(q); const d = cd(q, '009'); d.item = '012'; addD(q, ['CRX313_01'], '給付骨髓移植 (012)，但承保範圍沒有這項保障'); }
    if ((q = nc())) { used.add(q); for (const d of Ds.filter(x => x.policyNo === q.base.policyNo)) d.icd = (q.base.sex === '1' ? 'C539' : 'C61').padEnd(7, ' '); addD(q, ['CRX315_01'], '癌症種類與被保險人性別不符'); }
    if ((q = claims.find(x => !used.has(x) && x.base.startDate >= '20150301'))) { used.add(q); const d = cd(q, '015'); d.occCode = '00000000'; addD(q, ['CRX204_01'], '事故時職業代碼填 00000000'); }
    if ((q = nc())) { used.add(q); for (const d of Ds.filter(x => x.policyNo === q.base.policyNo)) d.policyNo = d.policyNo.slice(0, -2) + '99'; key.push({ rules: ['CRX310_01'], policy: `${q.base.policyNo.slice(0, -2)}99/${q.base.policySeq}`, file: 'CD', what: '給付資料的保單號碼打錯，承保檔找不到' }); }
    if ((q = by('dca').find(x => !used.has(x)))) { used.add(q); for (let k = Ds.length - 1; k >= 0; k--) if (Ds[k].policyNo === q.base.policyNo && Ds[k].item === '002') Ds.splice(k, 1); add(q, ['CRX310_03'], '癌症死亡 (DCA)，給付檔漏報癌症死亡給付'); }
    if ((q = by('dea').find(x => !used.has(x)))) { used.add(q); const d = Ds.find(x => x.policyNo === q.base.policyNo); d.icd = 'C349   '; addD(q, ['CRD310_01'], '非癌死亡 (001) 卻填了癌症種類'); }
    if ((q = nc())) { used.add(q); const d = cd(q, '005'); Ds.splice(Ds.indexOf(d) + 1, 0, Object.assign({}, d, { claimNo: d.claimNo })); addD(q, ['CRD301_02'], '同一筆罹癌給付重複填送'); }
    // 今年新投保、等待期間內就申請罹癌給付
    if ((q = by('new').find(x => !used.has(x) && x.base.coverage[21] === '1' && x.base.waitDays === '090'))) {
      used.add(q); const ev = X.plusDays(q.base.startDate, 20);
      Ds.push({ company: q.base.company, policyNo: q.base.policyNo, policySeq: q.base.policySeq, claimNo: `K${h.Y}99001`, eventDate: ev, payDate: X.plusDays(ev, 15), icd: 'C509   ', item: '022', hospDays: '0', payAmt: q.base.firstCancerAmt, occCode: q.base.occCode, year: String(h.Y), reserved: '00000000000000000000' });
      if (q.base.sex === '1') Ds[Ds.length - 1].icd = 'C61    ';
      addD(q, ['CRX311_04'], '投保 20 天就申請罹癌給付 (還在 90 天等待期間內)');
    }
  }

  return { generateCancer, generateAccident: accident ? (o => accident.mock(o)) : null };
});
