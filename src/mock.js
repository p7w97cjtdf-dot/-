/*
 * 模擬資料產生器：產生符合手冊格式之個人壽險承保檔 / 給付檔，
 * 並可注入各式「欄位 / 格式 / 邏輯 / 跨檔」錯誤，附上解答 (answer key)，
 * 用來展示及驗證 AI 檢核助手能自動找出問題。
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const core = isNode ? require('./core.js') : root.DQ;
  const life = isNode ? require('./rulesets/life.js') : root.DQ.rulesets.life;
  const m = factory(core, life);
  if (isNode) module.exports = m; else root.DQ.mock = m;
})(typeof self !== 'undefined' ? self : this, function (C, life) {
  'use strict';
  const { buildLine, addYearsMinusDay, fmtDate, toDate, monthsBetween } = C;
  const L = life.layouts.L, D = life.layouts.D, ZIP = life.tables.zip;

  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function generate(opts) {
    opts = Object.assign({ seed: 20251014, policies: 120, company: '01', year: 2025, inject: false }, opts);
    const rand = rng(opts.seed);
    const ri = (a, b) => a + Math.floor(rand() * (b - a + 1));
    const pick = arr => arr[Math.floor(rand() * arr.length)];
    const Y = opts.year, CO = opts.company;
    const dateIn = (y1, y2) => fmtDate(new Date(Date.UTC(ri(y1, y2), ri(0, 11), ri(1, 28))));
    const amt = (yuan) => String(Math.round(yuan * 100));
    const plus = (d, days) => { const x = toDate(d); x.setUTCDate(x.getUTCDate() + days); return fmtDate(x); };

    const Ls = [], Ds = [];
    const SCEN = ['new', 'keep', 'keep', 'keep', 'lapse', 'death', 'accident', 'inn', 'pau', 'surrender', 'maturity', 'usd', 'sib', 'keep', 'new'];

    for (let i = 0; i < opts.policies; i++) {
      const scen = i < SCEN.length ? SCEN[i] : pick(SCEN);
      const prodKind = scen === 'sib' ? 'endow' : scen === 'maturity' ? 'term' : pick(['whole', 'whole', 'term', 'endow']);
      const tTerm = scen === 'maturity' ? 10 : pick([10, 20, 30]);
      const start = scen === 'new' ? `${Y}${String(ri(1, 10)).padStart(2, '0')}${String(ri(1, 28)).padStart(2, '0')}`
        : scen === 'maturity' ? `${Y - 10}${String(ri(1, 9)).padStart(2, '0')}15`
        : dateIn(prodKind === 'whole' ? 1998 : Math.max(1998, Y - tTerm + 1), Y - 2);
      const sexv = pick(['1', '2']);
      const birth = fmtDate(new Date(Date.UTC(+start.slice(0, 4) - ri(1, 60), ri(0, 11), ri(1, 28))));
      const cur = scen === 'usd' ? 'USD' : 'NTD';
      const fx = cur === 'USD' ? 31 : 1;
      const p45 = { whole: '14', term: '13', endow: '12' }[prodKind];
      const pc = `2${CO}1${p45[1]}1M11A${String.fromCharCode(65 + (i % 26))}${String(i % 100).padStart(2, '0')}`;
      let termType, term, end;
      if (prodKind === 'whole') { termType = 'Y'; term = '999'; end = addYearsMinusDay(start, 9999 - +start.slice(0, 4)); }
      else { termType = 'T'; term = String(tTerm).padStart(3, '0'); end = addYearsMinusDay(start, tTerm); }
      const payTerm = prodKind === 'whole' ? '020' : String(Math.min(+term, 10)).padStart(3, '0');
      const sum = pick([500000, 1000000, 2000000, 3000000, 5000000]) / (cur === 'USD' ? 30 : 1);
      const annualPrem = Math.round(sum * (prodKind === 'endow' ? 0.06 : prodKind === 'whole' ? 0.025 : 0.004));
      const v2 = start >= '20170321';
      const survival = prodKind === 'endow';
      const base = {
        company: CO, policyNo: `P${Y - 2000}${String(100000 + i).slice(1)}${CO}`, policySeq: 'A01', txnSeq: '00000',
        idType: '0', idNo: '0000000000', sumInsuredOrig: amt(sum), termType, term, birthDate: birth, sex: sexv,
        medExam: '2', examClass: '1', substdReason: '0', addType: 'XED', addDate: '00000000', exitType: 'EOY', exitDate: '00000000',
        dividendClass: start >= '20040101' ? pick(['N', 'B']) : pick(['T', 'Q']), productClass: pc, startDate: start, endDate: end,
        survivalType: survival ? '1' : '0', benefitType: survival ? '3' : '2', longevityAge: '000', screening: '0', smoker: '0',
        disabilityCat: '000', disabilityLevel: '0', econStatus: '0', groupLink: '0', channel: pick(['1', '1', '2', '4']), salesMethod: '1',
        insuredRelation: pick(['1', '1', '3']), currency: cur, illnessDeathOrig: amt(sum), occClass: start >= '20150301' ? pick(['1', '2', '3']) : '1',
        productCode: pc + '00', companyPlanCode: `PLAN${p45}${String(i % 7)}`, productCodeVer: v2 ? '2' : '1', productCode2: v2 ? 'A11Z10000000' : '000000000000',
        payFreq: '1', payTerm, paidMonths: '000', lapseReason: 'N', occCode: start >= '20150301' ? pick(['0805001', '0101001', '1201002']) : '00000000',
        ownerZip: pick(ZIP), insuredZip: pick(ZIP), totalPremOrig: amt(annualPrem * +payTerm), totalPremTwd: amt(annualPrem * +payTerm * fx),
        survivalAmtOrig: survival ? amt(sum * 0.05) : '0', survivalAmtTwd: survival ? amt(sum * 0.05 * fx) : '0',
        longevityAmtOrig: '0', longevityAmtTwd: '0', maturityAmtOrig: survival ? amt(sum) : '0', maturityAmtTwd: survival ? amt(sum * fx) : '0',
        survivalCond: survival ? '2' : '0', survivalFirstDate: survival ? addYearsMinusDay(start, 4) : '00000000',
        sumInsuredTwd: amt(sum * fx), illnessDeathTwd: amt(sum * fx), reserved: '0000',
      };
      if (base.occCode !== '00000000') base.occCode = base.occCode.padEnd(8, ' ');
      const recs = [];
      const ev = () => { let d = dateIn(Y, Y); if (d <= start) d = plus(start, 30); return d; };
      const add = o => recs.push(Object.assign({}, base, o));
      const claim = (type, date, o) => Ds.push(Object.assign({
        claimType: type, company: CO, policyNo: base.policyNo, policySeq: base.policySeq, idType: '0', idNo: '0000000000',
        termType, term, birthDate: birth, sex: sexv, medExam: '2', examClass: '1', substdReason: '0', startDate: start, eventDate: date,
        dueAmtOrig: base.illnessDeathOrig, paidAmtOrig: base.illnessDeathOrig, diffReason: '0', causeIcd: '00000', disabilityItem: '00000000',
        productClass: pc, currency: cur, payDate: plus(date, ri(5, 40)), occClass: base.occClass, disabilityCat: '000', disabilityLevel: '0',
        companyPlanCode: base.companyPlanCode, payMethod: '1', dueAmtTwd: base.illnessDeathTwd, paidAmtTwd: base.illnessDeathTwd, reserved: '0'.repeat(20),
      }, o));

      switch (scen) {
        case 'new': add({ addType: 'NEW', addDate: start, exitType: 'XED' }); break;
        case 'keep': case 'usd': add({}); break;
        case 'lapse': {
          const d1 = ev(), d2 = plus(d1, ri(30, 120)) > `${Y}1231` ? `${Y}1231` : plus(d1, ri(30, 120));
          const pm = monthsBetween(start, d1);
          add({ txnSeq: '00001', exitType: 'LNN', exitDate: d1, paidMonths: String(Math.min(pm, 999)).padStart(3, '0'), lapseReason: 'S' });
          add({ txnSeq: '00002', addType: 'RNN', addDate: d2, exitType: 'XED' });
          break;
        }
        case 'death': { const d = ev(); add({ exitType: 'DEA', exitDate: d }); claim('1', d, { causeIcd: pick(['C349', 'I219', 'C220', 'J189']) }); break; }
        case 'accident': { const d = ev(); add({ exitType: 'ADS', exitDate: d }); claim('1', d, { causeIcd: pick(['V892', 'W19', 'X599']), dueAmtOrig: amt(sum * 2), paidAmtOrig: amt(sum * 2), dueAmtTwd: amt(sum * 2 * fx), paidAmtTwd: amt(sum * 2 * fx) }); break; }
        case 'inn': {
          const d = ev(), s2 = sum * 1.5;
          add({ txnSeq: '00001', exitType: 'INN', exitDate: d });
          add({ txnSeq: '00002', addType: 'INN', addDate: d, exitType: 'XED', sumInsuredOrig: amt(s2), sumInsuredTwd: amt(s2 * fx), illnessDeathOrig: amt(s2), illnessDeathTwd: amt(s2 * fx) });
          break;
        }
        case 'pau': {
          const d = ev(), s2 = Math.round(sum * 0.4);
          add({ txnSeq: '00001', exitType: 'PAU', exitDate: d });
          add({ txnSeq: '00002', addType: 'PAU', addDate: d, exitType: 'XED', sumInsuredOrig: amt(s2), sumInsuredTwd: amt(s2 * fx), illnessDeathOrig: amt(s2), illnessDeathTwd: amt(s2 * fx) });
          break;
        }
        case 'surrender': add({ exitType: 'SRD', exitDate: ev() }); break;
        case 'maturity': add({ exitType: 'MAD', exitDate: end }); break;
        case 'sib': {
          const d = base.survivalFirstDate <= `${Y}1231` && base.survivalFirstDate >= `${Y}0101` ? base.survivalFirstDate : ev();
          add({ txnSeq: '00001', exitType: 'SIB', exitDate: d });
          add({ txnSeq: '00002', addType: 'SIB', addDate: d, exitType: 'XED' });
          claim('4', d, { dueAmtOrig: base.survivalAmtOrig, paidAmtOrig: base.survivalAmtOrig, dueAmtTwd: base.survivalAmtTwd, paidAmtTwd: base.survivalAmtTwd });
          break;
        }
      }
      for (const r of recs) Ls.push(r);
    }

    const key = [];
    let extraL = [];
    if (opts.inject) {
      const find = (pred, from) => Ls.findIndex((r, i) => i >= (from || 0) && pred(r));
      const used = new Set();
      const take = pred => { const i = Ls.findIndex((r, k) => !used.has(Ls[k].policyNo) && pred(r)); if (i < 0) throw new Error('no candidate'); used.add(Ls[i].policyNo); return Ls[i]; };
      const takeD = pred => { const d = Ds.find(x => !used.has(x.policyNo) && pred(x)); if (!d) throw new Error('no claim candidate'); used.add(d.policyNo); return d; };
      const single = r => r.txnSeq === '00000' && ['EOY', 'XED'].includes(r.exitType);
      const inj = (file, rec, ruleId, desc, mutate) => { mutate(rec); key.push({ file, policy: rec.policyNo.trim() + '/' + rec.policySeq.trim(), ruleId, desc }); };
      void find;

      inj('L', take(single), '23900_L0802', '出生日期 2 月 30 日 (不存在的日期)', r => { r.birthDate = r.birthDate.slice(0, 4) + '0230'; });
      inj('L', take(single), '23900_L0802', '出生日期誤填民國年 (076 年)', r => { r.birthDate = '0' + String(+r.birthDate.slice(0, 4) - 1911).padStart(3, '0') + r.birthDate.slice(4); });
      inj('L', take(r => single(r) && r.termType === 'T'), '24901_L0613', '年滿期 T 卻填保險期間 999', r => { r.term = '999'; });
      inj('L', take(r => single(r) && r.termType === 'T'), '25204_L2005', '年滿期迄日少算一年', r => { r.endDate = addYearsMinusDay(r.startDate, +r.term - 1); });
      inj('L', take(r => r.addType === 'NEW'), '24300_L1904', '新契約加保日期 ≠ 保險期間起日', r => { r.addDate = plus(r.startDate, 3); });
      inj('L', take(r => r.exitType === 'MAD'), '26102_L1503', '滿期退保日期 ≠ 保險期間迄日', r => { r.exitDate = plus(r.endDate, 1); });
      inj('L', take(single), '21800_L3302', '幣別填 TWD (代碼表為 NTD)', r => { r.currency = 'TWD'; });
      inj('L', take(single), '10400_L3001', '通路別填 0', r => { r.channel = '0'; });
      inj('L', take(single), '20300_L0902', '性別填 3', r => { r.sex = '3'; });
      inj('L', take(single), '10400_L0201', '保單編號靠右填寫', r => { r.policyNo = r.policyNo.trim().padStart(15, ' '); });
      inj('L', take(single), '10400_L0501', '保險金額未補前置 0 (以空白補位)', r => { r._rawPatch = ['sumInsuredOrig', r.sumInsuredOrig.replace(/^0+/, '').padStart(18, ' ')]; });
      inj('L', take(r => single(r) && r.startDate >= '20040101'), '25102_L1703', '2004 年後保單分紅類別填 T(強制分紅)', r => { r.dividendClass = 'T'; });
      inj('L', take(single), '21001_L1803', '商品類別編號公司代碼錯誤', r => { r.productClass = r.productClass.slice(0, 1) + '99' + r.productClass.slice(3); });
      inj('L', take(r => single(r) && r.currency === 'NTD'), 'X001', '臺幣保單原幣保額 ≠ 臺幣保額', r => { r.sumInsuredTwd = String(BigInt(r.sumInsuredTwd) * 10n); });
      inj('L', take(single), '30201_L0302', '只有一筆資料異動序號卻填 00001', r => { r.txnSeq = '00001'; });
      inj('L', take(r => r.exitType === 'LNN'), '30213_L1306', '停效後下一筆加保別填 INN 而非 RNN', r => { const n = Ls[Ls.indexOf(r) + 1]; n.addType = 'INN'; });
      inj('L', take(r => r.txnSeq === '00001' && r.exitType === 'INN'), '30107_P0901', '同保單兩筆性別不一致', r => { const n = Ls[Ls.indexOf(r) + 1]; n.sex = n.sex === '1' ? '2' : '1'; });
      inj('L', take(r => r.txnSeq === '00001' && r.exitType === 'INN'), '30205_P0502', '保額增加(INN)後保額反而較小', r => { const n = Ls[Ls.indexOf(r) + 1]; n.sumInsuredOrig = String(BigInt(r.sumInsuredOrig) / 2n).padStart(18, '0'); n.sumInsuredTwd = n.sumInsuredOrig; });
      inj('L', take(r => single(r) && r.payFreq === '1'), '25702_L4103', '躉繳(0)卻填繳費期間 020', r => { r.payFreq = '0'; r.payTerm = '020'; });
      inj('L', take(single), 'L4403', '職業類別 8(拒保) 但職業分類代碼不為 0', r => { r.occClass = '8'; r.occCode = '0805001 '; });
      inj('L', take(single), '24602_L2703', '身障等級 2 但身障類別 000', r => { r.disabilityLevel = '2'; });
      inj('L', take(single), '25002_L1233', '次標準體原因=1 但體檢類別=1(標準體)', r => { r.substdReason = '1'; });
      inj('L', take(r => r.addType === 'NEW'), '24701_L4501', '新契約要保人郵遞區號填 999', r => { r.ownerZip = '999'; });
      inj('L', take(single), '22300_L4602', '被保險人郵遞區號 000 不存在', r => { r.insuredZip = '000'; });
      inj('L', take(r => single(r) && r.productClass.slice(3, 5) === '13'), '25304_L2106', '定期壽險還本型態填 1', r => { r.survivalType = '1'; r.survivalCond = '0'; });
      inj('L', take(r => r.exitType === 'LNN'), '25805_L4202', '停效但停(失)效原因填 N', r => { r.lapseReason = 'N'; });
      inj('L', take(r => r.exitType === 'XED' && r.addType === 'NEW'), '26104_L1504', '退保別 XED 但退保日期不為 0', r => { r.exitDate = `${Y}1231`; });
      inj('L', take(single), '10400_L3701', '公司保單險種代號含全形字', r => { r.companyPlanCode = 'ＰＬＡＮ' + r.companyPlanCode.slice(4); });
      // 跨檔
      const dea = takeD(d => d.claimType === '1' && !/^[V-Y]/.test(d.causeIcd));
      Ds.splice(Ds.indexOf(dea), 1);
      key.push({ file: 'L', policy: dea.policyNo.trim() + '/' + dea.policySeq.trim(), ruleId: '30301_LD012', desc: '疾病死亡(DEA)但給付檔漏報' });
      const d2 = takeD(d => d.claimType === '1' && !/^[V-Y]/.test(d.causeIcd));
      inj('D', d2, '30312_LD019', '給付發生日期與承保退保日期不一致', d => { d.eventDate = plus(d.eventDate, -2); d.payDate = plus(d.eventDate, 10); });
      const d3 = takeD(d => d.claimType === '1');
      inj('D', d3, '24101_D1303', '實際給付金額不同但不同原因填 0', d => { d.paidAmtOrig = String(BigInt(d.dueAmtOrig) + 1234500n).padStart(18, '0'); d.paidAmtTwd = d.currency === 'NTD' ? d.paidAmtOrig : d.paidAmtTwd; });
      const d4 = takeD(d => d.claimType === '1' && /^[V-Y]/.test(d.causeIcd));
      const l4 = Ls.find(r => r.policyNo === d4.policyNo); l4.exitType = 'DEA';
      key.push({ file: 'L', policy: d4.policyNo.trim() + '/' + d4.policySeq.trim(), ruleId: '26904_D1402', desc: '外因(意外)死亡，承保退保別卻填 DEA(疾病死亡)' });
      const d5 = takeD(d => d.claimType === '1' && !/^[V-Y]/.test(d.causeIcd));
      inj('D', d5, '26901_D1402', 'ICD-10 代碼含小數點', d => { d.causeIcd = d.causeIcd.slice(0, 3) + '.' + d.causeIcd.slice(3, 4); });
      const d6 = takeD(d => d.claimType === '4');
      inj('D', d6, '26400_D1803', '給付日期早於發生日期', d => { d.payDate = plus(d.eventDate, -5); });
      Ds.push(Object.assign({}, Ds[0], { policyNo: 'Z99999999999999', policySeq: 'A01' }));
      key.push({ file: 'D', policy: 'Z99999999999999/A01', ruleId: '30307_LD013', desc: '給付資料在承保檔找不到對應保單' });
      // 檔案格式
      const dup = take(single);
      extraL.push({ after: dup, rec: Object.assign({}, dup) });
      key.push({ file: 'L', policy: dup.policyNo.trim() + '/' + dup.policySeq.trim(), ruleId: '30202_L0302', desc: '同一筆資料重複填送 (主鍵重複)' });
      const shortRec = take(single);
      shortRec._truncate = true;
      key.push({ file: 'L', policy: '', ruleId: '10300', desc: '資料長度不足 (少一個欄位)' });
      key.push({ file: 'L', policy: '', ruleId: 'F003', desc: '檔案中間有空白行' });
    }

    for (const e of extraL) Ls.splice(Ls.indexOf(e.after) + 1, 0, e.rec);
    const lines = Ls.map(r => {
      let s = buildLine(L, r);
      if (r._rawPatch) { const f = L.field(r._rawPatch[0]); s = s.slice(0, f.start - 1) + r._rawPatch[1] + s.slice(f.start - 1 + f.len); }
      return r._truncate ? s.slice(0, 421) : s;
    });
    if (opts.inject) lines.splice(Math.floor(lines.length / 2), 0, '');
    const dLines = Ds.map(r => buildLine(D, r));
    return { L: lines.join('\n') + '\n', D: dLines.join('\n') + '\n', key,
      names: { L: `LFL${CO}_${Y}.txt`, D: `LFD${CO}_${Y}.txt` } };
  }

  return { generate };
});
