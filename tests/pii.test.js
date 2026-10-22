// 個資遮罩 (src/pii.js)：送給外部 AI 之前的脫敏規則與最後關卡
const test = require('node:test');
const assert = require('node:assert');
const pii = require('../src/pii.js');
const C = require('../src/core.js');
const all = require('../src/rulesets/index.js');
const P = require('../src/ai-payload.js');
const report = require('../src/report.js');
const M = require('../src/master.js');
const { generate } = require('../src/mock.js');
const ext = require('../src/mock-ext.js');

const r = t => pii.redact(t).text;

test('身分證與居留證：A123****89，大小寫與新舊式居留證都遮罩', () => {
  assert.strictEqual(r('證號 A123456789'), '證號 A123****89');
  assert.strictEqual(r('b234567890'), 'b234****90');
  assert.strictEqual(r('居留證 AB12345678、A800000014'), '居留證 AB12****78、A800****14');
  assert.strictEqual(r('A1234567890'), 'A1234567890', '11 碼不是證號');
});

test('姓名：資料中已知的姓名與「姓名：」等標示後的姓名', () => {
  assert.strictEqual(pii.redact('聯絡 陳大文 先生', { names: ['陳大文'] }).text, '聯絡 陳○文 先生');
  assert.strictEqual(r('姓名：王小明，要保人：林美'), '姓名：王○明，要保人：林○');
  assert.strictEqual(r('被保險人身份代號表'), '被保險人身份代號表', '沒有分隔符號的欄位名稱不誤判');
});

test('地址：保留縣市區，其餘遮蔽；沒有縣市的路名門牌也遮蔽', () => {
  assert.strictEqual(r('住 臺北市信義區松仁路100號5樓。'), '住 臺北市信義區[已遮蔽地址]。');
  const road = r('寄到中山北路二段45巷3弄12號之1，謝謝');
  assert.ok(road.includes('[已遮蔽地址]') && !/中山北路|45巷|12號|之1/.test(road) && road.endsWith('，謝謝'), road);
  assert.strictEqual(r('通路別代碼錯誤、銷售通路'), '通路別代碼錯誤、銷售通路', '「通路」不是地址');
});

test('電話、Email、卡號與帳號', () => {
  assert.strictEqual(r('手機 0912-345-678 或 0912345678'), '手機 0912***678 或 0912***678');
  assert.strictEqual(r('+886 912 345 678'), '0912***678');
  assert.strictEqual(r('電話 (02)2345-6789 轉 123'), '電話 (02)****6789');
  assert.strictEqual(r('02-2345-6789'), '(02)****6789');
  assert.strictEqual(r('wang.da@example.com.tw'), 'w***@example.com.tw');
  assert.strictEqual(r('卡號 4111 1111 1111 1234'), '卡號 ****-****-****-1234');
  assert.strictEqual(r('匯款帳號：012-3456-7890123'), '匯款帳號：[已遮蔽帳號]');
});

test('不誤遮申報資料的一般數值：金額、日期、代碼、檢核編號', () => {
  const s = '金額 000000001000000，日期 20250131、2026-10-08，商品 21003M11A00，檢核 30212_L1305、24801_L1303，職業 01010010';
  assert.strictEqual(r(s), s);
});

test('保單號碼、賠案號碼外觀像證號：出現在申報資料中時不遮罩', () => {
  const ctx = { exempt: new Set(['P250000001', 'K202500001']) };
  assert.strictEqual(pii.redact('保單 P250000001 賠案 K202500001 證號 A123456789', ctx).text, '保單 P250000001 賠案 K202500001 證號 A123****89');
});

test('最後關卡：遮罩後掃描為 0；仍無法遮蔽時停止送出', () => {
  const g = pii.guard('姓名：王小明 0912-345-678 A123456789 臺北市大安區復興南路一段1號');
  assert.deepStrictEqual(pii.scan(g.text), []);
  assert.strictEqual(g.counts.id, 1); assert.strictEqual(g.counts.phone, 1); assert.strictEqual(g.counts.name, 1); assert.strictEqual(g.counts.address, 1);
  // 資料中登記的姓名若遮罩後仍原樣出現 (例如名字本身含遮罩符號)，不送出
  assert.throws(() => pii.guard('客戶 王○明', { names: ['王○明'] }), e => e.code === 'pii_blocked');
});

test('實際送給 AI 的內容 (三個險種＋客戶資料)：遮罩後掃描不到任何個資', () => {
  const g = generate({ inject: true }), c = ext.generateCancer({ inject: true }), a = ext.generateAccident({ inject: true });
  const res = C.validate(all, { L: { name: g.names.L, text: g.L }, D: { name: g.names.D, text: g.D }, CL: { name: c.names.CL, text: c.CL }, CD: { name: c.names.CD, text: c.CD }, AL: { name: a.names.AL, text: a.AL }, AD: { name: a.names.AD, text: a.AD } });
  const cust = M.customers(res, g.customers); res.issues = res.issues.concat(cust.issues.filter(i => i.file === 'L'));
  const recon = { cust }, ctx = P.context(res, recon);
  const sum = P.summaryData({ report }, all, res, recon);
  assert.deepStrictEqual(pii.scan(sum, ctx), []);
  for (const i of res.issues.slice(0, 300)) assert.deepStrictEqual(pii.scan(JSON.stringify(P.explainData(all, res, i, recon)), ctx), [], i.ruleId);
  // 保單號碼仍保留 (AI 才能對應到哪一筆)
  assert.ok(res.issues.some(i => i.policy && sum.includes(i.policy.split('/')[0].trim())));
  // 遮罩後再經最後關卡，不會被擋
  assert.doesNotThrow(() => pii.guard(sum, ctx));
});
