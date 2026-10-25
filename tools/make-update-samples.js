#!/usr/bin/env node
// 產生「法規更新」的測試資料 (samples/updates/)：一般更新包、核可申請檔，以及用主管私鑰簽的已核可檔與被竄改的已核可檔
//   node tools/make-update-samples.js [主管私鑰.pem]    沒給私鑰時只產生不需要簽章的檔案
const fs = require('fs');
const path = require('path');
const A = require('../src/approval.js');
const dir = path.join(__dirname, '..', 'samples', 'updates');
fs.mkdirSync(dir, { recursive: true });
const write = (name, obj) => fs.writeFileSync(path.join(dir, name), JSON.stringify(obj, null, 2) + '\n');

const add = { id: 'test-add', name: '【測試】高保額保單提醒', version: '1', issuedAt: '20261025', basis: '測試用，非真實函令',
  note: '測試用：臺幣保險金額超過 2,000 萬的保單列為「建議確認」。用「試用資料_含錯誤.xlsx」會找到 2 筆。',
  rules: [{ id: 'T-HIGH-01', name: '臺幣保險金額超過 2,000 萬須加強審核', file: 'L', scope: 'record', severity: 'warning',
    assert: { field: { fn: 'amount', args: ['sumInsuredTwd'] }, op: 'lte', value: 20000000 },
    message: '臺幣保險金額超過 2,000 萬，請確認核保紀錄', suggestion: '確認核保與再保安排後保留' }] };
const disable = { id: 'test-disable', name: '【測試】停用兩項檢查', version: '1', issuedAt: '20261025', basis: '測試用，非真實函令',
  note: '測試用：停用 30212_L1305 與 30205_P0502。用「試用資料_含錯誤.xlsx」會隱藏 4 個問題，畫面與報告會註明「結果不完整」。',
  disable: ['30212_L1305', '30205_P0502'], disableWhy: { '30212_L1305': '測試停用', '30205_P0502': '測試停用' } };
const field = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'rules', 'updates', 'example-2026-format-change.json'), 'utf8'));
field.note = '測試用 (虛構情境)：保留欄位第 1 碼改為「數位投保註記」、2025/07/01 起的新契約必填；並停用 L6101。用「試用資料_含錯誤.xlsx」會找到 6 筆新契約沒有填。';
const broken = { id: 'test-broken', name: '【測試】有錯的更新包', version: '1', issuedAt: '20261025', basis: '測試用',
  note: '測試用：一條規則用了不存在的欄位、停用不存在的檢查編號。匯入後會列出「無法使用、已略過」。',
  rules: [{ id: 'T-BAD-01', name: '不存在的欄位', file: 'L', scope: 'record', assert: { field: 'noSuchField', op: 'notBlank' }, message: '測試' }], disable: ['NO_SUCH_RULE'] };
write('1_新增檢查_待核可.json', add);
write('2_停用檢查_待核可.json', disable);
write('3_新增欄位_待核可.json', field);
write('4_有錯的更新包.json', broken);

(async () => {
  write('5_核可申請_停用檢查.json', await A.request(disable, { found: 0, hidden: 4 }, '測試申請人'));
  const key = process.argv[2];
  if (!key) { console.log('沒有給主管私鑰：已核可的測試檔沒有產生'); return; }
  const pem = fs.readFileSync(key, 'utf8');
  const ok = await A.approve(await A.request(add, { found: 2, hidden: 0 }, '測試申請人'), pem, '測試主管');
  write('6_已核可_新增檢查.json', ok);
  const bad = JSON.parse(JSON.stringify(ok));
  bad.packText = bad.packText.replace('20000000', '200000000');   // 偷改門檻 (2,000 萬 → 2 億)
  write('7_已核可_被竄改.json', bad);
  console.log(`已產生測試檔 (主管金鑰 ${ok.approval.keyId})：${fs.readdirSync(dir).join('、')}`);
})();
