// 規則 DSL：缺值的判定、比較的型態與精度、三值邏輯 (P0)
const test = require('node:test');
const assert = require('node:assert');
const dsl = require('../src/rules-dsl.js');
const life = require('../src/rulesets/life.js');
const C = require('../src/core.js');
const L = life.layouts.L;
const e = (c, rec, lay) => dsl.evalCond(c, { rec, lay });

test('缺欄位：notBlank 不會通過；各運算對「欄位不存在」都是無法判定 (null)', () => {
  assert.strictEqual(e({ field: 'x', op: 'notBlank' }, {}), null);
  for (const op of ['isBlank', 'notBlank', 'isZero', 'notZero', 'isDate']) assert.strictEqual(e({ field: 'x', op }, {}), null, op);
  for (const op of ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'startsWith', 'matches']) assert.strictEqual(e({ field: 'x', op, value: '1' }, {}), null, op);
  assert.strictEqual(e({ field: 'x', op: 'in', values: ['1'] }, {}), null);
  // 繼承來的屬性不算資料欄位
  assert.strictEqual(e({ field: 'x', op: 'notBlank' }, Object.create({ x: 'A' })), null);
  assert.strictEqual(e({ field: 'toString', op: 'notBlank' }, {}), null);
  assert.strictEqual(e({ field: '__proto__', op: 'notBlank' }, {}), null);
  // 不是物件的資料
  assert.strictEqual(dsl.evalCond({ field: 'x', op: 'notBlank' }, { rec: null }), null);
  // 參照的欄位不存在
  assert.strictEqual(e({ field: 'a', op: 'eq', ref: 'b' }, { a: '1' }), null);
});

test('空字串、null、undefined 與合法的 0', () => {
  for (const v of [null, undefined, '', '   ']) {
    assert.strictEqual(e({ field: 'x', op: 'isBlank' }, { x: v }), true, String(v));
    assert.strictEqual(e({ field: 'x', op: 'notBlank' }, { x: v }), false, String(v));
    assert.strictEqual(e({ field: 'x', op: 'isZero' }, { x: v }), null, `isZero ${v}`);
    assert.strictEqual(e({ field: 'x', op: 'notZero' }, { x: v }), null, `notZero ${v}`);
    assert.strictEqual(e({ field: 'x', op: 'gt', value: 0 }, { x: v }), null, `gt ${v}`);
  }
  assert.strictEqual(e({ field: 'x', op: 'eq', value: '1' }, { x: null }), null);
  for (const v of [0, '0', '000', '0.00']) {
    assert.strictEqual(e({ field: 'x', op: 'notBlank' }, { x: v }), true, String(v));
    assert.strictEqual(e({ field: 'x', op: 'isZero' }, { x: v }), true, String(v));
    assert.strictEqual(e({ field: 'x', op: 'notZero' }, { x: v }), false, String(v));
  }
  assert.strictEqual(e({ field: 'x', op: 'notZero' }, { x: '007' }), true);
  // 空白的文字欄位仍可做文字比較
  assert.strictEqual(e({ field: 'x', op: 'eq', value: '' }, { x: '   ' }), true);
});

test('長整數不失真：9007199254740992 與 9007199254740993 不相等', () => {
  assert.strictEqual(e({ field: 'x', op: 'eq', value: '9007199254740993' }, { x: '9007199254740992' }), false);
  assert.strictEqual(e({ field: 'x', op: 'lt', value: '9007199254740993' }, { x: '9007199254740992' }), true);
  // 數字欄位 (保險金額，15 碼) 也用精確比較
  assert.strictEqual(e({ field: 'sumInsuredOrig', op: 'eq', value: '900719925474099300' }, { sumInsuredOrig: '900719925474099200' }, L), false);
  // 超出支援範圍或不是有限數字：無法判定，不靜默失真
  assert.strictEqual(e({ field: 'x', op: 'gt', value: 1e21 }, { x: '5' }), null);
  assert.strictEqual(e({ field: 'x', op: 'gt', value: Infinity }, { x: '5' }), null);
  assert.strictEqual(e({ field: 'x', op: 'gt', value: NaN }, { x: '5' }), null);
  assert.strictEqual(e({ field: 'x', op: 'gt', value: 5 }, { x: '1'.repeat(60) }), null);
});

