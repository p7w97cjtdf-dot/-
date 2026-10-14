const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const fin = require('../src/rulesets/finance.js');
const R = require('../src/recon.js');
const { generate } = require('../src/mock.js');

function runAll(g) {
  const res = C.validate(life, { L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D } });
  const roll = R.rollForward(res, g.prior);
  const ctl = R.controlRecon(res, g.control, roll.issues);
  const stmt = R.statement(g.statement, res);
  return { res, roll, ctl, stmt };
}

test('正確資料：控制總數全部一致、結轉無差異、財報平衡', () => {
  for (const seed of [20251014, 7, 42]) {
    const { roll, ctl, stmt } = runAll(generate({ seed }));
    assert.deepStrictEqual(ctl.rows.filter(r => r.status !== '一致').map(r => `${r.item} ${r.period} ${r.status}`), [], `seed ${seed}`);
    assert.deepStrictEqual(roll.issues.map(i => i.message), []);
    assert.deepStrictEqual(stmt.issues.map(i => i.message), []);
    const m = roll.movement;
    assert.deepStrictEqual(m.close, m.closeActual, '期初 + 異動 = 期末');
    assert.deepStrictEqual(m.open, m.priorClose, '期初 = 上年度期末');
  }
});

test('控制總數差異自動歸因 (時間差 / 定義差 / 待查)', () => {
  const g = generate({ inject: true });
  const { ctl } = runAll(g);
  for (const k of g.reconKey.filter(k => k.module === 'control')) {
    const row = ctl.rows.find(r => r.item === k.item && r.period === k.period);
    assert.ok(row, `${k.item} ${k.period} 應有對帳列`);
    assert.strictEqual(row.status, k.status, `${k.item} ${k.period}：${k.desc}；實際 ${row.status} ${row.explain}`);
    if (k.status === '時間差') assert.strictEqual(row.records.length, 1, '應指出造成差異的那一筆給付');
  }
});

test('期初/期末結轉：漏報、上年度不符、保額變動無異動', () => {
  const g = generate({ inject: true });
  const { roll } = runAll(g);
  for (const k of g.reconKey.filter(k => k.module === 'roll')) {
    assert.ok(roll.issues.some(i => i.ruleId === k.ruleId && i.policy === k.policy), `${k.ruleId} ${k.policy} ${k.desc}`);
  }
});

test('財報勾稽：停用科目、代碼錯置建議、數字對調連鎖不平、與給付明細時間差', () => {
  const g = generate({ inject: true });
  const { stmt } = runAll(g);
  for (const k of g.reconKey.filter(k => k.module === 'stmt')) {
    const i = stmt.issues.find(x => x.ruleId === k.ruleId && x.code === k.code);
    assert.ok(i, `${k.ruleId} ${k.code} ${k.desc}`);
    if (k.suggest) assert.strictEqual(i.suggest, k.suggest);
  }
  const s003 = stmt.issues.find(i => i.ruleId === 'S003' && i.code === '2303');
  assert.strictEqual(s003.chainRole, '根因');
  assert.strictEqual(stmt.issues.find(i => i.ruleId === 'S005').chainRole, '連帶');
  assert.match(s003.suggestion, /數字對調/);
  const s008 = stmt.issues.find(i => i.ruleId === 'S008');
  assert.strictEqual(s008.severity, 'warning');
  assert.strictEqual(s008.records.length, 1);
});

test('退件解碼：手冊編號、籠統代碼、行號都能定位到具體資料', () => {
  const g = generate({ inject: true });
  const { res, roll, ctl, stmt } = runAll(g);
  const ctx = { res, extra: roll.issues.concat(ctl.issues, stmt.issues), catalogs: [life.catalog, fin.catalog] };
  const a = R.decode('退件原因：L0612、30212_L1305 檢核未通過', ctx);
  assert.ok(a.findings.find(f => f.clue === '30212_L1305').matches.length > 0);
  // 手冊「肆、檢核程式項目及代碼表」的錯誤代碼：只列該代碼的問題 (landing 範例：定位 5 處)
  const m = R.decode('錯誤代碼 10400：數字資料範圍錯誤', ctx);
  assert.strictEqual(m.findings[0].kind, '手冊錯誤代碼');
  assert.ok(m.findings[0].matches.every(i => i.ruleId.startsWith('10400_')));
  assert.strictEqual(m.located, 5);
  assert.ok(m.findings[0].matches.some(i => i.ruleId === '10400_L0501' && i.line === 31 && i.fix.value === '000000000500000000'));
  // 手冊沒有的自訂代碼：依關鍵字推定類別
  const b = R.decode('Error E-0504: 欄位驗證失敗', ctx);
  assert.ok(b.findings[0].matches.length > 5, '籠統代碼應列出候選錯誤');
  assert.ok(b.findings[0].groups[0].items.length >= 1);
  const line = res.issues.find(i => i.line > 1 && i.file === 'L').line;
  const c = R.decode(`第 ${line} 行資料有誤`, ctx);
  assert.ok(c.findings[0].matches.every(i => i.line === line) && c.findings[0].matches.length > 0);
  const d = R.decode('資產負債表不平，請檢查', ctx);
  assert.ok(d.findings[0].matches.some(i => i.ruleId === 'S005'));
});

test('金額解析', () => {
  assert.strictEqual(R.parseAmount('1,234.5'), 123450);
  assert.strictEqual(R.parseAmount('-10'), -1000);
  assert.ok(Number.isNaN(R.parseAmount('12a')));
});
