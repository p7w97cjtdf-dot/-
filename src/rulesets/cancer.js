/*
 * 規則集：人壽保險業「個人癌症保險」年度填報
 * 來源：新式癌症保險填報手冊_2024 (肆、資料欄位說明；壹拾、欄位檢核說明)
 * 檢核編號沿用手冊錯誤代碼，前面加上檔別：CRL = 承保資料、CRD = 給付資料、CRX = 承保檔與給付檔對應檢核。
 * 例如 CRL245_01 = 承保資料「等待期間不可大於 90」。
 * 需要前一填報年度資料才能判斷的檢核 (308_01、302_02 的上年度退保別) 未實作。
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('../core.js') : root.DQ;
  const X = isNode ? require('./ext-common.js') : root.DQ.rulesets.extCommon;
  const m = factory(C, X);
  if (isNode) module.exports = m; else root.DQ.rulesets.cancer = m;
})(typeof self !== 'undefined' ? self : this, function (C, X) {
  'use strict';
  const { keys, dateOk, nz, mmdd, insAge } = X;
  const num = C.num, isZero = C.isZero;

  // ================= 代碼表 =================
  const T = Object.assign({}, X.T, {
    productVer: { '1': '15 碼版本', '2': '27 碼版本' },
    salesMethod: { '1': '保險業務員', '2': '郵寄', '3': '電話行銷', '4': '網路銷售', '5': '直接投保', '6': '直效行銷', '7': '網路投保', '8': '基富通', 'A': '多媒體行銷', '9': '非以上招攬方式者' },
    addType: { NEW: '新契約', XEN: '填報年度始日持續有效', EDN: '保單年度始日持續有效', RNN: '復效', CTC: '契約轉換', NTC: '契約轉換後之新契約' },
    exitType: { XED: '填報年度末日持續有效', EDD: '保單年度末日持續有效', LNN: '停效', MAD: '滿期', SRD: '解約', LOP: '失效', TMD: '終止', DCA: '死亡(保單有死亡給付)', DEA: '死亡(保單無死亡給付)', CTC: '契約轉換', DED: '遞延新契約' },
    medExam: { '1': '有體檢', '2': '無體檢' },
    bodyClass: { '1': '標準體', '2': '次標準體', '3': '優體' },
    relation: { '1': '本人', '2': '配偶', '3': '子女', '4': '父母', '0': '其他' },
    // 承保範圍代號表 (第 1~28 位)；給付項目代號 001~028 與承保範圍序位一一對應
    coverage: ['非癌死亡', '癌症死亡', '初(首)次罹癌-初期', '初(首)次罹癌-輕度', '初(首)次罹癌-重度', '初(首)次罹癌-原位癌', '初(首)次罹癌-非原位癌',
      '癌症門診手術醫療', '癌症住院手術醫療', '癌症外科手術醫療', '癌症門診醫療', '癌症骨髓移植', '癌症住院醫療', '癌症出院(在家)療養',
      '癌症化學治療', '癌症放射線治療', '癌症義乳重建手術', '癌症義肢裝設', '癌症義齒裝設', '豁免保費', '癌症照護保險金',
      '初(首)次罹癌(不分類型)', '癌症手術醫療(不分類型)', '其他', '標靶治療', '免疫療法', '基因檢測', '質子療法'],
  });
  T.item = Object.fromEntries(T.coverage.map((n, i) => [String(i + 1).padStart(3, '0'), n]));
  const TERMINAL = ['MAD', 'SRD', 'LOP', 'TMD', 'DCA', 'DEA'];
  const MIXED = ['2B', '2D', '2I', '2K', '2G', '1B', '9B', '9D', '9G', '1D', '2F', '2J'];
  const termOk = v => /^(B001|G0(0[2-9]|[1-8]\d|9[0-5])|T\d{3}|W\d{3}|Y999)$/.test(v) && v !== 'T000' && v !== 'W000';
  // 癌症 ICD-10：C00~C96 惡性腫瘤、D00~D09 原位癌、D37~D49 性質未明腫瘤
  const icd3 = v => v.trim().slice(0, 3);
  const isCancerIcd = v => /^C(0\d|[1-8]\d|9[0-6])/.test(icd3(v)) || /^D0\d/.test(icd3(v)) || /^D(3[7-9]|4\d)/.test(icd3(v));
  const FEMALE_ONLY = /^(C5[1-8]|D0[67])/, MALE_ONLY = /^(C6[0-3]|D07)/;

  // ================= 欄位格式 =================
  const ALNUM = /^[A-Z0-9 ]*$/;
  const f = (no, o) => Object.assign({ typeRule: `CRL103_${String(no).padStart(2, '0')}`, codeRule: `CRL201_${String(no).padStart(2, '0')}` }, o);
  const L = X.layout('CL', '癌症保險承保資料檔', 282, [
    ['company', '公司代號', 1, 2, '9', f(1, { notZero: true, codes: keys(T.company), codeTable: '表 3．1．1 公司代號與簡稱表' })],
    ['policyNo', '保單編號', 3, 15, 'X', f(2, { notBlank: true, notZero: true, leftAlign: true, charset: ALNUM, charsetHint: '限大寫 A~Z、0~9，靠左、後補空白' })],
    ['policySeq', '保單編號序號', 18, 5, 'X', f(2, { leftAlign: true, charset: /^[A-Za-z0-9@ ]*$/, charsetHint: '限 A~Z、a~z、0~9、@，靠左、後補空白' })],
    ['seq', '異動序號', 23, 5, '9', f(3, { codes: v => +v <= 999, codeTable: '異動序號 00000~00999' })],
    ['productVer', '商品編號適用版本', 28, 1, '9', f(4, { codes: keys(T.productVer), codeTable: '商品編號適用版本代號表' })],
    ['productCode', '商品編號', 29, 27, 'X', f(5, { notBlank: true, charset: ALNUM, charsetHint: '限大寫 A~Z、0~9，靠左' })],
    ['waitDays', '等待期間(天)', 56, 3, '9', f(6)],
    ['channel', '通路別', 59, 1, '9', f(7, { codes: keys(T.channel), codeTable: '表 3．1．3 通路別代號表' })],
    ['salesMethod', '招攬方式', 60, 1, 'X', f(8, { codes: keys(T.salesMethod), codeTable: '表 3．1．4 招攬方式代號表' })],
    ['termCode', '保險期間類別及保單期間代號', 61, 4, 'X', f(9, { typeRule: 'CRL203_01', codeRule: 'CRL203_02', codes: termOk, codeTable: '表 3．1．5 保險期間類別及期間代號表', codeHint: '一年期 B001；保證續保 G002~G095；年滿期 Tnnn；歲滿期 Wnnn；終身 Y999' })],
    ['addType', '加保別', 65, 3, 'X', f(10, { notBlank: true, codes: keys(T.addType), codeTable: '表 3．1．6 契約變更型態代號表(加保別)' })],
    ['exitType', '退保別', 68, 3, 'X', f(11, { notBlank: true, codes: keys(T.exitType), codeTable: '表 3．1．7 契約變更型態代號表(退保別)' })],
    ['startDate', '保險期間起日', 71, 8, '9', f(12, { typeRule: 'CRL239_12' })],
    ['endDate', '保險期間迄日', 79, 8, '9', f(13, { typeRule: 'CRL239_13' })],
    ['idType', '證件種類代號', 87, 1, '9', f(14, { codes: keys(T.idType), codeTable: '表 3．1．8 證件種類代號表' })],
    ['idNo', '證件編號', 88, 10, 'X', f(15)],
    ['sex', '性別', 98, 1, '9', f(16, { codes: keys(T.sex), codeTable: '表 3．1．9 性別代號表' })],
    ['birthDate', '出生日期', 99, 8, '9', f(17, { typeRule: 'CRL239_17' })],
    ['medExam', '有無體檢別', 107, 1, '9', f(18, { codes: keys(T.medExam), codeTable: '表 3．1．10 有無體檢別代號表' })],
    ['bodyClass', '體況類別', 108, 1, '9', f(19, { codes: keys(T.bodyClass), codeTable: '表 3．1．11 體況類別代號表' })],
    ['relation', '被保險人與要保人之關係', 109, 1, '9', f(20, { codes: keys(T.relation), codeTable: '表 3．1．12 被保險人身份表' })],
    ['occCode', '簽單時職業分類代碼', 110, 8, 'X', f(21, { notBlank: true, codes: v => v === '00000000' || X.occOk(v), codeTable: X.occ.table, codeHint: '依職業分類表填 8 碼代號 (家管 17000010、無業 17000050)' })],
    ['payerZip', '要保人住所郵遞區號', 118, 3, '9', f(22, { codes: X.zipOk, codeTable: '郵遞區號前 3 碼一覽表', codeHint: '2019 年前的有效契約資訊不足可填 999；OIU 保單可填 888' })],
    ['insuredZip', '被保險人住所郵遞區號', 121, 3, '9', f(23, { codes: X.zipOk, codeTable: '郵遞區號前 3 碼一覽表', codeHint: '2019 年前的有效契約資訊不足可填 999；OIU 保單可填 888' })],
    ['disabilityCat', '身心障礙類別', 124, 3, 'X', f(24, { codeRule: 'CRL233_03', codes: X.isDisabilityCat, codeTable: '表 3．1．13A/B 身心障礙類別代號表', codeHint: '非身心障礙者填 000' })],
    ['disabilityLevel', '身心障礙等級', 127, 1, '9', f(25, { codeRule: 'CRL233_03', codes: keys(T.disabilityLevel), codeTable: '表 3．1．14 身心障礙等級代號表' })],
    ['currency', '原幣別', 128, 3, 'X', f(26, { notBlank: true, codes: T.currency, codeTable: '表 3．1．15 幣別代號表' })],
    ['coverage', '承保範圍代號', 131, 50, '9', f(27, { codeRule: 'CRL202_01', codes: v => /^[01]{50}$/.test(v), codeTable: '表 3．1．16 承保範圍代號表', codeHint: '每一位只能填 0 或 1' })],
    ['firstCancerAmt', '初(首)次罹癌保險金額(元)', 181, 15, '9', f(28)],
    ['dailyHospAmt', '癌症每日住院給付金額', 196, 15, '9', f(29)],
    ['maxBenefit', '癌症給付上限金額', 211, 15, '9', f(30)],
    ['policyYear', '保單年度', 226, 3, '9', f(31, { notZero: true })],
    ['insAge', '保險年齡', 229, 3, '9', f(32)],
    ['exposure', '暴露數', 232, 7, '9', f(33)],
    ['addYear', '加保別契約變更年度', 239, 4, '9', f(34)],
    ['companyPlanCode', '公司保單險種代號', 243, 20, 'X', f(35, { notBlank: true, hint: '不得空白，無則填 0' })],
    ['histType', '歷史修改之異動型態', 263, 3, 'X', f(36)],
    ['reserved', '保留欄位', 266, 17, 'X', f(37, { default: '00000000000000000' })],
  ], {
    fileName: { re: /^CRL\d{6}\.txt$/i, pattern: 'CRL+填報年度+公司代號.txt', example: 'CRL202501.txt' },
    keyOf: r => (r.policyNo || '').trimEnd() + '/' + (r.policySeq || '').trimEnd(),
    sheet: '癌症險保單資料',
  });

  const g = (no, o) => Object.assign({ typeRule: `CRD103_${String(no).padStart(2, '0')}`, codeRule: `CRD201_${String(no).padStart(2, '0')}` }, o);
  const D = X.layout('CD', '癌症保險給付資料檔', 115, [
    ['company', '公司代號', 1, 2, '9', g(1, { notZero: true, codes: keys(T.company), codeTable: '表 3．1．1 公司代號與簡稱表' })],
    ['policyNo', '保單編號', 3, 15, 'X', g(2, { notBlank: true, notZero: true, leftAlign: true, charset: ALNUM, charsetHint: '限大寫 A~Z、0~9，靠左、後補空白' })],
    ['policySeq', '保單編號序號', 18, 5, 'X', g(2, { leftAlign: true, charset: /^[A-Za-z0-9@ ]*$/ })],
    ['claimNo', '賠案號碼', 23, 15, 'X', g(3, { notBlank: true, charset: ALNUM, hint: '不得空白，無則填 0' })],
    ['eventDate', '事故日期', 38, 8, '9', g(4, { notZero: true })],
    ['payDate', '給付日期', 46, 8, '9', g(5, { notZero: true })],
    ['icd', '罹患癌症種類(ICD-10)', 54, 7, 'X', g(6)],
    ['item', '給付項目', 61, 3, '9', g(7, { notZero: true, codes: keys(T.item), codeTable: '給付項目代號表' })],
    ['hospDays', '癌症住院給付日數', 64, 5, '9', g(8)],
    ['payAmt', '給付金額(元)', 69, 15, '9', g(9)],
    ['occCode', '事故時職業分類代碼', 84, 8, 'X', g(10, { codeRule: 'CRD204_01', codes: v => v === '00000000' || X.occOk(v), codeTable: X.occ.table })],
    ['year', '填報年度', 92, 4, '9', g(11)],
    ['reserved', '保留欄位', 96, 20, 'X', g(12, { default: '00000000000000000000' })],
  ], {
    fileName: { re: /^CRD\d{6}\.txt$/i, pattern: 'CRD+填報年度+公司代號.txt', example: 'CRD202501.txt' },
    keyOf: r => (r.policyNo || '').trimEnd() + '/' + (r.policySeq || '').trimEnd(),
    sheet: '癌症險理賠資料',
  });

  // ================= 規則目錄 =================
  const catalog = [];
  const R = (id, name, level, ref, severity) => { if (!catalog.some(c => c.id === id)) catalog.push({ id, name, level, ref, severity: severity || 'error', product: 'cancer' }); };
  for (const fd of L.fields) { R(fd.typeRule, `${fd.name}資料型態`, '資料類型', '壹拾-1~9'); if (fd.codes) R(fd.codeRule, `${fd.name}代碼檢核`, '代碼', '壹拾-1~9'); }
  for (const fd of D.fields) { R(fd.typeRule, `${fd.name}資料型態`, '資料類型', '壹拾-10~12'); if (fd.codes) R(fd.codeRule, `${fd.name}代碼檢核`, '代碼', '壹拾-10~12'); }
  [
    ['CRL231_01', '商品編號適用版本與商品編號碼數相符 (版本 1=15 碼、版本 2=27 碼)', '單筆', '壹拾-1'],
    ['CRL231_23', '商品編號符合人身保險商品編碼原則', '單筆', '壹拾-2'],
    ['CRL231_99', '商品須為癌症保險 (第 4-5 碼=32，或第 9-10 碼為含癌症之混合型)', '單筆', '貳-1', 'warning'],
    ['CRL245_01', '等待期間不可大於 90 天', '單筆', '壹拾-2'],
    ['CRL245_02', '等待期間個位數為 0 (10 的倍數)', '單筆', '壹拾-2'],
    ['CRL203_03', '保險期間類別 Y999 (終身) 時保險期間迄日為 99991231', '單筆', '壹拾-2'],
    ['CRL203_04', '保險期間類別與保險期間起迄日、出生日期相符', '單筆', '壹拾-2'],
    ['CRL243_01', '退保別 DED 的加保別須為 NEW；加保別 NTC 的退保別須為 CTC', '單筆', '壹拾-3'],
    ['CRL243_02', '加保別 NEW 的異動序號為 00000 或 00001', '單筆', '壹拾-3'],
    ['CRL243_03', '加保別 NTC 的異動序號為 00001', '單筆', '壹拾-3'],
    ['CRL243_04', '加保別 CTC 的異動序號須大於 00001', '單筆', '壹拾-3'],
    ['CRL243_05', '加保別 XEN 且保險起日不為 0101 時，異動序號不可大於 00001', '單筆', '壹拾-3'],
    ['CRL243_06', '加保別 EDN：起日 0101 時序號不可大於 00001；起日非 0101 時序號須大於 00001', '單筆', '壹拾-3'],
    ['CRL248_04', '加保別 XEN 時保險起日不可為 01 月 01 日', '單筆', '壹拾-3'],
    ['CRL248_05', '退保別 XED 時保險起日不可為 01 月 01 日 (應填 EDD)', '單筆', '壹拾-4'],
    ['CRL264_04', '加保別 NEW 且保險起日為 0101 時，退保別不可為 XED', '單筆', '壹拾-4'],
    ['CRL264_05', '加保別 NEW 且保險起日非 0101 時，退保別不可為 EDD', '單筆', '壹拾-4'],
    ['CRL264_03', '退保別非全年有效 (LNN、SRD、TMD) 時暴露數不可為 1', '單筆', '壹拾-4'],
    ['CRL304_02', '退保別 LNN、LOP、SRD、TMD 時暴露數須小於 1', '單筆', '壹拾-4'],
    ['CRL304_03', '退保別 MAD 且保險迄日不是 1231 時暴露數不可能為 1', '單筆', '壹拾-4'],
    ['CRL248_01', '保險期間起日須早於保險期間迄日', '單筆', '壹拾-4'],
    ['CRL248_02', '主契約 (商品編號第 7 碼=M) 非終身時，迄日月日=起日月日前一天；終身時迄日=99991231', '單筆', '壹拾-4'],
    ['CRL232', '證件編號全填 0 (個資保護)', '單筆', '壹拾-5'],
    ['CRL244', '出生日期須早於或等於保險期間起日', '單筆', '壹拾-5'],
    ['CRL239_17B', '出生日期須大於 19120101', '單筆', '壹拾-5'],
    ['CRL239_12B', '保險期間起日須大於等於 19740101', '單筆', '壹拾-4'],
    ['CRL219', '商品編碼第 17 碼=2 (優體) 時，體況類別須為 3 (優體)', '單筆', '壹拾-5'],
    ['CRL204_21', '職業代碼 00000000 僅限 2015/03/01 前起保之保單', '單筆', '壹拾-6'],
    ['CRL233_01', '身心障礙類別=000 時身心障礙等級須為 0；類別≠000 時等級不可為 0', '單筆', '壹拾-6'],
    ['CRL202_03', '承保範圍第 1~24 碼不可全為 0，第 29~50 碼須全為 0', '單筆', '壹拾-7'],
    ['CRL202_05', '承保範圍第 3~7 碼任一為 1 時，第 22 碼須為 0', '單筆', '壹拾-7'],
    ['CRL202_04', '承保範圍第 8~10 碼任一為 1 時，第 23 碼須為 0', '單筆', '壹拾-7'],
    ['CRL238_28', '承保範圍第 3~7 或 22 碼為 1 時，初(首)次罹癌保險金額不得為 0', '單筆', '壹拾-7'],
    ['CRL241_01', '承保範圍第 13 碼 (癌症住院醫療)=0 時，每日住院給付金額須為 0', '單筆', '壹拾-8'],
    ['CRL241_02', '承保範圍第 13 碼=1 時，每日住院給付金額不得為 0', '單筆', '壹拾-8'],
    ['CRL238_30', '癌症給付上限金額不可為 0 (無上限填 999999999999999)', '單筆', '壹拾-8'],
    ['CRL259_01', '加保別 NEW 的保單年度=1', '單筆', '壹拾-8'],
    ['CRL259_02', '加保別 XEN 的保單年度=加保別異動年－保單起年', '單筆', '壹拾-8'],
    ['CRL259_03', '加保別 EDN 的保單年度=加保別異動年－保單起年＋1', '單筆', '壹拾-8'],
    ['CRL259_04', '保單年度介於 (異動年－起年) 與 (異動年－起年＋1) 之間', '單筆', '壹拾-8'],
    ['CRL234_01', '保險年齡不可大於 150，且須等於起保年齡 (最近生日法)＋保單年度－1', '單筆', '壹拾-8'],
    ['CRL304_01', '暴露數介於 0 與 1.000002 之間', '單筆', '壹拾-9'],
    ['CRL248_03', '起保月日 0101、加保別 NEW/EDN、退保別 EDD 時暴露數須為 1', '單筆', '壹拾-9'],
    ['CRL236_01', '加保別異動年不可小於 2017', '單筆', '壹拾-9'],
    ['CRL236_02', '保險期間起日 (年) 不可晚於加保別異動年', '單筆', '壹拾-9'],
    // 多筆
    ['CRL302_05', '保單只有 1 筆時，異動序號填 00000 或 00001', '多筆', '壹拾-1'],
    ['CRL303_01', '保單多筆時依異動序號前後排序填列', '多筆', '壹拾-1'],
    ['CRL309_05', '保單筆數=最大之異動序號', '多筆', '壹拾-1'],
    ['CRL301', '同一保單的欄位值須相同 (等待期間、通路、招攬方式、證件、性別、出生日期、體檢、體況、職業、幣別、承保範圍)', '多筆', '壹拾-2~7'],
    ['CRL302_03', '同一保單的保險期間類別與起迄日須相同 (契約轉換 CTC 除外)', '多筆', '壹拾-2'],
    ['CRL302_01', '加保別新契約 (NEW) 不可出現多筆', '多筆', '壹拾-3'],
    ['CRL302_02', '加保別 XEN 須為保單第一筆', '多筆', '壹拾-3'],
    ['CRL302_03B', '加保別 CTC 時上一筆退保別須為 CTC', '多筆', '壹拾-3'],
    ['CRL302_04', '加保別 RNN 時上一筆退保別須為 LNN', '多筆', '壹拾-3'],
    ['CRL302_06', '加保別 EDN 時上一筆退保別須為 EDD 或 DED', '多筆', '壹拾-3'],
    ['CRL309_01', '終止類退保別 (MAD、SRD、LOP、TMD、DCA、DEA) 須在最大序號那一筆，且只出現一次', '多筆', '壹拾-3'],
    ['CRL309_02', '保險起日不是 0101 時，保單最後一筆退保別不可為 EDD', '多筆', '壹拾-4'],
    ['CRL309_03', '保險迄年=加保別異動年時，最後一筆退保別須為 MAD (不可為 EDD、XED)', '多筆', '壹拾-3'],
    ['CRL234_02', '同一保單同一保單年度保險年齡相同；保單年度較大時保險年齡也較大', '多筆', '壹拾-8'],
    ['CRL304_04', '同一保單同一保單年度暴露數合計不可大於 1.000002', '多筆', '壹拾-9'],
    ['CRL301_01', '承保檔 公司+保單+加保別異動年+異動序號 不得重複', '多筆', '壹拾-9'],
    // 給付
    ['CRD239_04', '事故日期須為合法日期且大於 19800101', '單筆', '壹拾-10'],
    ['CRD239_05', '給付日期須為合法日期且大於等於 20170101', '單筆', '壹拾-10'],
    ['CRD240_01', '事故日期須早於或等於給付日期', '單筆', '壹拾-10'],
    ['CRD240_02', '事故年須小於等於填報年度', '單筆', '壹拾-10'],
    ['CRD205_01', '罹患癌症種類不可有小數點', '單筆', '壹拾-10'],
    ['CRD249', '給付項目 002~028 時，罹患癌症種類須為癌症 ICD-10 代碼', '單筆', '壹拾-11'],
    ['CRD249B', '給付項目 006 (原位癌) 時，罹患癌症種類應為原位癌 D00~D09', '單筆', '壹拾-11', 'warning'],
    ['CRD310_01', '給付項目 001 (非癌死亡) 時，罹患癌症種類須填 0000000', '單筆', '壹拾-11'],
    ['CRD241_01', '給付項目 013 (住院) 時，癌症住院給付日數須大於 0', '單筆', '壹拾-11'],
    ['CRD241_02', '癌症住院給付日數大於 0 時，給付項目須為 013', '單筆', '壹拾-11'],
    ['CRD246', '除給付項目 020 (豁免保費) 外，給付金額不可為 0', '單筆', '壹拾-11'],
    ['CRD242', '2017 ≤ 填報年度 ≤ 系統年度', '單筆', '壹拾-12'],
    ['CRD306_01', '同一保單給付項目 002 (癌症死亡) 只會有一筆', '多筆', '壹拾-11'],
    ['CRD307_01', '同一保單給付項目 001 與 002 (死亡) 不能同時出現', '多筆', '壹拾-11'],
    ['CRD312_01', '給付項目 001 或 002 (死亡) 的事故日期須為該保單最大的日期', '多筆', '壹拾-10'],
    ['CRD305_01', '同一事故日期的住院 (013) 給付日數合計不大於 365', '多筆', '壹拾-11'],
    ['CRD301_02', '給付檔 填報年度+公司+保單+事故日期+給付項目+給付日期 不得重複', '多筆', '壹拾-12'],
    // 承保檔與給付檔
    ['CRX310_01', '給付資料的保單須存在於承保檔', '跨檔', '壹拾-13'],
    ['CRX310_03', '承保退保別 DCA (癌症死亡) 且承保範圍第 2 碼=1 時，給付檔須有給付項目 002', '跨檔', '壹拾-13'],
    ['CRX311_03', '給付項目 001/002 (死亡) 時，承保退保別須有 DCA 或 DEA', '跨檔', '壹拾-13'],
    ['CRX311_04', '事故日期須在保險起迄日期間內，且不早於保險起日＋等待期間', '跨檔', '壹拾-13'],
    ['CRX315_01', '罹患癌症種類須與承保檔性別相符', '跨檔', '壹拾-13'],
    ['CRX313_01', '給付項目須在承保範圍內 (承保檔有該保障項目，給付檔才能有該項給付)', '跨檔', '壹拾-13'],
    ['CRX204_01', '事故時職業分類代碼除 2015/03/01 前起保之保單外不得為 00000000', '跨檔', '壹拾-13'],
  ].forEach(a => R(...a));

  // ================= 單筆檢核：承保 =================
  const recordL = [];
  const rl = fn => recordL.push(fn);
  const bit = (r, n) => r.coverage[n - 1] === '1';
  const anyBit = (r, a, b) => r.coverage.slice(a - 1, b).includes('1');

  rl((r, p) => X.checkProduct(r, p, {
    codeKey: 'productCode', verKey: 'productVer', ids: { len: 'CRL231_01', rule: 'CRL231_23', scope: 'CRL231_99' },
    scope: c => c.slice(3, 5) === '32' || MIXED.includes(c.slice(8, 10)),
    scopeMsg: '商品編號看起來不是癌症保險：第 4-5 碼不是 32，第 9-10 碼也不是含癌症的混合型',
    scopeHint: '確認此商品是否屬於癌症保險填報對象，或商品編號是否填錯',
  }));
  rl((r, p) => {
    const w = num(r.waitDays); if (isNaN(w)) return;
    if (w > 90) p({ ruleId: 'CRL245_01', category: '單筆邏輯', fields: ['waitDays'], value: r.waitDays, message: `等待期間 ${w} 天大於 90 天`, suggestion: '依契約約定填等待期間，例如 030、060、090' });
    if (w % 10) p({ ruleId: 'CRL245_02', category: '單筆邏輯', fields: ['waitDays'], value: r.waitDays, message: `等待期間 ${w} 天不是 10 的倍數`, suggestion: '等待期間應為 10 的倍數，例如 030、060、090' });
  });
  // 保險期間
  rl((r, p) => {
    const s = r.startDate, e = r.endDate;
    if (dateOk(s) && s < '19740101') p({ ruleId: 'CRL239_12B', category: '格式', fields: ['startDate'], value: s, message: '保險期間起日早於 19740101', suggestion: '請確認是否誤填民國年' });
    if (!dateOk(s)) return p({ ruleId: 'CRL239_12', category: '格式', fields: ['startDate'], value: s, message: '保險期間起日不是合法日期', suggestion: '格式 YYYYMMDD (西元)' });
    if (!dateOk(e)) return p({ ruleId: 'CRL239_13', category: '格式', fields: ['endDate'], value: e, message: '保險期間迄日不是合法日期', suggestion: '格式 YYYYMMDD (西元)，終身保險填 99991231' });
    if (s >= e) return p({ ruleId: 'CRL248_01', category: '單筆邏輯', fields: ['startDate', 'endDate'], value: `${s} ≥ ${e}`, message: '保險期間起日須早於迄日', suggestion: '檢查兩日期是否填反' });
    if (r.termCode === 'Y999' && e !== '99991231') p({ ruleId: 'CRL203_03', category: '單筆邏輯', fields: ['termCode', 'endDate'], value: e, message: '保險期間類別為終身 (Y999)，迄日應填 99991231', suggestion: '改為 99991231', fix: { field: 'endDate', value: '99991231' } });
    else if (r.productCode[6] === 'M' && r.termCode !== 'Y999' && e !== '99991231' && mmdd(e) !== mmdd(X.plusDays(s, -1)) && !(mmdd(s) === '0229' && mmdd(e) === '0227'))
      p({ ruleId: 'CRL248_02', category: '單筆邏輯', fields: ['startDate', 'endDate'], value: `${s}~${e}`, message: '主契約的保險迄日月日應為起日月日的前一天', suggestion: `例如起日 ${s.slice(4, 6)}/${s.slice(6)}，迄日應為 ${X.plusDays(s, -1).slice(4, 6)}/${X.plusDays(s, -1).slice(6)}` });
    const m = /^T(\d{3})$/.exec(r.termCode);
    if (m && e !== '99991231' && +e.slice(0, 4) - +s.slice(0, 4) !== +m[1] && !(mmdd(s) === '0101' && +e.slice(0, 4) - +s.slice(0, 4) === +m[1] - 1))
      p({ ruleId: 'CRL203_04', category: '單筆邏輯', fields: ['termCode', 'startDate', 'endDate'], value: `${r.termCode} ${s}~${e}`, message: `保險期間類別 ${r.termCode} (${+m[1]} 年期)，但起迄日相差 ${+e.slice(0, 4) - +s.slice(0, 4)} 年`, suggestion: '確認保險期間代號或迄日' });
    const w = /^W(\d{3})$/.exec(r.termCode);
    if (w && dateOk(r.birthDate) && e !== '99991231' && Math.abs(insAge(r.birthDate, s) + (+e.slice(0, 4) - +s.slice(0, 4)) - +w[1]) > 1)
      p({ ruleId: 'CRL203_04', category: '單筆邏輯', fields: ['termCode', 'birthDate', 'endDate'], value: `${r.termCode} ${e}`, message: `歲滿期 ${r.termCode}：依出生日期推算，迄日時被保險人約 ${insAge(r.birthDate, s) + (+e.slice(0, 4) - +s.slice(0, 4))} 歲，與 ${+w[1]} 歲不符`, suggestion: '確認出生日期、保險期間代號或迄日' });
  });
  // 加保別 / 退保別 / 異動序號
  rl((r, p) => {
    const add = r.addType, ex = r.exitType, seq = num(r.seq), jan1 = dateOk(r.startDate) && mmdd(r.startDate) === '0101';
    const f2 = (id, fields, msg, sug, fix) => p({ ruleId: id, category: '單筆邏輯', fields, value: fields.map(k => r[k]).join('/'), message: msg, suggestion: sug, fix });
    if (ex === 'DED' && add !== 'NEW') f2('CRL243_01', ['addType', 'exitType'], '退保別為 DED (遞延新契約) 時，加保別應為 NEW', '確認加保別或退保別');
    if (add === 'NTC' && ex !== 'CTC') f2('CRL243_01', ['addType', 'exitType'], '加保別為 NTC 時，退保別應為 CTC', '契約轉換後之新契約第一筆退保別填 CTC');
    if (add === 'NEW' && seq > 1) f2('CRL243_02', ['addType', 'seq'], '加保別為 NEW (新契約) 時，異動序號應為 00000 或 00001', '新契約應為保單第一筆');
    if (add === 'NTC' && seq !== 1) f2('CRL243_03', ['addType', 'seq'], '加保別為 NTC 時，異動序號應為 00001', '改為 00001', { field: 'seq', value: '00001' });
    if (add === 'CTC' && seq <= 1) f2('CRL243_04', ['addType', 'seq'], '加保別為 CTC (契約轉換) 時，異動序號應大於 00001', '契約轉換前應有轉換前的資料');
    if (add === 'XEN' && jan1) f2('CRL248_04', ['addType', 'startDate'], '保險起日為 01 月 01 日時，加保別不可為 XEN', '起日 0101 的有效契約加保別應填 EDN', { field: 'addType', value: 'EDN' });
    else if (add === 'XEN' && seq > 1) f2('CRL243_05', ['addType', 'seq'], '加保別為 XEN 時，異動序號不可大於 00001', 'XEN 應為保單第一筆');
    if (add === 'EDN' && jan1 && seq > 1) f2('CRL243_06', ['addType', 'seq'], '保險起日為 0101、加保別為 EDN 時，異動序號不可大於 00001', '確認異動序號');
    if (add === 'EDN' && dateOk(r.startDate) && !jan1 && seq <= 1) f2('CRL243_06', ['addType', 'seq'], '保險起日不是 0101、加保別為 EDN 時，異動序號應大於 00001', '前面應有一筆 XEN/EDD (填報年度始日至保單週年日前一日)');
    if (ex === 'XED' && jan1) f2('CRL248_05', ['exitType', 'startDate'], '保險起日為 01 月 01 日時，退保別不可為 XED', '保單年度末日即填報年度末日，應填 EDD', { field: 'exitType', value: 'EDD' });
    else if (add === 'NEW' && jan1 && ex === 'XED') f2('CRL264_04', ['addType', 'exitType'], '新契約起日為 0101 時，退保別不可為 XED', '改為 EDD', { field: 'exitType', value: 'EDD' });
    if (add === 'NEW' && dateOk(r.startDate) && !jan1 && ex === 'EDD') f2('CRL264_05', ['addType', 'exitType'], '新契約起日不是 0101 時，退保別不可為 EDD', '年底仍有效應填 XED', { field: 'exitType', value: 'XED' });
  });
  // 暴露數
  rl((r, p) => {
    const e = num(r.exposure); if (isNaN(e)) return;
    if (e > 1000002) return p({ ruleId: 'CRL304_01', category: '單筆邏輯', fields: ['exposure'], value: r.exposure, message: '暴露數大於 1 (1000002)', suggestion: '暴露數為有效日數 ÷ 填報年度天數，整數 1 位、小數 6 位' });
    const jan1 = dateOk(r.startDate) && mmdd(r.startDate) === '0101';
    if (['LNN', 'SRD', 'TMD'].includes(r.exitType) && e >= 1000000) p({ ruleId: 'CRL264_03', category: '單筆邏輯', fields: ['exitType', 'exposure'], value: r.exposure, message: `退保別 ${r.exitType} (非全年有效)，暴露數不可為 1`, suggestion: '暴露數只算到停效/解約/終止日' });
    if (['LNN', 'LOP', 'SRD', 'TMD'].includes(r.exitType) && e >= 1000000) p({ ruleId: 'CRL304_02', category: '單筆邏輯', fields: ['exitType', 'exposure'], value: r.exposure, message: `退保別 ${r.exitType} 時暴露數應小於 1`, suggestion: '扣除停效、解約、失效、終止後的日數' });
    if (r.exitType === 'MAD' && dateOk(r.endDate) && mmdd(r.endDate) !== '1231' && e >= 1000000) p({ ruleId: 'CRL304_03', category: '單筆邏輯', fields: ['exitType', 'exposure'], value: r.exposure, message: '滿期 (MAD) 且迄日不是年底，暴露數不可能為 1', suggestion: '暴露數只算到滿期日' });
    if (jan1 && ['NEW', 'EDN'].includes(r.addType) && r.exitType === 'EDD' && e !== 1000000) p({ ruleId: 'CRL248_03', category: '單筆邏輯', fields: ['exposure'], value: r.exposure, message: '起保月日 0101、全年有效 (NEW/EDN → EDD)，暴露數應為 1', suggestion: '改為 1000000', fix: { field: 'exposure', value: '1000000' } });
  });
  // 被保險人
  rl((r, p) => {
    if (!/^0+$/.test(r.idNo)) p({ ruleId: 'CRL232', category: '單筆邏輯', fields: ['idNo'], value: r.idNo, message: '因個資保護，證件編號應全填 0', suggestion: '改為 0000000000', fix: { field: 'idNo', value: '0000000000' } });
    if (!dateOk(r.birthDate)) return p({ ruleId: 'CRL239_17', category: '格式', fields: ['birthDate'], value: r.birthDate, message: '出生日期不是合法日期 (YYYYMMDD，需考慮大小月與閏年)', suggestion: '請確認是否誤填民國年或月日顛倒' });
    if (r.birthDate <= '19120101') p({ ruleId: 'CRL239_17B', category: '格式', fields: ['birthDate'], value: r.birthDate, message: '出生日期早於 1912 年', suggestion: '請確認是否誤填' });
    if (dateOk(r.startDate) && r.birthDate > r.startDate) p({ ruleId: 'CRL244', category: '單筆邏輯', fields: ['birthDate', 'startDate'], value: `${r.birthDate} > ${r.startDate}`, message: '出生日期晚於保險期間起日', suggestion: '檢查出生日期或起日是否填錯' });
  });
  rl((r, p) => { if (r.productVer === '2' && r.productCode[16] === '2' && r.bodyClass !== '3') p({ ruleId: 'CRL219', category: '單筆邏輯', fields: ['bodyClass', 'productCode'], value: r.bodyClass, message: '商品編碼第 17 碼為 2 (優體保單)，體況類別應為 3 (優體)', suggestion: '改為 3', fix: { field: 'bodyClass', value: '3' } }); });
  rl((r, p) => { if (r.occCode === '00000000' && dateOk(r.startDate) && r.startDate >= '20150301') p({ ruleId: 'CRL204_21', category: '缺漏', fields: ['occCode', 'startDate'], value: r.occCode, message: '2015/03/01 起保的保單職業分類代碼不可為 00000000', suggestion: '依職業分類表填 8 碼代號 (家管 17000010、無業 17000050)' }); });
  rl((r, p) => {
    if ((r.disabilityCat === '000') !== (r.disabilityLevel === '0')) p({ ruleId: 'CRL233_01', category: '單筆邏輯', fields: ['disabilityCat', 'disabilityLevel'], value: `${r.disabilityCat}/${r.disabilityLevel}`, message: '身心障礙類別與等級不一致：類別 000 時等級須為 0，類別非 000 時等級不可為 0', suggestion: '確認身心障礙類別與等級' });
  });
  // 承保範圍與保額
  rl((r, p) => {
    if (!/^[01]{50}$/.test(r.coverage)) return;
    if (!anyBit(r, 1, 24) || anyBit(r, 29, 50)) p({ ruleId: 'CRL202_03', category: '單筆邏輯', fields: ['coverage'], value: r.coverage.replace(/0+$/, ''), message: !anyBit(r, 1, 24) ? '承保範圍第 1~24 碼不可全部為 0' : '承保範圍第 29~50 碼須全部為 0', suggestion: '依保單提供的承保項目，在對應序位填 1' });
    if (anyBit(r, 3, 7) && bit(r, 22)) p({ ruleId: 'CRL202_05', category: '單筆邏輯', fields: ['coverage'], value: r.coverage.slice(0, 28), message: '承保範圍已分初期/輕度/重度/原位/非原位 (第 3~7 碼)，第 22 碼 (不分類型) 須為 0', suggestion: '兩者擇一：分類型給付填第 3~7 碼；不分類型填第 22 碼' });
    if (anyBit(r, 8, 10) && bit(r, 23)) p({ ruleId: 'CRL202_04', category: '單筆邏輯', fields: ['coverage'], value: r.coverage.slice(0, 28), message: '承保範圍已分門診/住院/外科手術 (第 8~10 碼)，第 23 碼 (不分類型) 須為 0', suggestion: '兩者擇一：分類型填第 8~10 碼；不分類型填第 23 碼' });
    if ((anyBit(r, 3, 7) || bit(r, 22)) && isZero(r.firstCancerAmt)) p({ ruleId: 'CRL238_28', category: '缺漏', fields: ['firstCancerAmt', 'coverage'], value: r.firstCancerAmt, message: '承保範圍含初(首)次罹癌，但初(首)次罹癌保險金額為 0', suggestion: '填入初(首)次罹癌保險金額 (分期別給付者合併各項金額)' });
    if (!bit(r, 13) && nz(r.dailyHospAmt)) p({ ruleId: 'CRL241_01', category: '單筆邏輯', fields: ['dailyHospAmt', 'coverage'], value: r.dailyHospAmt.replace(/^0+/, ''), message: '承保範圍沒有癌症住院醫療 (第 13 碼=0)，每日住院給付金額應為 0', suggestion: '確認承保範圍第 13 碼或金額', fix: { field: 'dailyHospAmt', value: '0' } });
    if (bit(r, 13) && isZero(r.dailyHospAmt)) p({ ruleId: 'CRL241_02', category: '缺漏', fields: ['dailyHospAmt', 'coverage'], value: r.dailyHospAmt, message: '承保範圍有癌症住院醫療 (第 13 碼=1)，每日住院給付金額不可為 0', suggestion: '填入每日住院給付金額' });
  });
  rl((r, p) => { if (isZero(r.maxBenefit)) p({ ruleId: 'CRL238_30', category: '缺漏', fields: ['maxBenefit'], value: r.maxBenefit, message: '癌症給付上限金額不可為 0', suggestion: '填入各項保險金合計給付上限；無上限填 999999999999999', fix: { field: 'maxBenefit', value: '999999999999999' } }); });
  // 保單年度、保險年齡、異動年
  rl((r, p) => {
    const y = num(r.addYear), py = num(r.policyYear);
    if (!isNaN(y) && y < 2017) p({ ruleId: 'CRL236_01', category: '單筆邏輯', fields: ['addYear'], value: r.addYear, message: '加保別契約變更年度不可小於 2017', suggestion: '填入此筆異動所屬的填報年度' });
    if (!dateOk(r.startDate) || isNaN(y) || isNaN(py)) return;
    const sy = +r.startDate.slice(0, 4);
    if (sy > y) return p({ ruleId: 'CRL236_02', category: '單筆邏輯', fields: ['startDate', 'addYear'], value: `${sy} > ${y}`, message: '保險期間起日的年份晚於加保別契約變更年度', suggestion: '確認起日或加保別契約變更年度' });
    if (r.addType === 'NEW' && py !== 1) p({ ruleId: 'CRL259_01', category: '單筆邏輯', fields: ['addType', 'policyYear'], value: r.policyYear, message: '新契約 (NEW) 的保單年度應為 1', suggestion: '改為 001', fix: { field: 'policyYear', value: '001' } });
    else if (r.addType === 'XEN' && py !== y - sy) p({ ruleId: 'CRL259_02', category: '單筆邏輯', fields: ['addType', 'policyYear'], value: r.policyYear, message: `加保別 XEN 的保單年度應為 ${y}－${sy}＝${y - sy}`, suggestion: `改為 ${String(y - sy).padStart(3, '0')}`, fix: y - sy > 0 ? { field: 'policyYear', value: String(y - sy).padStart(3, '0') } : null });
    else if (r.addType === 'EDN' && py !== y - sy + 1) p({ ruleId: 'CRL259_03', category: '單筆邏輯', fields: ['addType', 'policyYear'], value: r.policyYear, message: `加保別 EDN 的保單年度應為 ${y}－${sy}＋1＝${y - sy + 1}`, suggestion: `改為 ${String(y - sy + 1).padStart(3, '0')}`, fix: { field: 'policyYear', value: String(y - sy + 1).padStart(3, '0') } });
    else if (py < y - sy || py > y - sy + 1) p({ ruleId: 'CRL259_04', category: '單筆邏輯', fields: ['policyYear'], value: r.policyYear, message: `保單年度應介於 ${y - sy} 與 ${y - sy + 1} 之間`, suggestion: '依保單生效日起算到此筆異動所經過的年度' });
    const age = num(r.insAge);
    if (isNaN(age) || !dateOk(r.birthDate) || r.birthDate > r.startDate) return;
    const want = insAge(r.birthDate, r.startDate) + py - 1;
    if (age > 150 || age !== want) p({ ruleId: 'CRL234_01', category: '單筆邏輯', fields: ['insAge', 'birthDate', 'startDate', 'policyYear'], value: r.insAge, message: age > 150 ? '保險年齡大於 150' : `保險年齡應為 ${want} (起保時 ${insAge(r.birthDate, r.startDate)} 歲，最近生日法，加保單年度 ${py} － 1)`, suggestion: `改為 ${String(want).padStart(3, '0')}`, fix: want >= 0 && want <= 150 ? { field: 'insAge', value: String(want).padStart(3, '0') } : null });
  });

  // ================= 多筆檢核：承保 (同一保單) =================
  const SAME = ['waitDays', 'channel', 'salesMethod', 'idType', 'idNo', 'sex', 'birthDate', 'medExam', 'bodyClass', 'occCode', 'currency', 'coverage'];
  const groupL = [];
  groupL.push((recs, p) => {
    const s = recs.slice().sort((a, b) => a._line - b._line);
    const one = (r, id, fields, msg, sug, fix) => p(r, { ruleId: id, category: '多筆邏輯', fields, value: fields.map(k => r[k]).join('/'), message: msg, suggestion: sug, fix });
    if (s.length === 1) {
      if (!['00000', '00001'].includes(s[0].seq)) one(s[0], 'CRL302_05', ['seq'], '保單只有 1 筆，異動序號應為 00000 或 00001', '改為 00000', { field: 'seq', value: '00000' });
    } else {
      for (let i = 1; i < s.length; i++) if (num(s[i].seq) <= num(s[i - 1].seq)) { one(s[i], 'CRL303_01', ['seq'], `異動序號 ${s[i].seq} 沒有依前後排序 (上一筆為 ${s[i - 1].seq})`, '依異動先後由 00001 起依序填列'); break; }
      const max = Math.max(...s.map(r => num(r.seq)));
      if (max !== s.length) one(s[s.length - 1], 'CRL309_05', ['seq'], `保單共 ${s.length} 筆，但最大異動序號為 ${String(max).padStart(5, '0')}`, '異動序號應由 00001 起連續編號，最大序號＝筆數');
      if (s.filter(r => r.addType === 'NEW').length > 1) one(s[1], 'CRL302_01', ['addType'], '同一保單出現多筆新契約 (NEW)', '新契約只會是第一筆');
      for (let i = 0; i < s.length; i++) {
        const a = s[i - 1], b = s[i];
        if (b.addType === 'XEN' && i > 0) one(b, 'CRL302_02', ['addType'], '加保別 XEN (填報年度始日有效) 應為保單第一筆', '確認異動順序');
        if (!a) continue;
        if (b.addType === 'CTC' && a.exitType !== 'CTC') one(b, 'CRL302_03B', ['addType'], `加保別 CTC 時，上一筆退保別應為 CTC (實際為 ${a.exitType})`, '契約轉換前一筆的退保別填 CTC');
        if (b.addType === 'RNN' && a.exitType !== 'LNN') one(b, 'CRL302_04', ['addType'], `加保別 RNN (復效) 時，上一筆退保別應為 LNN (停效)，實際為 ${a.exitType}`, '復效前應有停效的資料');
        if (b.addType === 'EDN' && !['EDD', 'DED'].includes(a.exitType)) one(b, 'CRL302_06', ['addType'], `加保別 EDN 時，上一筆退保別應為 EDD 或 DED，實際為 ${a.exitType}`, '確認上一筆退保別');
        for (const k of SAME) if (a[k] !== b[k]) one(b, 'CRL301', [k], `「${L.field(k).name}」與上一筆不同 (同一保單應相同)`, `確認正確值；若上一筆正確則改為 ${a[k]}`, { field: k, value: a[k] });
        if (b.addType !== 'CTC' && a.exitType !== 'CTC') for (const k of ['termCode', 'startDate', 'endDate']) if (a[k] !== b[k]) one(b, 'CRL302_03', [k], `「${L.field(k).name}」與上一筆不同 (非契約轉換時應相同)`, `若上一筆正確則改為 ${a[k]}`, { field: k, value: a[k] });
      }
    }
    // 終止類退保別
    for (const ex of TERMINAL) { const hit = s.filter(r => r.exitType === ex); if (hit.length > 1) one(hit[1], 'CRL309_01', ['exitType'], `退保別 ${ex} (${T.exitType[ex]}) 出現多筆`, '終止類退保別只會出現一次'); }
    const last = s[s.length - 1];
    s.slice(0, -1).filter(r => TERMINAL.includes(r.exitType)).forEach(r => one(r, 'CRL309_01', ['exitType'], `退保別 ${r.exitType} (${T.exitType[r.exitType]}) 應在保單最後一筆 (最大序號)，但其後仍有資料`, '確認退保別或異動序號'));
    if (dateOk(last.startDate) && mmdd(last.startDate) !== '0101' && last.exitType === 'EDD') one(last, 'CRL309_02', ['exitType'], '保險起日不是 0101，保單最後一筆退保別不可為 EDD', '年底仍有效應填 XED', { field: 'exitType', value: 'XED' });
    if (dateOk(last.endDate) && last.endDate !== '99991231' && last.endDate.slice(0, 4) === last.addYear && ['EDD', 'XED'].includes(last.exitType))
      one(last, 'CRL309_03', ['exitType', 'endDate'], `保險迄日 ${last.endDate} 在本填報年度，最後一筆退保別應為 MAD (滿期)，不是 ${last.exitType}`, '改為 MAD', { field: 'exitType', value: 'MAD' });
    // 保險年齡、暴露數
    const byYear = new Map();
    for (const r of s) { if (!byYear.has(r.policyYear)) byYear.set(r.policyYear, []); byYear.get(r.policyYear).push(r); }
    for (const [py, rs] of byYear) {
      if (new Set(rs.map(r => r.insAge)).size > 1) one(rs[1], 'CRL234_02', ['insAge'], `同一保單年度 (${+py}) 的保險年齡不同`, '同一保單年度保險年齡應相同');
      const sum = rs.reduce((t, r) => t + (num(r.exposure) || 0), 0);
      if (rs.length > 1 && sum > 1000002) one(rs[rs.length - 1], 'CRL304_04', ['exposure'], `同一保單年度 (${+py}) 的暴露數合計 ${(sum / 1e6).toFixed(6)} 大於 1`, '確認各筆有效日數');
    }
    const ys = [...byYear.keys()].sort();
    for (let i = 1; i < ys.length; i++) if (num(byYear.get(ys[i])[0].insAge) <= num(byYear.get(ys[i - 1])[0].insAge)) one(byYear.get(ys[i])[0], 'CRL234_02', ['insAge'], '保單年度較大，但保險年齡沒有變大', '保單年度加 1 時保險年齡也加 1');
  });
  // 唯一鍵 (跨保單)
  const uniqueL = (data, p) => {
    const seen = new Map();
    for (const r of data.CL || []) {
      if (r._raw.length !== L.recordLength) continue;
      const k = [r.company, r.policyNo, r.policySeq, r.addYear, r.seq].join('|');
      if (seen.has(k)) p('CL', r, { ruleId: 'CRL301_01', category: '多筆邏輯', fields: ['seq'], value: r.seq, message: `與第 ${seen.get(k)} 行的公司、保單、加保別異動年、異動序號相同 (重複填送)`, suggestion: '刪除重複資料' });
      else seen.set(k, r._line);
    }
  };

  // ================= 單筆檢核：給付 =================
  const recordD = [];
  const rd = fn => recordD.push(fn);
  rd((r, p) => {
    if (!dateOk(r.eventDate) || r.eventDate <= '19800101') return p({ ruleId: 'CRD239_04', category: '格式', fields: ['eventDate'], value: r.eventDate, message: '事故日期不是合法日期或早於 1980 年', suggestion: '格式 YYYYMMDD (西元)' });
    if (!dateOk(r.payDate) || r.payDate < '20170101') return p({ ruleId: 'CRD239_05', category: '格式', fields: ['payDate'], value: r.payDate, message: '給付日期不是合法日期或早於 2017 年', suggestion: '格式 YYYYMMDD (西元)' });
    if (r.eventDate > r.payDate) p({ ruleId: 'CRD240_01', category: '單筆邏輯', fields: ['eventDate', 'payDate'], value: `${r.eventDate} > ${r.payDate}`, message: '事故日期晚於給付日期', suggestion: '檢查兩日期是否填反' });
    if (/^\d{4}$/.test(r.year) && r.eventDate.slice(0, 4) > r.year) p({ ruleId: 'CRD240_02', category: '單筆邏輯', fields: ['eventDate', 'year'], value: `${r.eventDate.slice(0, 4)} > ${r.year}`, message: '事故年份晚於填報年度', suggestion: '確認事故日期或填報年度' });
  });
  rd((r, p) => {
    const y = num(r.year); if (isNaN(y)) return;
    if (y < 2017 || y > new Date().getFullYear()) p({ ruleId: 'CRD242', category: '單筆邏輯', fields: ['year'], value: r.year, message: `填報年度 ${y} 不在 2017 至今年之間`, suggestion: '填入彙送資料所屬的填報年度' });
  });
  rd((r, p) => {
    const v = r.icd, item = r.item;
    if (v.includes('.')) return p({ ruleId: 'CRD205_01', category: '格式', fields: ['icd'], value: v, message: '罹患癌症種類不可有小數點', suggestion: `改為「${v.replace('.', '').padEnd(7, ' ')}」`, fix: { field: 'icd', value: v.replace('.', '') } });
    if (item === '001' && v !== '0000000') p({ ruleId: 'CRD310_01', category: '單筆邏輯', fields: ['icd', 'item'], value: v, message: '給付項目 001 (非癌死亡)，罹患癌症種類應填 0000000', suggestion: '改為 0000000', fix: { field: 'icd', value: '0000000' } });
    else if (/^0(0[2-9]|1\d|2[0-8])$/.test(item) && !isCancerIcd(v)) p({ ruleId: 'CRD249', category: '代碼', fields: ['icd', 'item'], value: v, message: `給付項目 ${item} (${T.item[item]})，罹患癌症種類「${v.trim()}」不是癌症 ICD-10 代碼`, suggestion: '依 ICD-10-CM 填入癌症代碼，至少前 3 碼 (C00~C96、D00~D09 原位癌)' });
    else if (item === '006' && !/^D0\d/.test(icd3(v))) p({ ruleId: 'CRD249B', category: '單筆邏輯', fields: ['icd', 'item'], value: v, message: '給付項目 006 (原位癌)，罹患癌症種類通常為 D00~D09', suggestion: '確認給付項目或癌症種類' });
  });
  rd((r, p) => {
    const days = num(r.hospDays);
    if (r.item === '013' && !(days > 0)) p({ ruleId: 'CRD241_01', category: '缺漏', fields: ['hospDays', 'item'], value: r.hospDays, message: '給付項目 013 (癌症住院醫療)，住院給付日數應大於 0', suggestion: '填入實際給付的住院日數' });
    if (days > 0 && r.item !== '013') p({ ruleId: 'CRD241_02', category: '單筆邏輯', fields: ['hospDays', 'item'], value: r.hospDays, message: `住院給付日數大於 0，但給付項目為 ${r.item} (不是 013 住院)`, suggestion: '非住院給付的住院日數應為 0', fix: { field: 'hospDays', value: '00000' } });
    if (r.item !== '020' && isZero(r.payAmt)) p({ ruleId: 'CRD246', category: '缺漏', fields: ['payAmt', 'item'], value: r.payAmt, message: `給付項目 ${r.item} 的給付金額不可為 0`, suggestion: '填入該項給付金額 (新臺幣元)' });
  });
  const groupD = [];
  groupD.push((recs, p) => {
    const one = (r, id, fields, msg, sug) => p(r, { ruleId: id, category: '多筆邏輯', fields, value: fields.map(k => r[k]).join('/'), message: msg, suggestion: sug });
    const death2 = recs.filter(r => r.item === '002');
    if (death2.length > 1) one(death2[1], 'CRD306_01', ['item'], '同一保單出現多筆癌症死亡 (002) 給付', '癌症死亡給付只會有一筆');
    if (death2.length && recs.some(r => r.item === '001')) one(recs.find(r => r.item === '001'), 'CRD307_01', ['item'], '同一保單同時有非癌死亡 (001) 與癌症死亡 (002)', '死亡給付只能擇一');
    const maxDate = recs.map(r => r.eventDate).sort().pop();
    for (const d of recs.filter(r => ['001', '002'].includes(r.item))) if (d.eventDate !== maxDate) one(d, 'CRD312_01', ['eventDate', 'item'], `死亡給付的事故日期 ${d.eventDate} 不是此保單最大的日期 (另有 ${maxDate})`, '死亡後不會再有其他事故，請確認日期');
    const hosp = new Map();
    for (const r of recs.filter(x => x.item === '013')) hosp.set(r.eventDate, (hosp.get(r.eventDate) || 0) + (num(r.hospDays) || 0));
    for (const [dt, n] of hosp) if (n > 365) one(recs.find(r => r.item === '013' && r.eventDate === dt), 'CRD305_01', ['hospDays'], `同一事故日期 ${dt} 的住院給付日數合計 ${n} 天，超過 365`, '確認住院日數');
  });
  const uniqueD = (data, p) => {
    const seen = new Map();
    for (const r of data.CD || []) {
      if (r._raw.length !== D.recordLength) continue;
      const k = [r.year, r.company, r.policyNo, r.policySeq, r.eventDate, r.item, r.payDate].join('|');
      if (seen.has(k)) p('CD', r, { ruleId: 'CRD301_02', category: '多筆邏輯', fields: ['item'], value: r.item, message: `與第 ${seen.get(k)} 行的填報年度、保單、事故日期、給付項目、給付日期相同 (重複填送)`, suggestion: '刪除重複資料；同一事故多次給付請合併為一筆' });
      else seen.set(k, r._line);
    }
  };

  // ================= 承保檔與給付檔 =================
  const cross = [uniqueL, uniqueD, (data, p) => {
    const Ls = (data.CL || []).filter(r => r._raw.length === L.recordLength), Ds = (data.CD || []).filter(r => r._raw.length === D.recordLength);
    if (!Ls.length || !Ds.length) return;
    const lBy = new Map(), dBy = new Map();
    for (const r of Ls) { const k = L.keyOf(r); if (!lBy.has(k)) lBy.set(k, []); lBy.get(k).push(r); }
    for (const r of Ds) { const k = D.keyOf(r); if (!dBy.has(k)) dBy.set(k, []); dBy.get(k).push(r); }
    for (const [k, ls] of lBy) {
      const dca = ls.find(r => r.exitType === 'DCA');
      if (dca && dca.coverage[1] === '1' && !(dBy.get(k) || []).some(d => d.item === '002' && d.eventDate.slice(0, 4) === dca.addYear))
        p('CL', dca, { ruleId: 'CRX310_03', fields: ['exitType'], value: 'DCA', message: '退保別為 DCA (癌症死亡)，承保範圍有癌症死亡，但給付檔沒有這張保單的癌症死亡 (002) 給付', suggestion: '補報給付資料，或確認退保別' });
    }
    for (const [k, ds] of dBy) {
      const ls = lBy.get(k);
      if (!ls) { for (const d of ds) p('CD', d, { ruleId: 'CRX310_01', fields: ['policyNo', 'policySeq'], value: k, message: '給付資料的保單在承保檔找不到', suggestion: '確認保單編號/序號是否一致 (含空白補位)，或補報承保資料' }); continue; }
      const l = ls[0];
      for (const d of ds) {
        if (['001', '002'].includes(d.item) && !ls.some(x => ['DCA', 'DEA'].includes(x.exitType)))
          p('CD', d, { ruleId: 'CRX311_03', fields: ['item'], value: d.item, message: `給付項目 ${d.item} (死亡)，但承保檔這張保單的退保別沒有 DCA 或 DEA`, suggestion: '確認承保檔是否漏報死亡異動' });
        if (dateOk(d.eventDate) && dateOk(l.startDate) && dateOk(l.endDate)) {
          const w = num(l.waitDays) || 0;
          if (d.eventDate < l.startDate || d.eventDate > l.endDate) p('CD', d, { ruleId: 'CRX311_04', fields: ['eventDate'], value: d.eventDate, message: `事故日期不在保險期間 ${l.startDate}~${l.endDate} 內`, suggestion: '確認事故日期或承保資料' });
          else if (w && ['003', '004', '005', '006', '007', '022'].includes(d.item) && d.eventDate < X.plusDays(l.startDate, w)) p('CD', d, { ruleId: 'CRX311_04', fields: ['eventDate'], value: d.eventDate, message: `事故日期在等待期間內 (起日 ${l.startDate}＋等待 ${w} 天)`, suggestion: '等待期間內罹癌通常不給付，請確認' });
        }
        const c3 = icd3(d.icd);
        if (l.sex === '1' && FEMALE_ONLY.test(c3) || l.sex === '2' && MALE_ONLY.test(c3))
          p('CD', d, { ruleId: 'CRX315_01', fields: ['icd'], value: d.icd.trim(), message: `罹患癌症種類 ${c3} 與承保檔性別 (${T.sex[l.sex]}) 不符`, suggestion: '確認癌症種類或被保險人性別' });
        const n = num(d.item);
        if (n >= 1 && n <= 28 && l.coverage[n - 1] !== '1')
          p('CD', d, { ruleId: 'CRX313_01', fields: ['item'], value: d.item, message: `給付項目 ${d.item} (${T.item[d.item]}) 不在承保範圍內 (承保範圍第 ${n} 碼為 0)`, suggestion: '確認給付項目，或承保檔的承保範圍是否漏填' });
        if (d.occCode === '00000000' && dateOk(l.startDate) && l.startDate >= '20150301')
          p('CD', d, { ruleId: 'CRX204_01', fields: ['occCode'], value: d.occCode, message: '2015/03/01 起保的保單，事故時職業分類代碼不可為 00000000', suggestion: `可參考承保檔職業代碼 ${l.occCode}`, fix: l.occCode !== '00000000' ? { field: 'occCode', value: l.occCode } : null });
      }
    }
  }];

  return {
    id: 'cancer', name: '個人癌症保險', version: '2024',
    layouts: { CL: L, CD: D }, tables: T, catalog,
    recordRules: { CL: recordL, CD: recordD },
    groupRules: { CL: groupL, CD: groupD },
    crossRules: cross,
    helpers: { isCancerIcd, termOk, MIXED },
  };
});