test('代碼保留前導零；數字欄位依數值比較', () => {
  // 沒有欄位定義：兩邊都是文字 → 文字比較，'001' ≠ '1'
  assert.strictEqual(e({ field: 'x', op: 'eq', value: '1' }, { x: '001' }), false);
  assert.strictEqual(e({ field: 'x', op: 'in', values: ['1', '2'] }, { x: '001' }), false);
  // 有代碼表的欄位 (性別、幣別)：文字比較
  const code = L.fields.find(f => f.codes && f.type === '9');
  if (code) assert.strictEqual(e({ field: code.key, op: 'eq', value: '1' }, { [code.key]: '01' }, L), false, code.key);
  const xf = L.fields.find(f => f.type === 'X' && !f.codes);
  assert.strictEqual(e({ field: xf.key, op: 'eq', value: '1' }, { [xf.key]: '001' }, L), false, xf.key);
  // 英數字欄位：固定長度補的空白不算
  assert.strictEqual(e({ field: xf.key, op: 'eq', value: 'AB' }, { [xf.key]: 'AB   ' }, L), true);
  // 數字欄位 (9、沒有代碼表)：'001' = '1'
  const nf = L.fields.find(f => f.type === '9' && !f.codes);
  assert.strictEqual(e({ field: nf.key, op: 'eq', value: '1' }, { [nf.key]: '001' }, L), true, nf.key);
  // 指定碼位 (pos) 取出來的是文字
  assert.strictEqual(e({ field: nf.key, op: 'eq', value: '0', pos: [1, 2] }, { [nf.key]: '001' }, L), false);
});

test('合法的數值比較不受影響', () => {
  assert.strictEqual(e({ field: 'x', op: 'gt', value: 5 }, { x: '10' }), true);
  assert.strictEqual(e({ field: 'x', op: 'gt', value: '9' }, { x: '65' }), true, '兩邊都是數字字串時大小比較用數值');
  assert.strictEqual(e({ field: 'x', op: 'lte', value: 1.5 }, { x: '1.50' }), true);
  assert.strictEqual(e({ field: 'x', op: 'eq', value: 5 }, { x: '005' }), true, '規則的值是數字時用數值相等');
  assert.strictEqual(e({ field: 'x', op: 'lt', value: '20250101' }, { x: '20241231' }), true, '日期');
  // 函式：金額以元計 (精確小數)、年齡、天數
  assert.strictEqual(e({ field: { fn: 'amount', args: ['a'] }, op: 'eq', value: '1234567890123.45' }, { a: '123456789012345' }), true);
  assert.strictEqual(e({ field: { fn: 'amount', args: ['a'] }, op: 'eq', value: 1.5 }, { a: '150' }), true);
  assert.strictEqual(e({ field: { fn: 'age', args: ['b', 'd'] }, op: 'gte', value: 65 }, { b: '19500101', d: '20250101' }), true);
  assert.strictEqual(e({ field: { fn: 'days', args: ['a', 'b'] }, op: 'eq', value: 31 }, { a: '20250101', b: '20250201' }), true);
  assert.strictEqual(e({ field: { fn: 'age', args: ['b', 'd'] }, op: 'gte', value: 65 }, { b: '19500230', d: '20250101' }), null, '不合法的日期無法判定');
  assert.strictEqual(e({ field: 'end', op: 'eq', ref: { fn: 'addYearsMinusDay', args: ['start', 'n'] } }, { end: '20341231', start: '20250101', n: '010' }), true);
});

test('三值邏輯：all / any / not 的組合', () => {
  const T = { field: 't', op: 'eq', value: '1' }, F = { field: 't', op: 'eq', value: '2' }, U = { field: 'nope', op: 'eq', value: '1' }, rec = { t: '1' };
  const cases = [
    [{ all: [T, T] }, true], [{ all: [T, F] }, false], [{ all: [T, U] }, null], [{ all: [F, U] }, false], [{ all: [U, F] }, false],
    [{ any: [F, F] }, false], [{ any: [F, T] }, true], [{ any: [F, U] }, null], [{ any: [U, T] }, true],
    [{ not: T }, false], [{ not: F }, true], [{ not: U }, null],
    [{ all: [T, { any: [F, U] }] }, null], [{ any: [{ all: [T, F] }, { not: F }] }, true], [{ not: { all: [T, U] } }, null],
  ];
  for (const [c, want] of cases) assert.strictEqual(e(c, rec), want, JSON.stringify(c));
});

