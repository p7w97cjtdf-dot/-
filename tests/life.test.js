const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const report = require('../src/report.js');
const { generate } = require('../src/mock.js');

const L = life.layouts.L;
const run = g => C.validate(life, { L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D } });
const ids = res => new Set(res.issues.map(i => i.ruleId));

// 手冊「範例一(新加保)」之欄位值 (2025 版格式)
const manualExample = () => ({
  company: '01', policyNo: 'X00001000000', policySeq: '0001', txnSeq: '00000', idType: '0', idNo: '0000000000',
  sumInsuredOrig: '000000000100000000', termType: 'Y', term: '999', birthDate: '19720324', sex: '1', medExam: '2',
  examClass: '1', substdReason: '0', addType: 'NEW', addDate: '19920603', exitType: 'XED', exitDate: '00000000',
  dividendClass: 'T', productClass: '201121M11A0AJ', startDate: '19920603', endDate: '99990602', survivalType: '2',
  benefitType: '3', longevityAge: '105', screening: '9', smoker: '0', disabilityCat: '000', disabilityLevel: '0',
  econStatus: '0', groupLink: '0', channel: '1', salesMethod: '1', insuredRelation: '1', currency: 'NTD',
  illnessDeathOrig: '000000000100000000', occClass: '1', productCode: '201121M11A0AJ00', companyPlanCode: 'ABC',
  productCodeVer: '1', productCode2: '000000000000', payFreq: '1', payTerm: '020', paidMonths: '010', lapseReason: 'N',
  occCode: '00000000', ownerZip: '100', insuredZip: '100', totalPremOrig: '000000000100000000', totalPremTwd: '000000000100000000',
  survivalAmtOrig: '000000000010000000', survivalAmtTwd: '000000000010000000', longevityAmtOrig: '000000000100000000',
  longevityAmtTwd: '000000000100000000', maturityAmtOrig: '0', maturityAmtTwd: '0', survivalCond: '1', survivalFirstDate: '19950603',
  sumInsuredTwd: '000000000100000000', illnessDeathTwd: '000000000100000000', reserved: '0000',
});
const validateOne = obj => C.validate(life, { L: { name: 'LFL01_2025.txt', text: C.buildLine(L, obj) + '\n' } });

test('欄位格式長度與手冊一致 (承保 425 / 給付 225)', () => {
  assert.strictEqual(L.fields.at(-1).start + L.fields.at(-1).len - 1, 425);
  assert.strictEqual(life.layouts.D.fields.at(-1).start + life.layouts.D.fields.at(-1).len - 1, 225);
  for (const lay of [L, life.layouts.D]) lay.fields.reduce((pos, f) => { assert.strictEqual(f.start, pos, f.name); return pos + f.len; }, 1);
});

test('手冊範例一 (新加保) 通過所有檢核', () => {
  const res = validateOne(manualExample());
  assert.deepStrictEqual(res.issues.map(i => `${i.ruleId} ${i.message}`), []);
});

test('乾淨的模擬資料 0 錯誤 0 警告', () => {
  const res = run(generate({ inject: false }));
  assert.deepStrictEqual(res.issues.map(i => `${i.ruleId} L${i.line} ${i.message}`), []);
});

test('注入的每一項錯誤都被偵測到', () => {
  const g = generate({ inject: true });
  const res = run(g);
  const missed = g.key.filter(k => !res.issues.some(i => i.ruleId === k.ruleId && (!k.policy || (i.policy || '').trim() === k.policy)));
  assert.deepStrictEqual(missed, []);
  // 不應誤報在未注入錯誤的保單上
  const injected = new Set(g.key.map(k => k.policy));
  const stray = res.issues.filter(i => i.policy && i.policy.trim() !== '/' && !injected.has(i.policy.trim()) && i.ruleId !== '10300');
  assert.deepStrictEqual(stray.map(i => `${i.ruleId} ${i.policy}`), []);
});

