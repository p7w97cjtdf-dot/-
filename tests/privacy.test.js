// 送給 Claude 的內容不得含姓名、證號、地址；單筆解釋不送整筆明細
const test = require('node:test');
const assert = require('node:assert');
const C = require('../src/core.js');
const life = require('../src/rulesets/life.js');
const report = require('../src/report.js');
const R = require('../src/recon.js');
const M = require('../src/master.js');
const P = require('../src/ai-payload.js');
const { generate } = require('../src/mock.js');

const g = generate({ inject: true });
const res = C.validate(life, { L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D } });
const cust = M.customers(res, g.customers), prod = M.products(res, g.products);
// 與網頁相同：落在承保檔的客戶/商品問題併入明細問題清單
res.issues = res.issues.concat(cust.issues.filter(i => i.file === 'L'), prod.issues.filter(i => i.file === 'L'));
const recon = { cust, prod };
const ctx = P.context(res, recon);

test('遮罩函式', () => {
  const c = { names: ['王小明'], ids: new Set(['A123456789']), policies: new Set(['P250000001']) };
  const s = P.mask('要保人 王小明 證號 A123456789 B287654321，保單 P250000001，地址 臺北市信義區松仁路100號', c);
  assert.ok(!s.includes('王小明') && s.includes('王○明'));
  assert.ok(!s.includes('A123456789') && !s.includes('B287654321') && (s.match(/\*\*\*/g) || []).length >= 2);
  assert.ok(s.includes('P250000001'), '保單號碼不應被遮罩');
  assert.ok(s.includes('臺北市信義區[已遮蔽地址]') && !s.includes('松仁路'));
});

test('試用資料確實含個資 (測試前提)', () => {
  const raw = JSON.stringify(cust.issues.map(i => [i.message, i.value]));
  assert.ok(P.leaks(raw, ctx).length > 0);
});

test('AI 根因摘要送出內容不含姓名、證號、地址', () => {
  const s = P.summaryData({ report }, life, res, recon);
  assert.deepStrictEqual(P.leaks(s, ctx), []);
  assert.ok(s.includes('C00'), '仍包含客戶資料問題的檢核編號');
});

test('單筆解釋只送相關欄位且已遮罩', () => {
  const issues = res.issues.filter(i => i.file === 'L' || i.file === 'D');
  for (const i of issues) {
    const o = P.explainData(life, res, i, recon);
    assert.deepStrictEqual(P.leaks(JSON.stringify(o), ctx), [], i.ruleId);
    const fields = o.fields.split('；').map(x => x.split('=')[0].replace(/^\d+\./, ''));
    const lay = life.layouts[i.file];
    assert.ok(fields.length < lay.fields.length / 2 || o.fields.startsWith('('), `${i.ruleId} 不應送整筆`);
    if (!(i.fields || []).includes('idNo')) assert.ok(!fields.includes('證件編號'));
    if (!(i.fields || []).includes('birthDate')) assert.ok(!fields.includes('出生日期'));
  }
});

test('退件解碼送出內容已遮罩', () => {
  const dec = R.decode('C009 C001 C004 錯誤，請修正', { rs: life, res, extra: cust.issues });
  const o = P.decodeData('C009 退件', dec, res, recon);
  assert.deepStrictEqual(P.leaks(o.text + o.brief, ctx), []);
});
