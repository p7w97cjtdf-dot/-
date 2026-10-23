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
