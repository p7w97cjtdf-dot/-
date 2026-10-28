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

test('身分證與居留證：完全替換成 ***，大小寫與新舊式居留證都遮罩', () => {
  assert.strictEqual(r('證號 A123456789'), '證號 ***');
  assert.strictEqual(r('b234567890'), '***');
  assert.strictEqual(r('居留證 AB12345678、A800000014'), '居留證 ***、***');
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
  assert.strictEqual(r('手機 0912-345-678 或 0912345678'), '手機 *** 或 ***');
  assert.strictEqual(r('+886 912 345 678'), '***');
  assert.strictEqual(r('電話 (02)2345-6789 轉 123'), '電話 ***');
  assert.strictEqual(r('02-2345-6789'), '***');
  assert.strictEqual(r('wang.da@example.com.tw'), '***');
  assert.strictEqual(r('卡號 4111 1111 1111 1234'), '卡號 ****-****-****-1234');
  assert.strictEqual(r('匯款帳號：012-3456-7890123'), '匯款帳號：[已遮蔽帳號]');
});

test('不誤遮申報資料的一般數值：金額、日期、代碼、檢核編號', () => {
  const s = '金額 000000001000000，日期 20250131、2026-10-08，商品 21003M11A00，檢核 30212_L1305、24801_L1303，職業 01010010';
  assert.strictEqual(r(s), s);
});

test('保單號碼、賠案號碼外觀像證號：出現在申報資料中時不遮罩', () => {
  const ctx = { exempt: new Set(['P250000001', 'K202500001']) };
  assert.strictEqual(pii.redact('保單 P250000001 賠案 K202500001 證號 A123456789', ctx).text, '保單 P250000001 賠案 K202500001 證號 ***');
});