test('無法判定的筆數反映在統計 (不算通過)，舊範例規則的結果不變', () => {
  const rule = { id: 'U-T1', file: 'L', name: '測試', assert: { field: 'sumInsuredOrig', op: 'gt', value: '0' } };
  const rs = dsl.extend(life, [rule]);
  const text = require('fs').readFileSync(require('path').join(__dirname, '..', 'samples', 'clean', 'LFL01_2025.txt'), 'utf8');
  // 保額空白的一筆：不是通過，而是無法判定
  const lines = text.split('\n'); const f = L.field('sumInsuredOrig');
  lines[0] = lines[0].slice(0, f.start - 1) + ' '.repeat(f.len) + lines[0].slice(f.start - 1 + f.len);
  C.validate(rs, { L: { name: 'LFL01_2025.txt', text: lines.join('\n') } });
  assert.strictEqual(rs.dslStats.unjudged['U-T1'], 1);
  const COV = require('../src/coverage.js');
  const sc = COV.scope(['L'], { unjudged: rs.dslStats.unjudged });
  assert.ok(!sc.safe && sc.warn.some(w => w.kind === 'unjudged'), '檢查範圍要標示無法判定');
});

test('規則格式驗證：null、陣列、錯誤型態回傳驗證錯誤，不丟例外', () => {
  for (const bad of [null, undefined, [], 'rule', 42, true, () => 1, new Date(), Object.create({ id: 'x' })]) {
    let errs; assert.doesNotThrow(() => { errs = dsl.validateRule(bad, life.layouts); }, String(bad));
    assert.ok(Array.isArray(errs) && errs.length, String(bad));
  }
  assert.deepStrictEqual(dsl.validateRule({ id: 'A', file: 'L', assert: { field: 'policyNo', op: 'notBlank' } }, null), ['缺少資料格式定義，無法驗證規則']);
  // 條件節點是 null 或陣列
  for (const c of [null, [], [{ field: 'policyNo', op: 'notBlank' }], 'x'])
    assert.ok(dsl.validateRule({ id: 'A', file: 'L', assert: c }, life.layouts).length, JSON.stringify(c));
});

test('規則格式驗證：all／any／not／單一條件只能擇一，混合的節點被拒絕', () => {
  const leaf = { field: 'policyNo', op: 'notBlank' };
  const v = c => dsl.validateRule({ id: 'A', file: 'L', assert: c }, life.layouts);
  assert.deepStrictEqual(v(leaf), []);
  assert.deepStrictEqual(v({ all: [leaf, leaf] }), []);
  for (const c of [{ all: [leaf], field: 'policyNo', op: 'notBlank' }, { all: [leaf], any: [leaf] }, { not: leaf, op: 'notBlank', field: 'policyNo' }, { all: [leaf], extra: 1 }, { not: leaf, x: 1 }, { field: 'policyNo', op: 'notBlank', bogus: 1 }, {}])
    assert.ok(v(c).length, JSON.stringify(c));
  assert.match(v({ all: [leaf], any: [leaf] }).join(), /只能擇一/);
});