test('不同亂數種子下乾淨資料皆無誤報', () => {
  for (const seed of [1, 7, 42, 2024, 99999]) {
    const res = run(generate({ seed, policies: 200 }));
    assert.deepStrictEqual(res.issues.map(i => `${seed}: ${i.ruleId} ${i.message}`), []);
  }
});

test('代碼 / 單筆邏輯 / 日期', () => {
  const cases = [
    [{ currency: 'TWD' }, '21800_L3302'],
    [{ birthDate: '19720230' }, '23900_L0802'],
    [{ termType: 'B', term: '999' }, '24903_L0613'],
    [{ dividendClass: 'N' }, '25101_L1704'],
    [{ productClass: '201121M11XXAJ' }, '21001_L1803'],
    [{ addDate: '19920604' }, '24300_L1904'],
    [{ exitType: 'XED', exitDate: '20251231' }, '26104_L1504'],
    [{ exitType: 'SRD', exitDate: '00000000' }, '26104_L1504'],
    [{ disabilityCat: '040', disabilityLevel: '0' }, '24601_L2703'],
    [{ econStatus: 'A' }, '25501_L2803'],
    [{ productCodeVer: '2' }, 'L3903'],
    [{ payFreq: '5', payTerm: '000' }, 'L4701'],
    [{ survivalType: '0' }, 'L5501'],
    [{ sumInsuredTwd: '000000000200000000' }, 'X001'],
  ];
  for (const [patch, rule] of cases) {
    const res = validateOne(Object.assign(manualExample(), patch));
    assert.ok(ids(res).has(rule), `${JSON.stringify(patch)} 應觸發 ${rule}，實際：${[...ids(res)].join(',')}`);
  }
});

test('多筆：停效後須復效、異動序號依序', () => {
  const a = Object.assign(manualExample(), { txnSeq: '00001', addType: 'XED', addDate: '00000000', exitType: 'LNN', exitDate: '20250301', paidMonths: '393', lapseReason: 'S' });
  const b = Object.assign(manualExample(), { txnSeq: '00003', addType: 'INN', addDate: '20250501', exitType: 'XED', sumInsuredOrig: '000000000200000000' });
  const res = C.validate(life, { L: { name: 'LFL01_2025.txt', text: [a, b].map(o => C.buildLine(L, o)).join('\n') + '\n' } });
  const s = ids(res);
  for (const r of ['30213_L1306', '30202_L0302']) assert.ok(s.has(r), r);
});

test('自動修正後問題減少', () => {
  const g = generate({ inject: true });
  const res = run(g);
  const fixed = C.applyFixes(life, res, 'L');
  assert.ok(fixed.applied > 0);
  const res2 = C.validate(life, { L: { name: g.names.L, text: fixed.text }, D: { name: g.names.D, text: g.D } });
  assert.ok(res2.summary.errors < res.summary.errors, `${res2.summary.errors} < ${res.summary.errors}`);
  assert.strictEqual(res2.issues.filter(i => i.file === 'L' && i.fix).length, 0);
});

test('CSV 匯入 → 固定長度 → 檢核結果一致', () => {
  const g = generate({ inject: false, policies: 30 });
  const recs = C.parseFixedWidth(g.L, L).records;
  const csv = C.recordsToCSV(L, recs);
  const back = C.csvToFixedWidth(csv, L);
  assert.strictEqual(back, g.L);
});

test('報告產出', () => {
  const res = run(generate({ inject: true }));
  const html = report.toHTML(life, res);
  assert.match(html, /資料檢查報告/);
  const csv = report.toCSV(life, res);
  assert.ok(csv.startsWith('\uFEFF序號,狀況,資料'), 'CSV 開頭要有 BOM，Excel 才不會顯示亂碼');
  assert.ok(csv.includes('\r\n') && /必須修改/.test(csv));
  assert.ok(report.toRejectFile(life, res, 'L').split('\n').length > 10);
});