// 變形寫法：全形、半形／全形混用、字元間穿插空白或符號、看不見的字元，送給 AI 前都要完全替換成 ***
const IDS = [
  'A123456789', 'a123456789', 'Ａ１２３４５６７８９', 'ａ１２３４５６７８９', 'Ａ1２3４5６7８9', 'A１２３４５６７８９',
  'A 123 456 789', 'A-123-456-789', 'A.123.456.789', 'A_123_456_789', 'A/123/456/789', 'A123 456 789', 'A123-456-789', 'A 123456789', 'A12345 6789',
  'A 1 2 3 4 5 6 7 8 9', 'A-1-2-3-4-5-6-7-8-9', 'A*1*2*3*4*5*6*7*8*9', 'A.1.2.3.4.5.6.7.8.9', 'A｜1｜2｜3｜4｜5｜6｜7｜8｜9', 'A•1•2•3•4•5•6•7•8•9',
  'Ａ　１２３　４５６　７８９', 'Ａ－１２３－４５６－７８９', 'A—123—456—789', 'A–123–456–789', 'A\u200b123456789', 'A1\u200c2\u200d3456789', 'A\ufeff123\u00ad456789',
  'B287654321', 'AB12345678', 'ＡＢ１２３４５６７８', 'AB 1234 5678', 'A800000014', 'A 800 000 014', 'AC 12345678',
];
const MOBILES = [
  '0912345678', '０９１２３４５６７８', '０9１2３4５6７8', '0912-345-678', '0912 345 678', '0912.345.678', '0912_345_678', '0912/345/678', '0912 345678',
  '09 12 34 56 78', '0 9 1 2 3 4 5 6 7 8', '0-9-1-2-3-4-5-6-7-8', '0*9*1*2*3*4*5*6*7*8', '０　９１２　３４５　６７８', '０９１２－３４５－６７８', '0912—345—678',
  '0912\u200b345678', '+886912345678', '+886 912 345 678', '+886-912-345-678', '886912345678', '＋８８６９１２３４５６７８', '+886 9 1 2 3 4 5 6 7 8', '+886-9-12-345-678',
];
const plain = s => s.replace(/\\u([0-9a-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
test('身分證字號變形：全形、混用、穿插空白或符號、看不見的字元都替換成 ***', () => {
  for (const raw of IDS.map(plain)) {
    for (const t of [raw, `證號：${raw}，`, `要保人證號 ${raw} 請確認`, `{"證號":"${raw}"}`]) {
      const out = r(t);
      assert.ok(out.includes('***'), `沒有遮蔽：${JSON.stringify(t)} → ${JSON.stringify(out)}`);
      assert.doesNotMatch(out.replace(/\s|[-._/*|•]/g, ''), /[A-Za-z][1289A-D]\d{8}/i, t);
      assert.doesNotMatch(out, /\d{4}/, `還留有證號的數字：${JSON.stringify(t)} → ${JSON.stringify(out)}`);
      assert.deepStrictEqual(pii.scan(out), [], t);
    }
  }
});
test('手機號碼變形：全形、混用、穿插空白或符號、國碼都替換成 ***', () => {
  for (const raw of MOBILES.map(plain)) {
    for (const t of [raw, `手機：${raw}，`, `聯絡電話 ${raw} 晚上可打`, `{"tel":"${raw}"}`]) {
      const out = r(t);
      assert.ok(out.includes('***'), `沒有遮蔽：${JSON.stringify(t)} → ${JSON.stringify(out)}`);
      assert.doesNotMatch(out, /\d{3}/, `還留有手機的數字：${JSON.stringify(t)} → ${JSON.stringify(out)}`);
      assert.deepStrictEqual(pii.scan(out), [], t);
    }
  }
});
test('姓名、地址、市話、Email 變形也遮蔽', () => {
  const ctx = { names: ['王小明'] };
  for (const t of ['王小明', '王 小 明', '王　小　明', '王.小.明', '王*小*明', '王\u200b小明'].map(plain)) assert.strictEqual(pii.redact(`客戶 ${t} 先生`, ctx).text, '客戶 王○明 先生', t);
  for (const t of ['姓名：王 小 明', '姓名：王.小.明', '姓名：王・小・明', '姓名：王小明']) assert.strictEqual(r(t), '姓名：王○明', t);
  for (const t of ['臺北市信義區松仁路100號5樓', '臺 北 市 信 義 區 松 仁 路 100 號', '臺北市信義區松仁路１００號', '松仁路 100 號', '松 仁 路 1 0 0 號']) {
    const out = r(`地址 ${t}。`); assert.ok(out.includes('[已遮蔽地址]') && !/松仁路|松仁|100|１００/.test(out), `${t} → ${out}`);
  }
  for (const t of ['(02)2345-6789', '(02) 2345 6789', '02-2345-6789', '02.2345.6789', '（０２）２３４５－６７８９', '０２－２３４５－６７８９']) assert.strictEqual(r(`電話 ${t}`), '電話 ***', t);
  for (const t of ['wang@example.com', 'wang＠example．com', 'ｗａｎｇ＠ｅｘａｍｐｌｅ．ｃｏｍ', 'wang @ example . com', 'wang [at] example [dot] com', 'wang(at)example(dot)com', 'wang{at}example.com.tw', 'wang [@] example [.] com']) assert.strictEqual(r(`信箱 ${t} 謝謝`), '信箱 *** 謝謝', t);
});
test('變形比對不誤遮申報資料：兩個連在一起的日期、金額、保單號碼', () => {
  for (const t of ['生效日 0911231 1001231', '期間 0910101 0911231', '金額 0912345 678000', '共 1,234,567,890 元', '23900_L0802 1231231', '保費 09123 45678']) assert.strictEqual(r(t), t, t);
  const ctx = { exempt: new Set(['P250000001']) };
  for (const t of ['P250000001', 'P 250 000 001', 'Ｐ２５００００００１']) assert.ok(!pii.redact(`保單 ${t}`, ctx).text.includes('***'), t);
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

// 9 筆範例 (a–f)：每一筆送給 AI 前都要被遮罩；遮罩後再掃描為 0
const NINE = [
  { what: 'a 看不見的空白字元夾在身分證中間', text: '證號 A1​2345‍6789', gone: /A1.?2345.?6789|23456789/ },
  { what: 'a 特殊連字號、破折號的手機', text: '手機 0912‑345—678、0912−345–678', gone: /345.?678/ },
  { what: 'a 全形 ＠ ． 與 [at] (dot) 的 Email', text: '信箱 wang＠example．com、lin[at]mail[dot]com、chen (at) corp (dot) com.tw', gone: /wang|lin\b|chen|example|corp/ },
  { what: 'b 沒寫「生日」：民國／西元年月日後面接「生」', text: '王先生民國79年1月1日生，配偶1990/02/03生，子女0950405 生', gone: /79年1月1日|1990\/02\/03|0950405/ },
  { what: 'b 「出生於」後面的日期', text: '被保人出生於 79.01.01，另一位出生於1985年12月31日', gone: /79\.01\.01|1985年12月31日/ },
  { what: 'c 被保險人／要保人／受益人後面的姓名 (有沒有冒號都算)', text: '被保險人王小明投保，要保人林美華，受益人：陳大文', gone: /王小明|林美華|陳大文/ },
  { what: 'd 13–19 碼且通過檢查碼的卡號只留末 4 碼', text: '卡號 4111111111111111、5555555555554444、378282246310005', gone: /411111111111|555555555555|37828224631/, keep: /1111|4444|0005/ },
  { what: 'e 護照號碼、統一編號', text: '護照號碼：312345678，護照 AB1234567，統一編號 12345678，統編:87654321', gone: /312345678|AB1234567|12345678|87654321/ },
  { what: 'f 填在保單號碼欄位、其實是檢查碼正確的身分證號', text: '保單號碼 A123456789／F131104093', ctx: { exempt: new Set(['A123456789', 'F131104093']) }, gone: /A123456789|F131104093/ },
];
test('9 筆範例：送給 AI 前都被遮罩，遮罩後再掃描為 0', () => {
  for (const c of NINE) {
    const out = pii.redact(c.text, c.ctx).text;
    assert.doesNotMatch(out, c.gone, `${c.what}：${out}`);
    if (c.keep) assert.match(out, c.keep, `${c.what}：末 4 碼要保留：${out}`);
    assert.deepStrictEqual(pii.scan(out, c.ctx), [], `${c.what}：遮罩後掃描仍有個資：${out}`);
    assert.doesNotThrow(() => pii.guard(c.text, c.ctx), c.what);
  }
});
test('不誤遮：生效日、不通過檢查碼的長數字、保單號碼、規則文字', () => {
  for (const t of ['生效日 2025/01/01 生效', '1990/01/01 生存給付', '金額 000000001000000', '序號 4111111111111112', '承保保單須有要保人與被保險人資料', '被保險人性別代碼錯誤', '要保人住所郵遞區號', '受益人比例合計', '被保險人兩張保單'])
    assert.strictEqual(pii.redact(t).text, t, t);
  assert.strictEqual(pii.redact('保單 P250000001', { exempt: new Set(['P250000001']) }).text, '保單 P250000001', '檢查碼不正確的保單號碼照舊');
  assert.ok(pii.twIdValid('A123456789') && !pii.twIdValid('A123456788') && pii.luhn('4111111111111111') && !pii.luhn('4111111111111112'));
});
test('第二道檢查先正規化再掃描：用變形寫法躲過的個資會被攔下，並說明是哪一類', () => {
  // 遮罩前直接掃描 (模擬遮罩被繞過)：看不見的字元、全形、[at] 都要偵測到
  const kinds = s => [...new Set(pii.scan(s).map(x => x.type))].sort();
  assert.deepStrictEqual(kinds('A1​23456789'), ['id']);
  assert.deepStrictEqual(kinds('ｗａｎｇ［at］example［dot］com'), ['email']);
  assert.deepStrictEqual(kinds('民國79年1月1日生'), ['birth']);
  assert.deepStrictEqual(kinds('護照 312345678'), ['doc']);
  assert.deepStrictEqual(kinds('4111111111111111'), ['card']);
  // 遮罩無法處理的情況：停止送出，訊息寫出類別
  assert.throws(() => pii.guard('客戶 王○明', { names: ['王○明'] }), e => e.code === 'pii_blocked' && /姓名/.test(e.message));
});

test('姓名上下文：已知姓名 (含全形、分隔字元) 在送出前遮蔽；沒有上下文的無標籤姓名如實列為限制', () => {
  const ctx = { names: ['王小明', '歐陽娜娜'] };
  // 沒有上下文、也沒有標示：規則比對認不出來 (這是限制，不宣稱能辨識所有姓名)
  assert.strictEqual(pii.redact('王小明希望了解檢核結果。').text, '王小明希望了解檢核結果。');
  // 有上下文：遮蔽
  assert.strictEqual(pii.redact('王小明希望了解檢核結果。', ctx).text, '王○明希望了解檢核結果。');
  for (const t of ['王　小　明', '王 小 明', '王.小.明', '王​小明', '王*小*明']) assert.strictEqual(pii.redact(`${t}希望了解`, ctx).text, '王○明希望了解', t);
  assert.strictEqual(pii.redact('歐陽娜娜來電', ctx).text, '歐○○娜來電');
  assert.deepStrictEqual(pii.scan(pii.redact('王小明、歐陽娜娜', ctx).text, ctx), []);
  // 完全遮蔽選項
  pii.setOptions({ fullName: true });
  try {
    assert.strictEqual(pii.redact('王小明希望了解檢核結果。', ctx).text, '○○○希望了解檢核結果。');
    assert.strictEqual(pii.redact('姓名：林美', {}).text, '姓名：○○');
    assert.strictEqual(pii.redact('被保險人陳大文投保').text, '被保險人○○○投保');
    assert.doesNotThrow(() => pii.guard('王小明希望了解', ctx));
  } finally { pii.setOptions({ fullName: false }); }
  // 合併上下文：呼叫時傳入的與 App 提供的
  const m = pii.mergeCtx({ names: ['甲乙丙'], exempt: new Set(['A123456789']) }, { names: ['王小明'], ids: new Set(['A123456789']) });
  assert.deepStrictEqual(m.names.sort(), ['王小明', '甲乙丙']);
  assert.ok(!m.exempt.has('A123456789'), '既是證號又在不遮罩清單時，以證號為準');
});

test('客戶資料檔建立的上下文：只取姓名與證號；已知姓名與手機在送出前遮蔽', () => {
  const P = require('../src/ai-payload.js');
  const ctx = P.context(null, { custText: '保單編號,角色,證件編號,姓名,地址\nP250000001,1,A123456789,王小明,臺北市\n' });
  assert.deepStrictEqual(ctx.names, ['王小明']); assert.ok(ctx.ids.has('A123456789'));
  const out = pii.guard('王小明的手機 0912-345-678 想確認出生日期問題', ctx).text;
  assert.strictEqual(out, '王○明的手機 *** 想確認出生日期問題');
});