test('規則格式驗證：過深、過寬、太長、危險鍵名、繼承屬性、不支援的函式都被拒絕', () => {
  const leaf = { field: 'policyNo', op: 'notBlank' };
  const v = (c, extra) => dsl.validateRule(Object.assign({ id: 'A', file: 'L', assert: c }, extra), life.layouts);
  let deep = leaf; for (let i = 0; i < 12; i++) deep = { not: deep };
  assert.match(v(deep).join(), /巢狀超過/);
  assert.match(v({ any: Array(300).fill(leaf) }).join(), /超過 200 個/);
  assert.match(v({ field: 'policyNo', op: 'in', values: Array(201).fill('A') }).join(), /values 超過/);
  assert.match(v({ field: 'policyNo', op: 'eq', value: 'x'.repeat(501) }).join(), /500 字以內/);
  assert.match(v(leaf, { message: 'x'.repeat(600) }).join(), /message/);
  assert.match(v({ field: 'policyNo', op: 'eq', value: Infinity }).join(), /有限的數字/);
  assert.match(v({ field: 'policyNo', op: 'eq', value: { a: 1 } }).join(), /value 只能是/);
  assert.match(v({ field: 'constructor', op: 'notBlank' }).join(), /格式不正確/);
  assert.match(v({ field: 'policyNo', op: 'toString', value: '1' }).join(), /不支援的運算/);
  assert.match(v({ field: { fn: 'constructor', args: ['policyNo'] }, op: 'eq', value: 1 }).join(), /不支援的函式/);
  assert.match(v({ field: { fn: 'num', args: ['policyNo'], extra: 1 }, op: 'eq', value: 1 }).join(), /只能有 fn 與 args/);
  let fn = 'birthDate'; for (let i = 0; i < 5; i++) fn = { fn: 'num', args: [fn] };
  assert.match(v({ field: fn, op: 'eq', value: 1 }).join(), /函式巢狀/);
  assert.match(dsl.validateRule(JSON.parse('{"id":"A","file":"L","assert":{"field":"policyNo","op":"notBlank"},"__proto__":{"x":1}}'), life.layouts).join(), /不允許的鍵名/);
  assert.match(v(JSON.parse('{"field":"policyNo","op":"notBlank","__proto__":{"all":[]}}')).join(), /不允許的鍵名/);
  assert.match(v(leaf, { unknownKey: 1 }).join(), /不認得的規則屬性/);
  assert.match(dsl.validateRule({ id: 'A', file: 'constructor', assert: leaf }, life.layouts).join(), /file 應為/);
  // 一整批：有一條不對就整批不通過
  const ok = { id: 'A', file: 'L', assert: leaf }, bad = { id: 'B', file: 'L', assert: { all: [leaf], op: 'x' } };
  assert.strictEqual(dsl.validateAll([ok], life.layouts).ok, true);
  assert.strictEqual(dsl.validateAll([ok, bad], life.layouts).ok, false);
  assert.strictEqual(dsl.validateAll([ok, ok], life.layouts).ok, false, '編號重複');
  assert.strictEqual(dsl.validateAll(Array(501).fill(ok), life.layouts).ok, false);
  assert.strictEqual(dsl.validateAll(null, life.layouts).ok, false);
});

test('更新包：整包驗證後才套用，有一項不對整包都不套用', () => {
  const P = require('../src/rule-packs.js');
  const leaf = { field: 'policyNo', op: 'notBlank' };
  const good = { id: 'g', name: '好的包', rules: [{ id: 'U-G1', file: 'L', name: 'x', assert: leaf }], disable: ['10400_L0201'] };
  const mixed = { id: 'm', name: '有錯的包', rules: [{ id: 'U-M1', file: 'L', name: 'x', assert: leaf }, { id: 'U-M2', file: 'L', name: 'y', assert: { all: [leaf], op: 'eq' } }], disable: ['10400_L0501'] };
  const out = P.apply(life, [good, mixed]);
  assert.ok(out.ruleset.catalog.some(c => c.id === 'U-G1'));
  assert.ok(!out.ruleset.catalog.some(c => c.id === 'U-M1'), '有錯的包裡正確的規則也不套用');
  assert.ok(out.disabled.has('10400_L0201') && !out.disabled.has('10400_L0501'), '有錯的包的停用清單也不套用');
  assert.deepStrictEqual(out.rejected.map(r => r.id), ['m']);
  // 不是物件、危險鍵名、太多規則
  for (const bad of [null, 'x', 5, JSON.parse('{"id":"p","__proto__":{"rules":[]}}'), { id: 'p', rules: Array(501).fill({ id: 'x', file: 'L', assert: leaf }) }])
    assert.strictEqual(P.validate(bad, life, []).ok, false, JSON.stringify(bad && bad.id));
  // 原型不會被改
  const n = P.normalize(JSON.parse('{"id":"p","__proto__":{"polluted":1}}'));
  assert.strictEqual(n.polluted, undefined); assert.strictEqual({}.polluted, undefined);
});
