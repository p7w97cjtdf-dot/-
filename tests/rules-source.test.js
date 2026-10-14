// rules/rules.js (由手冊整理) 與規則引擎一致：編號、嚴重度、欄位位置、代碼表
const test = require('node:test');
const assert = require('node:assert');
const src = require('../rules/rules.js');
const life = require('../src/rulesets/life.js');
const stats = require('../src/rule-stats.js').count();

test('每條引擎規則都在 rules.js，嚴重度相同，且有手冊頁碼或註明本工具補充', () => {
  const by = new Map(src.rules.concat(src.toolRules).map(r => [r.id, r]));
  assert.strictEqual(src.rules.length + src.toolRules.length, stats.total);
  for (const c of life.catalog) {
    const r = by.get(c.id);
    assert.ok(r, c.id);
    assert.strictEqual(r.severity, c.severity, c.id);
    assert.ok(r.name && r.category, c.id);
    assert.ok(r.source.doc === 'tool' ? r.source.note : r.source.page > 0, c.id);
  }
  const tool = src.rules.filter(r => r.source.doc === 'tool').map(r => r.id);
  assert.deepStrictEqual(tool, ['X001', 'X002', 'X003', 'X004']);
});

test('欄位定義與引擎的固定長度格式一致', () => {
  for (const fid of ['L', 'D']) {
    const lay = life.layouts[fid], f = src.fields[fid];
    assert.strictEqual(f.recordLength, lay.recordLength);
    assert.strictEqual(f.fields.length, lay.fields.length);
    for (const [i, x] of f.fields.entries()) {
      const y = lay.fields[i];
      assert.deepStrictEqual([x.no, x.key, x.start, x.len], [y.no, y.key, y.start, y.len], `${fid} ${x.name}`);
      assert.strictEqual(x.end, x.start + x.len - 1);
      assert.ok(x.page && x.page.page > 0, `${fid} ${x.name} 頁碼`);
    }
    assert.strictEqual(f.fields.at(-1).end, lay.recordLength);
  }
});
