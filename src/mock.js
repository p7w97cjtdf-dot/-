/*
 * 模擬資料產生器：產生符合手冊格式之個人壽險承保檔 / 給付檔，
 * 並可注入各式「欄位 / 格式 / 邏輯 / 跨檔」錯誤，附上解答 (answer key)，
 * 用來展示及驗證 AI 檢核助手能自動找出問題。
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const core = isNode ? require('./core.js') : root.DQ;
  const life = isNode ? require('./rulesets/life.js') : root.DQ.rulesets.life;
  const fin = isNode ? require('./rulesets/finance.js') : root.DQ.rulesets.finance;
  const recon = isNode ? require('./recon.js') : root.DQ.recon;
  const sample = isNode ? require('./sample-data.js') : root.DQ.sampleData;
  const master = isNode ? require('./master.js') : root.DQ.master;
  const m = factory(core, life, fin, recon, sample, master);
  if (isNode) module.exports = m; else root.DQ.mock = m;
})(typeof self !== 'undefined' ? self : this, function (C, life, fin, recon, sample, master) {
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
      // 商品代號取自商品資料：2014 年底前起保者使用當時的舊版代號 (已於 20141231 停售)
      const suffix = { whole: 'W99', term: `T${tTerm / 10}0`, endow: `E${tTerm / 10}0` }[prodKind];
      const code = `2${CO}1${p45[1]}1M11A${suffix}${start <= '20141231' ? '90' : '00'}`;
      const pc = code.slice(0, 13);
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
        productCode: code, companyPlanCode: `PLAN${p45}${String(i % 7)}`, productCodeVer: v2 ? '2' : '1', productCode2: v2 ? 'A11Z10000000' : '000000000000',
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
          const d1 = ev(), cap = `${Y}1231` < end ? `${Y}1231` : end, a = plus(d1, ri(30, 120));
          // 復效日不超過年底與滿期日 (亂數消耗次數與原本相同，避免試用資料位移)
          let d2 = cap; if (a <= `${Y}1231`) { const b = plus(d1, ri(30, 120)); d2 = b > cap ? cap : b; } else if (a < cap) d2 = a;
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

    // 對帳情境：固定兩筆落在結帳邊界附近的給付 (6/30、12/30)
    const reserved = new Set();
    const edge = (pay, maxEvent) => {
      const d = Ds.find(x => ['1', '2', '3'].includes(x.claimType) && !reserved.has(x.policyNo) && x.eventDate.startsWith(String(Y)) && x.eventDate <= maxEvent);
      if (d) {
        // 事故日移到給付日前 10 天，承保退保日同步，讓理賠處理天數合理
        const ev2 = plus(pay, -10), l = Ls.find(r => r.policyNo === d.policyNo && r.exitDate === d.eventDate);
        if (l && ev2 > d.startDate) { l.exitDate = ev2; d.eventDate = ev2; }
        d.payDate = pay; reserved.add(d.policyNo);
      }
      return d;
    };
    const juneClaim = edge(`${Y}0630`, `${Y}0625`), yearEndClaim = edge(`${Y}1230`, `${Y}1225`);
    const truthL = Ls.map(r => Object.assign({}, r));

    const key = [];
    let extraL = [];
    if (opts.inject) {
      const find = (pred, from) => Ls.findIndex((r, i) => i >= (from || 0) && pred(r));
      const used = new Set(reserved);
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
      inj('D', d2, '30312_LD019', '給付發生日期與承保退保日期不一致', d => { d.eventDate = plus(d.eventDate, -2); });
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
      const sp = shortRec.policyNo.trim() + '/' + shortRec.policySeq.trim();
      key.push({ file: 'L', policy: '', ruleId: '10300', affects: [`C007 ${sp}`], desc: `資料長度不足 (少一個欄位)；該筆 (${sp}) 無法拆欄，客戶資料會連帶出現 C007「保單不在承保檔」` });
      key.push({ file: 'L', policy: '', ruleId: 'F003', desc: '檔案中間有空白行' });
    }

    // 匯入規則情境：違反「公司內部核保規則」範例 (非手冊規則，內建檢核不會發現)
    const ruleKey = [];
    if (opts.inject) {
      const busy = r => reserved.has(r.policyNo) || key.some(k => k.policy.startsWith(r.policyNo.trim()));
      const single = r => r.txnSeq === '00000' && ['EOY', 'XED'].includes(r.exitType) && !busy(r);
      const old = Ls.find(r => single(r) && r.termType === 'Y' && r.addType !== 'NEW');
      if (old) { old.birthDate = String(+old.startDate.slice(0, 4) - 78) + old.startDate.slice(4, 6) + '01'; ruleKey.push({ ruleId: 'U002', policy: old.policyNo.trim() + '/' + old.policySeq.trim(), desc: '投保年齡 78 歲承保終身壽險' }); reserved.add(old.policyNo); }
      const big = Ls.find(r => single(r) && r.addType === 'NEW' && r.currency === 'NTD');
      if (big) { const f = 4000000000n / BigInt(big.sumInsuredOrig); for (const k of ['totalPremOrig', 'totalPremTwd']) big[k] = String(BigInt(big[k]) * f); for (const k of ['sumInsuredOrig', 'sumInsuredTwd', 'illnessDeathOrig', 'illnessDeathTwd']) big[k] = '4000000000'; ruleKey.push({ ruleId: 'U001', policy: big.policyNo.trim() + '/' + big.policySeq.trim(), desc: '新契約保額 4,000 萬元未體檢' }); reserved.add(big.policyNo); }
      const slow = Ds.find(d => d.claimType === '1' && !reserved.has(d.policyNo) && !key.some(k => k.policy.startsWith(d.policyNo.trim())) && Ds.filter(x => x.policyNo === d.policyNo).length === 1);
      if (slow) { slow.payDate = plus(slow.eventDate, 120); ruleKey.push({ ruleId: 'U007', policy: slow.policyNo.trim() + '/' + slow.policySeq.trim(), desc: '死亡給付在事故後 120 天才給付' }); reserved.add(slow.policyNo); }
    }

    // 主檔情境：停售後仍用舊版商品代號、商品代號誤植
    const masterKey = [];
    if (opts.inject) {
      const busy = r => reserved.has(r.policyNo) || key.some(k => k.policy.startsWith(r.policyNo.trim())) || ruleKey.some(k => k.policy.startsWith(r.policyNo.trim()));
      const cands = Ls.filter(r => r.txnSeq === '00000' && ['EOY', 'XED'].includes(r.exitType) && r.startDate >= '20150101' && r.currency === 'NTD' && !busy(r));
      const a = cands[0], b = cands[1];
      if (a) { a.productCode = a.productCode.slice(0, 13) + '90'; reserved.add(a.policyNo); masterKey.push({ ruleId: 'PM02', policy: a.policyNo.trim() + '/' + a.policySeq.trim(), desc: `${a.startDate} 起保仍使用 2014 年底停售的舊版代號` }); }
      if (b) { const c = b.productCode; b.productCode = c.slice(0, 9) + c[10] + c[9] + c.slice(11); reserved.add(b.policyNo); masterKey.push({ ruleId: 'PM01', policy: b.policyNo.trim() + '/' + b.policySeq.trim(), suggest: c, desc: `商品代號第 10、11 碼對調（${b.productCode}）` }); }
    }

    // 合理性情境：資料合法但不合理，應標為「疑似異常（需人工判斷）」而非錯誤
    const anomalyKey = [], custPatch = [];
    if (opts.inject) {
      const busy = r => reserved.has(r.policyNo) || [key, ruleKey, masterKey].some(ks => ks.some(k => k.policy.startsWith(r.policyNo.trim())));
      const fresh = r => r.addType === 'NEW' && r.exitType === 'XED' && r.currency === 'NTD' && !busy(r) && Ls.filter(x => x.policyNo === r.policyNo).length === 1;
      const tag = (r, ruleId, desc) => { reserved.add(r.policyNo); anomalyKey.push({ ruleId, file: ruleId < 'A003' ? 'L' : 'D', policy: r.policyNo.trim() + '/' + r.policySeq.trim(), desc }); };
      // A001 新契約被保險人 86 歲 (定期壽險，避免同時違反「75 歲以上不得承保終身壽險」範例規則)
      const old = Ls.find(r => fresh(r) && r.termType === 'T');
      if (old) {
        old.birthDate = String(+old.startDate.slice(0, 4) - 86) + old.startDate.slice(4, 6) + '01';
        custPatch.push([old.policyNo.trim(), old.birthDate]);
        tag(old, 'A001', `新契約投保年齡 86 歲（出生 ${old.birthDate}）`);
      }
      // A002 總保費只有正常的 1/10 (疑似少一位數)
      const cheap = Ls.find(r => fresh(r) && r.productCode !== (old && old.productCode) && Ls.filter(x => x.productCode === r.productCode).length >= 6);
      if (cheap) { for (const k of ['totalPremOrig', 'totalPremTwd']) cheap[k] = String(BigInt(cheap[k]) / 10n); tag(cheap, 'A002', '應繳總保費合計只有同商品正常水準的 1/10'); }
      // A003 生效後 45 天即疾病身故
      const early = Ls.find(r => fresh(r) && r.startDate <= `${Y}0901`);
      const tpl = Ds.find(d => d.claimType === '1');
      if (early && tpl) {
        const ev = plus(early.startDate, 45);
        early.exitType = 'DEA'; early.exitDate = ev;
        const f = ['company', 'policyNo', 'policySeq', 'termType', 'term', 'birthDate', 'sex', 'medExam', 'examClass', 'substdReason', 'startDate', 'productClass', 'currency', 'occClass', 'companyPlanCode'];
        const d = Object.assign({}, tpl, Object.fromEntries(f.map(k => [k, early[k]])), { claimType: '1', eventDate: ev, payDate: plus(ev, 20), causeIcd: 'C349 ', diffReason: '0', disabilityItem: '00000000',
          dueAmtOrig: early.illnessDeathOrig, paidAmtOrig: early.illnessDeathOrig, dueAmtTwd: early.illnessDeathTwd, paidAmtTwd: early.illnessDeathTwd });
        Ds.push(d);
        tag(early, 'A003', `${early.startDate} 起保，45 天後（${ev}）疾病身故`);
      }
      // A004 同一被保險人兩張保單：乙保單領生命末期提前給付，60 天後甲保單身故
      const mkClaim = (l, type, ev, icd) => Object.assign({}, tpl, Object.fromEntries(['company', 'policyNo', 'policySeq', 'termType', 'term', 'birthDate', 'sex', 'medExam', 'examClass', 'substdReason', 'startDate', 'productClass', 'currency', 'occClass', 'companyPlanCode'].map(k => [k, l[k]])),
        { claimType: type, eventDate: ev, payDate: plus(ev, 20), causeIcd: icd, diffReason: '0', disabilityItem: '00000000', dueAmtOrig: l.illnessDeathOrig, paidAmtOrig: l.illnessDeathOrig, dueAmtTwd: l.illnessDeathTwd, paidAmtTwd: l.illnessDeathTwd });
      for (const x of Ds.filter(d => d.claimType === '1' && !/^[V-Y]/.test(d.causeIcd) && d.currency === 'NTD' && !busy({ policyNo: d.policyNo }) && Ds.filter(z => z.policyNo === d.policyNo).length === 1)) {
        const ev = plus(x.eventDate, -60);
        const y = Ls.find(r => !r._truncate && r.txnSeq === '00000' && r.exitType === 'EOY' && r.currency === 'NTD' && !busy(r) && r.policyNo !== x.policyNo && Ls.filter(z => z.policyNo === r.policyNo).length === 1 && r.startDate <= plus(ev, -365));
        if (!y || !tpl) continue;
        const xl = Ls.find(r => r.policyNo === x.policyNo);
        y.birthDate = xl.birthDate; y.sex = xl.sex;
        y.exitType = 'ABD'; y.exitDate = ev;
        Ds.push(mkClaim(y, '3', ev, x.causeIcd));
        custPatch.push([y.policyNo.trim(), null, x.policyNo.trim()]);
        reserved.add(y.policyNo);
        tag(x, 'A004', `與保單 ${y.policyNo.trim()} 為同一被保險人：${ev} 先領生命末期提前給付，60 天後（${x.eventDate}）身故給付`);
        break;
      }
    }

    // 結轉情境：復效時保額被改動但未以 INN/DNN 申報
    const reconKey = [];
    if (opts.inject) {
      const rnn = Ls.slice().reverse().find(r => r.addType === 'RNN' && !reserved.has(r.policyNo) && !key.some(k => k.policy.startsWith(r.policyNo.trim())));
      if (rnn) {
        rnn.sumInsuredOrig = String(BigInt(rnn.sumInsuredOrig) * 6n / 5n); rnn.sumInsuredTwd = String(BigInt(rnn.sumInsuredTwd) * 6n / 5n);
        reconKey.push({ module: 'roll', ruleId: 'P004', policy: rnn.policyNo.trim() + '/' + rnn.policySeq.trim(), desc: '復效(RNN)時保額變動，未以保額增加(INN)申報' });
      }
    }
    // 預設含錯誤情境使用試用客戶資料 (sample-data.js)：依合理性情境同步，並修正試用資料中非刻意的不一致，
    // 讓「錯誤解答」以外不會多出客戶資料問題
    const useTrial = opts.inject && opts.seed === 20251014 && opts.policies === 120 && CO === '01' && Y === 2025;
    let trialCsv = null;
    if (useTrial) {
      const rows = sample.CUSTOMER_CSV.trimEnd().split('\n').map(l => l.split(','));
      const get = (p, role) => rows.find(z => z[0] === p && z[2] === role);
      const keep = new Set(CUSTOMER_KEY.map(k => k.policy.split('/')[0]));
      custPatch.push(['P250006201', '19431101']);            // 試用資料被保險人生日與承保檔不同
      for (const [p, birth, from] of custPatch) {
        const ins = get(p, '2'), own = get(p, '1');
        if (!ins) continue;
        const same = own && own[3] === ins[3];
        const person = birth ? ins.slice(3, 5).concat([birth], ins.slice(6)) : get(from, '2').slice(3);
        ins.splice(3, ins.length - 3, ...person);
        if (same) own.splice(3, own.length - 3, ...person);
      }
      // 被保險人身份 (承保檔) 與客戶資料的年齡關係一致：子女應較年輕、父母應較年長
      for (const r of Ls) {
        const pno = r.policyNo.trim(), own = get(pno, '1'), ins = get(pno, '2');
        if (!own || !ins || keep.has(pno) || own[3] === ins[3]) continue;
        const gap = +own[5].slice(0, 4) - +ins[5].slice(0, 4);          // > 0：被保險人較年長
        const bad = r.insuredRelation === '1' || (r.insuredRelation === '3' && gap >= 0) || (r.insuredRelation === '4' && gap <= 0);
        if (bad) r.insuredRelation = gap >= 15 ? '4' : gap <= -15 ? '3' : '2';
      }
      trialCsv = rows.map(c => c.join(',')).join('\n') + '\n';
    }
    for (const e of extraL) Ls.splice(Ls.indexOf(e.after) + 1, 0, e.rec);
    const lines = Ls.map(r => {
      let s = buildLine(L, r);
      if (r._rawPatch) { const f = L.field(r._rawPatch[0]); s = s.slice(0, f.start - 1) + r._rawPatch[1] + s.slice(f.start - 1 + f.len); }
      return r._truncate ? s.slice(0, 421) : s;
    });
    if (opts.inject) lines.splice(Math.floor(lines.length / 2), 0, '');
    const dLines = Ds.map(r => buildLine(D, r));
    const out = { L: lines.join('\n') + '\n', D: dLines.join('\n') + '\n', key, reconKey, ruleKey, masterKey, anomalyKey,
      names: { L: `LFL${CO}_${Y}.txt`, D: `LFD${CO}_${Y}.txt`, prior: `LFL${CO}_${Y - 1}.txt`, control: `控制總數_${Y}.csv`, statement: `資產負債表_${Y}.csv`, products: `商品資料_${Y}.csv`, customers: `客戶資料_${Y}.csv` } };
    out.products = sample.PRODUCT_CSV;
    // 含錯誤的預設情境使用試用的客戶資料 (假設資料，內含刻意的錯誤)；其他情境產生與保單一致的客戶資料
    if (useTrial) {
      out.customers = trialCsv;
      masterKey.push(...CUSTOMER_KEY);
    } else out.customers = customersFor(Ls, opts.seed);
    Object.assign(out, reconInputs(out, truthL, { Y, CO, inject: opts.inject, rand, ri, juneClaim, yearEndClaim, reconKey }));
    return out;
  }

  // 試用客戶資料中刻意放入的錯誤
  const CUSTOMER_KEY = [
    { ruleId: 'C001', policy: 'P250000901/A01', desc: '被保險人證號檢查碼錯誤 (J195366528)' },
    { ruleId: 'C004', policy: 'P250002801/A01', desc: '要保人郵遞區號 813 與臺北市中正區地址不符' },
    { ruleId: 'C005', policy: 'P250001901/A01', desc: '同一證號 S272264127 姓名不同' },
    { ruleId: 'C005', policy: 'P250004001/A01', desc: '同一證號 R281813824 出生日期不同' },
    { ruleId: 'C005', policy: 'P250001601/A01', desc: '同一保單內同一證號出生日期不同' },
    { ruleId: 'C006', policy: 'P250003201/A01', desc: '承保保單沒有客戶資料' },
    { ruleId: 'C007', policy: 'Z88888888888888/A01', desc: '客戶資料的保單不在承保檔' },
    { ruleId: 'C008', policy: 'P250000001/A01', fix: '19910623', desc: '承保檔出生日期不合法，客戶資料有正確值' },
    { ruleId: 'C008', policy: 'P250000101/A01', fix: '20051021', desc: '承保檔出生日期為民國年，客戶資料有正確值' },
    { ruleId: 'C008', policy: 'P250001101/A01', fix: '1', desc: '承保檔性別代碼錯誤，客戶資料有正確值' },
    { ruleId: 'C009', policy: 'P250001701/A01', desc: '身份為本人，但要保人與被保險人證號不同' },
  ];

  // 產生與保單一致的客戶資料 (角色 1 要保人、2 被保險人)
  function customersFor(Ls, seed) {
    const rand = rng((seed || 1) + 7), ri = (a, b) => a + Math.floor(rand() * (b - a + 1)), pick = a => a[Math.floor(rand() * a.length)];
    const SUR = '陳林黃張李王吳劉蔡楊許鄭謝郭洪曾邱廖賴周徐蘇葉莊呂江何蕭羅高', GIVEN = { 1: ['建宏', '志明', '俊傑', '家豪', '承恩', '冠宇', '柏翰', '宗翰'], 2: ['淑芬', '怡君', '雅婷', '欣怡', '佳穎', '詩涵', '美玲', '宜庭'] };
    const ROAD = ['中正路', '中山路', '民權路', '信義路', '和平路', '文心路', '民生路'];
    const zips = Object.keys(sample.ZIP).filter(z => sample.ZIP[z][0] && !['釣魚臺', '南海諸島'].includes(sample.ZIP[z][0]));
    const used = new Set();
    const person = (sex, birth) => {
      let id; do { id = master.makeId('ABCDEFGHJKLMNPQRSTUVXYWZIO'[ri(0, 25)], sex, String(ri(0, 9999999)).padStart(7, '0')); } while (!id || used.has(id));
      used.add(id);
      const z = pick(zips), [city, dist] = sample.ZIP[z];
      return { id, name: SUR[ri(0, SUR.length - 1)] + pick(GIVEN[sex]), birth, sex, zip: z, addr: `${city}${dist === city ? '' : dist}${pick(ROAD)}${ri(1, 300)}號${ri(1, 12)}樓` };
    };
    const shift = (d, y) => String(+d.slice(0, 4) + y) + d.slice(4, 6) + (d.slice(6) > '28' ? '28' : d.slice(6));
    const seen = new Set(), rows = [];
    for (const r of Ls) {
      const k = r.policyNo.trim() + '/' + r.policySeq.trim();
      if (seen.has(k) || r._truncate || r.policyNo.trim() !== r.policyNo.trimEnd()) continue;
      seen.add(k);
      const ins = person(r.sex, r.birthDate);
      const own = r.insuredRelation === '1' ? ins : person(pick(['1', '2']), shift(r.birthDate, { 3: -ri(22, 35), 4: ri(22, 35), 2: ri(-3, 3) }[r.insuredRelation] || -ri(10, 30)));
      for (const [role, p] of [['1', own], ['2', ins]]) rows.push([r.policyNo.trim(), r.policySeq.trim(), role, p.id, p.name, p.birth, p.sex, p.zip, p.addr].join(','));
    }
    return '保單編號,保單序號,角色,證件編號,姓名,出生日期,性別,郵遞區號,地址\n' + rows.join('\n') + '\n';
  }

  // ---------- 對帳用輸入：上年度申報檔、上游控制總數、資產負債表 ----------
  function reconInputs(out, truthL, o) {
    const { Y, inject, ri, reconKey } = o;
    const res = C.validate(life, { L: { name: out.names.L, text: out.L }, D: { name: out.names.D, text: out.D } });
    const agg = recon.aggregate(res);
    const keyOf = r => r.policyNo.trim() + '/' + r.policySeq.trim();
    const amtOf = d => Number(d.paidAmtTwd);

    // 上年度申報檔 (取自注入錯誤前的資料)
    const firsts = new Map();
    for (const r of truthL) if (!firsts.has(keyOf(r)) || r.txnSeq < firsts.get(keyOf(r)).txnSeq) firsts.set(keyOf(r), r);
    let prior = [...firsts.values()].filter(r => ['XED', 'EOY'].includes(r.addType)).map(r => Object.assign({}, r, {
      txnSeq: '00000', addType: r.startDate >= `${Y - 1}0101` ? 'NEW' : 'XED', addDate: r.startDate >= `${Y - 1}0101` ? r.startDate : '00000000',
      exitType: r.startDate >= `${Y - 1}0101` ? 'XED' : 'EOY', exitDate: '00000000', lapseReason: 'N', paidMonths: '000' }));
    if (inject) {
      const pool = prior.slice().reverse().filter(r => !out.key.some(k => k.policy === keyOf(r)) && !reconKey.some(k => k.policy === keyOf(r)));
      const lost = Object.assign({}, pool[0], { policyNo: `P${Y - 2001}LOST0001` });
      prior.push(lost);
      reconKey.push({ module: 'roll', ruleId: 'P001', policy: keyOf(lost), desc: '上年度期末有效保單，本年度漏報' });
      const changed = pool[1];
      prior[prior.indexOf(changed)] = Object.assign({}, changed, { sumInsuredOrig: String(BigInt(changed.sumInsuredOrig) * 4n / 5n), sumInsuredTwd: String(BigInt(changed.sumInsuredTwd) * 4n / 5n) });
      reconKey.push({ module: 'roll', ruleId: 'P003', policy: keyOf(changed), desc: '本年度期初保額 ≠ 上年度期末保額 (上年度末增額未申報)' });
      const dropped = pool[2];
      prior = prior.filter(r => r !== dropped);
      reconKey.push({ module: 'roll', ruleId: 'P002', policy: keyOf(dropped), desc: '本年度以持續有效(XED)申報，但上年度申報檔無此保單' });
    }
    const priorText = prior.map(r => buildLine(L, r)).join('\n') + '\n';

    // 上游控制總數 (各系統依自己的結帳口徑)
    const rows = [];
    for (const [k, a] of agg) { const [item, period] = k.split('|'); rows.push({ item, period, cnt: a.cnt, amt: a.amt, recs: a.recs }); }
    const row = (item, period) => rows.find(r => r.item === item && r.period === period) || (rows.push({ item, period, cnt: 0, amt: 0, recs: [] }), rows[rows.length - 1]);
    const move = (claim, from, to) => { const a = row('CLM', from), b = row('CLM', to); a.cnt--; a.amt -= amtOf(claim); b.cnt++; b.amt += amtOf(claim); };
    if (inject) {
      if (o.juneClaim) { move(o.juneClaim, `${Y}-06`, `${Y}-07`); reconKey.push({ module: 'control', item: 'CLM', period: `${Y}-06`, status: '時間差', desc: '6/30 給付，理賠系統以入帳日計入 7 月' }, { module: 'control', item: 'CLM', period: `${Y}-07`, status: '時間差', desc: '同上 (相互抵銷)' }); }
      if (o.yearEndClaim) { move(o.yearEndClaim, `${Y}-12`, `${Y + 1}-01`); reconKey.push({ module: 'control', item: 'CLM', period: `${Y}-12`, status: '時間差', desc: '12/30 給付，理賠系統計入次年 1 月 (跨年度)' }); }
      const inf = row('INF', String(Y));
      inf.amt = inf.recs.reduce((s, x) => s + (x.currency !== 'NTD' ? x.orig : x.amt), 0);
      reconKey.push({ module: 'control', item: 'INF', period: String(Y), status: '定義差', desc: '保單管理系統外幣保單以原幣加總' });
      const nb = row('NB', `${Y}-03`); nb.cnt += 1; nb.amt += 285000000;
      reconKey.push({ module: 'control', item: 'NB', period: `${Y}-03`, status: '待查', desc: '新契約系統多 1 件 285 萬元，申報漏報' });
    }
    rows.sort((a, b) => a.item.localeCompare(b.item) || a.period.localeCompare(b.period));
    const money = c => (c / 100).toFixed(2);
    const control = '\uFEFF來源系統,項目代號,項目名稱,期間,筆數,金額\n' + rows.filter(r => r.cnt || r.amt).map(r => [recon.ITEMS[r.item].source, r.item, recon.ITEMS[r.item].name, r.period, r.cnt, money(r.amt)].join(',')).join('\n') + '\n';

    // 資產負債表
    const yi = n => n * 100;                                // 元 → 分
    const bal = {};
    const leaf = (code, open, inc, dec) => { bal[code] = { open, inc, dec, close: open + inc - dec }; };
    const rnd = (a, b) => yi(ri(a, b) * 1000);
    for (const c of ['1101', '1102', '1103', '1201', '1202', '1301', '1302', '1303', '1401', '1402', '1501', '1601']) { const op = rnd(200000, 9000000); leaf(c, op, rnd(10000, 900000), rnd(10000, 900000)); }
    for (const c of ['2102', '2103', '2301', '2302', '2303', '2304', '2305', '2306', '2401']) { const op = rnd(100000, 5000000); leaf(c, op, rnd(10000, 600000), rnd(10000, 600000)); }
    for (const c of ['3101', '3201', '3202', '3301']) leaf(c, rnd(100000, 900000), 0, 0);
    const paid = res.data.D.filter(d => d._raw.length === life.layouts.D.recordLength && d.payDate.startsWith(String(Y))).reduce((s, d) => s + amtOf(d), 0);
    leaf('2101', rnd(1000, 5000), paid + rnd(100, 900), paid);
    const sumOf = (codes, k) => codes.reduce((s, c) => s + bal[c][k], 0);
    const A = ['1101', '1102', '1103', '1201', '1202', '1301', '1302', '1303', '1401', '1402', '1501', '1601'];
    const Lb = ['2101', '2102', '2103', '2301', '2302', '2303', '2304', '2305', '2306', '2401'];
    const E = ['3101', '3201', '3202', '3301'];
    const plugOpen = sumOf(A, 'open') - sumOf(Lb, 'open') - sumOf(E, 'open'), plugClose = sumOf(A, 'close') - sumOf(Lb, 'close') - sumOf(E, 'close');
    bal['3203'] = { open: plugOpen, inc: Math.max(plugClose - plugOpen, 0), dec: Math.max(plugOpen - plugClose, 0), close: plugClose };
    if (inject && o.yearEndClaim) {
      const x = amtOf(o.yearEndClaim);
      bal['2101'].dec -= x; bal['2101'].close += x;      // 12/30 給付，會計次年入帳
      bal['1102'].inc += x; bal['1102'].close += x;
      reconKey.push({ module: 'stmt', ruleId: 'S008', code: '2101', desc: '應付保險給付與給付明細差一筆 12/30 給付 (會計次年入帳)' });
    }
    const totals = () => {
      for (const a of fin.chart.slice().reverse()) if (!a.until && !bal[a.code]) {
        const kids = fin.children(a.code).filter(k => bal[k.code]);
        bal[a.code] = ['open', 'inc', 'dec', 'close'].reduce((o2, k) => (o2[k] = kids.reduce((s, c) => s + bal[c.code][k], 0), o2), {});
      }
    };
    totals();
    const codeMap = {}, typo = {};
    if (inject) {
      // 責任準備金期末餘額數字對調，上層小計以公式帶出 → 本列結轉不符 + 資產負債表不平
      const c = bal['2303'], s = String(c.close / 100);
      let i = 2; while (i < s.length - 1 && s[i] === s[i + 1]) i++;
      const t = s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2), d = Number(t) * 100 - c.close;
      c.close += d; bal['23'].close += d; bal['2'].close += d;
      reconKey.push({ module: 'stmt', ruleId: 'S003', code: '2303', desc: '責任準備金期末餘額數字對調' }, { module: 'stmt', ruleId: 'S005', code: '1', desc: '連帶造成資產負債表不平' });
      codeMap['1302'] = '1304'; reconKey.push({ module: 'stmt', ruleId: 'S002', code: '1304', desc: '使用 IFRS 9 後已停用之「備供出售金融資產」' });
      codeMap['1401'] = '1410'; reconKey.push({ module: 'stmt', ruleId: 'S001', code: '1410', suggest: '1401', desc: '科目代號誤植 (1401 → 1410)' });
      void typo;
    }
    const lines2 = fin.chart.filter(a => !a.until && bal[a.code]).map(a => {
      const b = bal[a.code], code = codeMap[a.code] || a.code;
      const name = codeMap[a.code] && fin.byCode.get(code) ? fin.byCode.get(code).name : a.name;
      return [code, name, money(b.open), money(b.inc), money(b.dec), money(b.close)].join(',');
    });
    const statement = '\uFEFF科目代號,科目名稱,期初餘額,本期增加,本期減少,期末餘額\n' + lines2.join('\n') + '\n';
    return { prior: priorText, control, statement };
  }

  return { generate };
});
