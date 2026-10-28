const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const dsl = require('../src/rules-dsl.js');
const RI = require('../src/rule-import.js');
const S = require('../src/rule-samples.js');
const { generate } = require('../src/mock.js');

const files = g => ({ L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D } });
const all = S.converted.manual.concat(S.converted.company);

test('預先轉換的規則全部通過格式驗證', () => {
  for (const r of all) assert.deepStrictEqual(dsl.validateRule(r, life.layouts), [], r.id);
});

test('正確資料上不觸發任何轉換規則 (多組亂數)', () => {
  for (const seed of [20251014, 1, 7, 42, 99999]) {
    const hits = dsl.runRules(life, all, files(generate({ seed, policies: 200 })));
    assert.deepStrictEqual(hits.map(h => `${seed} ${h.ruleId} L${h.line}`), []);
  }
});

test('手冊條文轉成的規則，涵蓋內建規則找到的所有列', () => {
  const g = generate({ inject: true });
  const builtIn = C.validate(life, files(g)).issues;
  for (const id of ['24901_L0613', '25102_L1703', '25101_L1704', '25201_L2003', '25204_L2005', '25702_L4103', '30214_L1306']) {
    const rule = S.converted.manual.find(r => r.id === id);
    const a = new Set(dsl.runRules(life, [rule], files(g)).map(i => i.file + i.line));
    const b = new Set(builtIn.filter(i => i.ruleId === id).map(i => i.file + i.line));
    for (const x of b) assert.ok(a.has(x), `${id} 應找到 ${x}`);
    // 多找到的列，必須是內建規則也已標示錯誤的列 (同一筆資料的連帶症狀)
    const flagged = new Set(builtIn.map(i => i.file + i.line));
    for (const x of a) if (!b.has(x)) assert.ok(flagged.has(x), `${id} 在 ${x} 多出未被內建規則標示的錯誤`);
  }
});

test('公司內部規則找出內建檢核找不到的問題', () => {
  const g = generate({ inject: true });
  assert.ok(g.ruleKey.length >= 3);
  const builtIn = C.validate(life, files(g)).issues;
  const hits = dsl.runRules(life, S.converted.company, files(g));
  for (const k of g.ruleKey) {
    assert.ok(hits.some(h => h.ruleId === k.ruleId && h.policy.trim() === k.policy), `${k.ruleId} ${k.desc}`);
    assert.ok(!builtIn.some(i => i.policy.trim() === k.policy), `${k.policy} 不應被內建規則抓到`);
  }
});

test('套用後併入檢核結果 (extend)', () => {
  const g = generate({ inject: true });
  const rs = dsl.extend(life, S.converted.company);
  const res = C.validate(rs, files(g));
  assert.ok(res.issues.some(i => i.ruleId === 'U001' && i.category === '匯入規則'));
  assert.ok(rs.catalog.some(c => c.id === 'U007'));
  assert.strictEqual(res.issues.filter(i => !i.imported).length, C.validate(life, files(g)).issues.length);
});

test('審核：格式錯誤、疑似轉錯、與內建相同', () => {
  const clean = files(generate({}));
  const bad = [
    { id: 'B1', name: '不存在的欄位', file: 'L', assert: { field: 'salary', op: 'gt', value: 1 } },
    { id: 'B2', name: 'prev 用在單筆', file: 'L', scope: 'record', assert: { field: 'prev.sex', op: 'eq', ref: 'sex' } },
    { id: 'B3', name: '轉反了的規則', file: 'L', scope: 'record', when: { field: 'termType', op: 'eq', value: 'Y' }, assert: { field: 'term', op: 'ne', value: '999' } },
  ];
  const rv = RI.review(bad.concat([S.converted.manual[0], S.converted.company[0]]), { base: life, current: clean, clean });
  assert.deepStrictEqual(rv.map(r => r.status), ['格式錯誤', '格式錯誤', '疑似轉錯', '與內建相同', '可執行']);
  assert.ok(rv[0].errors[0].includes('salary'));
  assert.deepStrictEqual(rv.map(r => r.enabled), [false, false, false, false, true]);
});

test('轉換流程：切段、解析 AI 回覆 (含 code fence)、去重', async () => {
  const text = S.company + '\n\n' + 'x'.repeat(9000);
  assert.ok(RI.chunk(text).length >= 2);
  let calls = 0;
  const fakeAI = async prompt => {
    calls++;
    assert.match(prompt, /sumInsuredTwd｜欄59 保險金額\(臺幣金額\)/);
    return '```json\n' + JSON.stringify({ rules: S.converted.company, unconvertible: S.converted.companyUnconvertible }) + '\n```';
  };
  const out = await RI.convert(text, fakeAI);
  assert.strictEqual(out.parts, calls);
  assert.strictEqual(out.rules.length, S.converted.company.length, '重複的 id 只保留一條');
  assert.ok(out.unconvertible.length >= 1);
  const broken = await RI.convert('一條規則', async () => '抱歉，我無法');
  assert.strictEqual(broken.failures.length, 1);
});

test('中文說明', () => {
  const d = dsl.describe(S.converted.company[1], life.layouts);
  assert.strictEqual(d.when, '保險期間別 = 「Y」');
  assert.strictEqual(d.assert, '足歲(出生日期，保險期間起日) ≤ 75');
  const p = dsl.describe(S.converted.company[5], life.layouts);
  assert.match(p.assert, /相差天數\(上一筆退保日期，加保日期\) ≤ 730/);
});

test('錯誤解答 CSV：認得格式、解析每一項，並和檢查結果對照', () => {
  const W = require('../src/workbook.js');
  const csv = '分類,資料檔,檢核編號,保單／案例,預期問題說明\n內建檢核錯誤,L,23900_L0802,P250000001/A01,出生日期不存在\n對帳／結轉,control,,,6/30 給付計入 7 月\n內建檢核錯誤,L,F003,,檔案中間有空白行\n';
  const aoa = require('../src/core.js').parseCSV(csv);
  assert.ok(W.isAnswerKey(aoa[0]));
  assert.ok(!W.isAnswerKey(['公司代號', '保單編號', '保單編號序號']), '申報資料的標題不是錯誤解答');
  const key = W.answerKey(aoa);
  assert.deepStrictEqual(key.map(k => [k.ruleId, k.policy]), [['23900_L0802', 'P250000001/A01'], ['', ''], ['F003', '']]);
  const r = W.checkAnswers(key, [{ ruleId: '23900_L0802', policy: 'P250000001/A01  ' }, { ruleId: 'F003' }]);
  assert.deepStrictEqual([r.found, r.total, r.manual], [2, 2, 1]);
  // 保單不同就不算找到
  assert.strictEqual(W.checkAnswers(key, [{ ruleId: '23900_L0802', policy: 'P250000101/A01' }]).found, 0);
});
