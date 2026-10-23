// AI 洞見驗證：AI 提出的原因要用原始資料逐筆驗證，筆數以工具算出的為準
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../src/core.js');
const all = require('../src/rulesets/index.js');
const V = require('../src/ai-verify.js');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const res = C.validate(all, { L: { name: 'LFL01_2025.txt', text: read('samples/dirty/LFL01_2025.txt') }, D: { name: 'LFD01_2025.txt', text: read('samples/dirty/LFD01_2025.txt') } });

test('從 AI 回覆分出文字與 JSON；JSON 壞掉時當成沒有可驗證的原因', () => {
  const r = V.split('1. 整體狀況…\n```json\n{"insights":[{"title":"a","file":"L","condition":{"field":"sex","op":"eq","value":"1"}}]}\n```\n提醒');
  assert.strictEqual(r.insights.length, 1);
  assert.ok(!r.text.includes('insights'));
  assert.deepStrictEqual(V.split('文字 ```json\n{壞掉\n```').insights, []);
});

test('四種結果：已驗證、數字不對、不成立、無法驗證', () => {
  const out = V.verify([
    { title: '金額沒有補前置 0', file: 'L', condition: { field: 'sumInsuredOrig', pos: [1, 1], op: 'eq', value: ' ' }, ruleIds: ['10400_L0501'], claim: 1 },
    { title: '出生日期不合法', file: 'L', condition: { not: { field: 'birthDate', op: 'isDate' } }, ruleIds: ['23900_L0802'], claim: 30 },
    { title: '日幣保單', file: 'L', condition: { field: 'currency', op: 'eq', value: 'JPY' }, claim: 5 },
    { title: '欄位寫錯', file: 'L', condition: { field: 'nope', op: 'eq', value: '1' } },
    { title: '用正規表示式', file: 'L', condition: { field: 'policyNo', op: 'matches', value: '(a+)+$' } },
    { title: '沒有條件', file: 'L' },
  ], all, res);
  assert.deepStrictEqual(out.map(x => x.status), ['verified', 'mismatch', 'refuted', 'invalid', 'invalid', 'invalid']);
  assert.strictEqual(out[0].count, 1); assert.strictEqual(out[0].coverage, 1);
  assert.strictEqual(out[1].count, 2);          // AI 說 30 筆，實際 2 筆
  // 驗證到的資料列確實都有那個檢查問題
  const bad = new Set(res.issues.filter(i => i.ruleId === '23900_L0802').map(i => i.line));
  assert.ok(out[1].lines.every(l => bad.has(l)));
});

test('給 AI 的欄位清單只列有放入的檔案', () => {
  const g = V.fieldGuide(all, res);
  assert.ok(g.includes('L（') && g.includes('D（') && !g.includes('CL（'));
  assert.ok(g.includes('birthDate=出生日期'));
});

test('整體狀況：退件可能性由工具判定，和 AI 說的比對', () => {
  assert.strictEqual(V.riskOf(res), '高');
  assert.strictEqual(V.verifyRisk('退件可能性高', res).status, 'verified');
  assert.strictEqual(V.verifyRisk('低', res).status, 'refuted');
  assert.strictEqual(V.verifyRisk(null, res).status, 'invalid');
});

test('先改什麼：影響最多、可一鍵修改、會連帶其他錯誤用數字檢查', () => {
  const out = V.verifyPriorities([{ ruleIds: ['10400_L0501'], reason: '可一鍵修改' }, { ruleIds: ['30202_L0302'], reason: '會連帶其他錯誤' }, { ruleIds: ['K0001'], reason: '很重要' }, { ruleIds: ['NOPE'], reason: '影響最多' }], res);
  assert.deepStrictEqual(out.map(x => x.status), ['verified', 'verified', 'invalid', 'invalid']);
});

test('以後怎麼避免：預防檢查拿現在的資料試跑，算出抓到幾筆、誤報幾筆', () => {
  const [good, noisy, useless] = V.verifyPreventions([
    { title: '出生日期要合法', file: 'L', condition: { field: 'birthDate', op: 'isDate' }, ruleIds: ['23900_L0802'] },
    { title: '性別只能 1', file: 'L', condition: { field: 'sex', op: 'eq', value: '1' } },
    { title: '幣別不是 XXX', file: 'L', condition: { field: 'currency', op: 'ne', value: 'XXX' } },
  ], all, res);
  assert.strictEqual(good.status, 'verified'); assert.strictEqual(good.caught, 2); assert.strictEqual(good.falseAlarm, 0);
  assert.strictEqual(noisy.status, 'mismatch'); assert.ok(noisy.falseAlarm > 0);
  assert.strictEqual(useless.status, 'refuted');
  assert.strictEqual(good.rule.severity, 'warning');
});

test('單筆解釋：AI 建議的值改進副本重新檢查', () => {
  const files = { L: { name: 'LFL01_2025.txt', text: read('samples/dirty/LFL01_2025.txt') }, D: { name: 'LFD01_2025.txt', text: read('samples/dirty/LFD01_2025.txt') } };
  const iss = res.issues.find(i => i.ruleId === '23900_L0802');
  assert.strictEqual(V.verifyFix({ field: 'birthDate', value: '19910623' }, iss, all, files).status, 'verified');
  assert.strictEqual(V.verifyFix({ field: 'birthDate', value: '19910231' }, iss, all, files).status, 'refuted');
  const side = V.verifyFix({ field: 'birthDate', value: '20300101' }, iss, all, files);
  assert.strictEqual(side.status, 'mismatch'); assert.ok(side.newIssues.length);
  assert.strictEqual(V.verifyFix({ field: 'birthDate', value: '123456789' }, iss, all, files).status, 'refuted');   // 超過欄位長度
  assert.strictEqual(V.verifyFix(null, iss, all, files).status, 'invalid');
  assert.strictEqual(files.L.text, read('samples/dirty/LFL01_2025.txt'));   // 原始資料沒有被改
  assert.strictEqual(V.verifySystemic(true, 2).status, 'refuted');
  assert.strictEqual(V.verifySystemic(true, 5).status, 'verified');
});

test('退件說明：AI 說的原因要在定位結果裡', () => {
  const R = require('../src/recon.js');
  const d = R.decode('錯誤代碼 23900', { res, extra: [], catalogs: [all.catalog] });
  const out = V.verifyLikely([{ title: '出生日期', ruleIds: ['23900_L0802'], claim: 2 }, { title: '幣別', ruleIds: ['10400_L3001'], claim: 1 }, { title: '沒寫編號' }], d, res);
  assert.deepStrictEqual(out.map(x => x.status), ['verified', 'refuted', 'invalid']);
  assert.strictEqual(out[1].inData, 1);   // 資料中有，但退件訊息沒有指到
});
