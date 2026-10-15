// 規則更新包：匯入後新增檢查、新欄位、適用起日與停用內建檢查都要生效
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const C = require('../src/core.js');
const P = require('../src/rule-packs.js');
const all = require('../src/rulesets/index.js');
const { generate } = require('../src/mock.js');

const demo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'updates', 'example-2026-format-change.json'), 'utf8'));
const files = g => ({ L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D } });

test('示範更新包格式正確', () => {
  const v = P.validate(demo, all);
  assert.deepStrictEqual(v.errors, []);
  assert.deepStrictEqual(v.rules.filter(r => r.errors.length), []);
});

test('套用後：新欄位與新規則找到問題，適用起日之前的保單不檢查，停用的檢查不再出現', () => {
  const g = generate({ inject: true });
  const { ruleset, disabled } = P.apply(all, [demo]);
  const res = C.validate(ruleset, files(g));
  const issues = P.filterIssues(res.issues, disabled);
  const u1 = issues.filter(i => i.ruleId === 'U2026-01');
  assert.ok(u1.length > 0, '2025/07/01 後的新契約應找到');
  for (const i of u1) {
    const r = res.data.L.find(x => x._line === i.line);
    assert.strictEqual(r.addType, 'NEW'); assert.ok(r.startDate >= '20250701'); assert.strictEqual(r.digitalFlag, '0');
  }
  // 新格式：保留欄位第 1 碼填 Y。沒有更新包時是 L6101 錯誤；套用後通過
  const lines = g.L.split('\n'); lines[0] = lines[0].slice(0, 421) + 'Y000' + lines[0].slice(425);
  const f2 = { L: { name: g.names.L, text: lines.join('\n') }, D: { name: g.names.D, text: g.D } };
  assert.ok(C.validate(all, f2).issues.some(i => i.ruleId === 'L6101' && i.line === 1), '沒有更新包時應報 L6101');
  const after = P.filterIssues(C.validate(ruleset, f2).issues, disabled).filter(i => i.line === 1 && i.file === 'L');
  assert.deepStrictEqual(after.filter(i => ['L6101', 'U2026-01', 'U2026-02', 'demo-2026-01:digitalFlag'].includes(i.ruleId)).map(i => i.ruleId), []);
  assert.ok(ruleset.catalog.some(c => c.id === 'U2026-01' && c.level === '法規更新'));
});

test('新欄位允許的值：填其他值時以新欄位的代碼檢查報出', () => {
  const g = generate({});
  const L = all.layouts.L;
  const lines = g.L.split('\n'); lines[0] = lines[0].slice(0, 421) + 'X' + lines[0].slice(422);
  const { ruleset } = P.apply(all, [demo]);
  const res = C.validate(ruleset, { L: { name: g.names.L, text: lines.join('\n') }, D: { name: g.names.D, text: g.D } });
  assert.ok(res.issues.some(i => i.ruleId === 'demo-2026-01:digitalFlag' && i.line === 1));
  assert.strictEqual(L.recordLength, 425);
});

test('表單規則與停用：只有規則陣列也能匯入；找不到的檢核編號與超出範圍的欄位會被擋下', () => {
  assert.strictEqual(P.normalize([{ id: 'X1' }]).rules.length, 1);
  const v = P.validate({ disable: ['NOPE'], fields: [{ file: 'L', key: 'zz', name: 'zz', start: 425, len: 3 }] }, all);
  assert.strictEqual(v.errors.length, 2);
});

test('沒有更新包時結果與內建相同', () => {
  const g = generate({ inject: true });
  const a = C.validate(all, files(g)).issues.length;
  const { ruleset, disabled } = P.apply(all, []);
  assert.strictEqual(P.filterIssues(C.validate(ruleset, files(g)).issues, disabled).length, a);
});
