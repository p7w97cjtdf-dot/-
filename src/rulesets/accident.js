/*
 * 規則集：人壽保險業「個人傷害保險」年度填報 (PAL 承保資料檔 / PAD 給付資料檔)
 * 來源：傷害保險填報手冊 (110 年版；參、資料欄位說明；陸、資料檢核規則)
 * 檢核編號沿用手冊編號，前面加上 PA (個人傷害保險)，避免與壽險、癌症險編號重複：
 *   PAL13B05 = 承保資料單筆檢核 L13B05；PAL13L02 = 承保資料多筆檢核；PAD15B03 = 給付資料；PALD0L07 = 承保檔與給付檔對應檢核。
 *   手冊沒有編號的欄位格式/代碼檢核用 PAL103_nn / PAL201_nn (承保第 nn 欄)、PAD103_nn / PAD201_nn (給付第 nn 欄)。
 * 範圍：只做個人傷害保險 (PAL/PAD) 的【年度填報】流程 (歷史資料修改代號 = 000)。
 *   未實作：旅行平安保險專用規則、【修改歷史】流程 (L58B02~、L58L01~)、需要前一填報年度檔案或公司另外提供投保上下限的規則
 *   (L33B07/08 等)、需要 ICD-10-CM 第 20 章完整代碼表的事故原因檢核 (只檢查 V00~Y99 樣式)。
 * 多筆檢核：承保檔同一保單號碼 (保單編號＋序號) 的各筆依異動序號排序，「上1筆」指排序後的前一筆；
 *   人數數量合計數自保單第一筆 (NEW / NCT / XEN；或 2021 前停效之 LNN，視為停效前有 1 人) 起累計，
 *   因此承保檔應包含保單自期初有效 (XEN) 或新契約 (NEW) 起的全部異動。
 *   「檔案年度」以承保檔中最大的填報年度推估。
 * 「事故時承保檔」：同一保單契約變更日期 ≦ 事故日期的最後一筆 (都晚於事故日期時取第一筆)。
 * 手冊疑義的處理 (程式中亦有註明)：
 *   LD0L07 原文「事故日期≧迄日」與 D15B03 矛盾，依文意實作為「事故日期≦事故時承保檔之保單迄日」。
 *   D00L06/D00L07 的「給付金額性質代號=4101」應為「給付項目代號=4101」。
 *   L27B04 起日「≧20210120」與表 3．1．13．D 生效日 20210119 不一致，一律以 20210119 為分界。
 *   L13B08「各保費收入欄位≠0」解讀為保費收入不可全為 0。
 *   D50B01 保留欄位「="0"」依欄位長度實作為 "00"。
 *   D18B02/D18B04/D19B05 只對有給付日期 (給付金額性質≠2) 的資料檢查。
 *   L44B01/L50B01/L52B01 對保費應為 0 的契約變更型態 (停效、滿期、解約…) 不檢查保費須大於 0。
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const C = isNode ? require('../core.js') : root.DQ;
  const X = isNode ? require('./ext-common.js') : root.DQ.rulesets.extCommon;
  const m = factory(C, X);
  if (isNode) module.exports = m; else root.DQ.rulesets.accident = m;
})(typeof self !== 'undefined' ? self : this, function (C, X) {
  'use strict';
  const { keys, dateOk, mmdd } = X;
  const num = C.num, isZero = C.isZero, ageAt = C.ageAt, addY = C.addYearsMinusDay;

  // ================= 代碼表 =================
  const T = Object.assign({}, X.T, {
    productVer: { '1': '15 碼版本 (2015/6/30 以前)', '2': '27 碼版本 (2015/7/1 以後)' },
    contractType: { '1': '主約', '2': '附約或附加條款 (有職業類別)', '3': '附約或附加條款 (無職業類別)' },
    bizType: { PE: '個人保單-個人', CP: '個人保單-集體投保 (限微型保險)', TH: '其他保單' },
    groupLink: { '0': '非集體投保微型保險', A: '雇主與員工', B: '合作社、協會、工會與成員', C: '金融機構與債務人', D: '學校與學生', E: '社福慈善團體與服務對象', F: '地方政府與戶籍居民', G: '宗教團體與成員', Z: '其他法人團體與成員' },
    channel: { '1': '壽險公司', '2': '銀行保經', '3': '銀行保代', '4': '一般保經', '5': '一般保代' },
    salesMethod: { '1': '保險業務員', '2': '郵寄', '3': '電話行銷', '4': '網路銷售', '5': '直接投保', '6': '直效行銷', '7': '網路投保', '9': '非以上招攬方式' },
    termType: { A: '小於一年期', B: '一年期', G: '一年期保證續保', T: '年滿期', W: '歲滿期', Y: '終身' },
    changeType: { NEW: '新契約', RNN: '復效', INN: '保額增加', DNN: '保額減少', MNN: '日限額變更', ONN: '職業類別變更', GNN: '保費異動', EOP: '繳費期滿', NCT: '契約轉換1', CTC: '契約轉換2', LNN: '停效', DEA: '疾病死亡', ADS: '意外死亡', TDI: '疾病完全失能', ATS: '意外完全失能', ADB: '意外失能給付合計達保險金額', PAU: '繳清', ROL: '展期', MAD: '滿期', SRD: '解約', RES: '撤銷', LOP: '失效', TMD: '終止', HCC: '危險分類欄位變更', OCA: '職業分類代碼變更', XEN: '填報年度期初有效' },
    idType: { '0': '資料不完整 (僅其他保單)', '1': '身分證', '2': '護照', '3': '居留證', '9': '其他證件' },
    sex: { '0': '其他保單', '1': '男', '2': '女' },
    occClass: { '0': '其他保單/契約別 3', '1': '第 1 類', '2': '第 2 類', '3': '第 3 類', '4': '第 4 類', '5': '第 5 類', '6': '第 6 類', '8': '拒保', '9': '適用特別費率' },
    relation: { '0': '其他', '1': '本人', '2': '配偶', '3': '子女', '4': '父母' },
    econ: Object.fromEntries('0ABCDEFGHIJKMNOPQRSTUVWZ'.split('').map(c => [c, c === '0' ? '非微型保單' : '經濟弱勢者身分 ' + c])),
    currency: Object.fromEntries('AUD KRW CAD MYR CHF NTD CNY NZD DKK PHP EUR SEK GBP SGD HKD THB IDR USD JPY ZAR'.split(' ').map(c => [c, c])),
    scope: { '00': '無該項保險金額', '01': '所有意外事故 (標準型)', '02': '一般意外事故及特定事故 (多倍型)', '03': '僅投保特定事故' },
    special: { '01': '水上大眾運輸', '02': '陸地大眾運輸', '03': '航空大眾運輸', '04': '其他特定意外事故' },
    destination: { N: '非旅遊相關商品', A: '國內', B: '國外', C: '國內外' },
    histCode: Object.fromEntries('000 A01 A20 B01 A30 AB1 AB2 AB3 D01 AD1 AD2 AD3'.split(' ').map(c => [c, c === '000' ? '年度填報' : '修改歷史'])),
    benefitType: { '01': '意外死亡 (已滿 15 足歲)', '11': '意外死亡 (未滿 15 足歲)', '02': '意外失能', '03': '醫療限額 (實支實付)', '04': '醫療日額', '05': '重大燒燙傷', '06': '骨折' },
    payStatus: { S: '結案或免給付結案', P: '分次給付未結案', U: '未給付案' },
    region: { '01': '國內', '02': '大陸 (含港澳)', '03': '國外' },
    amtNature: { '1': '已付金額', '2': '未付金額', '4': '追回金額' },
    diffReason: { '0': '無給付不同', '1': '和解', '2': '違反告知義務', '3': '條款除外責任', '4': '有全民健康保險給付', '9': '其他' },
    fracture: Object.fromEntries('01 02 03 04 05 06 07 08 09 10 11 12 13 14 15 16 17 18 19 20'.split(' ').map((c, i) => [c, [14, 14, 14, 20, 20, 28, 28, 28, 34, 40, 40, 50, 40, 40, 40, 40, 40, 50, 50, 60][i]])),
    burn2: ['1100', '1200', '1300', '1400', '1500', '1600', '1700', '1800', '1900'],
    burn3: ['9481', '9482', '9483', '9484', '9485', '9486', '9487', '9488', '9489'],
    burnFace: ['9400', '9415'],
  });
  // 給付項目代號表 (表3．2．7)：代號 → 可配合的給付類別
  T.benefitItem = {};
  for (const c of '2301 2302 2303 2304 2305 2306 2307 2308 2309 2310 2311 2312 2313 2314 3999'.split(' ')) T.benefitItem[c] = ['03', '04', '05', '06'];
  T.benefitItem['4101'] = ['04'];
  for (let i = 0; i <= 9; i++) T.benefitItem['010' + i] = ['01', '11', '02'];
  T.benefitItem['0110'] = ['02'];
  for (let i = 0; i <= 9; i++) T.benefitItem['020' + i] = ['01', '11'];
  for (let i = 0; i <= 9; i++) T.benefitItem['030' + i] = ['02'];
  T.benefitItem['0310'] = ['02'];
  // 失能程度與保險金給付表 (表3．2．5．A 舊制 / B 新制 / C 2015-08-04 後)；後 2 碼為失能等級
  const GRADE = {
    A: '00000101 00000201 00000301 00000401 00000501 00000601 00000701 00000802 00000902 00001003 00001103 00001203 00001303 00001404 00001504 00001604 00001704 00001804 00001904 00002004 00002104 00002204 00002305 00002405 00002505 00002605 00002706 00002806',
    B: '01010101 01010202 01010303 01010407 02010101 02010205 02010307 02010404 02010506 02010607 03010105 03010207 04010109 05010101 05010205 05010307 06010101 06010202 06010303 06010407 06020109 06030103 07010107 08010101 08010205 08010306 08020103 08020207 08020307 08020407 08020508 08020608 08020709 08020811 08030102 08030203 08030306 08030406 08030507 08030608 08030704 08030805 08030907 08031007 08031108 08031206 08031309 08040105 08040208 08040308 08040408 08040511 08040609 08040710 09010101 09010205 09010306 09020107 09030105 09030207 09040102 09040203 09040306 09040406 09040507 09040608 09040704 09040805 09040907 09041007 09041108 09041206 09041309 09050107 09050209',
    C: '01010101 01010202 01010303 01010407 01010511 02010101 02010205 02010307 02010404 02010506 02010607 03010105 03010207 04010109 04010211 05010101 05010205 05010307 06010101 06010202 06010303 06010407 06020109 06020211 06030103 07010107 07010209 08010101 08010205 08010306 08020103 08020207 08020307 08020407 08020508 08020608 08020709 08020811 08020911 08030102 08030203 08030306 08030406 08030507 08030608 08030704 08030805 08030907 08031007 08031108 08031206 08031309 08040105 08040208 08040308 08040408 08040511 08040609 08040710 09010101 09010205 09010306 09020107 09030105 09030207 09040102 09040203 09040306 09040406 09040507 09040608 09040704 09040805 09040907 09041007 09041108 09041206 09041309 09050107 09050209',
  };
  for (const k of keys(GRADE)) GRADE[k] = new Set(GRADE[k].split(' '));
  T.grade = GRADE;
  // 新制 (表 B/C) 失能等級 1~11 級的給付比例
  const GRADE_RATE = [0, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05];
  // 經濟弱勢者身分代號表 (依保單起日適用的版本)
  const ECON = { A: 'ABCDEFGHZ', B: 'ABCDEFGHIZ', C: 'ABCDEFGHIMNOPQRSTUZ', D: 'ABCDEFGHIJMNOPQRSTUVZ', E: 'ABCDEFGHIJKMNOPQRSTUVWZ' };
  const econTable = s => s < '20140626' ? 'A' : s < '20181225' ? 'B' : s < '20210119' ? 'C' : s < '20250814' ? 'D' : 'E';
  // 混合型含傷害之給付型別 (商品編號第 9-10 碼)
  const ACC_MIX = ['2A', '1D', '2D', '3D', '4D', '5D', '6D', '9D', '2E', '1G', '2G', '3G', '4G', '5G', '6G', '9G', '2H', '2J', '2K'];
  // 公司代號與商品編號第 2-3 碼可對應的代號 (L05B02)
  const CO_ALIAS = { '02': ['54', '58'], '04': ['10', '15'], '05': ['03', '62'], '06': ['12'], '09': ['52'], '18': ['71'], '56': ['70'], '64': ['07'] };
  const ADD_ONE = ['NEW', 'NCT', 'XEN', 'RNN'];                       // 人數 +
  const ZERO_HEAD = ['INN', 'DNN', 'MNN', 'ONN', 'GNN', 'EOP', 'CTC', 'HCC', 'OCA'];   // +00000000
  const MINUS = ['DEA', 'ADS', 'TDI', 'MAD', 'SRD', 'RES', 'LOP', 'TMD', 'LNN', 'ADB']; // 必為 -
  const END_TYPES = ['LNN', 'DEA', 'ADS', 'TDI', 'ATS', 'ADB', 'PAU', 'ROL', 'MAD', 'SRD', 'RES', 'LOP', 'TMD'];
  const NO_PREM = ['EOP', 'LNN', 'PAU', 'ROL', 'MAD', 'SRD', 'LOP', 'RES', 'DEA', 'ADS', 'TDI', 'ATS', 'ADB', 'TMD'];
  const AMTS = ['deathAmt', 'disAmt', 'medLimit', 'medDaily', 'burnAmt', 'fractureAmt'];
  const PREMS = ['premDeathDis', 'premMedLimit', 'premMedDaily', 'premEither', 'premOther'];

  // ================= 小工具 =================
  const pos = v => num(v) > 0;
  const isPE = r => r.bizType === 'PE' || r.bizType === 'CP';
  const micro8 = r => r.productCode[7] === '4';
  const microA = r => r.productVer === '2' && r.productCode[18] === 'A';
  const isMicro = r => micro8(r) || microA(r);
  const is1A = r => r.productCode.slice(8, 10) === '1A';
  const yr = d => +d.slice(0, 4);
  const p3 = n => String(n).padStart(3, '0');
  const ALNUM = /^[A-Z0-9 ]*$/;
  const NOCH = /^[A-Z0-9@_ ]*$/;
  // 產生 issue 的捷徑
  const E = (r, p, cat) => (id, fields, message, suggestion, fix) =>
    p({ ruleId: id, category: cat || '單筆邏輯', fields, value: fields.map(k => (r[k] || '').trim()).join('/'), message, suggestion, fix: fix || null });

  // ================= 欄位格式 =================
  const f = (no, o) => Object.assign({ typeRule: `PAL103_${String(no).padStart(2, '0')}`, codeRule: `PAL201_${String(no).padStart(2, '0')}` }, o);
  const L = X.layout('AL', '傷害保險承保資料檔', 457, [
    ['company', '公司代號', 1, 2, '9', f(1, { ref: '陸-1', codeRule: 'PAL01B02', notZero: true, codes: keys(T.company), codeTable: '表3．1．1 公司簡稱與代號表' })],
    ['policyNo', '保單編號', 3, 15, 'X', f(2, { ref: '陸-1', typeRule: 'PAL02B01', notBlank: true, notZero: true, leftAlign: true, charset: NOCH, charsetHint: '限大寫 A~Z、0~9、@、_，靠左、後補空白' })],
    ['policySeq', '保單編號序號', 18, 5, 'X', f(3, { ref: '陸-1', typeRule: 'PAL03B01', leftAlign: true, charset: NOCH, charsetHint: '限大寫 A~Z、0~9、@、_，靠左、後補空白' })],
    ['seq', '異動序號', 23, 5, '9', f(4, { ref: '陸-1', typeRule: 'PAL04B01' })],
    ['productCode', '保險商品編號', 28, 27, 'X', f(5, { ref: '參-8', notBlank: true, charset: ALNUM, charsetHint: '限大寫 A~Z、0~9' })],
    ['productVer', '保險商品編號適用版本', 55, 1, 'X', f(6, { ref: '陸-3', codeRule: 'PAL06B01', codes: keys(T.productVer), codeTable: '表3．1．18 保險商品編號適用版本代號表' })],
    ['contractType', '契約別', 56, 1, '9', f(7, { ref: '陸-3', codeRule: 'PAL07B01', codes: keys(T.contractType), codeTable: '契約別 (1 主約、2/3 附約)' })],
    ['bizType', '業務性質代號', 57, 2, 'X', f(8, { ref: '陸-3', codeRule: 'PAL08B01', codes: keys(T.bizType), codeTable: '表3．1．4 業務性質代號表' })],
    ['groupLink', '集體投保之連結關係', 59, 1, 'X', f(9, { ref: '陸-3', codeRule: 'PAL09B01', codes: keys(T.groupLink), codeTable: '表3．1．12 集體投保之連結關係代號表' })],
    ['channel', '通路別', 60, 1, '9', f(10, { ref: '陸-4', codeRule: 'PAL10B01', codes: keys(T.channel), codeTable: '表3．1．9 通路別代號表' })],
    ['salesMethod', '招攬方式', 61, 1, '9', f(11, { ref: '陸-4', codeRule: 'PAL11B01', codes: keys(T.salesMethod), codeTable: '表3．1．10 招攬方式代號表' })],
    ['termType', '保險期間別', 62, 1, 'X', f(12, { ref: '陸-4', codeRule: 'PAL12B01', codes: keys(T.termType), codeTable: '表3．1．17 保險期間別代號表' })],
    ['changeType', '契約變更型態代號', 63, 3, 'X', f(13, { ref: '陸-4', codeRule: 'PAL13B01', notBlank: true, codes: keys(T.changeType), codeTable: '表3．1．8．1 契約變更型態代號表' })],
    ['changeDate', '契約變更日期', 66, 8, '9', f(14, { ref: '陸-5', typeRule: 'PAL14B01' })],
    ['startDate', '保單保險期間起日', 74, 8, '9', f(15, { ref: '陸-6', typeRule: 'PAL15B01' })],
    ['endDate', '保單保險期間迄日', 82, 8, '9', f(16, { ref: '陸-6', typeRule: 'PAL16B01' })],
    ['actualDays', '實際投保日數', 90, 4, '9', f(17, { ref: '陸-6', typeRule: 'PAL17B01', codes: v => v === '0000', codeTable: '實際投保日數', codeHint: '個人傷害保險 (非旅平險) 填 0000' })],
    ['headSign', '人數加減號', 94, 1, 'X', f(18, { ref: '陸-6', codeRule: 'PAL18B01', codes: ['+', '-'], codeTable: '人數加減號' })],
    ['headCount', '人數數量', 95, 8, '9', f(19, { ref: '陸-6', typeRule: 'PAL19B01' })],
    ['idType', '證件種類代號', 103, 1, '9', f(20, { ref: '陸-6', codeRule: 'PAL20B01', codes: keys(T.idType), codeTable: '表3．1．6 證件種類代號表' })],
    ['idNo', '證件編號', 104, 10, 'X', f(21, { ref: '參-16' })],
    ['sex', '性別', 114, 1, '9', f(22, { ref: '陸-6', codeRule: 'PAL22B01', codes: ['1', '2', '0'], codeTable: '性別代號表' })],
    ['birthDate', '出生日期', 115, 8, '9', f(23, { ref: '陸-7', typeRule: 'PAL23B01' })],
    ['occClass', '職業類別代號', 123, 1, '9', f(24, { ref: '陸-7', codeRule: 'PAL24B01', codes: keys(T.occClass), codeTable: '表3．1．7．A 職業類別代號表' })],
    ['occCode', '職業分類代碼', 124, 8, 'X', f(25, { ref: '參-17', codes: v => v === '00000000' || X.occOk(v), codeTable: X.occ.table, codeHint: '依職業分類表填 8 碼代號；2015/03/01 前投保或職業類別為 0 者填 00000000' })],
    ['relation', '被保險人與要保人之關係', 132, 1, '9', f(26, { ref: '陸-8', codeRule: 'PAL26B01', codes: keys(T.relation), codeTable: '表3．1．20 被保險人身份代號表' })],
    ['econ', '經濟弱勢者身分', 133, 1, 'X', f(27, { ref: '參-17', codes: keys(T.econ), codeTable: '表3．1．13 經濟弱勢者身分代號表', codeHint: '非微型保單填 0' })],
    ['disabilityCat', '身心障礙類別', 134, 3, 'X', f(28, { ref: '參-22', codes: X.isDisabilityCat, codeTable: '表3．1．14．A/B 身心障礙類別代號表', codeHint: '非身心障礙者填 000' })],
    ['disabilityLevel', '身心障礙等級', 137, 1, '9', f(29, { ref: '陸-8', codeRule: 'PAL29B01', codes: keys(T.disabilityLevel), codeTable: '表3．1．15 身心障礙等級代號表' })],
    ['payerZip', '要保人住所郵遞區號', 138, 3, '9', f(30, { ref: '陸-8', codeRule: 'PAL30B01', codes: X.zipOk, codeTable: '表3．1．22 臺灣地區郵遞區號前3碼一覽表', codeHint: '2019 年前的有效契約資訊不足可填 999；OIU 保單可填 888' })],
    ['insuredZip', '被保險人住所郵遞區號', 141, 3, '9', f(31, { ref: '陸-8', codeRule: 'PAL31B01', codes: X.zipOk, codeTable: '表3．1．22 臺灣地區郵遞區號前3碼一覽表', codeHint: '2019 年前的有效契約資訊不足可填 999；OIU 保單可填 888' })],
    ['currency', '原幣別', 144, 3, 'X', f(32, { ref: '陸-8', codeRule: 'PAL32B01', notBlank: true, codes: keys(T.currency), codeTable: '表3．1．5 幣別代號表' })],
    ['deathAmt', '意外死亡保險金額', 147, 15, '9', f(33, { ref: '陸-8', typeRule: 'PAL33B01' })],
    ['deathScope', '意外死亡保險範圍代號', 162, 2, '9', f(34, { ref: '參-27', codes: keys(T.scope), codeTable: '表3．1．11 保險範圍代號表' })],
    ['deathSpecial', '意外死亡特定意外事故保險範圍代號', 164, 10, 'X', f(35, { ref: '參-28' })],
    ['disAmt', '意外失能保險金額', 174, 15, '9', f(36, { ref: '陸-9', typeRule: 'PAL36B01' })],
    ['disScope', '意外失能保險範圍代號', 189, 2, '9', f(37, { ref: '參-28', codes: keys(T.scope), codeTable: '表3．1．11 保險範圍代號表' })],
    ['disSpecial', '意外失能特定意外事故保險範圍代號', 191, 10, 'X', f(38, { ref: '參-28' })],
    ['medLimit', '醫療限額', 201, 15, '9', f(39, { ref: '陸-10', typeRule: 'PAL39B01' })],
    ['medDaily', '醫療日額', 216, 15, '9', f(40, { ref: '陸-10', typeRule: 'PAL40B01' })],
    ['maxDays', '最高日數限制', 231, 3, '9', f(41, { ref: '參-29' })],
    ['burnAmt', '重大燒燙傷保險金額', 234, 15, '9', f(42, { ref: '陸-10', typeRule: 'PAL42B01' })],
    ['fractureAmt', '骨折保險金額', 249, 15, '9', f(43, { ref: '陸-10', typeRule: 'PAL43B01' })],
    ['premDeathDis', '意外死亡失能保險金額保費收入', 264, 15, '9', f(44, { ref: '參-37' })],
    ['netDeathDis', '意外死亡失能保險金額純保費收入', 279, 15, '9', f(45, { ref: '陸-11', typeRule: 'PAL45B01' })],
    ['premMedLimit', '醫療限額保費收入', 294, 15, '9', f(46, { ref: '參-37' })],
    ['netMedLimit', '醫療限額純保費收入', 309, 15, '9', f(47, { ref: '陸-11', typeRule: 'PAL47B01' })],
    ['premMedDaily', '醫療日額保費收入', 324, 15, '9', f(48, { ref: '參-38' })],
    ['netMedDaily', '醫療日額純保費收入', 339, 15, '9', f(49, { ref: '陸-11', typeRule: 'PAL49B01' })],
    ['premEither', '醫療限額與醫療日額擇一給付者保費收入', 354, 15, '9', f(50, { ref: '參-38' })],
    ['netEither', '醫療限額與醫療日額擇一給付者純保費收入', 369, 15, '9', f(51, { ref: '陸-11', typeRule: 'PAL51B01' })],
    ['premOther', '其他保費收入', 384, 15, '9', f(52, { ref: '參-38' })],
    ['netOther', '其他純保費收入', 399, 15, '9', f(53, { ref: '陸-12', typeRule: 'PAL53B01' })],
    ['year', '填報年度', 414, 4, '9', f(54, { ref: '參-48' })],
    ['companyPolicyCode', '公司保單險種代號', 418, 20, 'X', f(55, { ref: '陸-12', typeRule: 'PAL55B01', notBlank: true })],
    ['destination', '目的地', 438, 1, 'X', f(56, { ref: '參-48', codes: keys(T.destination), codeTable: '目的地代號表' })],
    ['histCode', '歷史資料修改代號', 439, 3, 'X', f(57, { ref: '參-49', codes: keys(T.histCode), codeTable: '表3．1．23 歴史資料修改代號表' })],
    ['reserved', '保留欄位', 442, 16, 'X', f(58, { ref: '參-49', default: '0000000000000000' })],
  ], {
    fileName: { re: /^PAL\d{6}\.txt$/i, pattern: 'PAL+填報年度+公司代號.txt', example: 'PAL202501.txt' },
    keyOf: r => (r.policyNo || '').trimEnd() + '/' + (r.policySeq || '').trimEnd(),
    sheet: '傷害險保單資料',
  });

  const g = (no, o) => Object.assign({ typeRule: `PAD103_${String(no).padStart(2, '0')}`, codeRule: `PAD201_${String(no).padStart(2, '0')}` }, o);
  const D = X.layout('AD', '傷害保險給付資料檔', 287, [
    ['benefitType', '給付類別代號', 1, 2, '9', g(1, { ref: '陸-15', codeRule: 'PAD01B01', codes: keys(T.benefitType), codeTable: '表3．2．1 給付類別代號表' })],
    ['benefitItem', '給付項目代號', 3, 4, '9', g(2, { ref: '陸-15', codeRule: 'PAD02B01', codes: keys(T.benefitItem), codeTable: '表3．2．7 給付項目代號表' })],
    ['company', '公司代號', 7, 2, '9', g(3, { ref: '參-54', notZero: true, codes: keys(T.company), codeTable: '表3．1．1 公司簡稱與代號表' })],
    ['policyNo', '保單編號', 9, 15, 'X', g(4, { ref: '陸-15', typeRule: 'PAD04B01', notBlank: true, notZero: true, leftAlign: true, charset: NOCH, charsetHint: '限大寫 A~Z、0~9、@、_，靠左、後補空白' })],
    ['policySeq', '保單編號序號', 24, 5, 'X', g(5, { ref: '陸-15', typeRule: 'PAD05B01', leftAlign: true, charset: NOCH, charsetHint: '限大寫 A~Z、0~9、@、_，靠左、後補空白' })],
    ['claimNo', '賠案號碼', 29, 15, 'X', g(6, { ref: '陸-15', typeRule: 'PAD06B01', notBlank: true, notZero: true, leftAlign: true, charset: NOCH, charsetHint: '限大寫 A~Z、0~9、@、_，靠左、後補空白' })],
    ['productCode', '保險商品編號', 44, 27, 'X', g(7, { ref: '參-54', notBlank: true, charset: ALNUM, charsetHint: '限大寫 A~Z、0~9' })],
    ['productVer', '保險商品編號適用版本代號', 71, 1, 'X', g(8, { ref: '陸-15', codeRule: 'PAD08B01', codes: keys(T.productVer), codeTable: '表3．1．18 保險商品編號適用版本代號表' })],
    ['contractType', '契約別', 72, 1, '9', g(9, { ref: '陸-16', codeRule: 'PAD09B01', codes: keys(T.contractType), codeTable: '契約別 (1 主約、2/3 附約)' })],
    ['bizType', '業務性質代號', 73, 2, 'X', g(10, { ref: '陸-16', codeRule: 'PAD10B01', codes: keys(T.bizType), codeTable: '表3．1．4 業務性質代號表' })],
    ['groupLink', '集體投保之連結關係', 75, 1, 'X', g(11, { ref: '陸-16', codeRule: 'PAD11B01', codes: keys(T.groupLink), codeTable: '表3．1．12 集體投保之連結關係代號表' })],
    ['termType', '保險期間別', 76, 1, 'X', g(12, { ref: '陸-16', codeRule: 'PAD12B01', codes: keys(T.termType), codeTable: '表3．1．17 保險期間別代號表' })],
    ['startDate', '保單保險期間起日', 77, 8, '9', g(13, { ref: '參-55' })],
    ['endDate', '保單保險期間迄日', 85, 8, '9', g(14, { ref: '參-55' })],
    ['accidentDate', '事故日期', 93, 8, '9', g(15, { ref: '陸-16', typeRule: 'PAD15B01' })],
    ['applyDate', '申請日期', 101, 8, '9', g(16, { ref: '陸-16', typeRule: 'PAD16B01' })],
    ['payDate', '給付日期', 109, 8, '9', g(17, { ref: '參-55' })],
    ['admitDate', '入院日期', 117, 8, '9', g(18, { ref: '陸-16', typeRule: 'PAD18B01' })],
    ['dischargeDate', '出院日期', 125, 8, '9', g(19, { ref: '陸-16', typeRule: 'PAD19B01' })],
    ['hospDays', '住院日數', 133, 3, '9', g(20, { ref: '陸-16', typeRule: 'PAD20B01' })],
    ['idType', '證件類別代號', 136, 1, '9', g(21, { ref: '參-56', codes: keys(T.idType), codeTable: '表3．1．6 證件種類代號表' })],
    ['idNo', '證件編號', 137, 10, 'X', g(22, { ref: '參-56' })],
    ['sex', '性別', 147, 1, '9', g(23, { ref: '陸-16', codeRule: 'PAD23B01', codes: ['1', '2'], codeTable: '性別代號表' })],
    ['birthDate', '出生日期', 148, 8, '9', g(24, { ref: '陸-16', typeRule: 'PAD24B01' })],
    ['occClass', '事故時職業類別代號', 156, 1, '9', g(25, { ref: '陸-17', codeRule: 'PAD25B01', codes: keys(T.occClass), codeTable: '表3．1．7．A 職業類別代號表' })],
    ['occCode', '事故時職業分類代碼', 157, 8, 'X', g(26, { ref: '參-56', codes: v => v === '00000000' || X.occOk(v), codeTable: X.occ.table, codeHint: '依職業分類表填 8 碼代號；2015/03/01 前投保或職業類別為 0 者填 00000000' })],
    ['relation', '被保險人與要保人之關係', 165, 1, '9', g(27, { ref: '參-56', codes: keys(T.relation), codeTable: '表3．1．20 被保險人身份代號表' })],
    ['econ', '經濟弱勢者身分', 166, 1, 'X', g(28, { ref: '參-57', codes: keys(T.econ), codeTable: '表3．1．13 經濟弱勢者身分代號表', codeHint: '非微型保單填 0' })],
    ['disabilityCat', '身心障礙類別', 167, 3, 'X', g(29, { ref: '參-57', codes: X.isDisabilityCat, codeTable: '表3．1．14．A/B 身心障礙類別代號表', codeHint: '非身心障礙者填 000' })],
    ['disabilityLevel', '身心障礙等級', 170, 1, '9', g(30, { ref: '參-57', codes: keys(T.disabilityLevel), codeTable: '表3．1．15 身心障礙等級代號表' })],
    ['payStatus', '給付狀態代號', 171, 1, 'X', g(31, { ref: '陸-18', codeRule: 'PAD31B01', codes: keys(T.payStatus), codeTable: '給付狀態代號 (S/P/U)' })],
    ['causeCode', '事故原因代號', 172, 7, 'X', g(32, { ref: '參-58' })],
    ['regionCode', '事故地區代號', 179, 2, '9', g(33, { ref: '陸-18', codeRule: 'PAD33B01', codes: keys(T.region), codeTable: '表3．2．12 事故地區代號表' })],
    ['amtNature', '給付金額性質代號', 181, 1, '9', g(34, { ref: '陸-18', codeRule: 'PAD34B01', codes: keys(T.amtNature), codeTable: '表3．2．2 給付金額性質代號表' })],
    ['currency', '原幣別', 182, 3, 'X', g(35, { ref: '參-58', notBlank: true, codes: keys(T.currency), codeTable: '表3．1．5 幣別代號表' })],
    ['dueAmt', '應給付保險金額日額', 185, 15, '9', g(36, { ref: '參-59' })],
    ['dueMultiple', '應給付保險金額日額給付倍數', 200, 6, '9', g(37, { ref: '參-59' })],
    ['dueDays', '應給付日數', 206, 3, '9', g(38, { ref: '參-60' })],
    ['paidAmt', '實際給付保險金額', 209, 15, '9', g(39, { ref: '參-60' })],
    ['paidMultiple', '實際給付保險金額給付倍數', 224, 6, '9', g(40, { ref: '參-60' })],
    ['paidDays', '實際給付日數', 230, 3, '9', g(41, { ref: '參-60' })],
    ['diffReason', '給付額不同原因', 233, 1, '9', g(42, { ref: '陸-19', codeRule: 'PAD42B01', codes: keys(T.diffReason), codeTable: '給付額不同原因代號表' })],
    ['disabilityGrade', '失能項次等級代號', 234, 8, '9', g(43, { ref: '參-62' })],
    ['fractureCode', '骨折給付代號', 242, 2, '9', g(44, { ref: '參-62' })],
    ['burn2Code', '二度燒燙傷面積代號', 244, 4, '9', g(45, { ref: '參-63' })],
    ['burn3Code', '三度燒燙傷代號', 248, 4, '9', g(46, { ref: '參-64' })],
    ['burnFaceCode', '顏面燒燙傷代號', 252, 4, '9', g(47, { ref: '參-65' })],
    ['handlingFee', '處理費用', 256, 8, '9', g(48, { ref: '陸-20', typeRule: 'PAD48B01' })],
    ['year', '填報年度', 264, 4, '9', g(49, { ref: '參-66' })],
    ['applyAmt', '申請金額', 268, 15, '9', g(50, { ref: '陸-20', typeRule: 'PAD51B01' })],
    ['applyDays', '申請日數', 283, 3, '9', g(51, { ref: '陸-20', typeRule: 'PAD52B01' })],
    ['reserved', '保留欄位', 286, 2, 'X', g(52, { ref: '參-66', default: '00' })],
  ], {
    fileName: { re: /^PAD\d{6}\.txt$/i, pattern: 'PAD+填報年度+公司代號.txt', example: 'PAD202501.txt' },
    keyOf: r => (r.policyNo || '').trimEnd() + '/' + (r.policySeq || '').trimEnd(),
    sheet: '傷害險理賠資料',
  });

  // ================= 單筆檢核：承保 =================
  const recordL = [];
  const rl = fn => recordL.push(fn);
  const PC_HINT = '請依「人身保險商品編號性質說明表」(15 碼版) 或「人身保險商品編碼原則」(27 碼版) 確認商品編號';

  // 商品編號 (L05、L07)
  rl((r, p) => {
    const c = r.productCode, v = r.productVer, e = E(r, p);
    if (!['1', '2'].includes(v)) return;
    const bad = (id, n, what, fields) => e(id, fields || ['productCode'], `保險商品編號第 ${n} 碼「${c.slice(+String(n).split('-')[0] - 1, +String(n).split('-').pop())}」${what}`, PC_HINT);
    if (c[0] !== '2') bad('PAL05B01', 1, '應為 2 (壽險業)');
    if (![r.company].concat(CO_ALIAS[r.company] || []).includes(c.slice(1, 3))) bad('PAL05B02', '2-3', `與公司代號 ${r.company} 不符`, ['productCode', 'company']);
    const d4 = c[3], d5 = c[4];
    if (!'1234'.includes(d4)) bad('PAL05B03', 4, '不是險別大分類代碼 (1 人壽、2 傷害、3 健康、4 年金)');
    else if (d4 === '1' && !(v === '1' ? '12349' : '1239').includes(d5)) bad(v === '1' ? 'PAL05B04' : 'PAL05B05', 5, '不是人壽保險的細分類代碼', ['productCode', 'productVer']);
    else if (d4 === '2' && !'12349'.includes(d5)) bad('PAL05B06', 5, '不是傷害保險的細分類代碼 (1、2、3、4、9)');
    else if (d4 === '3' && !'1234569'.includes(d5)) bad('PAL05B07', 5, '不是健康保險的細分類代碼');
    else if (d4 === '4' && !'129'.includes(d5)) bad('PAL05B08', 5, '不是年金保險的細分類代碼');
    if (c.slice(3, 5) === '22') e('PAL05B10', ['productCode'], '保險商品編號第 4-5 碼為 22 (旅行平安保險)，不應填在個人傷害保險 (PAL) 檔', '旅行平安保險請改填 TAL 檔');
    if (v === '1' && !'1236'.includes(c[5])) bad('PAL05B11', 6, '不是個人/團體別代碼 (1、2、3、6)', ['productCode', 'productVer']);
    if (v === '2' && !'1369'.includes(c[5])) bad('PAL05B12', 6, '不是個人/團體別代碼 (1、3、6、9)', ['productCode', 'productVer']);
    if (!'MRAEN'.includes(c[6])) bad('PAL05B13', 7, '不是契約別代碼 (M、R、A、E、N)', ['productCode', 'contractType']);
    if (v === '1' && !'1234'.includes(c[7])) bad('PAL05B14', 8, '不是傳統/非傳統代碼 (1~4)', ['productCode', 'productVer']);
    if (v === '2' && !'ABZUV'.includes(c[7])) bad('PAL05B15', 8, '不是傳統/非傳統代碼 (A、B、Z、U、V)', ['productCode', 'productVer']);
    if (!(d4 === '2' || ACC_MIX.includes(c.slice(8, 10)))) e('PAL05B21', ['productCode'], `保險商品編號第 4 碼不是 2 (傷害保險)，第 9-10 碼「${c.slice(8, 10)}」也不是含傷害的混合型`, '確認此商品是否屬於傷害保險填報對象，或商品編號是否填錯');
    if (v === '1') {
      if (!/^\d\d$/.test(c.slice(13, 15))) bad('PAL05B22', '14-15', '(部分變更代碼) 只能是數字', ['productCode', 'productVer']);
      if (!/^0{12}$/.test(c.slice(15))) bad('PAL05B23', '16-27', '應補滿 0 (15 碼版本)', ['productCode', 'productVer']);
      return;
    }
    const chk = [['PAL05B24', 14, '123', '審查制度別'], ['PAL05B25', 15, '123', '年期別'], ['PAL05B26', 16, 'ABCDEFGHIJKZ', '幣別'], ['PAL05B27', 17, '123', '體況別'],
      ['PAL05B28', 18, '12', '給付方式別'], ['PAL05B29', 19, 'ABCDEZ', '特殊類型商品別'], ['PAL05B30', 20, '1239', '投資標的別']];
    for (const [id, n, ok, what] of chk) if (!ok.includes(c[n - 1])) bad(id, n, `不是${what}代碼`, ['productCode', 'productVer']);
    if (c.slice(20, 25) !== '00000') bad('PAL05B31', '21-25', '(保留碼) 應為 00000', ['productCode', 'productVer']);
    if (!/^\d\d$/.test(c.slice(25, 27))) bad('PAL05B32', '26-27', '(部分變更代碼) 只能是數字', ['productCode', 'productVer']);
    const t = c[14], tt = r.termType;
    if (T.termType[tt]) {
      const te = (id, msg) => e(id, ['productCode', 'termType'], `保險商品編號第 15 碼 (年期別) 為 ${t}，${msg}，但保險期間別為 ${tt}`, '確認保險期間別或商品編號第 15 碼 (1 一年期、2 定期、3 終身)');
      if (t === '1' && !'ABG'.includes(tt)) te('PAL05B33', '保險期間別應為 A、B 或 G');
      if (t !== '1' && 'ABG'.includes(tt)) te('PAL05B34', '保險期間別不可為 A、B、G');
      if (t === '2' && !'TW'.includes(tt)) te('PAL05B35', '保險期間別應為 T 或 W');
      if (t !== '2' && 'TW'.includes(tt)) te('PAL05B36', '保險期間別不可為 T、W');
      if (t === '3' && tt !== 'Y') te('PAL05B37', '保險期間別應為 Y');
      if (t !== '3' && tt === 'Y') te('PAL05B38', '保險期間別不可為 Y');
    }
    const ci = 'ABCDEFGHIJK'.indexOf(c[15]);
    const CUR = ['NTD', 'USD', 'GBP', 'AUD', 'EUR', 'HKD', 'NZD', 'CAD', 'SGD', 'CNY', 'JPY'];
    if (ci >= 0 && r.currency !== CUR[ci]) e('PAL05B' + (39 + ci), ['productCode', 'currency'], `保險商品編號第 16 碼為 ${c[15]}，原幣別應為 ${CUR[ci]}，實際為 ${r.currency}`, `改為 ${CUR[ci]}`, { field: 'currency', value: CUR[ci] });
  });
  rl((r, p) => {
    const e = E(r, p), m7 = r.productCode[6] === 'M';
    if (r.contractType === '1' && !m7) e('PAL07B02', ['contractType', 'productCode'], '契約別為 1 (主約)，但商品編號第 7 碼不是 M', '主約的商品編號第 7 碼應為 M；附約請填契約別 2 或 3');
    if (['2', '3'].includes(r.contractType) && m7) e('PAL07B03', ['contractType', 'productCode'], `契約別為 ${r.contractType} (附約)，但商品編號第 7 碼為 M (主契約)`, '確認契約別或商品編號');
  });
  // 微型保險、業務性質、集體投保 (L05B16、L05B50、L08、L09、L12B09)
  rl((r, p) => {
    const e = E(r, p), pe = isPE(r);
    if (micro8(r) && !pe) e('PAL05B16', ['productCode', 'bizType'], '商品編號第 8 碼為 4 (微型保險)，業務性質應為 PE 或 CP', '確認業務性質代號');
    if (microA(r) && !pe) e('PAL05B50', ['productCode', 'bizType'], '商品編號第 19 碼為 A (微型保險)，業務性質應為 PE 或 CP', '確認業務性質代號');
    if (r.bizType === 'CP' && !isMicro(r)) e('PAL08B02', ['bizType', 'productCode'], '業務性質 CP (集體投保) 限微型保險，但商品編號不是微型保險', '非微型保險請填 PE 或 TH');
    const gl = T.groupLink[r.groupLink] && r.groupLink !== '0';
    if (r.bizType === 'CP' && r.groupLink === '0') e('PAL08B06', ['bizType', 'groupLink'], '業務性質為 CP (集體投保)，集體投保之連結關係不可為 0', '依表3．1．12 填連結關係代號');
    if (T.bizType[r.bizType] && r.bizType !== 'CP' && gl) e('PAL08B07', ['bizType', 'groupLink'], `業務性質為 ${r.bizType}，集體投保之連結關係應填 0`, '改為 0', { field: 'groupLink', value: '0' });
    if (gl && !isMicro(r)) e('PAL09B02', ['groupLink', 'productCode'], '有集體投保之連結關係，但商品編號不是微型保險', '非微型保險的連結關係填 0');
    if (gl && r.bizType !== 'CP') e('PAL09B03', ['groupLink', 'bizType'], '有集體投保之連結關係，業務性質應為 CP', '確認業務性質代號');
    if ((r.bizType === 'CP' || isMicro(r)) && T.termType[r.termType] && r.termType !== 'B') e('PAL12B09', ['termType', 'bizType', 'productCode'], '微型保險 (或集體投保 CP) 的保險期間別應為 B (一年期)', '改為 B');
    // 經濟弱勢者身分 (依起日適用版本)
    if (!dateOk(r.startDate) || !T.econ[r.econ]) return;
    const tb = econTable(r.startDate), inT = ECON[tb].includes(r.econ), ix = 'ABCDE'.indexOf(tb);
    const msg = why => `${why}，經濟弱勢者身分「${r.econ}」不在表3．1．13．${tb} (保單起日 ${r.startDate} 適用) 內`;
    const sug = '微型保險依起日適用的經濟弱勢者身分代號表填列';
    if (r.econ !== '0' && !inT) e(['PAL27B01', 'PAL27B02', 'PAL27B03', 'PAL27B04', 'PAL27B05'][ix], ['econ', 'startDate'], msg('依保單起日'), '非微型保單填 0；微型保單依起日適用版本填代號');
    if (inT) return;
    if (micro8(r)) e(['PAL05B17', 'PAL05B18', 'PAL05B19', 'PAL05B55', 'PAL05B57'][ix], ['econ', 'productCode'], msg('商品編號第 8 碼為 4 (微型保險)'), sug);
    if (microA(r)) e(['PAL05B51', 'PAL05B52', 'PAL05B53', 'PAL05B56', 'PAL05B58'][ix], ['econ', 'productCode'], msg('商品編號第 19 碼為 A (微型保險)'), sug);
    if (r.bizType === 'CP') e(['PAL08B03', 'PAL08B04', 'PAL08B05', 'PAL08B13', 'PAL08B14'][ix], ['econ', 'bizType'], msg('業務性質為 CP'), sug);
    if (gl) e(['PAL09B04', 'PAL09B05', 'PAL09B06', 'PAL09B07', 'PAL09B08'][ix], ['econ', 'groupLink'], msg('有集體投保之連結關係'), sug);
  });
  // 日期 (L14、L15、L16)
  rl((r, p) => {
    const e = E(r, p), cd = r.changeDate, s = r.startDate, en = r.endDate, y = num(r.year), ct = r.changeType;
    const okC = dateOk(cd), okS = dateOk(s), okE = dateOk(en);
    if (/^\d{8}$/.test(cd) && !okC) E(r, p, '格式')('PAL14B01', ['changeDate'], '契約變更日期不是合法日期', '格式 YYYYMMDD (西元)');
    if (/^\d{8}$/.test(s) && !okS) E(r, p, '格式')('PAL15B01', ['startDate'], '保單保險期間起日不是合法日期', '格式 YYYYMMDD (西元)');
    if (/^\d{8}$/.test(en) && !okE) E(r, p, '格式')('PAL16B01', ['endDate'], '保單保險期間迄日不是合法日期', '格式 YYYYMMDD (西元)');
    if (okC && okS && cd < s) e('PAL14B02', ['changeDate', 'startDate'], `契約變更日期 ${cd} 早於保險期間起日 ${s}`, '檢查日期是否填錯');
    if (okC && okE && cd > en) e('PAL14B03', ['changeDate', 'endDate'], `契約變更日期 ${cd} 晚於保險期間迄日 ${en}`, '檢查日期是否填錯');
    if (okC && okE && cd === en && ['SRD', 'LOP', 'TMD'].includes(ct)) e('PAL14B04', ['changeDate', 'changeType'], `契約變更日期等於保險期間迄日，契約變更型態不可為 ${ct}`, '到期日當天結束應填 MAD (滿期)');
    if (okC && !isNaN(y) && yr(cd) > y) e('PAL14B05', ['changeDate', 'year'], `契約變更日期的年度 ${yr(cd)} 晚於填報年度 ${y}`, '確認契約變更日期或填報年度');
    if (okS && !isNaN(y) && yr(s) > y) e('PAL15B02', ['startDate', 'year'], `保險期間起日的年度 ${yr(s)} 晚於填報年度 ${y}`, '確認起日或填報年度');
    if (okS && okE && en < s) e('PAL16B02', ['startDate', 'endDate'], '保險期間迄日早於起日', '檢查兩日期是否填反');
    if (!okS || !okE || en < s) return;
    // 保險期間別 (L12)
    const tt = r.termType, main = r.contractType === '1', y1 = addY(s, 1);
    const sameMd = mmdd(X.plusDays(en, 1)) === mmdd(s) || mmdd(s) === '0229';
    if (tt === 'A' && en >= y1) e('PAL12B02', ['termType', 'startDate', 'endDate'], '保險期間別為 A (小於一年期)，但保險期間達 1 年以上', '確認保險期間別或迄日');
    if (tt === 'B' && main && en !== y1) e('PAL12B03', ['termType', 'startDate', 'endDate'], `保險期間別為 B (一年期) 主約，迄日應為 ${y1} (起日加 1 年減 1 天)`, `改為 ${y1}`, { field: 'endDate', value: y1 });
    if (['G', 'T', 'W'].includes(tt) && main && (en < y1 || !sameMd)) e('PAL12B04', ['termType', 'startDate', 'endDate'], `保險期間別為 ${tt} 的主約，保險期間應至少 1 年且迄日為起日週年日的前一天`, '確認迄日 (月日應為起日月日前一天)');
    if (tt === 'G' && !main && en < y1) e('PAL12B05', ['termType', 'startDate', 'endDate'], '保險期間別為 G (一年期保證續保)，保險期間應至少 1 年', '確認保險期間別或迄日');
    if (tt === 'T' && (en < y1 || en > addY(s, 35))) e('PAL12B06', ['termType', 'startDate', 'endDate'], `保險期間別為 T (年滿期)，保險期間應介於 1 年與 34 年之間，實際約 ${yr(en) - yr(s)} 年`, '確認保險期間別或迄日');
    if (['W', 'Y'].includes(tt) && dateOk(r.birthDate) && r.birthDate <= s) {
      const ages = [ageAt(r.birthDate, en), ageAt(r.birthDate, X.plusDays(en, 1))];
      const okW = a => a === 15 || (a >= 20 && a <= 27) || (a >= 35 && a <= 110);
      if (tt === 'W' && !ages.some(okW)) e('PAL12B07', ['termType', 'endDate', 'birthDate'], `保險期間別為 W (歲滿期)，迄日時被保險人 ${ages[1]} 歲，不是 15、20~27 或 35~110 歲`, '確認迄日或出生日期');
      if (tt === 'Y' && !ages.some(a => a >= 81 && a <= 150)) e('PAL12B08', ['termType', 'endDate', 'birthDate'], `保險期間別為 Y (終身)，迄日時被保險人 ${ages[1]} 歲，應介於 81 與 150 歲`, '終身保險的迄日應為保單規定的最高年齡');
    }
  });
  // 契約變更型態 (L13、L04B02/03)
  rl((r, p) => {
    const e = E(r, p), ct = r.changeType, cd = r.changeDate, pe = isPE(r);
    if (!T.changeType[ct]) return;
    if (ct === 'ADS' && !pos(r.deathAmt)) e('PAL13B02', ['changeType', 'deathAmt'], '契約變更型態為 ADS (意外死亡)，意外死亡保險金額應大於 0', '確認契約變更型態或意外死亡保額');
    if (['ATS', 'ADB'].includes(ct) && !pos(r.disAmt)) e('PAL13B03', ['changeType', 'disAmt'], `契約變更型態為 ${ct}，意外失能保險金額應大於 0`, '確認契約變更型態或意外失能保額');
    if (ct === 'MAD' && dateOk(cd) && cd !== r.endDate) e('PAL13B04', ['changeType', 'changeDate', 'endDate'], `契約變更型態為 MAD (滿期)，契約變更日期應等於保險期間迄日 ${r.endDate}`, `改為 ${r.endDate}`, { field: 'changeDate', value: r.endDate });
    if (['NEW', 'NCT', 'XEN'].includes(ct) && !['00000', '00001'].includes(r.seq)) e('PAL13B05', ['changeType', 'seq'], `契約變更型態為 ${ct}，異動序號應為 00000 或 00001`, `${ct} 應為保單第一筆`);
    if (ct === 'NEW' && dateOk(cd) && cd !== r.startDate) e('PAL13B07', ['changeType', 'changeDate', 'startDate'], `新契約 (NEW) 的契約變更日期應等於保險期間起日 ${r.startDate}`, `改為 ${r.startDate}`, { field: 'changeDate', value: r.startDate });
    if (['NEW', 'NCT', 'GNN'].includes(ct) && is1A(r) && PREMS.every(k => isZero(r[k]))) e('PAL13B08', ['changeType'].concat(PREMS), `基本型 (1A) 商品契約變更型態為 ${ct}，保費收入欄位不可全為 0`, '填入年繳化保費收入 (四捨五入後為 0 元者填 1)');
    if (ct === 'TMD' && dateOk(cd) && dateOk(r.endDate) && cd >= r.endDate) e('PAL13B09', ['changeType', 'changeDate', 'endDate'], '契約變更型態為 TMD (終止)，契約變更日期應早於保險期間迄日', '到期結束應填 MAD');
    if (ct === 'MNN' && pos(r.medLimit) === pos(r.medDaily)) e('PAL13B10', ['changeType', 'medLimit', 'medDaily'], '契約變更型態為 MNN (日限額變更)，醫療限額與醫療日額只能其中一項大於 0', '醫療限額與醫療日額互轉後只保留一項');
    if (ct === 'HCC' && (r.disabilityCat === '000' || r.disabilityLevel === '0')) e('PAL13B11', ['changeType', 'disabilityCat', 'disabilityLevel'], '契約變更型態為 HCC (危險分類變更)，身心障礙類別不可為 000、等級不可為 0', '填入變更後的身心障礙類別與等級');
    if (['PAU', 'ROL'].includes(ct) && r.productCode[3] !== '2' && !['2A', '2G', '2H', '2K', '1B', '3B', '4B', '5B', '6B', '9B', '1G', '3G', '4G', '5G', '6G', '9D', '9G'].includes(r.productCode.slice(8, 10)))
      e('PAL13B12', ['changeType', 'productCode'], `契約變更型態為 ${ct} (繳清/展期)，只會發生在與人壽保險混合型的保單`, '確認契約變更型態或商品編號第 9-10 碼');
    if (ct === 'XEN' && dateOk(r.startDate) && r.startDate >= '20210101') e('PAL13B13', ['changeType', 'startDate'], 'XEN (期初有效) 的保險期間起日應早於 20210101', '2021 年起投保的保單第一筆應為 NEW');
    if (ct === 'XEN' && !['20200101', '20210101'].includes(cd)) e('PAL13B14', ['changeType', 'changeDate'], 'XEN (期初有效) 的契約變更日期應為 20200101 或 20210101', '改為 20210101', { field: 'changeDate', value: '20210101' });
    if (['EOP', 'LNN', 'PAU', 'MAD', 'SRD', 'LOP'].includes(ct) && !PREMS.every(k => isZero(r[k]))) e('PAL13B15', ['changeType'].concat(PREMS), `契約變更型態為 ${ct}，各保費收入欄位應為 0`, '停效、繳清、滿期、解約、失效、繳費期滿後沒有保費收入，請填 0');
    if (r.seq === '00001' && pe && ['DEA', 'ADS', 'ADB', 'MAD', 'SRD', 'RES', 'LOP', 'TMD'].includes(ct)) e('PAL04B02', ['seq', 'changeType'], `個人保單第一筆 (異動序號 00001) 的契約變更型態不可為 ${ct}`, '保單有多筆時第一筆應為 NEW/XEN；只有 1 筆時異動序號填 00000');
    if (r.seq === '00001' && pe && r.headSign === '-' && ['ATS', 'PAU', 'ROL'].includes(ct)) e('PAL04B03', ['seq', 'changeType', 'headSign'], `個人保單第一筆 (異動序號 00001) 不可為人數減少的 ${ct}`, '確認異動序號或契約變更型態');
  });
  // 人數 (L08B08~B11、L18、L19)
  rl((r, p) => {
    const e = E(r, p), ct = r.changeType, n = num(r.headCount), sg = r.headSign;
    if (!T.changeType[ct] || isNaN(n)) return;
    const list = ['NEW', 'NCT', 'RNN', 'LNN', 'DEA', 'ADS', 'TDI', 'ADB', 'MAD', 'SRD', 'RES', 'LOP', 'TMD'];
    if (isPE(r) && list.includes(ct) && n !== 1) e('PAL08B08', ['bizType', 'changeType', 'headCount'], `個人保單契約變更型態為 ${ct}，人數數量應為 00000001`, '改為 00000001', { field: 'headCount', value: '00000001' });
    if (isPE(r) && ['ATS', 'PAU', 'ROL'].includes(ct) && sg === '-' && n !== 1) e('PAL08B09', ['bizType', 'changeType', 'headCount'], `個人保單 ${ct} 且人數減少時，人數數量應為 00000001`, '改為 00000001', { field: 'headCount', value: '00000001' });
    if (r.bizType === 'TH' && list.includes(ct) && n < 1) e('PAL08B10', ['bizType', 'changeType', 'headCount'], `其他保單契約變更型態為 ${ct}，人數數量應至少為 1`, '填入異動人數');
    if (r.bizType === 'TH' && ['ATS', 'PAU', 'ROL'].includes(ct) && sg === '-' && n < 1) e('PAL08B11', ['bizType', 'changeType', 'headCount'], `其他保單 ${ct} 且人數減少時，人數數量應至少為 1`, '填入異動人數');
    if (!['+', '-'].includes(sg)) return;
    if (!MINUS.includes(ct) && !['ATS', 'PAU', 'ROL'].includes(ct) && sg !== '+') e('PAL18B02', ['headSign', 'changeType'], `契約變更型態為 ${ct}，人數加減號應為 +`, '改為 +', { field: 'headSign', value: '+' });
    if (MINUS.includes(ct) && sg !== '-') e('PAL18B03', ['headSign', 'changeType'], `契約變更型態為 ${ct} (效力結束)，人數加減號應為 -`, '改為 -', { field: 'headSign', value: '-' });
    if (n === 0 && sg !== '+') e('PAL19B02', ['headCount', 'headSign'], '人數數量為 0 時，人數加減號應為 +', '改為 +', { field: 'headSign', value: '+' });
    if (n > 0 && ['CTC', 'DNN', 'INN', 'MNN', 'ONN', 'HCC', 'OCA'].includes(ct)) e('PAL19B03', ['headCount', 'changeType'], `契約變更型態為 ${ct}，不影響承保人數，人數數量應為 00000000`, '改為 00000000', { field: 'headCount', value: '00000000' });
    if (['ATS', 'PAU', 'ROL'].includes(ct) && sg === '+' && n !== 0) e('PAL19B04', ['headCount', 'changeType', 'headSign'], `${ct} 且人數加減號為 + (效力持續) 時，人數數量應為 00000000`, '改為 00000000', { field: 'headCount', value: '00000000' });
    if (['ATS', 'PAU', 'ROL'].includes(ct) && sg === '-' && n === 0) e('PAL19B05', ['headCount', 'changeType', 'headSign'], `${ct} 且人數加減號為 - 時，人數數量應大於 0`, '填入異動人數');
  });
  // 被保險人 (L20~L29)
  rl((r, p) => {
    const e = E(r, p), pe = isPE(r);
    if (pe && r.idType === '0') { e('PAL20B02', ['idType', 'bizType'], '個人保單的證件種類代號應為 1、2、3 或 9', '依被保險人證件填列'); e('PAL20B03', ['idType', 'bizType'], '證件種類代號為 0 (資料不完整) 僅限其他保單 (TH)', '依被保險人證件填列'); }
    if (!/^0{10}$/.test(r.idNo)) e('PAL21B01', ['idNo'], '證件編號目前暫時填 0000000000', '改為 0000000000', { field: 'idNo', value: '0000000000' });
    if (pe && r.sex === '0') e('PAL22B02', ['sex', 'bizType'], '個人保單的性別應為 1 (男) 或 2 (女)', '依被保險人性別填列');
    const b = r.birthDate, zb = b === '00000000';
    if (/^\d{8}$/.test(b) && !zb && !dateOk(b)) return E(r, p, '格式')('PAL23B01', ['birthDate'], '出生日期不是合法日期 (YYYYMMDD，需考慮大小月與閏年)', '請確認是否誤填民國年或月日顛倒；其他保單可填 00000000');
    if (!dateOk(b) && !zb) return;
    if (!zb && /^\d{4}$/.test(r.year) && yr(b) > +r.year) e('PAL23B02', ['birthDate', 'year'], '出生日期的年度晚於填報年度', '確認出生日期');
    if (pe && zb) e('PAL23B03', ['birthDate', 'bizType'], '個人保單的出生日期不可為 00000000', '填入被保險人出生日期');
    if (pe && !zb && dateOk(r.startDate) && b > r.startDate) e('PAL23B04', ['birthDate', 'startDate'], `出生日期 ${b} 晚於保險期間起日 ${r.startDate}`, '檢查出生日期或起日是否填錯');
    // 身心障礙 (L28、L29)
    const cat = r.disabilityCat, oldT = /^(0[1-9]0|1[0-8]0|990)$/.test(cat), newT = /^(A0[1-8]|M[0-9A-F]{2})$/.test(cat);
    if (!zb && cat !== '000' && X.isDisabilityCat(cat)) {
      if (b < '20120711' && dateOk(r.startDate) && r.startDate < '20120711' && dateOk(r.changeDate) && r.changeDate < '20120711' && !oldT) e('PAL28B01', ['disabilityCat', 'birthDate', 'startDate'], '2012/07/11 前的身心障礙資料，身心障礙類別應使用表3．1．14．A (舊制) 代號', '確認身心障礙類別');
      if (b >= '20120711' && !newT) e('PAL28B04', ['disabilityCat', 'birthDate'], '出生日期在 2012/07/11 以後，身心障礙類別只能使用表3．1．14．B (新制) 代號', '確認身心障礙類別');
    }
    if (T.disabilityLevel[r.disabilityLevel] && X.isDisabilityCat(cat)) {
      if (r.disabilityLevel !== '0' && cat === '000') e('PAL29B02', ['disabilityLevel', 'disabilityCat'], `身心障礙等級為 ${r.disabilityLevel}，身心障礙類別不可為 000`, '確認身心障礙類別或等級');
      if (r.disabilityLevel === '0' && cat !== '000') e('PAL29B03', ['disabilityLevel', 'disabilityCat'], `身心障礙類別為 ${cat}，身心障礙等級不可為 0`, '確認身心障礙類別或等級');
    }
  });
  // 職業類別與職業分類代碼 (L24、L25)
  rl((r, p) => {
    const e = E(r, p), oc = r.occClass, code = r.occCode, c = r.productCode, acc = c[3] === '2', s = r.startDate, cd = r.changeDate;
    if (!T.occClass[oc]) return;
    if (acc && c[4] !== '2' && oc === '8') e('PAL24B02', ['occClass', 'productCode'], '傷害保險商品的職業類別代號不可為 8 (拒保)', '確認職業類別');
    if (['1', '2'].includes(r.contractType) && isPE(r) && (oc === '0' || (acc && c[4] !== '2' && oc === '8'))) e(acc ? 'PAL24B04' : 'PAL24B05', ['occClass', 'contractType', 'bizType'], `個人保單的主約或有職業類別之附約，職業類別代號不可為 ${oc}`, '依被保險人職業填 1~6 或 9');
    if (r.contractType === '3' && oc !== '0') e('PAL24B06', ['occClass', 'contractType'], '契約別為 3 (無職業類別之附約)，職業類別代號應為 0', '改為 0', { field: 'occClass', value: '0' });
    if (!dateOk(s) || !dateOk(cd) || !(code === '00000000' || X.occOk(code))) return;
    const inT = X.occOk(code), cls = X.occ.classOf[code];
    const after = cd >= '20230601';
    // 2015/03/01 前投保：可填 00000000；2023/06/01 起的異動，傷害保險商品不可用拒保代碼
    if (s < '20150301') {
      if (acc && after && inT && cls === '8') e('PAL25B09', ['occCode', 'productCode'], '傷害保險商品的職業分類代碼不可為拒保 (第 8 類) 代碼', '確認職業分類代碼');
      return;
    }
    if (oc !== '0') {
      const id = s >= '20230601' ? (acc ? 'PAL25B06' : 'PAL25B07') : after ? (acc ? 'PAL25B11' : 'PAL25B12') : (acc ? 'PAL25B03' : 'PAL25B04');
      if (!inT) e(id, ['occCode', 'startDate', 'occClass'], '2015/03/01 起投保的保單，職業分類代碼應依職業分類表填 8 碼代號 (不可為 00000000)', '依職業分類表填列 (家管 17000010、無業 17000050)');
      else if (acc && cls === '8') e(id, ['occCode', 'productCode'], '傷害保險商品的職業分類代碼不可為拒保 (第 8 類) 代碼', '確認職業分類代碼');
    }
    if (inT || oc === '0') {
      const want = inT ? cls : '0';
      const id = s >= '20230601' ? 'PAL25B08' : after ? 'PAL25B13' : 'PAL25B05';
      if (oc !== want) e(id, ['occClass', 'occCode'], inT ? `職業分類代碼 ${code} 屬第 ${cls} 類，但職業類別代號為 ${oc}` : '職業類別代號為 0，但職業分類代碼不是 00000000', inT ? `改為 ${cls}` : '確認職業類別或職業分類代碼', inT ? { field: 'occClass', value: cls } : null);
    }
  });
  // 郵遞區號 (L30、L31)
  rl((r, p) => {
    if (!dateOk(r.startDate) || r.productVer !== '2' && r.productVer !== '1') return;
    const e = E(r, p), oiu = r.productVer === '2' && r.productCode[13] === '3', old = r.startDate < '20200101';
    for (const [k, base, nm] of [['payerZip', 'PAL30', '要保人'], ['insuredZip', 'PAL31', '被保險人']]) {
      const v = r[k];
      if (!X.zipOk(v)) continue;
      if (!oiu && old && v === '888') e(base + 'B03', [k, 'startDate'], `非 OIU 保單的${nm}住所郵遞區號不可填 888`, '填正確郵遞區號 (資訊不足可填 999)');
      if (oiu && !old && v === '999') e(base + 'B04', [k, 'startDate'], `2020 年起投保的 OIU 保單，${nm}住所郵遞區號不可填 999`, '填正確郵遞區號 (非國內地址填 888)');
      if (!oiu && !old && ['888', '999'].includes(v)) e(base + 'B05', [k, 'startDate'], `2020 年起投保的保單，${nm}住所郵遞區號應為正確郵遞區號 (不可填 ${v})`, '依要保書住所填郵遞區號前 3 碼');
    }
  });
  // 保險金額與保險範圍 (L33~L43)
  rl((r, p) => {
    const e = E(r, p), mi = isMicro(r), A = k => num(r[k]);
    for (const [amt, sc, sp, b] of [['deathAmt', 'deathScope', 'deathSpecial', 'L3'], ['disAmt', 'disScope', 'disSpecial', 'L3']]) {
      const isD = amt === 'deathAmt', nm = isD ? '意外死亡' : '意外失能';
      const id = (d, b2) => 'PA' + (isD ? 'L3' + d : 'L3' + (d + 3)) + 'B0' + b2;
      const v = A(amt), scope = r[sc], spc = r[sp];
      if (!isNaN(v) && T.scope[scope]) {
        if (v > 0 && scope === '00') e(id(4, 1), [sc, amt], `${nm}保險金額大於 0，保險範圍代號不可為 00`, '標準型填 01、多倍型填 02、僅特定事故填 03');
        if (v === 0 && scope !== '00') e(id(4, 2), [sc, amt], `${nm}保險金額為 0，保險範圍代號應為 00`, '改為 00', { field: sc, value: '00' });
      }
      let bitBad = false;
      for (let i = 0; i < 4; i++) if (!'01'.includes(spc[i])) { bitBad = true; e(id(5, i + 1), [sp], `${nm}特定意外事故保險範圍代號第 ${i + 1} 碼應為 0 或 1`, '有該特定事故填 1，沒有填 0'); }
      if (spc.slice(4) !== '000000') { bitBad = true; e(id(5, 5), [sp], `${nm}特定意外事故保險範圍代號第 5-10 碼應為 000000`, '目前只有 01~04 四種特定事故，第 5-10 碼填 0'); }
      if (bitBad) continue;
      if (scope === '01' && spc.slice(0, 4) !== '0000') e(id(5, 6), [sp, sc], `${nm}保險範圍為 01 (標準型)，特定意外事故保險範圍代號應為 0000000000`, '改為 0000000000', { field: sp, value: '0000000000' });
      if (['02', '03'].includes(scope) && spc.slice(0, 4) === '0000') e(id(5, 7), [sp, sc], `${nm}保險範圍為 ${scope} (含特定事故)，特定意外事故保險範圍代號第 1-4 碼不可全為 0`, '在對應的特定事故序位填 1');
    }
    if (mi) {
      if (A('deathAmt') > 0 && (A('deathAmt') < 100000 || A('deathAmt') > 500000)) e('PAL33B02', ['deathAmt', 'productCode'], '微型保險的意外死亡保險金額應介於 10 萬與 50 萬元之間', '確認保額');
      if (A('disAmt') > 0 && (A('disAmt') < 100000 || A('disAmt') > 500000)) e('PAL36B02', ['disAmt', 'productCode'], '微型保險的意外失能保險金額應介於 10 萬與 50 萬元之間', '確認保額');
      if (A('disAmt') !== A('deathAmt')) e('PAL36B03', ['disAmt', 'deathAmt'], '微型保險的意外失能保險金額應等於意外死亡保險金額', '確認保額');
      if (A('medLimit') > 0 && A('medLimit') !== 30000) e('PAL39B02', ['medLimit', 'productCode'], '微型保險的醫療限額應為 30000', '改為 30000');
      if (A('medLimit') > 0 && (A('deathAmt') !== 0 || A('disAmt') !== 0)) e('PAL39B03', ['medLimit', 'deathAmt', 'disAmt'], '微型保險有醫療限額時，意外死亡及失能保險金額應為 0', '確認保額');
      if (A('medLimit') === 0 && !(A('deathAmt') > 0 && A('disAmt') > 0)) e('PAL39B04', ['medLimit', 'deathAmt', 'disAmt'], '微型保險沒有醫療限額時，意外死亡及失能保險金額應大於 0', '確認保額');
      if (A('medDaily') !== 0) e('PAL40B02', ['medDaily', 'productCode'], '微型保險的醫療日額應為 0', '改為 0', { field: 'medDaily', value: '0' });
      if (A('burnAmt') !== 0) e('PAL42B02', ['burnAmt', 'productCode'], '微型保險的重大燒燙傷保險金額應為 0', '改為 0', { field: 'burnAmt', value: '0' });
      if (A('fractureAmt') !== 0) e('PAL43B03', ['fractureAmt', 'productCode'], '微型保險的骨折保險金額應為 0', '改為 0', { field: 'fractureAmt', value: '0' });
    }
    const md = A('medDaily'), mx = num(r.maxDays);
    if (!isNaN(md) && !isNaN(mx)) {
      if (isPE(r) && md > 0 && (mx < 30 || mx > 365)) e('PAL41B01', ['maxDays', 'medDaily'], `個人保單有醫療日額時，最高日數限制應介於 030 與 365 之間，實際為 ${r.maxDays}`, '依條款填住院醫療日額每次給付最高日數');
      if (!isPE(r) && md > 0 && (mx < 1 || mx > 730)) e('PAL41B02', ['maxDays', 'medDaily'], '其他保單有醫療日額時，最高日數限制應介於 001 與 730 之間', '依條款填最高日數');
      if (md === 0 && mx !== 0) e('PAL41B03', ['maxDays', 'medDaily'], '沒有醫療日額時，最高日數限制應為 000', '改為 000', { field: 'maxDays', value: '000' });
      if (md > 0 && mx === 0) e('PAL41B04', ['maxDays', 'medDaily'], '有醫療日額時，最高日數限制不可為 000', '依條款填最高日數 (無日數限制填 999)');
    }
    if (AMTS.every(k => isZero(r[k]))) e('PAL43B02', AMTS, '各保險金額欄位不可全為 0', '填入異動後的各項保險金額');
  });
  // 保費收入與純保費 (L44~L53)
  rl((r, p) => {
    const e = E(r, p), A = k => num(r[k]), base = is1A(r), ct = r.changeType, need = base && T.changeType[ct] && !NO_PREM.includes(ct);
    const prem = [['premDeathDis', 'netDeathDis', 'L44', 'L45', '意外死亡失能'], ['premMedLimit', 'netMedLimit', 'L46', 'L47', '醫療限額'], ['premMedDaily', 'netMedDaily', 'L48', 'L49', '醫療日額'], ['premEither', 'netEither', 'L50', 'L51', '醫療限額與醫療日額擇一給付者'], ['premOther', 'netOther', 'L52', 'L53', '其他']];
    for (const [pk, nk, , n, nm] of prem) {
      const pv = A(pk), nv = A(nk);
      if (isNaN(pv) || isNaN(nv)) continue;
      if (nv > 0 && pv === 0) e(`PA${n}B02`, [nk, pk], `${nm}純保費收入大於 0，但保費收入為 0`, '確認保費收入');
      else if (nv > pv) e(`PA${n}B03`, [nk, pk], `${nm}純保費收入 ${nv} 大於保費收入 ${pv}`, '純保費應小於或等於保費收入');
    }
    const dd = A('deathAmt') > 0 || A('disAmt') > 0, lim = A('medLimit'), day = A('medDaily');
    if (need && dd && !(A('premDeathDis') > 0 && A('premDeathDis') <= 2e9)) e('PAL44B01', ['premDeathDis', 'deathAmt', 'disAmt'], A('premDeathDis') > 0 ? '意外死亡失能保險金額保費收入超過 20 億 (暫時上限)' : '基本型 (1A) 商品有意外死亡或失能保額，意外死亡失能保費收入應大於 0', '填入年繳化保費收入');
    if (A('premDeathDis') > 0 && !dd) e('PAL44B02', ['premDeathDis', 'deathAmt', 'disAmt'], '有意外死亡失能保費收入，但意外死亡與意外失能保險金額都是 0', '確認保額或保費');
    if (base && lim > 0 && A('premMedLimit') > 25e6) e('PAL46B01', ['premMedLimit'], '醫療限額保費收入超過 2500 萬 (暫時上限)', '確認保費收入');
    if (A('premMedLimit') > 0 && !(lim > 0)) e('PAL46B02', ['premMedLimit', 'medLimit'], '有醫療限額保費收入，但醫療限額為 0', '確認醫療限額或保費');
    if (A('premMedLimit') > 0 && A('premEither') > 0) e('PAL46B05', ['premMedLimit', 'premEither'], '有醫療限額保費收入時，醫療限額與醫療日額擇一給付者保費收入應為 0', '兩者擇一填列');
    if (base && day > 0 && A('premMedDaily') > 6e6) e('PAL48B01', ['premMedDaily'], '醫療日額保費收入超過 600 萬 (暫時上限)', '確認保費收入');
    if (A('premMedDaily') > 0 && !(day > 0)) e('PAL48B02', ['premMedDaily', 'medDaily'], '有醫療日額保費收入，但醫療日額為 0', '確認醫療日額或保費');
    if (A('premMedDaily') > 0 && A('premEither') > 0) e('PAL48B03', ['premMedDaily', 'premEither'], '有醫療日額保費收入時，醫療限額與醫療日額擇一給付者保費收入應為 0', '兩者擇一填列');
    if (need && lim > 0 && day > 0 && !(A('premEither') > 0 && A('premEither') <= 6e6)) e('PAL50B01', ['premEither', 'medLimit', 'medDaily'], '同時有醫療限額與醫療日額 (擇一給付)，擇一給付者保費收入應大於 0 且不超過 600 萬', '將醫療保費填在擇一給付者保費收入');
    if (A('premEither') > 0 && !(lim > 0 && day > 0)) e('PAL50B02', ['premEither', 'medLimit', 'medDaily'], '有擇一給付者保費收入，但醫療限額或醫療日額為 0', '只有一種醫療保障時，保費填在醫療限額或醫療日額保費收入');
    if (A('premEither') > 0 && (A('premMedLimit') > 0 || A('premMedDaily') > 0)) e('PAL50B03', ['premEither', 'premMedLimit', 'premMedDaily'], '有擇一給付者保費收入時，醫療限額及醫療日額保費收入應為 0', '兩者擇一填列');
    if (need && (A('burnAmt') > 0 || A('fractureAmt') > 0) && !(A('premOther') > 0 && A('premOther') <= 7e6)) e('PAL52B01', ['premOther', 'burnAmt', 'fractureAmt'], '基本型 (1A) 商品有重大燒燙傷或骨折保額，其他保費收入應大於 0 且不超過 700 萬', '填入年繳化保費收入');
  });
  // 其他欄位 (L56~L58)
  rl((r, p) => {
    const e = E(r, p);
    if (T.destination[r.destination] && r.destination !== 'N') e('PAL57B02', ['destination'], '個人傷害保險 (非旅平險) 的目的地應填 N', '改為 N', { field: 'destination', value: 'N' });
    if (T.histCode[r.histCode] && r.histCode !== '000') e('PAL58B01', ['histCode'], '【年度填報】流程的歷史資料修改代號應為 000', '修改歷史資料請改走【修改歷史】流程', { field: 'histCode', value: '000' });
    if (r.reserved !== '0000000000000000') e('PAL56B01', ['reserved'], '保留欄位應填 0000000000000000', '改為 16 個 0', { field: 'reserved', value: '0000000000000000' });
  });

  // ================= 多筆檢核：承保 (同一保單號碼) =================
  const sortL = recs => recs.slice().sort((a, b) => (num(a.seq) - num(b.seq)) || (a._line - b._line));
  // 人數數量合計數 (逐筆累計)；第一筆為停效 (2021 前停效保單) 時視為停效前有效人數
  function headSums(s) {
    let sum = 0;
    return s.map((r, i) => {
      const n = num(r.headCount) || 0;
      if (i === 0 && r.changeType === 'LNN' && r.headSign === '-') sum = n;
      sum += r.headSign === '-' ? -n : r.headSign === '+' ? n : 0;
      return sum;
    });
  }
  const groupL = [];
  groupL.push((recs, p) => {
    const s = sortL(recs), last = s.length - 1;
    const one = (r, id, fields, msg, sug, fix) => p(r, { ruleId: id, category: '多筆邏輯', fields, value: fields.map(k => (r[k] || '').trim()).join('/'), message: msg, suggestion: sug, fix: fix || null });
    if (s.length === 1 && !['00000', '00001'].includes(s[0].seq)) one(s[0], 'PAL04B05', ['seq'], '保單只有 1 筆，異動序號應為 00000', '改為 00000', { field: 'seq', value: '00000' });
    if (s.length > 1 && !['00000', '00001'].includes(s[0].seq)) one(s[0], 'PAL04B04', ['seq'], `保單第 1 筆的異動序號應為 00001，實際為 ${s[0].seq}`, '異動序號依契約變更日期排序，從 00001 起編');
    const seen = new Set();
    for (const r of s) { if (seen.has(r.seq)) one(r, 'PAL04B06', ['seq'], `異動序號 ${r.seq} 重複`, '同一保單號碼的異動序號不可重複，依序 +1'); seen.add(r.seq); }
    const first = s[0];
    if (T.changeType[first.changeType]) {
      if (first.changeType === 'LNN' && dateOk(first.changeDate) && first.changeDate >= '20210101') one(first, 'PAL13L01', ['changeType', 'changeDate'], '保單第 1 筆為停效 (LNN) 時，契約變更日期應早於 20210101', '2021 年起的停效之前應有 NEW 或 XEN 資料');
      if (dateOk(first.startDate) && first.startDate < '20210101' && !['NEW', 'NCT', 'XEN', 'LNN'].includes(first.changeType)) one(first, 'PAL13L02', ['changeType', 'startDate'], `2021 年前投保的保單，第 1 筆契約變更型態應為 NEW、NCT、XEN 或 LNN，實際為 ${first.changeType}`, '補報期初有效 (XEN) 資料');
      if (dateOk(first.startDate) && first.startDate >= '20210101' && !['NEW', 'NCT'].includes(first.changeType)) one(first, 'PAL13L03', ['changeType', 'startDate'], `2021 年起投保的保單，第 1 筆契約變更型態應為 NEW 或 NCT，實際為 ${first.changeType}`, '補報新契約 (NEW) 資料');
    }
    for (const t of ['NEW', 'NCT', 'XEN', 'PAU', 'ROL']) { const h = s.filter(r => r.changeType === t); if (h.length > 1) one(h[1], 'PAL13L13', ['changeType'], `契約變更型態 ${t} (${T.changeType[t]}) 在同一保單出現多次`, `${t} 只會出現 1 次`); }
    const dup = new Map();
    for (const r of s) { const k = r.changeDate + r.changeType; if (dup.has(k)) one(r, 'PAL14L06', ['changeDate', 'changeType'], `契約變更日期 ${r.changeDate} 已有相同契約變更型態 ${r.changeType} 的資料`, '同一天的異動型態不會相同，請合併或刪除重複資料'); else dup.set(k, r); }
    const sums = headSums(s);
    s.forEach((r, i) => {
      const sum = sums[i], ct = r.changeType, pe = isPE(r);
      if (sum < 0 && (i === 0 || sums[i - 1] >= 0)) one(r, 'PAL19L01', ['headCount', 'headSign'], `人數數量經過異動後合計為 ${sum}，不可小於 0`, '確認人數加減號與人數數量');
      if (i < last && ct !== 'LNN' && sum === 0) one(r, 'PAL19L02', ['headCount', 'changeType'], `此筆後面還有資料，但人數數量合計已為 ${sum}`, '保單效力結束 (合計為 0) 後不應再有異動資料；停效除外');
      if (pe && ['SRD', 'LOP', 'TMD', 'LNN', 'DEA', 'ADS', 'TDI', 'MAD', 'RES'].includes(ct) && sum !== 0) one(r, 'PAL19L03', ['headCount', 'changeType'], `個人保單 ${ct} 之後人數數量合計應為 0，實際為 ${sum}`, '確認人數加減號與人數數量');
      if (!pe && ['SRD', 'LOP', 'LNN', 'MAD', 'RES'].includes(ct) && sum !== 0) one(r, 'PAL19L04', ['headCount', 'changeType'], `其他保單 ${ct} 之後人數數量合計應為 0，實際為 ${sum}`, '確認人數加減號與人數數量');
      if (['PAU', 'ROL'].includes(ct) && r.headSign === '-' && sum !== 0) one(r, 'PAL19L05', ['headCount', 'changeType'], `${ct} 且人數減少後，人數數量合計應為 0，實際為 ${sum}`, '確認人數');
      if (['DEA', 'ADS', 'TDI', 'ATS', 'ADB', 'ROL', 'TMD'].includes(ct) && sum === 0 && !PREMS.every(k => isZero(r[k]))) one(r, 'PAL13L16', ['changeType'].concat(PREMS), `${ct} 後保單已無被保險人 (人數合計 0)，各保費收入欄位應為 0`, '改為 0');
    });
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i], ct = b.changeType, pe = isPE(b);
      const diff = (k, id, why) => { if (a[k] !== b[k]) one(b, id, [k], `「${L.field(k).name}」與上 1 筆不同${why || ''}`, `同一保單應相同；若上 1 筆正確則改為 ${a[k].trim() || '(空白)'}`, { field: k, value: a[k] }); };
      diff('contractType', 'PAL07L01'); diff('bizType', 'PAL08L01'); diff('groupLink', 'PAL09L01'); diff('channel', 'PAL10L01'); diff('salesMethod', 'PAL11L01');
      diff('startDate', 'PAL15L01'); diff('actualDays', 'PAL17L01'); diff('idNo', 'PAL21L01'); diff('econ', 'PAL27L01'); diff('currency', 'PAL32L01'); diff('destination', 'PAL57L01');
      if (ct !== 'CTC') { diff('termType', 'PAL12L01', ' (非契約轉換)'); diff('sex', 'PAL22L01', ' (非契約轉換)'); diff('birthDate', 'PAL23L01', ' (非契約轉換)'); }
      if (ct !== 'ROL' && ct !== 'CTC') diff('endDate', 'PAL16L03', ' (非展期、契約轉換)');
      if (ct === 'ROL' && b.endDate > a.endDate) one(b, 'PAL16L04', ['endDate'], '展期 (ROL) 後的保險期間迄日不可晚於上 1 筆', '確認迄日');
      if (b.productVer === '1' && a.productVer !== '1') one(b, 'PAL06L01', ['productVer'], '商品編號適用版本為 1 (15 碼版)，上 1 筆卻不是 1', '同一保單的適用版本應一致');
      if (ct !== 'CTC' && b.productVer === '1' && a.productVer === '1' && b.productCode.slice(0, 13) !== a.productCode.slice(0, 13)) one(b, 'PAL06L02', ['productCode'], '保險商品編號第 1-13 碼與上 1 筆不同 (非契約轉換)', '同一保單商品編號應相同 (部分變更代碼除外)');
      if (ct !== 'CTC' && b.productVer === '2' && a.productVer === '2' && b.productCode.slice(0, 25) !== a.productCode.slice(0, 25)) one(b, 'PAL06L03', ['productCode'], '保險商品編號第 1-25 碼與上 1 筆不同 (非契約轉換)', '同一保單商品編號應相同 (部分變更代碼除外)');
      if (b.idType !== '1') diff('idType', 'PAL20L02');
      if (ct !== 'HCC') { diff('disabilityCat', 'PAL28L01', ' (非危險分類變更)'); diff('disabilityLevel', 'PAL29L01', ' (非危險分類變更)'); }
      else if (a.disabilityCat === b.disabilityCat && a.disabilityLevel === b.disabilityLevel) one(b, 'PAL29L02', ['disabilityCat', 'disabilityLevel'], '契約變更型態為 HCC，但身心障礙類別及等級都與上 1 筆相同', '填入變更後的身心障礙類別或等級');
      if (dateOk(b.startDate) && b.startDate >= '20150301') {
        if (ct === 'OCA' && b.occCode === a.occCode) one(b, 'PAL25L01', ['occCode'], '契約變更型態為 OCA (職業分類代碼變更)，但職業分類代碼與上 1 筆相同', '填入變更後的職業分類代碼');
        if (!['OCA', 'ONN'].includes(ct)) diff('occCode', 'PAL25L02', ' (非職業變更)');
      }
      if (ct !== 'CTC') {
        if (pos(a.deathAmt) && pos(b.deathAmt)) { diff('deathScope', 'PAL34L01'); diff('deathSpecial', 'PAL35L01'); }
        if (pos(a.disAmt) && pos(b.disAmt)) { diff('disScope', 'PAL37L01'); diff('disSpecial', 'PAL38L01'); }
        if (pos(a.medDaily) && pos(b.medDaily)) diff('maxDays', 'PAL41L01');
        const cut = r => r.productCode.slice(0, r.productVer === '1' ? 13 : 25);
        if (cut(a) === cut(b) && a.productVer === b.productVer) diff('companyPolicyCode', 'PAL55L01');
      }
      const okA = dateOk(a.changeDate), okB = dateOk(b.changeDate);
      if (okA && okB) {
        if (ct !== 'RNN' && b.changeDate < a.changeDate) one(b, 'PAL14L01', ['changeDate'], `契約變更日期 ${b.changeDate} 早於上 1 筆 ${a.changeDate}`, '異動序號應依契約變更日期先後排序');
        if (ct === 'RNN' && a.changeType === 'LNN' && b.changeDate <= a.changeDate) one(b, 'PAL14L02', ['changeDate'], '復效 (RNN) 的契約變更日期應晚於停效 (LNN) 日期', '確認日期');
        if (ct === 'LNN' && a.changeType === 'RNN' && b.changeDate <= a.changeDate) one(b, 'PAL14L03', ['changeDate'], '停效 (LNN) 的契約變更日期應晚於上 1 筆復效 (RNN) 日期', '確認日期');
        if (b.changeDate === a.changeDate && ct === a.changeType) one(b, 'PAL14L04', ['changeDate', 'changeType'], '與上 1 筆契約變更日期相同，契約變更型態也相同', '同一天的不同異動應為不同型態；重複資料請刪除');
        if (b.changeDate === a.changeDate && !(num(b.seq) > num(a.seq))) one(b, 'PAL14L05', ['changeDate', 'seq'], '與上 1 筆契約變更日期相同，異動序號應大於上 1 筆', '確認異動序號');
      }
      if (okA && okB && a.changeDate >= '20200101' && b.changeDate >= '20200101' && T.changeType[ct]) {
        const lt = k => num(b[k]) < num(a[k]), gt = k => num(b[k]) > num(a[k]);
        if (['DNN', 'PAU'].includes(ct) && !AMTS.some(lt)) one(b, 'PAL13L04', ['changeType'].concat(AMTS), `契約變更型態為 ${ct}，但沒有任何保險金額比上 1 筆小`, '填入減少後的保險金額');
        if (ct === 'INN' && !AMTS.some(gt)) one(b, 'PAL13L05', ['changeType'].concat(AMTS), '契約變更型態為 INN (保額增加)，但沒有任何保險金額比上 1 筆大', '填入增加後的保險金額');
        if (ct === 'MNN' && !((isZero(b.medLimit) !== isZero(a.medLimit)) || (isZero(b.medDaily) !== isZero(a.medDaily)))) one(b, 'PAL13L06', ['changeType', 'medLimit', 'medDaily'], 'MNN (日限額變更) 應為醫療限額與醫療日額互轉，但與上 1 筆相比沒有轉換', '確認契約變更型態或金額');
        if (ct === 'ONN' && b.occClass === a.occClass) one(b, 'PAL13L07', ['changeType', 'occClass'], 'ONN (職業類別變更)，但職業類別與上 1 筆相同', '只有職業分類代碼變更時應填 OCA');
        if (ct !== 'ONN' && b.occClass !== a.occClass) one(b, 'PAL13L08', ['changeType', 'occClass'], `職業類別與上 1 筆不同，但契約變更型態為 ${ct} (不是 ONN)`, '職業類別變更應填 ONN');
        if (ct !== 'RNN' && a.changeType === 'LNN') one(b, 'PAL13L09', ['changeType'], `上 1 筆為停效 (LNN)，此筆契約變更型態應為 RNN (復效)，實際為 ${ct}`, '停效後的下一筆應為復效');
        if (ct === 'RNN' && a.changeType !== 'LNN') one(b, 'PAL13L10', ['changeType'], `復效 (RNN) 的上 1 筆應為停效 (LNN)，實際為 ${a.changeType}`, '確認契約變更型態');
        const keep = pe ? ['NEW', 'INN', 'DNN', 'MNN', 'NCT', 'CTC', 'PAU'] : ['NEW', 'INN', 'DNN', 'MNN', 'NCT', 'CTC', 'PAU', 'DEA', 'ADS', 'TDI', 'ATS', 'ADB', 'TMD'];
        if (!keep.includes(ct)) for (const k of AMTS) if (num(a[k]) !== num(b[k])) { one(b, pe ? 'PAL13L11' : 'PAL13L12', [k, 'changeType'], `契約變更型態 ${ct} 不會改變保額，但「${L.field(k).name}」與上 1 筆不同`, `若上 1 筆正確則改為 ${a[k].replace(/^0+(?=\d)/, '')}`, { field: k, value: a[k] }); break; }
      }
      if (pe && ['DEA', 'ADS', 'TDI', 'ATS', 'ADB', 'PAU', 'ROL', 'MAD', 'SRD', 'RES', 'LOP', 'TMD'].includes(a.changeType) && a.headSign === '-') one(b, 'PAL13L14', ['changeType'], `上 1 筆已是保單效力結束的 ${a.changeType}，之後不應再有資料`, '確認是否誤報，或保單號碼重新給予他人時應使用不同的保單編號序號');
      if (!pe && ['PAU', 'ROL', 'MAD', 'SRD', 'RES', 'LOP'].includes(a.changeType) && a.headSign === '-') one(b, 'PAL13L15', ['changeType'], `上 1 筆已是 ${a.changeType}，之後不應再有資料`, '確認是否誤報');
    }
  });
  // 迄日在檔案年度內的保單：最後人數合計須為 0 (L16L01/L16L02/L16L05)；檔案年度以最大填報年度推估
  const endYearL = (data, p) => {
    const Ls = (data.AL || []).filter(r => r._raw.length === L.recordLength);
    const fy = Math.max(...Ls.map(r => num(r.year)).filter(n => !isNaN(n)));
    if (!isFinite(fy)) return;
    const by = new Map();
    for (const r of Ls) { const k = L.keyOf(r); if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
    for (const recs of by.values()) {
      const s = sortL(recs), last = s[s.length - 1], sum = headSums(s)[s.length - 1];
      if (!dateOk(last.endDate) || yr(last.endDate) > fy) continue;
      const iss = (id, msg, sug) => p('AL', last, { ruleId: id, category: '多筆邏輯', fields: ['endDate', 'headCount'], value: `${last.endDate}/${sum}`, message: msg, suggestion: sug });
      if (sum !== 0) {
        iss('PAL16L01', `保險期間迄日 ${last.endDate} 在檔案年度 ${fy} 以前，人數數量合計應為 0，實際為 ${sum}`, '保單到期應有滿期 (MAD) 等效力結束的資料');
        iss('PAL16L05', `保險期間迄日在檔案年度以前，最後 1 筆的人數數量合計應為 0，實際為 ${sum}`, '補報滿期 (MAD) 等效力結束資料');
      } else if (T.changeType[last.changeType] && !END_TYPES.includes(last.changeType)) iss('PAL16L02', `保單已無被保險人，但最後 1 筆的契約變更型態為 ${last.changeType}`, '最後 1 筆應為停效、死亡、滿期、解約等效力結束型態');
    }
  };

  // ================= 單筆檢核：給付 =================
  const recordD = [];
  const rd = fn => recordD.push(fn);
  const paid = r => r.amtNature !== '2';
  rd((r, p) => {
    const e = E(r, p), it = T.benefitItem[r.benefitItem];
    if (it && T.benefitType[r.benefitType] && !it.includes(r.benefitType)) e('PAD02B02', ['benefitItem', 'benefitType'], `給付項目 ${r.benefitItem} 不能配合給付類別 ${r.benefitType} (${T.benefitType[r.benefitType]})`, `給付項目 ${r.benefitItem} 適用給付類別 ${it.join('、')}`);
  });
  // 日期 (D13~D20)
  rd((r, p) => {
    const e = E(r, p), fe = E(r, p, '格式'), ad = r.accidentDate, ap = r.applyDate, pd = r.payDate, y = num(r.year), t = r.benefitType;
    for (const [k, id, nm] of [['startDate', 'PAD103_13', '保單保險期間起日'], ['endDate', 'PAD103_14', '保單保險期間迄日'], ['accidentDate', 'PAD15B01', '事故日期'], ['applyDate', 'PAD16B01', '申請日期']])
      if (/^\d{8}$/.test(r[k]) && !dateOk(r[k])) fe(id, [k], `${nm}不是合法日期`, '格式 YYYYMMDD (西元)');
    for (const [k, id, nm] of [['admitDate', 'PAD18B01', '入院日期'], ['dischargeDate', 'PAD19B01', '出院日期']])
      if (/^\d{8}$/.test(r[k]) && r[k] !== '00000000' && !dateOk(r[k])) fe(id, [k], `${nm}不是合法日期`, '格式 YYYYMMDD (西元)；沒有則填 00000000');
    const okA = dateOk(ad), okP = dateOk(ap);
    if (okA && dateOk(r.startDate) && ad < r.startDate) e('PAD15B02', ['accidentDate', 'startDate'], `事故日期 ${ad} 早於保險期間起日 ${r.startDate}`, '確認事故日期或起日');
    if (okA && dateOk(r.endDate) && ad > r.endDate) e('PAD15B03', ['accidentDate', 'endDate'], `事故日期 ${ad} 晚於保險期間迄日 ${r.endDate}`, '確認事故日期或迄日');
    if (okA && !isNaN(y) && yr(ad) > y) e('PAD15B04', ['accidentDate', 'year'], `事故日期的年度 ${yr(ad)} 晚於填報年度 ${y}`, '確認事故日期或填報年度');
    if (okA && okP && ap < ad) e('PAD16B02', ['applyDate', 'accidentDate'], `申請日期 ${ap} 早於事故日期 ${ad}`, '檢查兩日期是否填反');
    if (okP && !isNaN(y) && yr(ap) > y) e('PAD16B03', ['applyDate', 'year'], `申請日期的年度 ${yr(ap)} 晚於填報年度 ${y}`, '確認申請日期或填報年度');
    if (T.amtNature[r.amtNature]) {
      if (!paid(r) && pd !== '00000000') e('PAD17B01', ['payDate', 'amtNature'], '未付金額 (給付金額性質 2) 的給付日期應填 00000000', '改為 00000000', { field: 'payDate', value: '00000000' });
      if (paid(r) && !dateOk(pd)) fe('PAD17B02', ['payDate', 'amtNature'], '已付或追回金額的給付日期應為合法的西元日期', '填入給付 (或追回) 日期，格式 YYYYMMDD');
    }
    const okD = paid(r) && dateOk(pd);
    if (okD && okA && pd < ad) e('PAD17B03', ['payDate', 'accidentDate'], `給付日期 ${pd} 早於事故日期 ${ad}`, '確認給付日期');
    if (okD && okP && pd < ap) e('PAD17B04', ['payDate', 'applyDate'], `給付日期 ${pd} 早於申請日期 ${ap}`, '確認給付日期');
    if (okD && !isNaN(y) && yr(pd) > y) e('PAD17B05', ['payDate', 'year'], `給付日期的年度 ${yr(pd)} 晚於填報年度 ${y}`, '確認給付日期或填報年度');
    const adm = r.admitDate, dis = r.dischargeDate, okM = dateOk(adm), okS = dateOk(dis), med = ['03', '04', '05', '06'].includes(t);
    if (okM && med && okD && okA && pd < ad) e('PAD18B02', ['payDate', 'accidentDate', 'admitDate'], '有入院日期的醫療類給付，給付日期不可早於事故日期', '確認給付日期');
    if (okM && okP && adm > ap) e('PAD18B03', ['admitDate', 'applyDate'], `入院日期 ${adm} 晚於申請日期 ${ap}`, '確認入院日期或申請日期');
    if (okM && okD && adm >= pd) e('PAD18B04', ['admitDate', 'payDate'], `入院日期 ${adm} 不早於給付日期 ${pd}`, '確認入院日期或給付日期');
    const hosp04 = t === '04' && r.benefitItem !== '4101';
    if (hosp04 && adm === '00000000') e('PAD18B05', ['admitDate', 'benefitType', 'benefitItem'], '醫療日額給付 (非骨折 4101) 必須填入院日期', '填入入院日期');
    if (okS && okM && dis < adm) e('PAD19B02', ['dischargeDate', 'admitDate'], `出院日期 ${dis} 早於入院日期 ${adm}`, '檢查兩日期是否填反');
    if (okS && med && okA && dis < ad) e('PAD19B03', ['dischargeDate', 'accidentDate'], `出院日期 ${dis} 早於事故日期 ${ad}`, '確認日期');
    if (okS && okP && dis > ap) e('PAD19B04', ['dischargeDate', 'applyDate'], `出院日期 ${dis} 晚於申請日期 ${ap}`, '出院後才會申請給付，請確認日期');
    if (okS && okD && dis > pd) e('PAD19B05', ['dischargeDate', 'payDate'], `出院日期 ${dis} 晚於給付日期 ${pd}`, '確認日期');
    if (hosp04 && dis === '00000000') e('PAD19B06', ['dischargeDate', 'benefitType', 'benefitItem'], '醫療日額給付 (非骨折 4101) 必須填出院日期', '填入出院日期');
    const hd = num(r.hospDays);
    if (okS && okM && !isNaN(hd) && X.dayDiff(adm, dis) - hd > 14) e('PAD20B02', ['hospDays', 'admitDate', 'dischargeDate'], `入出院相差 ${X.dayDiff(adm, dis)} 天，住院日數只有 ${hd} 天 (差距超過 14 天)`, '確認住院日數或入出院日期');
    if (t === '04' && hd > 0 && adm === '00000000') e('PAD20B03', ['hospDays', 'admitDate'], '醫療日額給付有住院日數，入院日期不可為 00000000', '填入入院日期');
    if (t === '04' && hd > 0 && dis === '00000000') e('PAD20B04', ['hospDays', 'dischargeDate'], '醫療日額給付有住院日數，出院日期不可為 00000000', '填入出院日期');
    if (hosp04 && hd === 0) e('PAD20B05', ['hospDays', 'benefitType', 'benefitItem'], '醫療日額給付 (非骨折 4101) 的住院日數不可為 000', '填入住院日數');
  });
  // 被保險人 (D23~D29)
  rd((r, p) => {
    const e = E(r, p), b = r.birthDate, okB = dateOk(b), ad = r.accidentDate, okA = dateOk(ad);
    if (/^\d{8}$/.test(b) && !okB) E(r, p, '格式')('PAD24B01', ['birthDate'], '出生日期不是合法日期', '格式 YYYYMMDD (西元)');
    if (okB && okA && r.benefitType === '01' && dateOk(r.startDate) && r.startDate > '20100202' && ageAt(b, ad) < 15) e('PAD24B02', ['birthDate', 'benefitType', 'accidentDate'], `給付類別 01 (已滿 15 足歲意外死亡)，但事故時被保險人 ${ageAt(b, ad)} 歲`, '未滿 15 足歲請填給付類別 11');
    if (okB && okA && r.benefitType === '11' && ageAt(b, ad) >= 15) e('PAD24B03', ['birthDate', 'benefitType', 'accidentDate'], `給付類別 11 (未滿 15 足歲意外死亡)，但事故時被保險人已 ${ageAt(b, ad)} 歲`, '已滿 15 足歲請填給付類別 01', { field: 'benefitType', value: '01' });
    if (okB && /^\d{4}$/.test(r.year) && yr(b) > +r.year) e('PAD24B04', ['birthDate', 'year'], '出生日期的年度晚於填報年度', '確認出生日期');
    if (okB && dateOk(r.startDate) && b > r.startDate) e('PAD24B05', ['birthDate', 'startDate'], `出生日期 ${b} 晚於保險期間起日 ${r.startDate}`, '確認出生日期或起日');
    const cat = r.disabilityCat;
    if (okB && okA && cat !== '000' && X.isDisabilityCat(cat)) {
      if (b < '20120711' && ad < '20120711' && !/^(0[1-9]0|1[0-8]0|990)$/.test(cat)) e('PAD29B01', ['disabilityCat', 'birthDate', 'accidentDate'], '2012/07/11 前的事故，身心障礙類別應使用表3．1．14．A 代號', '確認身心障礙類別');
      if (b >= '20120711' && !/^(A0[1-8]|M[0-9A-F]{2})$/.test(cat)) e('PAD29B03', ['disabilityCat', 'birthDate'], '出生日期在 2012/07/11 以後，身心障礙類別只能使用表3．1．14．B 代號', '確認身心障礙類別');
    }
    if (dateOk(r.startDate) && r.startDate < '20140626' && T.econ[r.econ] && !('0' + ECON.A).includes(r.econ)) e('PAD28B01', ['econ', 'startDate'], '2014/06/26 前投保的保單，經濟弱勢者身分應為 0 或表3．1．13．A 代號', '確認經濟弱勢者身分');
  });
  // 事故時職業 (D25、D26)
  rd((r, p) => {
    const e = E(r, p), oc = r.occClass, code = r.occCode, c = r.productCode, acc = c[3] === '2', s = r.startDate, ad = r.accidentDate;
    if (!T.occClass[oc]) return;
    if (acc && c[4] !== '2' && oc === '8') e('PAD25B02', ['occClass', 'productCode'], '傷害保險商品的事故時職業類別代號不可為 8 (拒保)', '確認職業類別');
    if (['1', '2'].includes(r.contractType) && isPE(r) && (oc === '0' || (acc && c[4] !== '2' && oc === '8'))) e(acc ? 'PAD25B04' : 'PAD25B05', ['occClass', 'contractType', 'bizType'], `個人保單的主約或有職業類別之附約，事故時職業類別代號不可為 ${oc}`, '依事故時職業填 1~6 或 9');
    if (r.contractType === '3' && oc !== '0') e('PAD25B06', ['occClass', 'contractType'], '契約別為 3，事故時職業類別代號應為 0', '改為 0', { field: 'occClass', value: '0' });
    if (!dateOk(s) || !dateOk(ad) || !(code === '00000000' || X.occOk(code))) return;
    const inT = X.occOk(code), cls = X.occ.classOf[code], after = ad >= '20230601';
    if (s < '20150301') {
      if (acc && after && inT && cls === '8') e('PAD26B09', ['occCode', 'productCode'], '傷害保險商品的事故時職業分類代碼不可為拒保 (第 8 類) 代碼', '確認職業分類代碼');
      return;
    }
    if (oc !== '0') {
      const id = s >= '20230601' ? (acc ? 'PAD26B06' : 'PAD26B07') : after ? (acc ? 'PAD26B11' : 'PAD26B12') : (acc ? 'PAD26B03' : 'PAD26B04');
      if (!inT) e(id, ['occCode', 'startDate', 'occClass'], '2015/03/01 起投保的保單，事故時職業分類代碼應依職業分類表填 8 碼代號 (不可為 00000000)', '依職業分類表填列');
      else if (acc && cls === '8') e(id, ['occCode', 'productCode'], '傷害保險商品的事故時職業分類代碼不可為拒保 (第 8 類) 代碼', '確認職業分類代碼');
    }
    if (inT || oc === '0') {
      const want = inT ? cls : '0', id = s >= '20230601' ? 'PAD26B08' : after ? 'PAD26B13' : 'PAD26B05';
      if (oc !== want) e(id, ['occClass', 'occCode'], inT ? `事故時職業分類代碼 ${code} 屬第 ${cls} 類，但事故時職業類別代號為 ${oc}` : '事故時職業類別代號為 0，但職業分類代碼不是 00000000', inT ? `改為 ${cls}` : '確認職業類別或職業分類代碼', inT ? { field: 'occClass', value: cls } : null);
    }
  });
  // 事故原因、給付狀態 (D32、D34)
  rd((r, p) => {
    const e = E(r, p), cc = r.causeCode;
    if (/^Y3[5-8]/.test(cc)) e('PAD32B06', ['causeCode'], `事故原因代號 ${cc.trim()} (Y35~Y38 法律介入、戰爭、軍事行動、恐怖主義) 不可使用`, '依事故實際原因填 ICD-10-CM 第 20 章代碼');
    else if (dateOk(r.accidentDate) && r.accidentDate >= '20160101' && paid(r) && T.amtNature[r.amtNature] && !/^[V-Y]\d{2}[0-9A-Z]{0,4} *$/.test(cc)) e('PAD32B04', ['causeCode', 'accidentDate'], `2016 年起的事故，事故原因代號「${cc.trim()}」應為 ICD-10-CM 第 20 章代碼 (V00~Y99，不含小數點，靠左)`, '依「事故原因代號_ICD-10-CM_Ch20」填列');
    if (r.amtNature === '2' && T.payStatus[r.payStatus] && r.payStatus !== 'U') e('PAD34B02', ['amtNature', 'payStatus'], '未付金額 (給付金額性質 2) 的給付狀態應為 U (未給付案)', '改為 U', { field: 'payStatus', value: 'U' });
    if (['1', '4'].includes(r.amtNature) && r.payStatus === 'U') e('PAD34B03', ['amtNature', 'payStatus'], '已付或追回金額的給付狀態不可為 U (未給付案)', '結案填 S；分次給付未結案填 P');
  });
  // 金額、倍數、日數 (D36~D42)
  rd((r, p) => {
    const e = E(r, p), t = r.benefitType, A = k => num(r[k]);
    if (!T.benefitType[t] || !T.amtNature[r.amtNature]) return;
    if (isZero(r.dueAmt)) e('PAD36B01', ['dueAmt'], '應給付保險金額日額應大於 0', '填入事故時應給付的標準保險金額 (不含倍數)');
    const dm = A('dueMultiple');
    if (t === '03' && !(dm >= 1 && dm <= 35000)) e('PAD37B01', ['dueMultiple', 'benefitType'], '醫療限額給付的應給付倍數應介於 000001 與 035000 之間', '1 倍填 001000');
    if (t === '04' && !(dm >= 1 && dm <= 5000)) e('PAD37B02', ['dueMultiple', 'benefitType'], '醫療日額給付的應給付倍數應介於 000001 與 005000 之間', '1 倍填 001000');
    if (['05', '06'].includes(t) && dm !== 1000) e('PAD37B03', ['dueMultiple', 'benefitType'], `給付類別 ${t} 的應給付倍數應為 001000 (1 倍)`, '改為 001000', { field: 'dueMultiple', value: '001000' });
    if (t === '04' && !(A('dueDays') >= 1 && A('dueDays') <= 365)) e('PAD38B01', ['dueDays', 'benefitType'], '醫療日額給付的應給付日數應介於 001 與 365 之間', '依條款填應給付日數');
    if (!paid(r)) {
      if (A('paidAmt') !== 0) e('PAD39B01', ['paidAmt', 'amtNature'], '未付金額資料的實際給付保險金額應為 0', '改為 0', { field: 'paidAmt', value: '0' });
      if (r.paidMultiple !== '000000') e('PAD40B01', ['paidMultiple', 'amtNature'], '未付金額資料的實際給付倍數應為 000000', '改為 000000', { field: 'paidMultiple', value: '000000' });
      if (A('paidDays') !== 0) e('PAD41B01', ['paidDays', 'amtNature'], '未付金額資料的實際給付日數應為 000', '改為 000', { field: 'paidDays', value: '000' });
      if (r.diffReason !== '0' && T.diffReason[r.diffReason]) e('PAD42B02', ['diffReason', 'amtNature'], '未付金額資料的給付額不同原因應為 0', '改為 0', { field: 'diffReason', value: '0' });
      return;
    }
    const due = A('dueAmt'), pa = A('paidAmt'), pm = A('paidMultiple'), days = A('dueDays'), rs = r.diffReason;
    if ([due, dm, pa, pm].some(isNaN) || !T.diffReason[rs]) return;
    if (rs === '0' && due > 0 && dm > 0) {
      const base = due * dm / 1000 * (t === '04' ? days : 1);
      const want = base > 0 ? Math.round(pa / base * 1000) : NaN;
      if (!isNaN(want) && Math.abs(want - pm) > 1) e(t === '04' ? 'PAD40B02' : 'PAD40B03', ['paidMultiple', 'paidAmt', 'dueAmt', 'dueMultiple'].concat(t === '04' ? ['dueDays'] : []), `實際給付倍數應為 ${String(want).padStart(6, '0')} (實際給付金額 ÷ (應給付日額 × 倍數${t === '04' ? ' × 應給付日數' : ''}))，實際填 ${r.paidMultiple}`, `改為 ${String(want).padStart(6, '0')}`, want >= 0 && want < 1e6 ? { field: 'paidMultiple', value: String(want).padStart(6, '0') } : null);
    }
    const std = Math.round(due * dm / 1000);
    if (['01', '11', '02'].includes(t) && pa !== std && !'1239'.includes(rs)) e('PAD42B03', ['diffReason', 'paidAmt', 'dueAmt'], `實際給付金額 ${pa} 不等於應給付金額 ${std} (日額 × 倍數)，給付額不同原因應為 1、2、3 或 9`, '填入給付不同的原因');
    if (['03', '05', '06'].includes(t) && pa !== std && rs === '0') e('PAD42B04', ['diffReason', 'paidAmt', 'dueAmt'], `實際給付金額 ${pa} 不等於應給付金額 ${std} (日額 × 倍數)，給付額不同原因不可為 0`, '填入給付不同的原因 (1、2、3、4、9)');
    if (t === '04' && A('paidDays') !== days && rs === '0') e('PAD42B05', ['diffReason', 'paidDays', 'dueDays'], `實際給付日數 ${r.paidDays} 與應給付日數 ${r.dueDays} 不同，給付額不同原因不可為 0`, '填入給付不同的原因 (1、2、3、4、9)');
  });
  // 失能、骨折、燒燙傷代號 (D43~D47)
  rd((r, p) => {
    const e = E(r, p), t = r.benefitType, gc = r.disabilityGrade, it = r.benefitItem, s = r.startDate, pd = r.payDate;
    if (T.benefitType[t] && t !== '02' && gc !== '00000000') e('PAD201_43', ['disabilityGrade', 'benefitType'], '非意外失能給付的失能項次等級代號應填 00000000', '改為 00000000', { field: 'disabilityGrade', value: '00000000' });
    if (t === '02' && /^\d{8}$/.test(gc) && T.amtNature[r.amtNature]) {
      const comp = ['0110', '0310'].includes(it), inA = GRADE.A.has(gc), inB = GRADE.B.has(gc), inC = GRADE.C.has(gc);
      const z = comp && gc === '00000000';
      if (!paid(r)) { if (!(gc === '00000000' || inA || inB || inC)) e('PAD43B01', ['disabilityGrade', 'amtNature'], `失能項次等級代號 ${gc} 不在失能程度與保險金給付表內`, '依表3．2．5．A/B/C 填列'); }
      else if (dateOk(s) && dateOk(pd)) {
        let id = null, ok = true, tbl = '';
        if (s < '20061001') {
          if (pd < '20061001') { id = comp ? 'PAD43B07' : 'PAD43B02'; ok = inA; tbl = 'A'; }
          else if (pd < '20150804') { id = comp ? 'PAD43B08' : 'PAD43B03'; ok = inA || inB; tbl = 'A 或 B'; }
          else { id = comp ? 'PAD43B09' : 'PAD43B04'; ok = inA || inC; tbl = 'A 或 C'; }
        } else if (pd >= '20061001') {
          if (pd < '20150804') { id = comp ? 'PAD43B10' : 'PAD43B05'; ok = inB; tbl = 'B'; }
          else { id = comp ? 'PAD43B11' : 'PAD43B06'; ok = inC; tbl = 'C'; }
        }
        if (id && !ok && !z) e(id, ['disabilityGrade', 'startDate', 'payDate'], `失能項次等級代號 ${gc} 不在表3．2．5．${tbl} (依保單起日與給付日期適用) 內`, `依表3．2．5．${tbl} 填 8 碼失能項次等級代號${comp ? '；補償保險金可填 00000000' : ''}`);
      }
    }
    const fc = r.fractureCode, frac = t === '04' && it === '4101';
    if (frac && !paid(r) && !(fc === '00' || T.fracture[fc])) e('PAD44B01', ['fractureCode'], `骨折給付代號 ${fc} 不在骨折給付代號表內`, '依表3．2．8 填列或填 00');
    if (frac && paid(r) && T.amtNature[r.amtNature] && !T.fracture[fc]) e('PAD44B02', ['fractureCode', 'benefitItem'], '骨折給付 (4101) 已付資料必須填骨折給付代號 (01~20)', '依表3．2．8 填骨折部位代號');
    if (!frac && T.benefitItem[it] && fc !== '00') e('PAD201_44', ['fractureCode', 'benefitItem'], '非骨折給付 (給付項目不是 4101) 的骨折給付代號應填 00', '改為 00', { field: 'fractureCode', value: '00' });
    const bt = [['burn2Code', T.burn2, 'PAD45B01', 'PAD201_45', '二度燒燙傷面積代號'], ['burn3Code', T.burn3, 'PAD46B01', 'PAD201_46', '三度燒燙傷代號'], ['burnFaceCode', T.burnFace, 'PAD47B01', 'PAD201_47', '顏面燒燙傷代號']];
    for (const [k, list, id, id0, nm] of bt) {
      if (t === '05' && r[k] !== '0000' && !list.includes(r[k])) e(id, [k], `${nm} ${r[k]} 不在代號表內`, '依代號表填列；無此項給付填 0000');
      if (T.benefitType[t] && t !== '05' && r[k] !== '0000') e(id0, [k, 'benefitType'], `非重大燒燙傷給付的${nm}應填 0000`, '改為 0000', { field: k, value: '0000' });
    }
    if (t === '05' && paid(r) && T.amtNature[r.amtNature] && bt.every(([k]) => r[k] === '0000')) e('PAD47B02', ['burn2Code', 'burn3Code', 'burnFaceCode'], '重大燒燙傷給付的二度、三度、顏面燒燙傷代號不可都為 0000', '依實際燒燙傷情形填列');
  });
  // 其他 (D49~D52)
  rd((r, p) => {
    const e = E(r, p), t = r.benefitType;
    if (dateOk(r.accidentDate) && /^\d{4}$/.test(r.year) && +r.year < yr(r.accidentDate)) e('PAD49B01', ['year', 'accidentDate'], `填報年度 ${r.year} 早於事故日期的年度`, '確認填報年度');
    if (T.benefitType[t] && t !== '04' && isZero(r.applyAmt)) e('PAD51B02', ['applyAmt', 'benefitType'], '申請金額應大於 0', '填入被保險人申請的金額');
    if (t === '04' && r.benefitItem !== '4101' && T.benefitItem[r.benefitItem] && isZero(r.applyDays)) e('PAD52B02', ['applyDays', 'benefitType'], '醫療日額給付 (非骨折) 的申請日數應大於 0', '填入申請日數');
    // D50B01：手冊寫「="0"」，欄位長度 2，依說明填 "00"
    if (r.reserved !== '00') e('PAD50B01', ['reserved'], '保留欄位應填 00', '改為 00', { field: 'reserved', value: '00' });
  });

  // ================= 多筆檢核：給付 (同一保單號碼) =================
  const groupD = [];
  groupD.push((recs, p) => {
    const s = recs.slice().sort((a, b) => a._line - b._line);
    const one = (r, id, fields, msg, sug, fix) => p(r, { ruleId: id, category: '多筆邏輯', fields, value: fields.map(k => (r[k] || '').trim()).join('/'), message: msg, suggestion: sug, fix: fix || null });
    const pe = isPE(s[0]);
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      const diff = (k, id) => { if (a[k] !== b[k]) one(b, id, [k], `同一保單的「${D.field(k).name}」與上 1 筆不同`, `同一保單應相同；若上 1 筆正確則改為 ${a[k].trim() || '(空白)'}`, { field: k, value: a[k] }); };
      if (b.productVer === '1' && a.productVer !== '1') one(b, 'PAD08L01', ['productVer'], '商品編號適用版本為 1，上 1 筆卻不是 1', '同一保單的適用版本應一致');
      if (b.productVer === '1' && a.productVer === '1' && a.productCode.slice(0, 13) !== b.productCode.slice(0, 13)) one(b, 'PAD08L02', ['productCode'], '保險商品編號第 1-13 碼與上 1 筆不同', '同一保單商品編號應相同');
      if (b.productVer === '2' && a.productVer === '2' && a.productCode.slice(0, 25) !== b.productCode.slice(0, 25)) one(b, 'PAD08L03', ['productCode'], '保險商品編號第 1-25 碼與上 1 筆不同', '同一保單商品編號應相同');
      diff('contractType', 'PAD09L01'); diff('groupLink', 'PAD11L01'); diff('startDate', 'PAD13L01'); diff('idNo', 'PAD22L01'); diff('econ', 'PAD28L01'); diff('currency', 'PAD35L01');
      if (pe && isPE(b)) { if (b.idType !== '1') diff('idType', 'PAD21L02'); diff('sex', 'PAD23L01'); diff('birthDate', 'PAD24L01'); }
    }
    if (pe) {
      const maxA = s.map(r => r.accidentDate).filter(dateOk).sort().pop();
      for (const r of s) if (['01', '11'].includes(r.benefitType) && dateOk(r.accidentDate) && r.accidentDate !== maxA) one(r, 'PAD10L01', ['accidentDate', 'benefitType'], `意外死亡給付的事故日期 ${r.accidentDate} 不是此保單最晚的事故日期 (另有 ${maxA})`, '死亡後不會再有其他事故，請確認日期');
      const cause = new Map();
      for (const r of s) { const c = cause.get(r.accidentDate); if (c && c.causeCode !== r.causeCode) one(r, 'PAD32L01', ['causeCode', 'accidentDate'], `同一事故日期 ${r.accidentDate} 的事故原因代號不同 (另有 ${c.causeCode.trim()})`, '同一事故應填相同的事故原因代號'); else if (!c) cause.set(r.accidentDate, r); }
      // 重複給付資料 (D00L01~D00L08)；D00L06/07 手冊寫「給付金額性質代號=4101」，實為給付項目代號 4101
      const dup = new Map();
      for (const r of s) {
        const t = r.benefitType, it = r.benefitItem, comp = ['0110', '0310'].includes(it), g01 = r.disabilityGrade.slice(6) === '01';
        let id = null, k = null;
        if (['01', '11'].includes(t)) { id = 'PAD00L01'; k = [r.company, r.accidentDate, r.applyDate, r.amtNature]; }
        else if (t === '02' && !comp && g01) { id = 'PAD00L02'; k = [r.company, r.accidentDate, r.amtNature]; }
        else if (t === '02' && !comp) { id = 'PAD00L03'; k = [r.company, r.accidentDate, r.applyDate, r.amtNature, r.disabilityGrade]; }
        else if (t === '02') { id = 'PAD00L04'; k = [r.company, r.accidentDate, r.applyDate, r.payDate, r.amtNature, r.claimNo]; }
        else if (t === '03') { id = 'PAD00L05'; k = [r.company, it, r.accidentDate, r.applyDate, r.amtNature, r.claimNo]; }
        else if (t === '04' && it === '4101') { id = 'PAD00L06'; k = [r.company, it, r.accidentDate, r.applyDate, r.amtNature, r.claimNo]; }
        else if (t === '04') { id = 'PAD00L07'; k = [r.company, it, r.accidentDate, r.applyDate, r.amtNature, r.claimNo, r.admitDate, r.dischargeDate]; }
        else if (['05', '06'].includes(t)) { id = 'PAD00L08'; k = [t, r.company, it, r.accidentDate, r.applyDate, r.amtNature, r.claimNo]; }
        if (!id) continue;
        const key = id + '|' + k.join('|');
        if (dup.has(key)) one(r, id, ['benefitType', 'accidentDate', 'applyDate', 'amtNature'], `與第 ${dup.get(key)} 行的給付類別、事故日期、申請日期、給付金額性質等相同 (重複給付資料)`, '刪除重複資料；同一事故多次給付請確認是否應合併');
        else dup.set(key, r._line);
      }
    }
    // 同一賠案 (D15L、D31L、D33L01)
    const byClaim = new Map();
    for (const r of s) { if (!byClaim.has(r.claimNo)) byClaim.set(r.claimNo, []); byClaim.get(r.claimNo).push(r); }
    for (const cs of byClaim.values()) {
      if (cs.length < 2) continue;
      const f0 = (pred, id, msg) => { const g = cs.filter(pred); for (const r of g.slice(1)) if (r.accidentDate !== g[0].accidentDate) one(r, id, ['accidentDate', 'claimNo'], msg, '同一賠案的事故日期應相同'); };
      for (const t of keys(T.benefitType).filter(x => x !== '02')) f0(r => r.benefitType === t, 'PAD15L01', `同一賠案、同一給付類別 ${t} 的事故日期不同`);
      f0(r => r.benefitType === '02' && !['0110', '0310'].includes(r.benefitItem), 'PAD15L02', '同一賠案的意外失能給付事故日期不同');
      f0(r => r.benefitType === '02' && ['0110', '0310'].includes(r.benefitItem), 'PAD15L03', '同一賠案的意外失能補償保險金事故日期不同');
      for (const r of cs.slice(1)) if (r.regionCode !== cs[0].regionCode) one(r, 'PAD33L01', ['regionCode', 'claimNo'], '同一賠案的事故地區代號不同', '同一賠案的事故地區應相同', { field: 'regionCode', value: cs[0].regionCode });
      const byPay = new Map();
      for (const r of cs) { const q = byPay.get(r.payDate); if (q && q.payStatus !== r.payStatus) one(r, 'PAD31L01', ['payStatus', 'payDate'], '同一賠案同一給付日期的給付狀態不同', '同一次給付的給付狀態應相同'); else if (!q) byPay.set(r.payDate, r); }
      const maxP = cs.map(r => r.payDate).filter(dateOk).sort().pop();
      for (const r of cs) if (r.payStatus === 'S' && dateOk(r.payDate) && r.payDate !== maxP) one(r, 'PAD31L02', ['payStatus', 'payDate'], `給付狀態為 S (結案)，但同一賠案另有更晚的給付日期 ${maxP}`, '結案應為同一賠案最後一次給付');
    }
    const byEvt = new Map();
    for (const r of s) { const k = [r.accidentDate, r.sex, r.birthDate].join('|'); const q = byEvt.get(k); if (q && q.regionCode !== r.regionCode) one(r, 'PAD33L02', ['regionCode', 'accidentDate'], `同一事故日期 ${r.accidentDate} 的事故地區代號不同`, '同一事故的事故地區應相同'); else if (!q) byEvt.set(k, r); }
    for (const r of s) if (r.amtNature === '4' && !s.some(x => x.amtNature === '1' && x.benefitType === r.benefitType && x.benefitItem === r.benefitItem && x.accidentDate === r.accidentDate)) one(r, 'PAD34L03', ['amtNature'], '追回金額 (性質 4) 找不到相同給付類別、給付項目、事故日期的已付資料', '確認追回資料或補報已付資料');
  });

  // ================= 承保檔與給付檔 (LD) =================
  // 事故時承保檔：契約變更日期 ≦ 事故日期的最後一筆；都晚於事故日期時取第一筆
  const atAccident = (ls, d) => { let pick = null; for (const r of ls) if (dateOk(r.changeDate) && r.changeDate <= d.accidentDate) pick = r; return pick || ls[0]; };
  const crossLD = (data, p) => {
    const Ls = (data.AL || []).filter(r => r._raw.length === L.recordLength), Ds = (data.AD || []).filter(r => r._raw.length === D.recordLength);
    if (!Ls.length || !Ds.length) return;
    const lBy = new Map(), dBy = new Map();
    for (const r of Ls) { const k = L.keyOf(r); if (!lBy.has(k)) lBy.set(k, []); lBy.get(k).push(r); }
    for (const r of Ds) { const k = D.keyOf(r); if (!dBy.has(k)) dBy.set(k, []); dBy.get(k).push(r); }
    const PL = (r, id, fields, msg, sug, fix) => p('AL', r, { ruleId: id, fields, value: fields.map(k => (r[k] || '').trim()).join('/'), message: msg, suggestion: sug, fix: fix || null });
    const PD = (r, id, fields, msg, sug, fix) => p('AD', r, { ruleId: id, fields, value: fields.map(k => (r[k] || '').trim()).join('/'), message: msg, suggestion: sug, fix: fix || null });
    for (const [k, ls0] of lBy) {
      const ls = sortL(ls0), ds = dBy.get(k) || [];
      for (const r of ls) {
        if (['ADS', 'ATS', 'ADB'].includes(r.changeType) && !ds.length) PL(r, 'PALD0L01', ['changeType'], `契約變更型態為 ${r.changeType} (${T.changeType[r.changeType]})，但給付檔沒有這張保單的給付資料`, '補報對應的給付資料，或確認契約變更型態');
        if (r.changeType === 'ADB' && ds.length && !ds.some(d => d.benefitType === '02')) PL(r, 'PALD0L03', ['changeType'], '契約變更型態為 ADB (意外失能給付達保額)，但給付檔沒有意外失能 (02) 給付', '補報意外失能給付資料');
      }
    }
    for (const [k, ds] of dBy) {
      const ls0 = lBy.get(k);
      if (!ls0) { for (const d of ds) PD(d, 'PALD0L02', ['policyNo', 'policySeq'], '給付資料的保單號碼在承保檔找不到', '確認保單編號/序號是否一致 (含空白補位)，或補報承保資料'); continue; }
      const ls = sortL(ls0), sums = headSums(ls);
      const sumOf = r => sums[ls.indexOf(r)];
      const ads = ls.find(r => r.changeType === 'ADS'), ats = ls.find(r => r.changeType === 'ATS');
      for (const d of ds) {
        if (!dateOk(d.accidentDate)) continue;
        const l = atAccident(ls, d), t = d.benefitType, it = d.benefitItem, pe = isPE(l);
        const LA = kk => num(l[kk]);
        const same = (kk, id, kd) => { if (d[kd || kk] !== l[kk]) PD(d, id, [kd || kk], `「${D.field(kd || kk).name}」與事故時承保資料不同 (承保檔為 ${l[kk].trim() || '(空白)'})`, `改為與承保檔相同的 ${l[kk].trim() || '(空白)'}`, { field: kd || kk, value: l[kk] }); };
        // LD0L：一般欄位對應
        const ended = END_TYPES.includes(l.changeType) && l.headSign === '-';
        if (l.changeType === 'LNN' && dateOk(l.changeDate) && d.accidentDate > l.changeDate) PD(d, 'PALD0L04', ['accidentDate'], `事故日期 ${d.accidentDate} 在停效 (${l.changeDate}) 之後`, '停效期間的事故不應有給付；確認事故日期或承保資料');
        if (pe && ended && d.accidentDate > l.changeDate) PD(d, 'PALD0L05', ['accidentDate'], `事故日期 ${d.accidentDate} 晚於保單效力結束 (${l.changeType} ${l.changeDate})`, '確認事故日期或承保資料');
        if (!pe && END_TYPES.includes(l.changeType) && sumOf(l) === 0 && d.accidentDate > l.changeDate) PD(d, 'PALD0L06', ['accidentDate'], `事故日期 ${d.accidentDate} 晚於保單效力結束 (${l.changeType} ${l.changeDate})`, '確認事故日期或承保資料');
        // LD0L07 手冊原文「事故日期≧迄日」為誤植，依文意實作為「事故日期≦迄日」
        if (dateOk(l.endDate) && d.accidentDate > l.endDate) PD(d, 'PALD0L07', ['accidentDate'], `事故日期 ${d.accidentDate} 晚於事故時承保資料的保險期間迄日 ${l.endDate}`, '確認事故日期');
        same('company', 'PALD0L08');
        if (d.productVer === '1' && l.productVer === '1' && d.productCode.slice(0, 13) !== l.productCode.slice(0, 13)) PD(d, 'PALD0L09', ['productCode'], '保險商品編號第 1-13 碼與事故時承保資料不同', `改為承保檔的 ${l.productCode.trim()}`, { field: 'productCode', value: l.productCode });
        if (d.productVer === '2' && l.productVer === '2' && d.productCode.slice(0, 25) !== l.productCode.slice(0, 25)) PD(d, 'PALD0L10', ['productCode'], '保險商品編號第 1-25 碼與事故時承保資料不同', `改為承保檔的 ${l.productCode.trim()}`, { field: 'productCode', value: l.productCode });
        if ((d.accidentDate === l.changeDate || d.accidentDate === l.startDate)) same('productVer', 'PALD0L11');
        same('contractType', 'PALD0L12'); same('bizType', 'PALD0L13'); same('groupLink', 'PALD0L14'); same('termType', 'PALD0L15'); same('startDate', 'PALD0L16'); same('endDate', 'PALD0L17');
        if (pe && d.bizType === l.bizType) { same('idType', 'PALD0L18'); same('idNo', 'PALD0L19'); same('sex', 'PALD0L20'); same('birthDate', 'PALD0L21'); same('occClass', 'PALD0L22'); same('occCode', 'PALD0L23'); }
        same('econ', 'PALD0L24'); same('disabilityCat', 'PALD0L25'); same('disabilityLevel', 'PALD0L26'); same('currency', 'PALD0L27');
        const dm = num(d.dueMultiple);
        // LD1：意外死亡
        if (['01', '11'].includes(t)) {
          if (!(LA('deathAmt') > 0)) PD(d, 'PALD1L01', ['benefitType'], '意外死亡給付，但事故時承保資料的意外死亡保險金額為 0', '確認給付類別或承保資料');
          if (l.changeType !== 'ADS') PD(d, 'PALD1L02', ['benefitType'], `意外死亡給付，但事故時承保資料的契約變更型態為 ${l.changeType} (應為 ADS)`, '承保檔應有契約變更日期為事故日期的 ADS (意外死亡) 資料');
          if (l.changeType === 'ADS' && d.accidentDate !== l.changeDate) PD(d, 'PALD1L03', ['accidentDate'], `意外死亡給付的事故日期應等於承保檔 ADS 的契約變更日期 ${l.changeDate}`, '確認事故日期');
          if (ads && d.accidentDate !== ads.changeDate) PD(d, 'PALD1L21', ['accidentDate'], `承保檔意外死亡 (ADS) 日期為 ${ads.changeDate}，與給付檔事故日期 ${d.accidentDate} 不同`, '確認事故日期或契約變更日期');
          if (l.deathScope !== '02' && T.scope[l.deathScope] && dm !== 1000) PD(d, 'PALD1L04', ['dueMultiple'], `意外死亡保險範圍不是多倍型 (02)，應給付倍數應為 001000，實際為 ${d.dueMultiple}`, '改為 001000', { field: 'dueMultiple', value: '001000' });
          if (l.deathScope === '02' && dm < 1000) PD(d, 'PALD1L05', ['dueMultiple'], '多倍型意外死亡給付的應給付倍數應至少為 001000', '填入該事故的給付倍數');
          const sc = l.deathScope, bits = l.deathSpecial, n = +it.slice(2);
          if (['0100', '0200'].includes(it)) { if (!(sc === '01' && bits === '0000000000')) PD(d, 'PALD1L08', ['benefitItem'], `給付項目 ${it} (所有意外事故-標準型)，但承保資料的意外死亡保險範圍為 ${sc}、特定事故代號 ${bits}`, '確認給付項目或承保範圍'); if (sc !== '01') PD(d, 'PALD1L22', ['benefitItem'], `給付項目 ${it} 應對應意外死亡保險範圍 01，承保資料為 ${sc}`, '確認給付項目'); }
          if (/^0[12]0[1-5]$/.test(it)) {
            const ok = sc === '02' && (n === 1 ? bits.slice(0, 4) !== '0000' : bits[n - 2] === '1');
            if (!ok) PD(d, 'PALD1L' + (8 + n), ['benefitItem'], `給付項目 ${it} (多倍型${n === 1 ? '一般意外' : '特定事故 0' + (n - 1)})，但承保資料的意外死亡保險範圍為 ${sc}、特定事故代號 ${bits}`, '確認給付項目或承保範圍');
            if (sc !== '02') PD(d, 'PALD1L23', ['benefitItem'], `給付項目 ${it} 應對應意外死亡保險範圍 02 (多倍型)，承保資料為 ${sc}`, '確認給付項目');
          }
          if (/^0[12]0[6-9]$/.test(it)) {
            if (!(sc === '03' && bits[n - 6] === '1')) PD(d, 'PALD1L' + (8 + n), ['benefitItem'], `給付項目 ${it} (僅保特定事故 0${n - 5})，但承保資料的意外死亡保險範圍為 ${sc}、特定事故代號 ${bits}`, '確認給付項目或承保範圍');
            if (sc !== '03') PD(d, 'PALD1L24', ['benefitItem'], `給付項目 ${it} 應對應意外死亡保險範圍 03 (僅特定事故)，承保資料為 ${sc}`, '確認給付項目');
          }
          if (sc === '01' && !['0100', '0200'].includes(it)) PD(d, 'PALD1L18', ['benefitItem'], `承保資料的意外死亡保險範圍為 01 (標準型)，給付項目應為 0100 或 0200，實際為 ${it}`, '確認給付項目');
          if (sc === '02' && !/^0[12]0[1-5]$/.test(it)) PD(d, 'PALD1L19', ['benefitItem'], `承保資料的意外死亡保險範圍為 02 (多倍型)，給付項目應為 0101~0105 或 0201~0205，實際為 ${it}`, '確認給付項目');
          if (sc === '03' && !/^0[12]0[6-9]$/.test(it)) PD(d, 'PALD1L20', ['benefitItem'], `承保資料的意外死亡保險範圍為 03 (僅特定事故)，給付項目應為 0106~0109 或 0206~0209，實際為 ${it}`, '確認給付項目');
        }
        // LD2：意外失能
        if (t === '02') {
          const comp = ['0110', '0310'].includes(it), g01 = d.disabilityGrade.slice(6) === '01', sc = l.disScope, bits = l.disSpecial, n = +it.slice(2);
          if (!(LA('disAmt') > 0)) PD(d, 'PALD2L01', ['benefitType'], '意外失能給付，但事故時承保資料的意外失能保險金額為 0', '確認給付類別或承保資料');
          if (l.changeType === 'ADB' && d.accidentDate !== l.changeDate) PD(d, 'PALD2L04', ['accidentDate'], `事故日期應等於承保檔 ADB 的契約變更日期 ${l.changeDate}`, '確認事故日期');
          if (sc !== '02' && T.scope[sc] && dm !== 1000) PD(d, 'PALD2L05', ['dueMultiple'], `意外失能保險範圍不是多倍型 (02)，應給付倍數應為 001000，實際為 ${d.dueMultiple}`, '改為 001000', { field: 'dueMultiple', value: '001000' });
          if (sc === '02' && dm < 1000) PD(d, 'PALD2L06', ['dueMultiple'], '多倍型意外失能給付的應給付倍數應至少為 001000', '填入該事故的給付倍數');
          if (!comp) {
            if (g01 && l.changeType !== 'ATS') PD(d, 'PALD2L07', ['disabilityGrade'], '失能等級為第 1 級 (完全失能)，事故時承保資料的契約變更型態應為 ATS', '承保檔應有 ATS (意外完全失能) 資料');
            if (g01 && l.changeType === 'ATS' && d.accidentDate !== l.changeDate) PD(d, 'PALD2L08', ['accidentDate'], `事故日期應等於承保檔 ATS 的契約變更日期 ${l.changeDate}`, '確認事故日期');
            if (l.changeType === 'ATS' && !g01) PD(d, 'PALD2L11', ['disabilityGrade'], '事故時承保資料為 ATS (意外完全失能)，失能等級應為第 1 級', '確認失能項次等級代號');
            if (l.changeType !== 'ATS' && g01) PD(d, 'PALD2L12', ['disabilityGrade'], '承保資料沒有 ATS (意外完全失能)，失能等級不應為第 1 級', '確認失能項次等級代號或承保資料');
            const rate = (GRADE.B.has(d.disabilityGrade) || GRADE.C.has(d.disabilityGrade)) ? GRADE_RATE[+d.disabilityGrade.slice(6)] : null;
            if (pe && rate && Math.abs(Math.round(LA('disAmt') * rate) - num(d.dueAmt)) > 1) PD(d, 'PALD2L10', ['dueAmt', 'disabilityGrade'], `應給付保險金額應為失能保額 ${LA('disAmt')} × ${rate * 100}% (第 ${+d.disabilityGrade.slice(6)} 級) = ${Math.round(LA('disAmt') * rate)}`, `改為 ${Math.round(LA('disAmt') * rate)}`, { field: 'dueAmt', value: String(Math.round(LA('disAmt') * rate)) });
          }
          if (g01 && !comp && ats && d.accidentDate !== ats.changeDate) PD(d, 'PALD2L29', ['accidentDate'], `承保檔意外完全失能 (ATS) 日期為 ${ats.changeDate}，與事故日期不同`, '確認事故日期');
          if (['0100', '0300'].includes(it)) { if (!(sc === '01' && bits === '0000000000')) PD(d, 'PALD2L15', ['benefitItem'], `給付項目 ${it} (標準型)，但承保資料的意外失能保險範圍為 ${sc}、特定事故代號 ${bits}`, '確認給付項目或承保範圍'); if (sc !== '01') PD(d, 'PALD2L30', ['benefitItem'], `給付項目 ${it} 應對應意外失能保險範圍 01`, '確認給付項目'); }
          if (/^0[13]0[1-5]$/.test(it)) {
            if (!(sc === '02' && (n === 1 ? bits.slice(0, 4) !== '0000' : bits[n - 2] === '1'))) PD(d, 'PALD2L' + (15 + n), ['benefitItem'], `給付項目 ${it} (多倍型)，但承保資料的意外失能保險範圍為 ${sc}、特定事故代號 ${bits}`, '確認給付項目或承保範圍');
            if (sc !== '02') PD(d, 'PALD2L31', ['benefitItem'], `給付項目 ${it} 應對應意外失能保險範圍 02 (多倍型)`, '確認給付項目');
          }
          if (/^0[13]0[6-9]$/.test(it)) {
            if (!(sc === '03' && bits[n - 6] === '1')) PD(d, 'PALD2L' + (15 + n), ['benefitItem'], `給付項目 ${it} (僅保特定事故)，但承保資料的意外失能保險範圍為 ${sc}、特定事故代號 ${bits}`, '確認給付項目或承保範圍');
            if (sc !== '03') PD(d, 'PALD2L32', ['benefitItem'], `給付項目 ${it} 應對應意外失能保險範圍 03 (僅特定事故)`, '確認給付項目');
          }
          if (comp && !['01', '02', '03'].includes(sc)) PD(d, 'PALD2L25', ['benefitItem'], '補償保險金給付，但承保資料沒有意外失能保險範圍', '確認給付項目或承保資料');
          if (sc === '01' && !['0100', '0110', '0300', '0310'].includes(it)) PD(d, 'PALD2L26', ['benefitItem'], `承保資料的意外失能保險範圍為 01，給付項目應為 0100、0110、0300 或 0310，實際為 ${it}`, '確認給付項目');
          if (sc === '02' && !/^0[13](0[1-5]|10)$/.test(it)) PD(d, 'PALD2L27', ['benefitItem'], `承保資料的意外失能保險範圍為 02 (多倍型)，給付項目 ${it} 不相符`, '確認給付項目');
          if (sc === '03' && !/^0[13](0[6-9]|10)$/.test(it)) PD(d, 'PALD2L28', ['benefitItem'], `承保資料的意外失能保險範圍為 03 (僅特定事故)，給付項目 ${it} 不相符`, '確認給付項目');
        }
        // LD3~LD6：醫療限額、醫療日額、重大燒燙傷、骨折 (保額為 0 時只報缺保額，不再比較金額)
        if (t === '03') {
          if (!(LA('medLimit') > 0)) PD(d, 'PALD3L01', ['benefitType'], '醫療限額給付，但事故時承保資料的醫療限額為 0', '確認給付類別或承保資料');
          else if (num(d.dueAmt) > LA('medLimit')) PD(d, 'PALD3L02', ['dueAmt'], `應給付保險金額 ${num(d.dueAmt)} 大於承保醫療限額 ${LA('medLimit')}`, '應給付金額取申請費用與限額較小者');
          if (dm !== 1000) PD(d, 'PALD3L03', ['dueMultiple'], '醫療限額給付的應給付倍數應為 001000', '改為 001000', { field: 'dueMultiple', value: '001000' });
        }
        if (t === '04') {
          const fr = it === '4101';
          if (!(LA('medDaily') > 0)) PD(d, 'PALD4L01', ['benefitType'], '醫療日額給付，但事故時承保資料的醫療日額為 0', '確認給付類別或承保資料');
          else {
            if (!(LA('maxDays') > 0 && LA('maxDays') <= 365)) PD(d, 'PALD4L02', ['benefitType'], `醫療日額給付，但承保資料的最高日數限制為 ${l.maxDays} (應介於 001 與 365)`, '確認承保資料的最高日數限制');
            if (isPE(d) && !fr && num(d.dueAmt) !== LA('medDaily')) PD(d, 'PALD4L03', ['dueAmt'], `應給付保險金額日額應等於承保醫療日額 ${LA('medDaily')}`, `改為 ${LA('medDaily')}`, { field: 'dueAmt', value: String(LA('medDaily')) });
            if ((isPE(d) ? fr : true) && num(d.dueAmt) > LA('medDaily')) PD(d, isPE(d) ? 'PALD4L04' : 'PALD4L05', ['dueAmt'], `應給付保險金額日額 ${num(d.dueAmt)} 大於承保醫療日額 ${LA('medDaily')}`, '確認應給付日額');
            if (!(num(d.dueDays) > 0 && num(d.dueDays) <= LA('maxDays'))) PD(d, 'PALD4L06', ['dueDays'], `應給付日數 ${d.dueDays} 應大於 0 且不超過承保最高日數限制 ${l.maxDays}`, '確認應給付日數');
          }
        }
        if (t === '05') {
          if (!(LA('burnAmt') > 0)) PD(d, 'PALD5L01', ['benefitType'], '重大燒燙傷給付，但事故時承保資料的重大燒燙傷保險金額為 0', '確認給付類別或承保資料');
          else if (num(d.dueAmt) > LA('burnAmt')) PD(d, 'PALD5L02', ['dueAmt'], `應給付保險金額 ${num(d.dueAmt)} 大於承保重大燒燙傷保險金額 ${LA('burnAmt')}`, '確認應給付金額');
        }
        if (t === '06') {
          if (!(LA('fractureAmt') > 0)) PD(d, 'PALD6L01', ['benefitType'], '骨折給付，但事故時承保資料的骨折保險金額為 0', '確認給付類別或承保資料');
          else if (num(d.dueAmt) > LA('fractureAmt')) PD(d, 'PALD6L02', ['dueAmt'], `應給付保險金額 ${num(d.dueAmt)} 大於承保骨折保險金額 ${LA('fractureAmt')}`, '確認應給付金額');
        }
      }
      // 合計金額 / 日數 / 件數
      const ok = ds.filter(d => dateOk(d.accidentDate));
      const sumBy = (list, keyf, valf) => { const m = new Map(); for (const d of list) { const kk = keyf(d); const q = m.get(kk) || { sum: 0, recs: [] }; q.sum += valf(d) || 0; q.recs.push(d); m.set(kk, q); } return [...m.values()]; };
      const death = ok.filter(d => ['01', '11'].includes(d.benefitType));
      if (death.length) {
        const l = atAccident(ls, death[0]), mx = Math.max(...death.map(d => num(d.dueMultiple) || 0)), tot = death.reduce((a, d) => a + (num(d.paidAmt) || 0), 0);
        if (tot > Math.round(num(l.deathAmt) * mx / 1000)) PD(death[0], 'PALD1L06', ['paidAmt'], `意外死亡實際給付合計 ${tot} 大於意外死亡保額 ${num(l.deathAmt)} × 倍數 ${mx / 1000}`, '確認實際給付金額或倍數');
        for (const q of sumBy(death, d => d.accidentDate, () => 1)) {
          const l2 = atAccident(ls, q.recs[0]);
          if (l2.changeType === 'ADS' && q.recs[0].accidentDate === l2.changeDate && q.sum !== num(l2.headCount)) PD(q.recs[0], 'PALD1L07', ['benefitType'], `意外死亡給付 ${q.sum} 件，與承保檔 ADS 的人數 ${num(l2.headCount)} 不同`, '確認給付件數或承保人數');
        }
      }
      const dis = ok.filter(d => d.benefitType === '02' && !['0110', '0310'].includes(d.benefitItem));
      if (dis.length) {
        const l = atAccident(ls, dis[0]), tot = dis.reduce((a, d) => a + (num(d.paidAmt) || 0), 0);
        if (!['ADB', 'ATS'].includes(l.changeType) && num(l.disAmt) > 0 && tot > num(l.disAmt)) PD(dis[0], 'PALD2L02', ['paidAmt'], `意外失能實際給付合計 ${tot} 大於意外失能保額 ${num(l.disAmt)}`, '確認實際給付金額');
        if (l.changeType === 'ADB' && tot < num(l.disAmt)) PD(dis[0], 'PALD2L03', ['paidAmt'], `承保檔為 ADB (失能給付合計達保額)，但意外失能實際給付合計 ${tot} 小於保額 ${num(l.disAmt)}`, '確認給付資料或契約變更型態');
        for (const q of sumBy(dis, d => d.claimNo + '|' + d.accidentDate, d => num(d.paidAmt))) { const l2 = atAccident(ls, q.recs[0]); if (num(l2.disAmt) > 0 && q.sum > num(l2.disAmt)) PD(q.recs[0], 'PALD2L14', ['paidAmt'], `同一賠案同一事故的意外失能實際給付合計 ${q.sum} 大於意外失能保額 ${num(l2.disAmt)}`, '確認實際給付金額'); }
      }
      for (const q of sumBy(ok.filter(d => d.benefitType === '03'), d => d.claimNo + '|' + d.accidentDate, d => num(d.paidAmt))) { const l = atAccident(ls, q.recs[0]); if (num(l.medLimit) > 0 && q.sum > num(l.medLimit)) PD(q.recs[0], 'PALD3L04', ['paidAmt'], `同一賠案同一事故的醫療限額實際給付合計 ${q.sum} 大於承保醫療限額 ${num(l.medLimit)}`, '確認實際給付金額'); }
      const day = ok.filter(d => d.benefitType === '04' && !['4101', '2304'].includes(d.benefitItem));
      for (const q of sumBy(day, d => d.claimNo + '|' + d.accidentDate, d => num(d.paidDays))) { const l = atAccident(ls, q.recs[0]); if (num(l.medDaily) > 0 && q.sum > num(l.maxDays)) PD(q.recs[0], 'PALD4L07', ['paidDays'], `同一賠案同一事故的實際給付日數合計 ${q.sum} 天，超過承保最高日數限制 ${l.maxDays}`, '確認實際給付日數'); }
      for (const q of sumBy(day, d => d.accidentDate, d => num(d.paidDays))) { const l = atAccident(ls, q.recs[0]); if (num(l.medDaily) > 0 && q.sum > num(l.maxDays) && !q.recs.every(d => d.diffReason === '0')) PD(q.recs[0], 'PALD4L08', ['paidDays', 'diffReason'], `同一事故日期的實際給付日數合計 ${q.sum} 天，超過最高日數限制 ${l.maxDays} (提醒)`, '請確認給付日數與給付額不同原因', null); }
      for (const [tp, amt, id] of [['05', 'burnAmt', 'PALD5L03'], ['06', 'fractureAmt', 'PALD6L03']])
        for (const q of sumBy(ok.filter(d => d.benefitType === tp), d => d.accidentDate, d => num(d.paidAmt))) { const l = atAccident(ls, q.recs[0]); if (num(l[amt]) > 0 && q.sum > num(l[amt])) PD(q.recs[0], id, ['paidAmt'], `同一事故的實際給付合計 ${q.sum} 大於承保${L.field(amt).name} ${num(l[amt])}`, '確認實際給付金額'); }
    }
  };

  // ================= 規則目錄 =================
  const catalog = [];
  const R = (id, name, level, ref, severity) => { if (!catalog.some(c => c.id === id)) catalog.push({ id, name, level, ref, severity: severity || 'error', product: 'accident' }); };
  for (const fd of L.fields) { R(fd.typeRule, `${fd.name}資料型態`, '資料類型', fd.ref); if (fd.codes) R(fd.codeRule, `${fd.name}代碼檢核`, '代碼', fd.ref); }
  for (const fd of D.fields) { R(fd.typeRule, `${fd.name}資料型態`, '資料類型', fd.ref); if (fd.codes) R(fd.codeRule, `${fd.name}代碼檢核`, '代碼', fd.ref); }
  [
    ['PAD00L01', '業務性質代號=(PE或CP)且給付類別代號=(01或11)時，not(公司代號相同且事故日期相同且申請日期相同且給付金額性質代號相同)', '多筆', '陸-15'],
    ['PAD00L02', '業務性質代號=(PE或CP)且給付類別代號=02且給付項目代號≠(0110及0310)且失能項次等級代號第7-8位=01時，not(公司代號相同且事故日期相…', '多筆', '陸-15'],
    ['PAD00L03', '業務性質代號=(PE或CP)且給付類別代號=02且給付項目代號≠(0110及0310)且失能項次等級代號第7-8位≠01時，not(公司代號相同且事故日期相…', '多筆', '陸-15'],
    ['PAD00L04', '業務性質代號=(PE或CP)且給付類別代號=02且給付項目代號=(0110或0310)時，not(公司代號相同且事故日期相同且申請日期相同且給付日期相同且給…', '多筆', '陸-15'],
    ['PAD00L05', '業務性質代號=(PE或CP)且給付類別代號=03時，not(公司代號相同且給付項目代號相同且事故日期相同且申請日期相同且給付金額性質代號相同且賠案編號相同)', '多筆', '陸-15'],
    ['PAD00L06', '業務性質代號=(PE或CP)且給付類別代號=04且給付金額性質代號=4101時，not(公司代號相同且給付項目代號相同且事故日期相同且申請日期相同且給付金額…', '多筆', '陸-15'],
    ['PAD00L07', '業務性質代號=(PE或CP)且給付類別代號=04且給付金額性質代號≠4101時，not(公司代號相同且給付項目代號相同且事故日期相同且申請日期相同且給付金額…', '多筆', '陸-15'],
    ['PAD00L08', '業務性質代號=(PE或CP)且給付類別代號=(05或06)時，not(公司代號相同且給付項目代號相同且事故日期相同且申請日期相同且給付金額性質代號相同且賠案…', '多筆', '陸-15'],
    ['PAD02B02', '給付類別代號與給付項目代號互相配合', '單筆', '陸-15'],
    ['PAD08L01', '保險商品編號適用版本代號=1時，保險商品編號適用版本代號=上1筆保險商品編號適用版本代號', '多筆', '陸-16'],
    ['PAD08L02', '保險商品編號適用版本代號=1且上一筆保險商品編號適用版本代號=1時，保險商品編號第1-13位=上1筆保險商品編號第1-13位', '多筆', '陸-16'],
    ['PAD08L03', '保險商品編號適用版本代號=2且上一筆保險商品編號適用版本代號=2時，保險商品編號第1-25位=上1筆保險商品編號第1-25位', '多筆', '陸-16'],
    ['PAD09L01', '契約別相同', '多筆', '陸-16'],
    ['PAD10L01', '業務性質代號=(PE或CP)且給付類別代號=(01或11)時，事故日期=max(事故日期)(即若發生死亡給付,之後不可能有給付資料)', '多筆', '陸-16'],
    ['PAD11L01', '集體投保之連結關係相同', '多筆', '陸-16'],
    ['PAD13L01', '保單保險期間起日相同', '多筆', '陸-16'],
    ['PAD15B01', '西元日期', '資料類型', '陸-16'],
    ['PAD15B02', '事故日期≧保單保險期間起日', '單筆', '陸-16'],
    ['PAD15B03', '事故日期≦保單保險期間迄日', '單筆', '陸-16'],
    ['PAD15B04', '事故日期之年度≦填報年度', '單筆', '陸-16'],
    ['PAD15L01', '給付類別代號≠02且給付類別相同且賠案編號相同時，事故日期相同', '多筆', '陸-16'],
    ['PAD15L02', '給付類別代號=02且給付項目代號≠(0110及0310)且賠案編號相同時，事故日期相同', '多筆', '陸-16'],
    ['PAD15L03', '給付類別代號=02且給付項目代號=(0110或0310)且賠案編號相同時，事故日期相同', '多筆', '陸-16'],
    ['PAD16B01', '西元日期', '資料類型', '陸-16'],
    ['PAD16B02', '申請日期≧事故日期', '單筆', '陸-16'],
    ['PAD16B03', '申請日期之年度≦填報年度', '單筆', '陸-16'],
    ['PAD17B01', '給付金額性質代號=2時，給付日期=00000000', '單筆', '陸-16'],
    ['PAD17B02', '給付金額性質代號≠2時，給付日期=西元日期', '單筆', '陸-16'],
    ['PAD17B03', '給付金額性質代號≠2時，給付日期≧事故日期', '單筆', '陸-16'],
    ['PAD17B04', '給付金額性質代號≠2時，給付日期≧申請日期', '單筆', '陸-16'],
    ['PAD17B05', '給付金額性質代號≠2時，給付日期之年度≦填報年度', '單筆', '陸-16'],
    ['PAD18B01', '00000000或西元日期', '資料類型', '陸-16'],
    ['PAD18B02', '入院日期≠00000000且給付類別代號=(03或04或05或06)時，給付日期≧事故日期', '單筆', '陸-16'],
    ['PAD18B03', '入院日期≠00000000時，入院日期≦申請日期', '單筆', '陸-16'],
    ['PAD18B04', '入院日期≠00000000時，入院日期＜給付日期', '單筆', '陸-16'],
    ['PAD18B05', '給付類別代號=04且給付項目代號≠4101時，入院日期≠00000000', '單筆', '陸-16'],
    ['PAD19B01', '00000000或西元日期', '資料類型', '陸-16'],
    ['PAD19B02', '出院日期≠00000000時，出院日期≧入院日期', '單筆', '陸-16'],
    ['PAD19B03', '出院日期≠00000000且給付類別代號=(03或04或05或06)時，出院日期≧事故日期', '單筆', '陸-16'],
    ['PAD19B04', '出院日期≠00000000時，出院日期≦申請日期', '單筆', '陸-16'],
    ['PAD19B05', '出院日期≠00000000時，出院日期≦給付日期', '單筆', '陸-16'],
    ['PAD19B06', '給付類別代號=04且給付項目代號≠4101時，出院日期≠00000000', '單筆', '陸-16'],
    ['PAD20B02', '((出院日期-入院日期)-住院日數)≦14天', '單筆', '陸-16'],
    ['PAD20B03', '給付類別代號=04且住院日數≠000時，入院日期≠00000000', '單筆', '陸-16'],
    ['PAD20B04', '給付類別代號=04且住院日數≠000時，出院日期≠00000000', '單筆', '陸-16'],
    ['PAD20B05', '給付類別代號=04且給付項目代號≠4101時，住院日數≠000', '單筆', '陸-16'],
    ['PAD21L02', '業務性質代號=(PE或CP)且證件種類代號≠1時，證件種類代號相同', '多筆', '陸-16'],
    ['PAD22L01', '證件編號相同', '多筆', '陸-16'],
    ['PAD23L01', '業務性質代號=(PE或CP)時，性別相同', '多筆', '陸-16'],
    ['PAD24B01', '西元日期', '資料類型', '陸-16'],
    ['PAD24B02', '給付類別代號=01且保單保險期間起日＞20100202且出生日期為合理日期且事故日期為合理日期時，事故時實際年齡( 事故日期-出生日期)≧15足歲', '單筆', '陸-16'],
    ['PAD24B03', '給付類別代號=11且出生日期為合理日期且事故日期為合理日期時，事故時實際年齡( 事故日期-出生日期)＜15足歲', '單筆', '陸-17'],
    ['PAD24B04', '出生日期之年度≦填報年度', '單筆', '陸-17'],
    ['PAD24B05', '出生日期≦保單保險期間起日', '單筆', '陸-17'],
    ['PAD24L01', '業務性質代號=(PE或CP)時，出生日期相同', '多筆', '陸-17'],
    ['PAD25B02', '保險商品編號第4位=2且保險商品編號第5位≠2時，事故時職業類別代號=(1或2或3或4或5或6或9或0)', '單筆', '陸-17'],
    ['PAD25B04', '保險商品編號第4位=2且保險商品編號第5位≠2且契約別=(1或2)且業務性質代號=(PE或CP)時，事故時職業類別代號=(1或2或3或4或5或6或9)', '單筆', '陸-17'],
    ['PAD25B05', '保險商品編號第4位≠2且契約別=(1或2)且業務性質代號=(PE或CP)時，事故時職業類別代號=(1或2或3或4或5或6或9或8)', '單筆', '陸-17'],
    ['PAD25B06', '契約別=3時，事故時職業類別代號=0', '單筆', '陸-17'],
    ['PAD26B03', '保險商品編號第4位=2且保單保險期間起日≧20150301且保單保險期間起日＜20230601且事故日期＜20230601且事故時職業類別代號≠0時，事故時…', '單筆', '陸-17'],
    ['PAD26B04', '保險商品編號第4位≠2且保單保險期間起日≧20150301且保單保險期間起日＜20230601且事故日期＜20230601且事故時職業類別代號≠0時，事故時…', '單筆', '陸-17'],
    ['PAD26B05', '保單保險期間起日≧20150301且保單保險期間起日＜20230601且事故日期＜20230601時，事故時職業類別代碼應與事故時職業分類代號互相配合(參照…', '單筆', '陸-17'],
    ['PAD26B06', '保險商品編號第4位=2且保單保險期間起日≧20230601且事故時職業類別代號≠0時，事故時職業分類代碼=台灣地區傷害保險個人職業分類表之代碼(不含拒保)', '單筆', '陸-17'],
    ['PAD26B07', '保險商品編號第4位≠2且保單保險期間起日≧20230601且事故時職業類別代號≠0時，事故時職業分類代碼=台灣地區傷害保險個人職業分類表之代碼(含拒保)', '單筆', '陸-17'],
    ['PAD26B08', '保單保險期間起日≧20230601時，事故時職業類別代碼應與事故時職業分類代號互相配合(參照台灣地區傷害保險個人職業分類表)', '單筆', '陸-17'],
    ['PAD26B09', '保險商品編號第4位=2且保單保險期間起日＜20150301且事故日期≧20230601時，事故時職業分類代碼=(00000000或台灣地區傷害保險個人職業分…', '單筆', '陸-17'],
    ['PAD26B11', '保險商品編號第4位=2且保單保險期間起日≧20150301且保單保險期間起日＜20230601且事故日期≧20230601且事故時職業類別代號≠0時，事故時…', '單筆', '陸-17'],
    ['PAD26B12', '保險商品編號第4位≠2且保單保險期間起日≧20150301且保單保險期間起日＜20230601且事故日期≧20230601且事故時職業類別代號≠0時，事故時…', '單筆', '陸-17'],
    ['PAD26B13', '保單保險期間起日≧20150301且保單保險期間起日＜20230601且事故日期≧20230601時，事故時職業類別代碼應與事故時職業分類代號互相配合(參照…', '單筆', '陸-17'],
    ['PAD28B01', '保單保險期間起日＜20140626時，經濟弱勢者身分=(0或經濟弱勢者身分代號表之代號)', '單筆', '陸-18'],
    ['PAD28L01', '經濟弱勢者身分相同', '多筆', '陸-18'],
    ['PAD29B01', '出生日期＜20120711且事故日期＜20120711時，身心障礙類別=(000或身心障礙類別代號表代號)', '單筆', '陸-18'],
    ['PAD29B03', '出生日期≧20120711時，身心障礙類別=(000或身心障礙類別擴充代號表代號)', '單筆', '陸-18'],
    ['PAD31L01', '賠案編號相同且給付日期相同時，給付狀態代號相同', '多筆', '陸-18'],
    ['PAD31L02', '賠案編號相同且給付狀態代號=S時，給付日期=Max(給付日期)', '多筆', '陸-18'],
    ['PAD32B04', '事故日期≧20160101且給付金額性質代號≠2時，事故原因代號=檔案｢事故原因代號_ICD-10-CM_Ch20.xls｣ (事故於2016年起發生者適用…', '單筆', '陸-18'],
    ['PAD32B06', '事故原因代號第1-3位≠(Y35及Y36及Y37及Y38)', '單筆', '陸-18'],
    ['PAD32L01', '業務性質代號=(PE或CP)且事故日期相同時，事故原因代號相同', '多筆', '陸-18'],
    ['PAD33L01', '賠案號碼相同時，事故地區代號相同', '多筆', '陸-18'],
    ['PAD33L02', '事故日期相同且性別相同且出生日期相同時，事故地區代號相同', '多筆', '陸-18'],
    ['PAD34B02', '給付金額性質代號=2時，給付狀態代號=U', '單筆', '陸-18'],
    ['PAD34B03', '給付金額性質代號≠2時，給付狀態代號≠U', '單筆', '陸-18'],
    ['PAD34L03', '給付金額性質代號=4時，有給付金額性質代號=1且給付類別代號相同且給付項目代號相同且事故日期相同之資料', '多筆', '陸-18'],
    ['PAD35L01', '原幣別相同', '多筆', '陸-18'],
    ['PAD36B01', '應給付保險金額日額＞0', '單筆', '陸-18'],
    ['PAD37B01', '給付類別代號=03時，應給付保險金額日額給付倍數=(000001~035000)', '單筆', '陸-18'],
    ['PAD37B02', '給付類別代號=04時，應給付保險金額日額給付倍數=(000001~005000)', '單筆', '陸-18'],
    ['PAD37B03', '給付類別代號=(05或06)時，應給付保險金額日額給付倍數=001000', '單筆', '陸-18'],
    ['PAD38B01', '給付類別代號=04時，應給付日數=(001~365)', '單筆', '陸-18'],
    ['PAD39B01', '給付金額性質代號=2時，實際給付保險金額日額=0', '單筆', '陸-18'],
    ['PAD40B01', '給付金額性質代號=2時，實際給付保險金額日額給付倍數=000000', '單筆', '陸-18'],
    ['PAD40B02', '給付類別代號=04且給付金額性質代號≠2且給付額不同原因=0時，實際給付保險金額日額給付倍數=(實際給付保險金額)÷(應給付保險金額日額×應給付保險金額日額…', '單筆', '陸-19'],
    ['PAD40B03', '給付類別代號≠04且給付金額性質代號≠2且給付額不同原因=0時，實際給付保險金額日額給付倍數=(實際給付保險金額)÷(應給付保險金額日額×應給付保險金額日額…', '單筆', '陸-19'],
    ['PAD41B01', '給付金額性質代號=2時，實際給付日數=000', '單筆', '陸-19'],
    ['PAD42B02', '給付金額性質代號=2時，給付額不同原因=0', '單筆', '陸-19'],
    ['PAD42B03', '給付類別代號=(01或11或02)且給付金額性質代號≠2且實際給付保險金額≠(應給付保險金額日額×應給付保險金額日額給付倍數)時，給付額不同原因=(1或2或…', '單筆', '陸-19'],
    ['PAD42B04', '給付類別代號=(03或05或06)且給付金額性質代號≠2且實際給付保險金額≠(應給付保險金額日額×應給付保險金額日額給付倍數)時，給付額不同原因=(1或2或…', '單筆', '陸-19'],
    ['PAD42B05', '給付類別代號=04且給付金額性質代號≠2且實際給付日數≠應給付日數時，給付額不同原因=(1或2或3或4或9)', '單筆', '陸-19'],
    ['PAD43B01', '給付金額性質代號=2時，失能項次等級代號=(00000000或失能程度與保險金給付表失能程度代號或失能程度與保險金給付表失能程度代號或失能程度與保險金給付表…', '單筆', '陸-19'],
    ['PAD43B02', '給付類別代號=02且給付項目代號≠(0110及0310)且保單保險期間起日＜20061001且給付日期＞00000000且給付日期＜20061001時，失能…', '單筆', '陸-19'],
    ['PAD43B03', '給付類別代號=02且給付項目代號≠(0110及0310)且保單保險期間起日＜20061001且給付日期≧20061001且給付日期＜20150804時，失能…', '單筆', '陸-19'],
    ['PAD43B04', '給付類別代號=02且給付項目代號≠(0110及0310)且保單保險期間起日＜20061001且給付日期≧20150804時，失能項次等級代號=(失能程度與保…', '單筆', '陸-19'],
    ['PAD43B05', '給付類別代號=02且給付項目代號≠(0110及0310)且保單保險期間起日≧20061001且給付日期≧20061001且給付日期＜20150804時，失能…', '單筆', '陸-19'],
    ['PAD43B06', '給付類別代號=02且給付項目代號≠(0110及0310)且保單保險期間起日≧20061001且給付日期≧20150804時，失能項次等級代號=失能程度與保險…', '單筆', '陸-19'],
    ['PAD43B07', '給付類別代號=02且給付項目代號=(0110或0310)且保單保險期間起日＜20061001且給付日期＞00000000且給付日期＜20061001時，失能…', '單筆', '陸-19'],
    ['PAD43B08', '給付類別代號=02且給付項目代號=(0110或0310)且保單保險期間起日＜20061001且給付日期≧20061001且給付日期＜20150804時，失能…', '單筆', '陸-19'],
    ['PAD43B09', '給付類別代號=02且給付項目代號=(0110或0310)且保單保險期間起日＜20061001且給付日期≧20150804時，失能項次等級代號=(000000…', '單筆', '陸-19'],
    ['PAD43B10', '給付類別代號=02且給付項目代號=(0110或0310)且保單保險期間起日≧20061001且給付日期≧20061001且給付日期＜20150804時，失能…', '單筆', '陸-19'],
    ['PAD43B11', '給付類別代號=02且給付項目代號=(0110或0310)且保單保險期間起日≧20061001且給付日期≧20150804時，失能項次等級代號=(000000…', '單筆', '陸-19'],
    ['PAD44B01', '給付類別代號=04且給付項目代號=4101且給付金額性質代號=2時，骨折給付代號=(00或骨折給付代號表骨折代號)', '單筆', '陸-19'],
    ['PAD44B02', '給付類別代號=04且給付項目代號=4101且給付金額性質代號≠2時，骨折給付代號=骨折給付代號表骨折代號', '單筆', '陸-19'],
    ['PAD45B01', '給付類別代號=05時，二度燒燙傷面積代號=(0000或燒燙傷面積表燒燙傷面積代號)', '單筆', '陸-19'],
    ['PAD46B01', '給付類別代號=05時，三度燒燙傷代號=(0000或三度燒燙傷代號表三度燒燙傷代號)', '單筆', '陸-20'],
    ['PAD47B01', '給付類別代號=05時，顏面燒燙傷代號=(0000或顏面燒燙傷表顏面燒燙傷代號)', '單筆', '陸-20'],
    ['PAD47B02', '給付類別代號=05且給付金額性質代號≠2時，二度燒燙傷面積代號及三度燒燙傷代號及顏面燒燙傷代號不可都為0000', '單筆', '陸-20'],
    ['PAD49B01', '填報年度≧事故日期之年度且填報年度≦檔案年度', '單筆', '陸-20'],
    ['PAD50B01', '保留欄位=0', '單筆', '陸-20'],
    ['PAD51B02', '給付類別代號≠04時，申請金額>0', '單筆', '陸-20'],
    ['PAD52B02', '給付類別代號=04且給付項目代號≠4101時，申請日數>0', '單筆', '陸-20'],
    ['PAL04B02', '異動序號=00001且業務性質代號=(PE或CP)時，契約變更型態代號≠(DEA及ADS及ADB及MAD及SRD及RES及LOP及TMD)', '單筆', '陸-1'],
    ['PAL04B03', '異動序號=00001且業務性質代號=(PE或CP)且人數數量加減號=-時，契約變更型態代號≠(ATS及PAU及ROL)', '單筆', '陸-1'],
    ['PAL04B04', '同保單號碼資料第1筆資料之異動序號=(00000或00001)', '代碼', '陸-1'],
    ['PAL04B05', '同保單號碼資料總筆數=1時，異動序號=(00000或00001)', '單筆', '陸-1'],
    ['PAL04B06', '同保單號碼資料之異動序號不重複', '單筆', '陸-1'],
    ['PAL05B01', '保險商品編號第1位=2 壽險業', '單筆', '陸-1'],
    ['PAL05B02', '保險商品編號第2-3位應符合(「人身保險商品編號性質說明表公司代號或「人身保險商品編碼原則」公司別代碼)；但公司代碼=02，保險商品編號第2-3位可以為(0…', '單筆', '陸-1'],
    ['PAL05B03', '保險商品編號第4位應符合(「人身保險商品編號性質說明表或「人身保險商品編碼原則」險別代碼_大分類代碼)', '單筆', '陸-1'],
    ['PAL05B04', '保險商品編號適用版本代號=1且保險商品編號第4位=1時，保險商品編號第5位應符合「人身保險商品編號性質說明表險別代碼_細分類_人壽保險代碼', '單筆', '陸-1'],
    ['PAL05B05', '保險商品編號適用版本代號=2且保險商品編號第4位=1時，保險商品編號第5位應符合「人身保險商品編碼原則」險別代碼_細分類_人壽保險代碼', '單筆', '陸-1'],
    ['PAL05B06', '保險商品編號第4位=2時，保險商品編號第5位應符合(「人身保險商品編號性質說明表或「人身保險商品編碼原則」險別代碼_細分類_傷害保險代碼)', '單筆', '陸-1'],
    ['PAL05B07', '保險商品編號第4位=3時，保險商品編號第5位應符合(「人身保險商品編號性質說明表或「人身保險商品編碼原則」險別代碼_細分類_健康保險代碼)', '單筆', '陸-1'],
    ['PAL05B08', '保險商品編號第4位=4時，保險商品編號第5位應符合(「人身保險商品編號性質說明表或「人身保險商品編碼原則」險別代碼_細分類_年金保險代碼)', '單筆', '陸-1'],
    ['PAL05B10', '檔案名稱第1位=P時，保險商品編號第4-5位≠22', '單筆', '陸-1'],
    ['PAL05B11', '保險商品編號適用版本代號=1時，保險商品編號第6位應符合「人身保險商品編號性質說明表個人/團體別代碼', '單筆', '陸-1'],
    ['PAL05B12', '保險商品編號適用版本代號=2時，保險商品編號第6位應符合「人身保險商品編碼原則」個人/團體別代碼', '單筆', '陸-1'],
    ['PAL05B13', '保險商品編號第7位應符合(「人身保險商品編號性質說明表或「人身保險商品編碼原則」契約別代碼)', '單筆', '陸-1'],
    ['PAL05B14', '保險商品編號適用版本代號=1時，保險商品編號第8位應符合「人身保險商品編號性質說明表傳統/非傳統代碼', '單筆', '陸-1'],
    ['PAL05B15', '保險商品編號適用版本代號=2時，保險商品編號第8位應符合「人身保險商品編碼原則」傳統/非傳統代碼', '單筆', '陸-1'],
    ['PAL05B16', '保險商品編號第8位=4時，業務性質代號=(PE或CP)', '單筆', '陸-1'],
    ['PAL05B17', '保險商品編號第8位=4且保單保險期間起日＜20140626時，經濟弱勢者身分=經濟弱勢者身分代號表代號', '單筆', '陸-1'],
    ['PAL05B18', '保險商品編號第8位=4且保單保險期間起日≧20140626且保單保險期間起日＜20181225時，經濟弱勢者身分=經濟弱勢者或特定身分者身分代號表代號', '單筆', '陸-2'],
    ['PAL05B19', '保險商品編號第8位=4且保單保險期間起日≧20181225且保單保險期間起日＜20210120時，經濟弱勢者身分=經濟弱勢者或特定身分者身分代號表代號', '單筆', '陸-2'],
    ['PAL05B21', '(保險商品編號第4位=2) 或 (保險商品編號第4位≠2且保險商品編號第9-10位應符合給付型別_混合型含傷害之代號)', '單筆', '陸-2'],
    ['PAL05B22', '保險商品編號適用版本代號=1時，保險商品編號第14.15位部分變更代碼只能為數字', '單筆', '陸-2'],
    ['PAL05B23', '保險商品編號適用版本代號=1時，保險商品編號第16~27位保險商品編號須補滿0', '單筆', '陸-2'],
    ['PAL05B24', '保險商品編號適用版本代號=2時，保險商品編號第14位應符合「人身保險商品編碼原則」審查制度別代碼', '單筆', '陸-2'],
    ['PAL05B25', '保險商品編號適用版本代號=2時，保險商品編號第15位應符合「人身保險商品編碼原則」年期別代碼', '單筆', '陸-2'],
    ['PAL05B26', '保險商品編號適用版本代號=2時，保險商品編號第16位應符合「人身保險商品編碼原則」幣別代碼', '單筆', '陸-2'],
    ['PAL05B27', '保險商品編號適用版本代號=2時，保險商品編號第17位應符合「人身保險商品編碼原則」體況別代碼', '單筆', '陸-2'],
    ['PAL05B28', '保險商品編號適用版本代號=2時，保險商品編號第18位應符合「人身保險商品編碼原則」給付方式別代碼', '單筆', '陸-2'],
    ['PAL05B29', '保險商品編號適用版本代號=2時，保險商品編號第19位應符合「人身保險商品編碼原則」特殊類型商品別代碼', '單筆', '陸-2'],
    ['PAL05B30', '保險商品編號適用版本代號=2時，保險商品編號第20位應符合「人身保險商品編碼原則」投資標的別代碼', '單筆', '陸-2'],
    ['PAL05B31', '保險商品編號適用版本代號=2時，保險商品編號第21-25位應符合「人身保險商品編碼原則」保留碼代碼', '單筆', '陸-2'],
    ['PAL05B32', '保險商品編號適用版本代號=2時，保險商品編號第26-27位部分變更代碼只能為數字', '單筆', '陸-2'],
    ['PAL05B33', '保險商品編號適用版本代號=2且保險商品編號第15位=1時，保險期間別=(A或B或G)', '單筆', '陸-2'],
    ['PAL05B34', '保險商品編號適用版本代號=2且保險商品編號第15位≠1時，保險期間別≠(A及B及G)', '單筆', '陸-2'],
    ['PAL05B35', '保險商品編號適用版本代號=2且保險商品編號第15位=2時，保險期間別=(T或W)', '單筆', '陸-2'],
    ['PAL05B36', '保險商品編號適用版本代號=2且保險商品編號第15位≠2時，保險期間別≠(T及W)', '單筆', '陸-2'],
    ['PAL05B37', '保險商品編號適用版本代號=2且保險商品編號第15位=3時，保險期間別=Y', '單筆', '陸-2'],
    ['PAL05B38', '保險商品編號適用版本代號=2且保險商品編號第15位≠3時，保險期間別≠Y', '單筆', '陸-2'],
    ['PAL05B39', '保險商品編號適用版本代號=2且保險商品編號第16位=A時，原幣別=NTD', '單筆', '陸-2'],
    ['PAL05B40', '保險商品編號適用版本代號=2且保險商品編號第16位=B時，原幣別=USD', '單筆', '陸-2'],
    ['PAL05B41', '保險商品編號適用版本代號=2且保險商品編號第16位=C時，原幣別=GBP', '單筆', '陸-2'],
    ['PAL05B42', '保險商品編號適用版本代號=2且保險商品編號第16位=D時，原幣別=AUD', '單筆', '陸-2'],
    ['PAL05B43', '保險商品編號適用版本代號=2且保險商品編號第16位=E時，原幣別=EUR', '單筆', '陸-2'],
    ['PAL05B44', '保險商品編號適用版本代號=2且保險商品編號第16位=F時，原幣別=HKD', '單筆', '陸-2'],
    ['PAL05B45', '保險商品編號適用版本代號=2且保險商品編號第16位=G時，原幣別=NZD', '單筆', '陸-2'],
    ['PAL05B46', '保險商品編號適用版本代號=2且保險商品編號第16位=H時，原幣別=CAD', '單筆', '陸-2'],
    ['PAL05B47', '保險商品編號適用版本代號=2且保險商品編號第16位=I時，原幣別=SGD', '單筆', '陸-2'],
    ['PAL05B48', '保險商品編號適用版本代號=2且保險商品編號第16位=J時，原幣別=CNY', '單筆', '陸-2'],
    ['PAL05B49', '保險商品編號適用版本代號=2且保險商品編號第16位=K時，原幣別=JPY', '單筆', '陸-2'],
    ['PAL05B50', '保險商品編號適用版本代號=2且保險商品編號第19位=A時，業務性質代號=(PE或CP)', '單筆', '陸-2'],
    ['PAL05B51', '保險商品編號適用版本代號=2且保險商品編號第19位=A且保單保險期間起日＜20140626時，經濟弱勢者身分=經濟弱勢者身分代號表代號', '單筆', '陸-2'],
    ['PAL05B52', '保險商品編號適用版本代號=2且保險商品編號第19位=A且保單保險期間起日≧20140626且保單保險期間起日＜20181225時，經濟弱勢者身分=經濟弱勢者…', '單筆', '陸-2'],
    ['PAL05B53', '保險商品編號適用版本代號=2且保險商品編號第19位=A且保單保險期間起日≧20181225且保單保險期間起日<20210119時，經濟弱勢者身分=經濟弱勢者…', '單筆', '陸-3'],
    ['PAL05B55', '保險商品編號第8位=4且保單保險期間起日≧20210119且保單保險期間起日<20250814時，經濟弱勢者身分=經濟弱勢者或特定身分者身分代號表代號', '單筆', '陸-3'],
    ['PAL05B56', '保險商品編號適用版本代號=2且保險商品編號第19位=A且保單保險期間起日≧20210119且保單保險期間起日<20250814時，經濟弱勢者身分=經濟弱勢者…', '單筆', '陸-3'],
    ['PAL05B57', '保險商品編號第8位=4且保單保險期間起日≧20250814時，經濟弱勢者身分=經濟弱勢者或特定身分者身分代號表代號', '單筆', '陸-3'],
    ['PAL05B58', '保險商品編號適用版本代號=2且保險商品編號第19位=A且保單保險期間起日≧20250814時，經濟弱勢者身分=經濟弱勢者或特定身分者身分代號表代號', '單筆', '陸-3'],
    ['PAL06L01', '保險商品編號適用版本代號=1時，保險商品編號適用版本代號=上1筆保險商品編號適用版本代號', '多筆', '陸-3'],
    ['PAL06L02', '保險商品編號適用版本代號=1且上一筆保險商品編號適用版本代號=1且契約變更型態代號≠CTC時，保險商品編號第1-13位=上1筆保險商品編號第1-13位', '多筆', '陸-3'],
    ['PAL06L03', '保險商品編號適用版本代號=2且上一筆保險商品編號適用版本代號=2且契約變更型態代號≠CTC時，保險商品編號第1-25位=上1筆保險商品編號第1-25位', '多筆', '陸-3'],
    ['PAL07B02', '契約別=1時，保險商品編號第7位=M', '單筆', '陸-3'],
    ['PAL07B03', '契約別≠1時，保險商品編號第7位≠M', '單筆', '陸-3'],
    ['PAL07L01', '契約別相同', '多筆', '陸-3'],
    ['PAL08B02', '業務性質代號=CP時，(保險商品編號第8位=4)或(保險商品編號第19位=A)', '單筆', '陸-3'],
    ['PAL08B03', '業務性質代號=CP且保單保險期間起日＜20140626時，經濟弱勢者身分=經濟弱勢者身分代號表代號', '單筆', '陸-3'],
    ['PAL08B04', '業務性質代號=CP且保單保險期間起日≧20140626且保單保險期間起日＜20181225時，經濟弱勢者身分=經濟弱勢者或特定身分者身分代號表代號', '單筆', '陸-3'],
    ['PAL08B05', '業務性質代號=CP且保單保險期間起日≧20181225且保單保險期間起日<20210119時，經濟弱勢者身分=經濟弱勢者或特定身分者身分代號表代號', '單筆', '陸-3'],
    ['PAL08B06', '業務性質代號=CP時，集體投保之連結關係=集體投保之連結關係代號表代號', '單筆', '陸-3'],
    ['PAL08B07', '業務性質代號≠CP時，集體投保之連結關係=0', '單筆', '陸-3'],
    ['PAL08B08', '個人傷害保險且業務性質代號=(PE或CP)且契約變更型態代號=(NEW或NCT或RNN或LNN或DEA或ADS或TDI或ADB或MAD或SRD或RES或LO…', '單筆', '陸-3'],
    ['PAL08B09', '業務性質代號=(PE或CP)且契約變更型態代號=(ATS或PAU或ROL)且人數加減號=-時，人數=00000001', '單筆', '陸-3'],
    ['PAL08B10', '業務性質代號=TH且契約變更型態代號=(NEW或NCT或RNN或LNN或DEA或ADS或TDI或ADB或MAD或SRD或RES或LOP或TMD)時，人數≧0…', '單筆', '陸-3'],
    ['PAL08B11', '業務性質代號=TH且契約變更型態代號=(ATS或PAU或ROL)且人數加減號=-時，人數≧00000001', '單筆', '陸-3'],
    ['PAL08B13', '業務性質代號=CP且保單保險期間起日≧20210119且保單保險期間起日<20250814時，經濟弱勢者身分=經濟弱勢者或特定身分者身分代號表代號', '單筆', '陸-3'],
    ['PAL08B14', '業務性質代號=CP且保單保險期間起日≧20250814時，經濟弱勢者身分=經濟弱勢者或特定身分者身分代號表代號', '單筆', '陸-3'],
    ['PAL08L01', '業務性質代號相同', '多筆', '陸-3'],
    ['PAL09B02', '集體投保之連結關係=集體投保之連結關係代號表之代號時，(保險商品編號[insprono]第8位=4)或(保險商品編號[insprono]第19位=A)', '單筆', '陸-4'],
    ['PAL09B03', '集體投保之連結關係=集體投保之連結關係代號表之代號時，業務性質代號=CP', '單筆', '陸-4'],
    ['PAL09B04', '集體投保之連結關係=集體投保之連結關係代號表之代號且保單保險期間起日＜20140626時，經濟弱勢者身分=經濟弱勢者身分代號表之代號', '單筆', '陸-4'],
    ['PAL09B05', '集體投保之連結關係=集體投保之連結關係代號表之代號且保單保險期間起日≧20140626且保單保險期間起日＜20181225時，經濟弱勢者身分=經濟弱勢者或特…', '單筆', '陸-4'],
    ['PAL09B06', '集體投保之連結關係=集體投保之連結關係代號表之代號且保單保險期間起日≧20181225且保單保險期間起日<20210119時，經濟弱勢者身分=經濟弱勢者或特…', '單筆', '陸-4'],
    ['PAL09B07', '集體投保之連結關係=集體投保之連結關係代號表之代號且保單保險期間起日≧20210119且保單保險期間起日<20250814時，經濟弱勢者身分=經濟弱勢者或特…', '單筆', '陸-4'],
    ['PAL09B08', '集體投保之連結關係=集體投保之連結關係代號表之代號且保單保險期間起日≧20250814時，經濟弱勢者身分=經濟弱勢者或特定身分者身分代號表之代號', '單筆', '陸-4'],
    ['PAL09L01', '集體投保之連結關係相同', '多筆', '陸-4'],
    ['PAL10L01', '通路別相同', '多筆', '陸-4'],
    ['PAL11L01', '招攬方式相同', '多筆', '陸-4'],
    ['PAL12B02', '保險期間別=A時，(保單保險期間迄日-保單保險期間起日)＜1年', '單筆', '陸-4'],
    ['PAL12B03', '保險期間別=B且契約別=1時，保單保險期間迄日=((保單保險期間起日+1年)-1天))', '單筆', '陸-4'],
    ['PAL12B04', '保險期間別=(G或T或W)且契約別=1時，(保單保險期間迄日-保單保險期間起日)≧1年(月日無差距)', '單筆', '陸-4'],
    ['PAL12B05', '保險期間別=G且契約別≠1時，(保單保險期間迄日-保單保險期間起日)≧1年(月日可以有差距)', '單筆', '陸-4'],
    ['PAL12B06', '保險期間別=T時，(保單保險期間迄日-保單保險期間起日)≧1年(月日可以有差距)且(保單保險期間迄日-保單保險期間起日)≦34年(月日可以有差距)', '單筆', '陸-4'],
    ['PAL12B07', '保險期間別=W時，保單保險期間迄日所屬之到達年齡=(15歲或20歲至27歲或35歲至110歲)', '單筆', '陸-4'],
    ['PAL12B08', '保險期間別=Y時，保單保險期間迄日所屬之到達年齡=81歲至150歲)', '單筆', '陸-4'],
    ['PAL12B09', '(業務性質代號=CP或保險商品編號第8位=4或保險商品編號第19位=A)時，保險期間別=B', '單筆', '陸-4'],
    ['PAL12L01', '契約變更型態代號≠CTC時，保險期間別=上1筆保險期間別', '多筆', '陸-4'],
    ['PAL13B02', '契約變更型態代號=ADS時，意外死亡保險金額＞0', '單筆', '陸-4'],
    ['PAL13B03', '契約變更型態代號=(ATS或ADB)時，意外失能保險金額＞0', '單筆', '陸-4'],
    ['PAL13B04', '契約變更型態代號=MAD時，契約變更日期=保單保險期間迄日', '單筆', '陸-4'],
    ['PAL13B05', '契約變更型態代號=(NEW或NCT或XEN)時，異動序號=(00000或00001)', '單筆', '陸-4'],
    ['PAL13B07', '契約變更型態代號=NEW時，契約變更日期=保單保險期間起日', '單筆', '陸-4'],
    ['PAL13B08', '契約變更型態代號=(NEW或NCT或GNN)且保險商品編號第9-10位=1A時，各保費收入欄位≠0', '單筆', '陸-4'],
    ['PAL13B09', '契約變更型態代號=TMD時，契約變更日期＜保單保險期間迄日', '單筆', '陸-4'],
    ['PAL13B10', '契約變更型態代號=MNN時，(醫療限額＞0且醫療日額=0)或(醫療限額=0且醫療日額＞0)', '單筆', '陸-4'],
    ['PAL13B11', '契約變更型態代號=HCC時，身心障礙類別≠000且身心障礙等級≠0', '單筆', '陸-4'],
    ['PAL13B12', '保險商品編號第4位≠2且契約變更型態代號=(PAU或ROL)時，保險商品編號第9-10位=(2A或2G或2H或2K或1B或3B或4B或5B或6B或9B或1G…', '單筆', '陸-4'],
    ['PAL13B13', '契約變更型態代號=XEN時，保單保險期間起日＜20210101', '單筆', '陸-4'],
    ['PAL13B14', '契約變更型態代號=XEN時，契約變更日期=(20200101或20210101)', '單筆', '陸-4'],
    ['PAL13B15', '契約變更型態代號=(EOP或LNN或PAU或MAD或SRD或LOP)時，意外死亡失能保險金額保費收入=0且醫療限額保費收入=0且醫療日額保費收入=0且醫療限…', '單筆', '陸-5'],
    ['PAL13L01', '同保單號碼資料第1筆資料契約變更型態代號=LNN時，契約變更日期＜20210101', '多筆', '陸-5'],
    ['PAL13L02', '保單保險期間起日＜20210101時，同保單號碼資料第1筆資料契約變更型態代號=(NEW或NCT或XEN或LNN)', '多筆', '陸-5'],
    ['PAL13L03', '保單保險期間起日≧20210101時，同保單號碼資料第1筆資料契約變更型態代號=(NEW或NCT)', '多筆', '陸-5'],
    ['PAL13L04', '契約變更日期≧20200101且上1筆契約變更日期≧20200101且契約變更型態代號=(DNN或PAU)時，(意外死亡保額＜上1筆意外死亡保額)或(意外失…', '多筆', '陸-5'],
    ['PAL13L05', '契約變更日期≧20200101且上1筆契約變更日期≧20200101且契約變更型態代號=INN時，(意外死亡保額＞上1筆意外死亡保額)或(意外失能保額＞上1…', '多筆', '陸-5'],
    ['PAL13L06', '契約變更日期≧20200101且上1筆契約變更日期≧20200101且契約變更型態代號=MNN時，(醫療限額=0且上1筆醫療限額＞0)或(醫療限額＞0且上1…', '多筆', '陸-5'],
    ['PAL13L07', '契約變更日期≧20200101且上1筆契約變更日期≧20200101且契約變更型態代號=ONN時，職業類別代號≠上1筆職業類別代號', '多筆', '陸-5'],
    ['PAL13L08', '契約變更日期≧20200101且上1筆契約變更日期≧20200101且契約變更型態代號≠ONN時，職業類別代號=上1筆職業類別代號', '多筆', '陸-5'],
    ['PAL13L09', '契約變更日期≧20200101且上1筆契約變更日期≧20200101且契約變更型態代號≠RNN時，上1筆契約變更型態代號≠LNN', '多筆', '陸-5'],
    ['PAL13L10', '契約變更日期≧20200101且上1筆契約變更日期≧20200101且契約變更型態代號=RNN時，上1筆契約變更型態代號=LNN', '多筆', '陸-5'],
    ['PAL13L11', '契約變更日期≧20200101且上1筆契約變更日期≧20200101且業務性質代號=(PE或CP)且契約變更型態代號≠(NEW或INN或DNN或MNN或NC…', '多筆', '陸-5'],
    ['PAL13L12', '契約變更日期≧20200101且上1筆契約變更日期≧20200101且業務性質代號≠(PE或CP)且契約變更型態代號≠(NEW或INN或DNN或MNN或NC…', '多筆', '陸-5'],
    ['PAL13L13', '契約變更型態代號=(NEW或NCT或XEN或PAU或ROL)時，同一保單號碼(保單編號及保單編號序號)資料只會出現1次', '多筆', '陸-5'],
    ['PAL13L14', '業務性質代號=(PE或CP)且上1筆契約變更型態代號=(DEA或ADS或TDI或ATS或ADB或PAU或ROL或MAD或SRD或RES或LOP或TMD)且人…', '多筆', '陸-5'],
    ['PAL13L15', '業務性質代號≠(PE及CP)且上1筆契約變更型態代號=(PAU或ROL或MAD或SRD或RES或LOP)且人數加減號=-時，之後不會有同一保單號碼(保單編號…', '多筆', '陸-5'],
    ['PAL13L16', '契約變更型態代號=(DEA或ADS或TDI或ATS或ADB或ROL或TMD)且人數數量合計數=0時，意外死亡失能保險金額保費收入=0且醫療限額保費收入=0且…', '多筆', '陸-5'],
    ['PAL14B01', '西元日期', '資料類型', '陸-5'],
    ['PAL14B02', '契約變更日期≧保單保險期間起日', '單筆', '陸-5'],
    ['PAL14B03', '契約變更日期≦保單保險期間迄日', '單筆', '陸-5'],
    ['PAL14B04', '契約變更日期=保單保險期間迄日時，契約變更型態代號≠(SRD及LOP及TMD)', '單筆', '陸-5'],
    ['PAL14B05', '契約變更日期之年度≦填報年度', '單筆', '陸-5'],
    ['PAL14L01', '契約變更型態代號≠RNN時，契約變更日期≧上1筆契約變更日期', '多筆', '陸-5'],
    ['PAL14L02', '契約變更型態代號= RNN且上1筆契約變更型態代號= LNN時，契約變更日期＞上1筆契約變更日期', '多筆', '陸-5'],
    ['PAL14L03', '契約變更型態代號= LNN且上1筆契約變更型態代號= RNN時，契約變更日期＞上1筆契約變更日期', '多筆', '陸-6'],
    ['PAL14L04', '契約變更日期=上1筆契約變更日期時，契約變更型態代號≠上一筆契約變更型態代號', '多筆', '陸-6'],
    ['PAL14L05', '契約變更日期=上1筆契約變更日期時，異動序號＞上一筆異動序號', '多筆', '陸-6'],
    ['PAL14L06', '契約變更日期相同時，契約變更型態不同', '多筆', '陸-6'],
    ['PAL15B01', '西元日期', '資料類型', '陸-6'],
    ['PAL15B02', '保單保險期間起日之年度≦填報年度', '單筆', '陸-6'],
    ['PAL15L01', '保單保險期間起日相同', '多筆', '陸-6'],
    ['PAL16B01', '西元日期', '資料類型', '陸-6'],
    ['PAL16B02', '保單保險期間迄日≧保單保險期間起日', '單筆', '陸-6'],
    ['PAL16L01', '保單保險期間迄日之年度≦檔案年度時，人數數量合計數=0', '多筆', '陸-6'],
    ['PAL16L02', '保單保險期間迄日之年度≦檔案年度且人數數量合計數=0時，契約變更型態代號=(LNN或DEA或ADS或TDI或ATS或ADB或PAU或ROL或MAD或SRD或…', '多筆', '陸-6'],
    ['PAL16L03', '契約變更型態代號≠(ROL及CTC)時，保單保險期間迄日=上1筆保單保險期間迄日', '多筆', '陸-6'],
    ['PAL16L04', '契約變更型態代號=ROL時，保單保險期間迄日≦上1筆保單保險期間迄日', '多筆', '陸-6'],
    ['PAL16L05', '保單保險期間迄日之年度≦檔案年度時，最後1筆人數數量合計數=0', '多筆', '陸-6'],
    ['PAL17L01', '實際投保日數相同', '多筆', '陸-6'],
    ['PAL18B02', '契約變更型態代號≠(DEA及ADS及TDI及MAD及SRD及RES及LOP及TMD及LNN及ADB及ATS及PAU及ROL)時，人數加減號=+', '單筆', '陸-6'],
    ['PAL18B03', '契約變更型態代號=(DEA或ADS或TDI或MAD或SRD或RES或LOP或TMD或LNN或ADB)時，人數加減號=-', '單筆', '陸-6'],
    ['PAL19B02', '人數數量=00000000時，人數加減號=+', '單筆', '陸-6'],
    ['PAL19B03', '人數數量＞00000000時，契約變更型態代號≠(CTC及DNN及INN及MNN及ONN及HCC及OCA)', '單筆', '陸-6'],
    ['PAL19B04', '契約變更型態代號=(ATS或PAU或ROL)且人數加減號=+時，人數數量=00000000', '單筆', '陸-6'],
    ['PAL19B05', '契約變更型態代號=(ATS或PAU或ROL)且人數加減號=-時，人數數量＞00000000', '單筆', '陸-6'],
    ['PAL19L01', '同一保單號碼(保單編號及保單編號序號)保單人數數量經過異動後，人數數量合計數≧0', '多筆', '陸-6'],
    ['PAL19L02', '該筆資料不是最後1筆且契約變更型態代號≠LNN時，人數數量合計數＞0', '多筆', '陸-6'],
    ['PAL19L03', '業務性質代號=(PE或CP)且契約變更型態代號=(SRD或LOP或TMD或LNN或DEA或ADS或TDI或MAD或RES)時，人數數量合計數=0', '多筆', '陸-6'],
    ['PAL19L04', '業務性質代號≠(PE及CP)且契約變更型態代號=(SRD或LOP或LNN或MAD或RES)時，人數數量合計數=0', '多筆', '陸-6'],
    ['PAL19L05', '契約變更型態代號=(PAU或ROL)且人數加減號=-時，人數數量合計數=0', '多筆', '陸-6'],
    ['PAL20B02', '業務性質代號=(PE或CP)時，證件種類代號=(1或2或3或9)', '單筆', '陸-6'],
    ['PAL20B03', '證件種類代號=0時，業務性質代號≠(PE及CP)', '單筆', '陸-6'],
    ['PAL20L02', '證件種類代號≠1時，證件種類代號=上1筆證件種類代號', '多筆', '陸-6'],
    ['PAL21B01', '證件編號目前暫時填0000000000', '單筆', '陸-6'],
    ['PAL21L01', '證件編號相同', '多筆', '陸-6'],
    ['PAL22B02', '個人傷害保險且業務性質代號=(PE或CP)時，性別=(1或2)', '單筆', '陸-6'],
    ['PAL22L01', '契約變更型態代號≠CTC時，性別=上1筆性別', '多筆', '陸-6'],
    ['PAL23B01', '00000000或西元日期', '資料類型', '陸-7'],
    ['PAL23B02', '出生日期之年度≦填報年度', '單筆', '陸-7'],
    ['PAL23B03', '個人傷害保險且業務性質代號=(PE或CP)時，出生日期≠00000000', '單筆', '陸-7'],
    ['PAL23B04', '業務性質代號=(PE或CP)且出生日期≠00000000時，出生日期≦保單保險期間起日', '單筆', '陸-7'],
    ['PAL23L01', '契約變更型態代號≠CTC時，出生日期=上1筆出生日期', '多筆', '陸-7'],
    ['PAL24B02', '保險商品編號第4位=2且保險商品編號第5位≠2時，職業類別代號=(1或2或3或4或5或6或9或0)', '單筆', '陸-7'],
    ['PAL24B04', '保險商品編號第4位=2且保險商品編號第5位≠2且契約別=(1或2)且業務性質代號=(PE或CP)時，職業類別代號=(1或2或3或4或5或6或9)', '單筆', '陸-7'],
    ['PAL24B05', '保險商品編號第4位≠2且契約別=(1或2)且業務性質代號=(PE或CP)時，職業類別代號=(1或2或3或4或5或6或9或8)', '單筆', '陸-7'],
    ['PAL24B06', '契約別=3時，職業類別代號=0', '單筆', '陸-7'],
    ['PAL25B03', '保險商品編號第4位=2且保單保險期間起日≧20150301且保單保險期間起日＜20230601且契約變更日期＜20230601且職業類別代號≠0時，職業分類…', '單筆', '陸-7'],
    ['PAL25B04', '保險商品編號第4位≠2且保單保險期間起日≧20150301且保單保險期間起日＜20230601且契約變更日期＜20230601且職業類別代號≠0時，職業分類…', '單筆', '陸-7'],
    ['PAL25B05', '保單保險期間起日≧20150301且保單保險期間起日＜20230601且契約變更日期＜20230601時，職業類別代碼應與職業分類代號互相配合(參照台灣地區…', '單筆', '陸-7'],
    ['PAL25B06', '保險商品編號第4位=2且保單保險期間起日≧20230601且職業類別代號≠0時，職業分類代碼=台灣地區傷害保險個人職業分類表之代碼(不含拒保)', '單筆', '陸-7'],
    ['PAL25B07', '保險商品編號第4位≠2且保單保險期間起日≧20230601且職業類別代號≠0時，職業分類代碼=台灣地區傷害保險個人職業分類表之代碼(含拒保)', '單筆', '陸-7'],
    ['PAL25B08', '保單保險期間起日≧20230601時，職業類別代碼應與職業分類代號互相配合(參照台灣地區傷害保險個人職業分類表)', '單筆', '陸-7'],
    ['PAL25B09', '保險商品編號第4位=2且保單保險期間起日＜20150301且契約變更日期≧20230601時，職業分類代碼=(00000000或台灣地區傷害保險個人職業分類…', '單筆', '陸-7'],
    ['PAL25B11', '保險商品編號第4位=2且保單保險期間起日≧20150301且保單保險期間起日＜20230601且契約變更日期≧20230601且職業類別代號≠0時，職業分類…', '單筆', '陸-7'],
    ['PAL25B12', '保險商品編號第4位≠2且保單保險期間起日≧20150301且保單保險期間起日＜20230601且契約變更日期≧20230601且職業類別代號≠0時，職業分類…', '單筆', '陸-7'],
    ['PAL25B13', '保單保險期間起日≧20150301且保單保險期間起日＜20230601且契約變更日期≧20230601時，職業類別代碼應與職業分類代號互相配合(參照台灣地區…', '單筆', '陸-7'],
    ['PAL25L01', '保單保險期間起日≧20150301且契約變更型態代號=OCA時，職業分類代碼≠上一筆職業分類代碼', '多筆', '陸-8'],
    ['PAL25L02', '保單保險期間起日≧20150301且契約變更型態代號≠(OCA及ONN)時，職業分類代碼=上1筆職業分類代碼', '多筆', '陸-8'],
    ['PAL27B01', '保單保險期間起日＜20140626時，經濟弱勢者身分=(0或經濟弱勢者身分代號表之代號)', '單筆', '陸-8'],
    ['PAL27B02', '保單保險期間起日≧20140626且保單保險期間起日＜20181225時，經濟弱勢者身分=(0或經濟弱勢者或特定身分者身分代號表之代號)', '單筆', '陸-8'],
    ['PAL27B03', '保單保險期間起日≧20181225且保單保險期間起日<20210119時，經濟弱勢者身分=(0或經濟弱勢者或特定身分者身分代號表之代號)', '單筆', '陸-8'],
    ['PAL27B04', '保單保險期間起日≧20210120且保單保險期間起日<20250814時，經濟弱勢者身分=(0或經濟弱勢者或特定身分者身分代號表之代號)', '單筆', '陸-8'],
    ['PAL27B05', '保單保險期間起日≧20250814時，經濟弱勢者身分=(0或經濟弱勢者或特定身分者身分代號表之代號)', '單筆', '陸-8'],
    ['PAL27L01', '經濟弱勢者身分相同', '多筆', '陸-8'],
    ['PAL28B01', '出生日期≠00000000且出生日期＜20120711且保單保險期間起日＜20120711且契約變更日期＜20120711時，身心障礙類別=(000或身心障…', '單筆', '陸-8'],
    ['PAL28B04', '出生日期≧20120711時，身心障礙類別=(000或身心障礙類別擴充代號表之代號)', '單筆', '陸-8'],
    ['PAL28L01', '契約變更型態代號≠HCC時，身心障礙類別=上1筆身心障礙類別', '多筆', '陸-8'],
    ['PAL29B02', '身心障礙等級≠0時，身心障礙類別≠000', '單筆', '陸-8'],
    ['PAL29B03', '身心障礙等級=0時，身心障礙類別=000', '單筆', '陸-8'],
    ['PAL29L01', '契約變更型態代號≠HCC時，身心障礙等級=上1筆身心障礙等級', '多筆', '陸-8'],
    ['PAL29L02', '契約變更型態代號=HCC時，(身心障礙類別≠上一筆身心障礙類別)或(身心障礙等級≠上一筆身心障礙等級)', '多筆', '陸-8'],
    ['PAL30B03', '保險商品編號第14位≠3且保單保險期間起日＜20200101時，要保人住所郵遞區號=(999或正確住所郵遞區號)', '單筆', '陸-8'],
    ['PAL30B04', '保險商品編號第14位=3且保單保險期間起日≧20200101時，要保人住所郵遞區號=(888或正確住所郵遞區號)', '單筆', '陸-8'],
    ['PAL30B05', '保險商品編號第14位≠3且保單保險期間起日≧20200101時，要保人住所郵遞區號=正確住所郵遞區號', '單筆', '陸-8'],
    ['PAL31B03', '保險商品編號第14位≠3且保單保險期間起日＜20200101時，被保險人住所郵遞區號=(999或正確住所郵遞區號)', '單筆', '陸-8'],
    ['PAL31B04', '保險商品編號第14位=3且保單保險期間起日≧20200101時，被保險人住所郵遞區號=(888或正確住所郵遞區號)', '單筆', '陸-8'],
    ['PAL31B05', '保險商品編號第14位≠3且保單保險期間起日≧20200101時，被保險人住所郵遞區號=正確住所郵遞區號', '單筆', '陸-8'],
    ['PAL32L01', '原幣別相同', '多筆', '陸-8'],
    ['PAL33B02', '(保險商品編號第8位=4)或(保險商品編號第19位=A)且意外死亡保險金額＞0時，意外死亡保險金額≧100000且意外死亡保險金額≦500000', '單筆', '陸-8'],
    ['PAL34B01', '意外死亡保險金額＞0時，意外死亡保險範圍代號=保險範圍代號表之代號', '單筆', '陸-9'],
    ['PAL34B02', '意外死亡保險金額=0時，意外死亡保險範圍代號=00', '單筆', '陸-9'],
    ['PAL34L01', '契約變更型態代號≠CTC且意外死亡保險金額＞0且上1筆意外死亡保險金額＞0時，意外死亡保險範圍代號=上1筆意外死亡保險範圍代號', '多筆', '陸-9'],
    ['PAL35B01', '意外死亡特定意外事故保險範圍代號第1位=(0或1)', '代碼', '陸-9'],
    ['PAL35B02', '意外死亡特定意外事故保險範圍代號第2位=(0或1)', '代碼', '陸-9'],
    ['PAL35B03', '意外死亡特定意外事故保險範圍代號第3位=(0或1)', '代碼', '陸-9'],
    ['PAL35B04', '意外死亡特定意外事故保險範圍代號第4位=(0或1)', '代碼', '陸-9'],
    ['PAL35B05', '意外死亡特定意外事故保險範圍代號第5-10位=000000', '單筆', '陸-9'],
    ['PAL35B06', '意外死亡保險範圍代號=01時，意外死亡特定意外事故保險範圍代號第1-4位=0000', '單筆', '陸-9'],
    ['PAL35B07', '意外死亡保險範圍代號=(02或03)時，意外死亡特定意外事故保險範圍代號第1-4位≠0000', '單筆', '陸-9'],
    ['PAL35L01', '契約變更型態代號≠CTC且意外死亡保險金額＞0且上1筆意外死亡保險金額＞0時，意外死亡特定意外事故保險範圍代號=上1筆意外死亡特定意外事故保險範圍代號', '多筆', '陸-9'],
    ['PAL36B02', '(保險商品編號第8位=4)或(保險商品編號第19位=A)且意外失能保險金額＞0時，意外失能保險金額≧100000且意外失能保險金額≦500000', '單筆', '陸-9'],
    ['PAL36B03', '(保險商品編號第8位=4)或(保險商品編號第19位=A)時，意外失能保險金額=意外死亡保險金額', '單筆', '陸-9'],
    ['PAL37B01', '意外失能保險金額＞0時，意外失能保險範圍代號=保險範圍代號表之代號', '單筆', '陸-9'],
    ['PAL37B02', '意外失能保險金額=0時，意外失能保險範圍代號=00', '單筆', '陸-9'],
    ['PAL37L01', '契約變更型態代號≠CTC且意外失能保險金額＞0且上1筆意外失能保險金額＞0時，意外失能保險範圍代號=上1筆意外失能保險範圍代號', '多筆', '陸-9'],
    ['PAL38B01', '意外失能特定意外事故保險範圍代號第1位=(0或1)', '代碼', '陸-9'],
    ['PAL38B02', '意外失能特定意外事故保險範圍代號第2位=(0或1)', '代碼', '陸-9'],
    ['PAL38B03', '意外失能特定意外事故保險範圍代號第3位=(0或1)', '代碼', '陸-9'],
    ['PAL38B04', '意外失能特定意外事故保險範圍代號第4位=(0或1)', '代碼', '陸-10'],
    ['PAL38B05', '意外失能特定意外事故保險範圍代號第5-10位=000000', '單筆', '陸-10'],
    ['PAL38B06', '意外失能保險範圍代號=01時，意外失能特定意外事故保險範圍代號第1-4位=0000', '單筆', '陸-10'],
    ['PAL38B07', '意外失能保險範圍代號=(02或03)時，意外失能特定意外事故保險範圍代號第1-4位≠0000', '單筆', '陸-10'],
    ['PAL38L01', '契約變更型態代號≠CTC且意外失能保險金額＞0且上1筆意外失能保險金額＞0時，意外失能特定意外事故保險範圍代號=上1筆意外失能特定意外事故保險範圍代號', '多筆', '陸-10'],
    ['PAL39B02', '(保險商品編號第8位=4)或(保險商品編號第19位=A)且醫療限額＞0時，醫療限額=30000', '單筆', '陸-10'],
    ['PAL39B03', '(保險商品編號第8位=4)或(保險商品編號第19位=A)且醫療限額＞0時，意外死亡保險金額=0且意外失能保險金額=0', '單筆', '陸-10'],
    ['PAL39B04', '(保險商品編號第8位=4)或(保險商品編號第19位=A)且醫療限額=0時，意外死亡保險金額＞0且意外失能保險金額＞0', '單筆', '陸-10'],
    ['PAL40B02', '(保險商品編號第8位=4)或(保險商品編號第19位=A)時，醫療日額=0', '單筆', '陸-10'],
    ['PAL41B01', '業務性質代號=(PE或CP)且醫療日額＞0時，最高日數限制≧030及最高日數限制≦365', '單筆', '陸-10'],
    ['PAL41B02', '業務性質代號≠(PE及CP)且醫療日額＞0時，最高日數限制＞000及最高日數限制≦730', '單筆', '陸-10'],
    ['PAL41B03', '醫療日額=0時，最高日數限制=000', '單筆', '陸-10'],
    ['PAL41B04', '醫療日額＞0時，最高日數限制＞000', '單筆', '陸-10'],
    ['PAL41L01', '契約變更型態代號≠CTC且醫療日額＞0且上1筆醫療日額＞0時，最高日數限制=上1筆最高日數限制', '多筆', '陸-10'],
    ['PAL42B02', '(保險商品編號第8位=4)或(保險商品編號第19位=A)時，重大燒燙傷保險金額=0', '單筆', '陸-10'],
    ['PAL43B02', '各保險金額欄位不能同時為0', '單筆', '陸-10'],
    ['PAL43B03', '(保險商品編號第8位=4)或(保險商品編號第19位=A)時，骨折保險金額=0', '單筆', '陸-10'],
    ['PAL44B01', '(旅行平安保險或保險商品編號第9-10位=1A)且(意外死亡保險金額＞0或意外失能保險金額＞0)時，意外死亡失能保險金額保費收入＞0且意外死亡失能保險金額保…', '單筆', '陸-11'],
    ['PAL44B02', '意外死亡失能保險金額保費收入＞0時，(意外死亡保險金額＞0或意外失能保險金額＞0)', '單筆', '陸-11'],
    ['PAL45B02', '意外死亡失能保險金額純保費收入＞0時，意外死亡失能保險金額保費收入＞0', '單筆', '陸-11'],
    ['PAL45B03', '意外死亡失能保險金額純保費收入≦意外死亡失能保險金額保費收入', '單筆', '陸-11'],
    ['PAL46B01', '(旅行平安保險或保險商品編號第9-10位=1A)且醫療限額＞0且醫療限額保費收入＞0時，醫療限額保費收入≦25000000(暫時上限)', '單筆', '陸-11'],
    ['PAL46B02', '醫療限額保費收入＞0時，醫療限額＞0', '單筆', '陸-11'],
    ['PAL46B05', '醫療限額保費收入＞0時，醫療限額與醫療日額擇一給付者保費收入=0', '單筆', '陸-11'],
    ['PAL47B02', '醫療限額純保費收入＞0時，醫療限額保費收入＞0', '單筆', '陸-11'],
    ['PAL47B03', '醫療限額純保費收入≦醫療限額保費收入', '單筆', '陸-11'],
    ['PAL48B01', '(旅行平安保險或保險商品編號第9-10位=1A)且醫療日額＞0且醫療日額保費收入＞0時，醫療日額保費收入≦6000000(暫時上限)', '單筆', '陸-11'],
    ['PAL48B02', '醫療日額保費收入＞0時，醫療日額＞0', '單筆', '陸-11'],
    ['PAL48B03', '醫療日額保費收入＞0時，醫療限額與醫療日額擇一給付者保費收入=0', '單筆', '陸-11'],
    ['PAL49B02', '醫療日額純保費收入＞0時，醫療日額保費收入＞0', '單筆', '陸-11'],
    ['PAL49B03', '醫療日額純保費收入≦醫療日額保費收入', '單筆', '陸-11'],
    ['PAL50B01', '(旅行平安保險或保險商品編號第9-10位=1A)且醫療限額＞0且醫療日額＞0時，醫療限額與醫療日額擇一給付者保費收入＞0且醫療限額與醫療日額擇一給付者保費收…', '單筆', '陸-11'],
    ['PAL50B02', '醫療限額與醫療日額擇一給付者保費收入＞0時，醫療限額＞0且醫療日額＞0', '單筆', '陸-11'],
    ['PAL50B03', '醫療限額與醫療日額擇一給付者保費收入＞0時，醫療限額保費收入=0且醫療日額保費收入=0', '單筆', '陸-11'],
    ['PAL51B02', '醫療限額與醫療日額擇一給付者純保費收入＞0時，醫療限額與醫療日額擇一給付者保費收入＞0', '單筆', '陸-12'],
    ['PAL51B03', '醫療限額與醫療日額擇一給付者純保費收入≦醫療限額與醫療日額擇一給付者保費收入', '單筆', '陸-12'],
    ['PAL52B01', '(旅行平安保險或保險商品編號第9-10位=1A)且(重大燒燙傷保險金額＞0或骨折保險金額＞0)時，其他保費收入＞0且其他保費收入≦7000000(暫時上限)', '單筆', '陸-12'],
    ['PAL53B02', '其他純保費收入＞0時，其他保費收入＞0', '單筆', '陸-12'],
    ['PAL53B03', '其他純保費收入≦其他保費收入', '單筆', '陸-12'],
    ['PAL55L01', '契約變更型態代號≠CTC且保險商品編號(不含部分變更代碼)相同時，公司保單險種代號相同', '多筆', '陸-12'],
    ['PAL56B01', '保留欄位=0000000000000000', '單筆', '陸-14'],
    ['PAL57B02', '個人傷害保險時，目的地=N', '單筆', '陸-12'],
    ['PAL57L01', '目的地相同', '多筆', '陸-12'],
    ['PAL58B01', '為年度填報資料(非修改歷史資料)流程者時，歴史資料修改代號=000', '單筆', '陸-12'],
    ['PALD1L09', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0101或0201)時，事故時承保檔_意外死亡保險範圍代號=02且事故時承保檔_意外死亡特定意…', '跨檔', '陸-21'],
    ['PALD1L10', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0102或0202)時，事故時承保檔_意外死亡保險範圍代號=02且事故時承保檔_意外死亡特定意…', '跨檔', '陸-22'],
    ['PALD1L11', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0103或0203)時，事故時承保檔_意外死亡保險範圍代號=02且事故時承保檔_意外死亡特定意…', '跨檔', '陸-22'],
    ['PALD1L12', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0104或0204)時，事故時承保檔_意外死亡保險範圍代號=02且事故時承保檔_意外死亡特定意…', '跨檔', '陸-22'],
    ['PALD1L13', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0105或0205)時，事故時承保檔_意外死亡保險範圍代號=02且事故時承保檔_意外死亡特定意…', '跨檔', '陸-22'],
    ['PALD1L14', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0106或0206)時，事故時承保檔_意外死亡保險範圍代號=03且事故時承保檔_意外死亡特定意…', '跨檔', '陸-22'],
    ['PALD1L15', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0107或0207)時，事故時承保檔_意外死亡保險範圍代號=03且事故時承保檔_意外死亡特定意…', '跨檔', '陸-22'],
    ['PALD1L16', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0108或0208)時，事故時承保檔_意外死亡保險範圍代號=03且事故時承保檔_意外死亡特定意…', '跨檔', '陸-22'],
    ['PALD1L17', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0109或0209)時，事故時承保檔_意外死亡保險範圍代號=03且事故時承保檔_意外死亡特定意…', '跨檔', '陸-22'],
    ['PALD2L16', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0101或0301)時，事故時承保檔_意外失能保險範圍代號=02且事故時承保檔_意外失能特定意外事故保險…', '跨檔', '陸-23'],
    ['PALD2L17', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0102或0302)時，事故時承保檔_意外失能保險範圍代號=02且事故時承保檔_意外失能特定意外事故保險…', '跨檔', '陸-23'],
    ['PALD2L18', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0103或0303)時，事故時承保檔_意外失能保險範圍代號=02且事故時承保檔_意外失能特定意外事故保險…', '跨檔', '陸-23'],
    ['PALD2L19', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0104或0304)時，事故時承保檔_意外失能保險範圍代號=02且事故時承保檔_意外失能特定意外事故保險…', '跨檔', '陸-23'],
    ['PALD2L20', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0105或0305)時，事故時承保檔_意外失能保險範圍代號=02且事故時承保檔_意外失能特定意外事故保險…', '跨檔', '陸-23'],
    ['PALD2L21', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0106或0306)時，事故時承保檔_意外失能保險範圍代號=03且事故時承保檔_意外失能特定意外事故保險…', '跨檔', '陸-23'],
    ['PALD2L22', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0107或0307)時，事故時承保檔_意外失能保險範圍代號=03且事故時承保檔_意外失能特定意外事故保險…', '跨檔', '陸-23'],
    ['PALD2L23', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0108或0308)時，事故時承保檔_意外失能保險範圍代號=03且事故時承保檔_意外失能特定意外事故保險…', '跨檔', '陸-23'],
    ['PALD2L24', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0109或0309)時，事故時承保檔_意外失能保險範圍代號=03且事故時承保檔_意外失能特定意外事故保險…', '跨檔', '陸-23'],
    ['PALD0L01', '承保檔_契約變更型態代號=(ADS或ATS或ADB)時，有相同給付檔_保單號碼(保單編號及保單編號序號)', '跨檔', '陸-21'],
    ['PALD0L02', '有給付檔_保單號碼(保單編號及保單編號序號)資料時，有相同承保檔_保單號碼(保單編號及保單編號序號)資料', '跨檔', '陸-21'],
    ['PALD0L03', '承保檔_契約變更型態代號=ADB時，有給付檔_給付類別代號=02資料', '跨檔', '陸-21'],
    ['PALD0L04', '事故時承保檔_契約變更型態代號=LNN時，給付檔_事故日期≦事故時承保檔_契約變更日期', '跨檔', '陸-21'],
    ['PALD0L05', '事故時承保檔_業務性質代號=(PE或CP)且事故時承保檔_契約變更型態代號=(DEA或ADS或TDI或ATS或ADB或PAU或ROL或MAD或SRD或RES…', '跨檔', '陸-21'],
    ['PALD0L06', '事故時承保檔_業務性質代號≠(PE及CP)且事故時承保檔_契約變更型態代號=(DEA或ADS或TDI或ATS或ADB或PAU或ROL或MAD或SRD或RES…', '跨檔', '陸-21'],
    ['PALD0L07', '給付檔_事故日期≧事故時承保檔_保單保險期間迄日', '跨檔', '陸-21'],
    ['PALD0L08', '給付檔_公司代號=事故時承保檔_公司代號', '跨檔', '陸-21'],
    ['PALD0L09', '給付檔_保險商品編號適用版本=1且事故時承保檔_保險商品編號適用版本=1時，給付檔_保險商品編號第1-13位=事故時承保檔_保險商品編號第1-13位', '跨檔', '陸-21'],
    ['PALD0L10', '給付檔_保險商品編號適用版本=2且事故時承保檔_保險商品編號適用版本=2時，給付檔_保險商品編號第1-25位=事故時承保檔_保險商品編號第1-25位', '跨檔', '陸-21'],
    ['PALD0L11', '(給付檔_事故日期=事故時承保檔_契約變更日期)或(給付檔_事故日期=事故時承保檔_保單保險期間起日)時，給付檔_保險商品編號適用版本=事故時承保檔_保險商…', '跨檔', '陸-21'],
    ['PALD0L12', '給付檔_契約別=事故時承保檔_契約別', '跨檔', '陸-21'],
    ['PALD0L13', '給付檔_業務性質代號=事故時承保檔_業務性質代號', '跨檔', '陸-21'],
    ['PALD0L14', '給付檔_集體投保之連結關係=事故時承保檔_集體投保之連結關係', '跨檔', '陸-21'],
    ['PALD0L15', '給付檔_保險期間別=事故時承保檔_保險期間別', '跨檔', '陸-21'],
    ['PALD0L16', '給付檔_保單保險期間起日=事故時承保檔_保單保險期間起日', '跨檔', '陸-21'],
    ['PALD0L17', '給付檔_保單保險期間迄日=事故時承保檔_保單保險期間迄日', '跨檔', '陸-21'],
    ['PALD0L18', '事故時承保檔_業務性質代號=(PE或CP)且給付檔_業務性質代號=事故時承保檔_業務性質代號時，給付檔_證件類別代號=事故時承保檔_證件類別代號', '跨檔', '陸-21'],
    ['PALD0L19', '事故時承保檔_業務性質代號=(PE或CP)且給付檔_業務性質代號=事故時承保檔_業務性質代號時，給付檔_證件編號=事故時承保檔_證件編號', '跨檔', '陸-21'],
    ['PALD0L20', '事故時承保檔_業務性質代號=(PE或CP)且給付檔_業務性質代號=事故時承保檔_業務性質代號時，給付檔_性別=事故時承保檔_性別', '跨檔', '陸-21'],
    ['PALD0L21', '事故時承保檔_業務性質代號=(PE或CP)且給付檔_業務性質代號=事故時承保檔_業務性質代號時，給付檔_出生日期=事故時承保檔_出生日期', '跨檔', '陸-21'],
    ['PALD0L22', '事故時承保檔_業務性質代號=(PE或CP)且給付檔_業務性質代號=事故時承保檔_業務性質代號時，給付檔_事故時職業類別代號=事故時承保檔_職業類別代號', '跨檔', '陸-21'],
    ['PALD0L23', '事故時承保檔_業務性質代號=(PE或CP)且給付檔_業務性質代號=事故時承保檔_業務性質代號時，給付檔_事故時職業分類代碼=事故時承保檔_職業分類代碼', '跨檔', '陸-21'],
    ['PALD0L24', '給付檔_經濟弱勢者身分=事故時承保檔_經濟弱勢者身分', '跨檔', '陸-21'],
    ['PALD0L25', '給付檔_身心障礙類別=事故時承保檔_身心障礙類別', '跨檔', '陸-21'],
    ['PALD0L26', '給付檔_身心障礙等級=事故時承保檔_身心障礙等級', '跨檔', '陸-21'],
    ['PALD0L27', '給付檔_原幣別=事故時承保檔_原幣別', '跨檔', '陸-21'],
    ['PALD1L01', '給付檔_給付類別代號=(01或11)時，事故時承保檔_意外死亡保險金額＞0', '跨檔', '陸-21'],
    ['PALD1L02', '給付檔_給付類別代號=(01或11)時，事故時承保檔_契約變更型態代號=ADS', '跨檔', '陸-21'],
    ['PALD1L03', '給付檔_給付類別代號=(01或11)時，給付檔_事故日期=事故時承保檔_契約變更日期', '跨檔', '陸-21'],
    ['PALD1L04', '給付檔_給付類別代號=(01或11)且事故時承保檔_意外死亡保險範圍代號≠02時，給付檔_應給付保險金額日額給付倍數=001000', '跨檔', '陸-21'],
    ['PALD1L05', '給付檔_給付類別代號=(01或11)且事故時承保檔_意外死亡保險範圍代號=02時，給付檔_應給付保險金額日額給付倍數≧001000', '跨檔', '陸-21'],
    ['PALD1L06', '給付檔_給付類別代號=(01或11)時，給付檔_實際給付保險金額合計≦(事故時承保檔_意外死亡保險金額×給付檔_應給付保險金額日額給付倍數)', '跨檔', '陸-21'],
    ['PALD1L07', '給付檔_給付類別代號=(01或11)且事故時承保檔_契約變更型態代號=ADS且給付檔_事故日期=事故時承保檔_契約變更日期時，給付檔_給付類別代號=(01或…', '跨檔', '陸-21'],
    ['PALD1L08', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0100或0200)時，事故時承保檔_意外死亡保險範圍代號=01且事故時承保檔_意外死亡特定意…', '跨檔', '陸-21'],
    ['PALD1L18', '給付檔_給付類別代號=(01或11)且事故時承保檔_意外死亡保險範圍代號=01時，給付檔_給付項目代號=(0100或0200)', '跨檔', '陸-22'],
    ['PALD1L19', '給付檔_給付類別代號=(01或11)且事故時承保檔_意外死亡保險範圍代號=02時，給付檔_給付項目代號=(0101或0102或0103或0104或0105或…', '跨檔', '陸-22'],
    ['PALD1L20', '給付檔_給付類別代號=(01或11)且事故時承保檔_意外死亡保險範圍代號=03時，給付檔_給付項目代號=(0106或0107或0108或0109或0206或…', '跨檔', '陸-22'],
    ['PALD1L21', '給付檔_給付類別代號=(01或11)且承保檔_契約變更型態代號=ADS時，給付檔_事故日期=承保檔_契約變更日期', '跨檔', '陸-22'],
    ['PALD1L22', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0100或0200)時，事故時承保檔_意外死亡保險範圍代號=01', '跨檔', '陸-22'],
    ['PALD1L23', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0101或0102或0103或0104或0105或0201或0202或0203或0204或02…', '跨檔', '陸-22'],
    ['PALD1L24', '給付檔_給付類別代號=(01或11)且給付檔_給付項目代號=(0106或0107或0108或0109或0206或0207或0208或0209)時，事故時承保…', '跨檔', '陸-22'],
    ['PALD2L01', '給付檔_給付類別代號=02時，事故時承保檔_意外失能保險金額＞0', '跨檔', '陸-22'],
    ['PALD2L02', '給付檔_給付類別代號=02且給付檔_給付項目代號≠(0110及0310)且事故時承保檔_契約變更型態代號≠(ADB及ATS)時，給付檔_實際給付保險金額合計…', '跨檔', '陸-22'],
    ['PALD2L03', '給付檔_給付類別代號=02且事故時承保檔_契約變更型態代號=ADB時，給付檔_實際給付保險金額合計≧事故時承保檔_意外失能保險金額', '跨檔', '陸-22'],
    ['PALD2L04', '給付檔_給付類別代號=02且事故時承保檔_契約變更型態代號=ADB時，給付檔_事故日期=事故時承保檔_契約變更日期', '跨檔', '陸-22'],
    ['PALD2L05', '給付檔_給付類別代號=02且事故時承保檔_意外失能保險範圍代號≠02時，給付檔_應給付保險金額日額給付倍數=001000', '跨檔', '陸-22'],
    ['PALD2L06', '給付檔_給付類別代號=02且事故時承保檔_意外失能保險範圍代號=02時，給付檔_應給付保險金額日額給付倍數≧001000', '跨檔', '陸-22'],
    ['PALD2L07', '給付檔_給付類別代號=02且給付檔_失能項次等級代號第7-8位=01且給付檔_給付項目代號≠(0110及0310) Then事故時承保檔_契約變更型態代號=…', '跨檔', '陸-22'],
    ['PALD2L08', '給付檔_給付類別代號=02且給付檔_失能項次等級代號第7-8位=01且給付檔_給付項目代號≠(0110及0310)且事故時承保檔_契約變更型態代號=ATS時…', '跨檔', '陸-22'],
    ['PALD2L10', '給付檔_給付類別代號=02且給付檔_給付項目代號≠(0110及0310)且事故時承保檔_業務性質代號=(PE或CP)時，給付檔_應給付保險金額日額=事故時承…', '跨檔', '陸-22'],
    ['PALD2L11', '給付檔_給付類別代號=02且給付檔_給付項目代號≠(0110及0310)且事故時承保檔_契約變更型態代號=ATS時，給付檔_失能項次等級代號第7-8位=01', '跨檔', '陸-22'],
    ['PALD2L12', '給付檔_給付類別代號=02且給付檔_給付項目代號≠(0110及0310)且事故時承保檔_契約變更型態代號≠ATS時，給付檔_失能項次等級代號第7-8位≠01', '跨檔', '陸-22'],
    ['PALD2L14', '給付檔_給付類別代號=02且給付檔_給付項目代號≠(0110及0310)且給付檔_賠案號碼相同且給付檔_事故日期相同時，給付檔_實際給付保險金額合計≦事故時…', '跨檔', '陸-22'],
    ['PALD2L15', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0100或0300)時，事故時承保檔_意外失能保險範圍代號=01且事故時承保檔_意外失能特定意外事故保險…', '跨檔', '陸-23'],
    ['PALD2L25', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0110或0310)時，事故時承保檔_意外失能保險範圍代號=(01或02或03)', '跨檔', '陸-23'],
    ['PALD2L26', '給付檔_給付類別代號=02且事故時承保檔_意外失能保險範圍代號=01時，給付檔_給付項目代號=(0100或0110或0300或0310)', '跨檔', '陸-23'],
    ['PALD2L27', '給付檔_給付類別代號=02且事故時承保檔_意外失能保險範圍代號=02時，給付檔_給付項目代號=(0101或0102或0103或0104或0105或0110或…', '跨檔', '陸-23'],
    ['PALD2L28', '給付檔_給付類別代號=02且事故時承保檔_意外失能保險範圍代號=03時，給付檔_給付項目代號=(0106或0107或0108或0109或0110或0306或…', '跨檔', '陸-23'],
    ['PALD2L29', '給付檔_給付類別代號=02且給付檔_失能項次等級代號第7-8位=01且承保檔_契約變更型態代號=ATS時，給付檔_事故日期=承保檔_契約變更日期', '跨檔', '陸-23'],
    ['PALD2L30', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0100或0300)時，事故時承保檔_意外失能保險範圍代號=01', '跨檔', '陸-23'],
    ['PALD2L31', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0101或0102或0103或0104或0105或0301或0302或0303或0304或0305)時，…', '跨檔', '陸-23'],
    ['PALD2L32', '給付檔_給付類別代號=02且給付檔_給付項目代號=(0106或0107或0108或0109或0306或0307或0308或0309)時，事故時承保檔_意外失…', '跨檔', '陸-23'],
    ['PALD3L01', '給付檔_給付類別代號=03時，事故時承保檔_醫療限額＞0', '跨檔', '陸-23'],
    ['PALD3L02', '給付檔_給付類別代號=03時，給付檔_應給付保險金額日額≦事故時承保檔_醫療限額', '跨檔', '陸-23'],
    ['PALD3L03', '給付檔_給付類別代號=03時，給付檔_應給付保險金額日額給付倍數=001000', '跨檔', '陸-23'],
    ['PALD3L04', '給付檔_給付類別代號=03且給付檔_賠案號碼相同且給付檔_事故日期相同時，給付檔_實際給付保險金額合計≦事故時承保檔_醫療限額', '跨檔', '陸-23'],
    ['PALD4L01', '給付檔_給付類別代號=04時，事故時承保檔_醫療日額＞0', '跨檔', '陸-23'],
    ['PALD4L02', '給付檔_給付類別代號=04時，事故時承保檔_最高日數限制＞000且事故時承保檔_最高日數限制≦365', '跨檔', '陸-23'],
    ['PALD4L03', '給付檔_給付類別代號=04且給付檔_給付項目代號≠4101且給付檔_業務性質代號=(PE或CP)時，給付檔_應給付保險金額日額=事故時承保檔_醫療日額', '跨檔', '陸-23'],
    ['PALD4L04', '給付檔_給付類別代號=04且給付檔_給付項目代號=4101且給付檔_業務性質代號=(PE或CP)時，給付檔_應給付保險金額日額≦事故時承保檔_醫療日額', '跨檔', '陸-23'],
    ['PALD4L05', '給付檔_給付類別代號=04且給付檔_業務性質代號≠(PE及CP)時，給付檔_應給付保險金額日額≦事故時承保檔_醫療日額', '跨檔', '陸-23'],
    ['PALD4L06', '給付檔_給付類別代號=04時，給付檔_應給付日數>000且給付檔_應給付日數≦事故時承保檔_最高日數限制', '跨檔', '陸-23'],
    ['PALD4L07', '給付檔_給付類別代號=04且給付檔_給付項目代號≠(4101及2304)且給付檔_賠案號碼相同且給付檔_事故日期相同時，給付檔_實際給付日數合計≦事故時承保…', '跨檔', '陸-23'],
    ['PALD4L08', '給付檔_給付類別代號=04且給付檔_給付項目代號≠(4101及2304)且給付檔_事故日期相同且給付檔_實際給付日數合計>事故時承保檔_最高日數限制且not…', '跨檔', '陸-23', 'warning'],
    ['PALD5L01', '給付檔_給付類別代號=05時，事故時承保檔_重大燒燙傷保險金額＞0', '跨檔', '陸-23'],
    ['PALD5L02', '給付檔_給付類別代號=05時，給付檔_應給付保險金額日額≦事故時承保檔_重大燒燙傷保險金額', '跨檔', '陸-24'],
    ['PALD5L03', '給付檔_給付類別代號=05且給付檔_事故日期相同時，給付檔_實際給付保險金額合計≦事故時承保檔_重大燒燙傷保險金額', '跨檔', '陸-24'],
    ['PALD6L01', '給付檔_給付類別代號=06時，事故時承保檔_骨折保險金額＞0', '跨檔', '陸-24'],
    ['PALD6L02', '給付檔_給付類別代號=06時，給付檔_應給付保險金額日額≦事故時承保檔_骨折保險金額', '跨檔', '陸-24'],
    ['PALD6L03', '給付檔_給付類別代號=06且給付檔_事故日期相同時，給付檔_實際給付保險金額合計≦事故時承保檔_骨折保險金額', '跨檔', '陸-24'],
    ['PAD201_43', '非意外失能給付的失能項次等級代號填 00000000', '代碼', '參-62'],
    ['PAD201_44', '非骨折給付 (4101) 的骨折給付代號填 00', '代碼', '參-62'],
    ['PAD201_45', '非重大燒燙傷給付的二度燒燙傷面積代號填 0000', '代碼', '參-63'],
    ['PAD201_46', '非重大燒燙傷給付的三度燒燙傷代號填 0000', '代碼', '參-64'],
    ['PAD201_47', '非重大燒燙傷給付的顏面燒燙傷代號填 0000', '代碼', '參-65'],
  ].forEach(a => R(...a));

  // ================= 試用資料 (模擬承保檔、給付檔) =================
  // inject: true 時注入各式錯誤，key 為解答：每個錯誤列出應被哪些檢核編號找到、在哪張保單。
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const p2 = n => String(n).padStart(2, '0');
  const OCC_LOW = X.occ.codes.filter(c => ['1', '2', '3'].includes(X.occ.classOf[c]));
  const GRADE_C = [...GRADE.C].filter(c => c.slice(6) !== '01');
  const FIXED = ['xen', 'xen', 'new', 'newB', 'inn', 'dnn', 'lapse', 'srd', 'mad', 'ads', 'med', 'med', 'frac', 'burn', 'dis', 'micro', 'onn', 'mixed', 'rider', 'rider3', 'gnn', 'lnnFirst', 'newOld',
    'ads', 'med', 'xen', 'srd', 'lapse', 'inn', 'dis', 'burn', 'frac', 'micro', 'onn', 'gnn', 'mad', 'med', 'new', 'newB', 'xen', 'xen', 'med', 'ads', 'dis', 'burn', 'frac', 'srd', 'mad', 'lapse', 'inn', 'xen', 'new',
    'xen', 'xen', 'xen', 'xen', 'xen', 'xen', 'xen', 'xen', 'med', 'med', 'med', 'med', 'med', 'med', 'ads', 'ads', 'rider', 'rider', 'xen', 'xen', 'xen', 'xen', 'med', 'med'];
  const RAND = ['xen', 'xen', 'xen', 'xen', 'new', 'new', 'med', 'med', 'inn', 'srd', 'lapse', 'newB', 'mixed', 'rider', 'rider3', 'dis', 'frac', 'burn', 'ads', 'micro', 'gnn', 'dnn', 'mad', 'onn', 'newOld'];

  function mock(opts) {
    opts = Object.assign({ seed: 20251201, policies: 100, company: '01', year: 2025, inject: false }, opts);
    const rand = rng(opts.seed), ri = (a, b) => a + Math.floor(rand() * (b - a + 1)), pick = a => a[Math.floor(rand() * a.length)];
    const Y = opts.year, CO = opts.company, dec31 = `${Y}1231`;
    const date = (y, m, d) => `${y}${p2(m)}${p2(d)}`;
    const rdate = (y, m1, m2) => date(y, ri(m1, m2), ri(1, 28));
    const pols = [], Ds = [];
    let claimSeq = 0;
    for (let i = 0; i < opts.policies; i++) {
      const scen = i < FIXED.length ? FIXED[i] : pick(RAND);
      let start;
      if (['new', 'newB', 'micro'].includes(scen)) start = rdate(Y, 2, 10);
      else if (scen === 'newOld') start = rdate(Y - 2, 1, 12);
      else if (scen === 'dnn') start = rdate(Y - 1, 2, 11);
      else if (scen === 'mad') start = date(Y - 10, ri(1, 11), ri(2, 28));
      else if (scen === 'lnnFirst') start = date(ri(2012, 2017), ri(1, 12), ri(1, 28));
      else start = date(ri(2008, 2020), ri(1, 12), ri(1, 28));
      const sy = yr(start), a0 = ri(22, 55);
      const birth = date(sy - a0, ri(1, 12), ri(1, 28));
      const term = ['micro', 'newB'].includes(scen) ? 'B' : scen === 'mad' ? 'T' : pick(['T', 'T', 'T', 'W']);
      const nYears = scen === 'mad' ? 10 : pick([20, 30]);
      const end = term === 'B' ? addY(start, 1) : term === 'T' ? addY(start, nYears) : addY(start, 75 - ageAt(birth, start));
      const v2 = start >= '20150701', micro = scen === 'micro', mixed = scen === 'mixed';
      const contract = scen === 'rider' ? '2' : scen === 'rider3' ? '3' : '1';
      const serial = p3(1 + i % 7), ptype = mixed ? '2A' : '1A';
      const d4 = mixed ? '1' : '2', d5 = mixed ? '9' : '1', d7 = contract === '1' ? 'M' : 'R';
      const productCode = v2 ? `2${CO}${d4}${d5}1${d7}Z${ptype}${serial}1${{ B: '1', T: '2', W: '2' }[term]}A11${micro ? 'A' : 'Z'}10000000` : `2${CO}${d4}${d5}1${d7}1${ptype}${serial}00` + '0'.repeat(12);
      // 職業
      let occClass, occCode;
      if (contract === '3') { occClass = '0'; occCode = '00000000'; }
      else if (start >= '20150301') { occCode = pick(OCC_LOW); occClass = X.occ.classOf[occCode]; }
      else { occCode = '00000000'; occClass = pick(['1', '1', '2', '3']); }
      // 保障內容
      const kind = micro ? 'micro' : ['rider', 'rider3'].includes(scen) ? pick(['riderDay', 'riderLim']) : scen === 'med' ? pick(['adLim', 'adDay', 'adMed']) : scen === 'frac' ? pick(['adDay', 'adMed']) : scen === 'burn' ? 'adBurn'
        : ['dis', 'ads'].includes(scen) ? pick(['ad', 'ad', 'adLim']) : pick(['ad', 'ad', 'adLim', 'adDay', 'adMed', 'adBurn', 'adFrac']);
      const amt = { deathAmt: 0, deathScope: '00', deathSpecial: '0000000000', disAmt: 0, disScope: '00', disSpecial: '0000000000', medLimit: 0, medDaily: 0, maxDays: '000', burnAmt: 0, fractureAmt: 0 };
      if (kind === 'micro') Object.assign(amt, { deathAmt: 300000, disAmt: 300000, deathScope: '01', disScope: '01' });
      else if (kind.startsWith('ad')) {
        const A = pick([1000000, 2000000, 3000000, 5000000]), multi = rand() < 0.25 && scen !== 'ads';
        Object.assign(amt, { deathAmt: A, disAmt: A, deathScope: multi ? '02' : '01', disScope: multi ? '02' : '01', deathSpecial: multi ? '0110000000' : '0000000000', disSpecial: multi ? '0110000000' : '0000000000' });
      }
      if (['adLim', 'adMed', 'riderLim'].includes(kind)) amt.medLimit = pick([30000, 50000, 100000]);
      if (['adDay', 'adMed', 'riderDay'].includes(kind)) { amt.medDaily = pick([1000, 1500, 2000]); amt.maxDays = pick(['090', '180', '365']); }
      if (kind === 'adBurn') amt.burnAmt = pick([500000, 1000000]);
      if (kind === 'adFrac') amt.fractureAmt = pick([50000, 100000]);
      const old = start < '20200101';
      const base = Object.assign({
        company: CO, policyNo: `PA${String(Y).slice(2)}${String(100000 + i).slice(1)}${CO}`, policySeq: pick(['01', 'A01', '1']), seq: '00000',
        productCode, productVer: v2 ? '2' : '1', contractType: contract, bizType: 'PE', groupLink: '0', channel: pick(['1', '1', '2', '4']), salesMethod: pick(['1', '1', '3', '7']),
        termType: term, startDate: start, endDate: end, actualDays: '0000', idType: '1', idNo: '0000000000', sex: pick(['1', '2']), birthDate: birth,
        occClass, occCode, relation: pick(['1', '1', '2', '3']), econ: micro ? 'A' : '0', disabilityCat: '000', disabilityLevel: '0',
        payerZip: old && rand() < 0.15 ? '999' : pick(X.T.zip), insuredZip: old && rand() < 0.15 ? '999' : pick(X.T.zip), currency: 'NTD',
        companyPolicyCode: `PA${ptype}${serial}${contract}`, destination: 'N', histCode: '000',
      }, amt);
      if (start >= '20130101' && rand() < 0.08) Object.assign(base, { disabilityCat: 'A03', disabilityLevel: '3' });
      // 保費：基本型 (1A) 依保額估算年繳保費；混合型填 0
      const fin = (r, pf) => {
        const ct = r.changeType;
        r.headSign = ['NEW', 'NCT', 'XEN', 'RNN'].includes(ct) || ZERO_HEAD.includes(ct) ? '+' : '-';
        r.headCount = ZERO_HEAD.includes(ct) ? '0' : '1';
        const z = !is1A(r) || NO_PREM.includes(ct), f = (1 + 0.25 * (Math.max(1, +r.occClass || 1) - 1)) * (pf || 1);
        const both = r.medLimit > 0 && r.medDaily > 0;
        const pr = {
          premDeathDis: r.deathAmt > 0 || r.disAmt > 0 ? Math.max(1, Math.round((r.deathAmt * 0.0012 + r.disAmt * 0.0003) * f)) : 0,
          premMedLimit: !both && r.medLimit > 0 ? Math.round(r.medLimit * 0.04 * f) : 0,
          premMedDaily: !both && r.medDaily > 0 ? Math.round(r.medDaily * 1.5 * f) : 0,
          premEither: both ? Math.round((r.medLimit * 0.04 + r.medDaily * 1.5) * f) : 0,
          premOther: r.burnAmt > 0 || r.fractureAmt > 0 ? Math.max(1, Math.round((r.burnAmt * 0.0004 + r.fractureAmt * 0.003) * f)) : 0,
        };
        const net = { premDeathDis: 'netDeathDis', premMedLimit: 'netMedLimit', premMedDaily: 'netMedDaily', premEither: 'netEither', premOther: 'netOther' };
        for (const k of PREMS) { r[k] = z ? 0 : pr[k]; r[net[k]] = r[k] > 0 ? Math.max(1, Math.round(r[k] * 0.78)) : 0; }
        return r;
      };
      const rec = (ct, cd, o, pf) => fin(Object.assign({}, base, { changeType: ct, changeDate: cd, year: String(yr(cd)) }, o), pf);
      const xen = () => rec('XEN', '20210101');
      let recs;
      if (['new', 'newB', 'micro', 'newOld'].includes(scen)) recs = [rec('NEW', start)];
      else if (scen === 'inn') { const k = pick([1.5, 2]); recs = [xen(), rec('INN', rdate(Y, 2, 11), { deathAmt: base.deathAmt * k, disAmt: base.disAmt * k })]; }
      else if (scen === 'dnn') recs = [rec('NEW', start), rec('DNN', rdate(Y, 1, 11), { deathAmt: base.deathAmt / 2, disAmt: base.disAmt / 2 })];
      else if (scen === 'lapse') { const ln = rdate(Y - 1, 2, 11); recs = [xen(), rec('LNN', ln), rec('RNN', rdate(Y, 1, 10))]; }
      else if (scen === 'srd') recs = [xen(), rec('SRD', rdate(Y, 1, 11))];
      else if (scen === 'mad') recs = [xen(), rec('MAD', end)];
      else if (scen === 'ads') { base._death = rdate(Y, 4, 10); recs = [xen(), rec('ADS', base._death)]; }
      else if (scen === 'onn') {
        let o;
        if (start >= '20150301') { const c = pick(OCC_LOW.filter(x => X.occ.classOf[x] !== occClass)); o = { occCode: c, occClass: X.occ.classOf[c] }; }
        else o = { occClass: occClass === '1' ? '2' : '1' };
        recs = [xen(), rec('ONN', rdate(Y, 2, 11), o)];
      } else if (scen === 'gnn') recs = [xen(), rec('GNN', rdate(Y, 2, 11), {}, 1.2)];
      else if (scen === 'lnnFirst') recs = [rec('LNN', date(ri(2019, 2020), ri(1, 12), ri(1, 28)), { year: '2021' })];
      else recs = [xen()];
      if (recs[0].changeType === 'XEN') recs[0].year = '2021';
      if (recs.length > 1) recs.forEach((r, k) => { r.seq = String(k + 1).padStart(5, '0'); });
      const pol = { i, scen, kind, base, recs, claims: [] };
      pols.push(pol);

      // ---- 給付 ----
      const cause = () => pick(['W01', 'W10', 'W18', 'W19', 'W22', 'V23', 'V28', 'V43']).padEnd(7, ' ');
      const claim = (l, t, item, acc, o) => {
        const apply = X.plusDays(acc, ri(3, 10)), pay = X.plusDays(apply, ri(3, 12));
        const d = Object.assign({
          benefitType: t, benefitItem: item, company: CO, policyNo: l.policyNo, policySeq: l.policySeq, claimNo: `PC${Y}${String(++claimSeq).padStart(6, '0')}`,
          productCode: l.productCode, productVer: l.productVer, contractType: l.contractType, bizType: l.bizType, groupLink: l.groupLink, termType: l.termType, startDate: l.startDate, endDate: l.endDate,
          accidentDate: acc, applyDate: apply, payDate: pay, admitDate: '00000000', dischargeDate: '00000000', hospDays: '000',
          idType: l.idType, idNo: l.idNo, sex: l.sex, birthDate: l.birthDate, occClass: l.occClass, occCode: l.occCode, relation: l.relation, econ: l.econ, disabilityCat: l.disabilityCat, disabilityLevel: l.disabilityLevel,
          payStatus: 'S', causeCode: cause(), regionCode: '01', amtNature: '1', currency: l.currency, dueAmt: 0, dueMultiple: '001000', dueDays: '000', paidAmt: 0, paidMultiple: '001000', paidDays: '000', diffReason: '0',
          disabilityGrade: '00000000', fractureCode: '00', burn2Code: '0000', burn3Code: '0000', burnFaceCode: '0000', handlingFee: '0', year: String(Y), applyAmt: 0, applyDays: '000', reserved: '00',
        }, o);
        Ds.push(d); pol.claims.push(d);
        return d;
      };
      const unpaid = d => Object.assign(d, { amtNature: '2', payDate: '00000000', payStatus: 'U', paidAmt: 0, paidMultiple: '000000', paidDays: '000' });
      const medClaim = (l, acc, wantDay) => {
        if (l.medLimit > 0 && !(wantDay && l.medDaily > 0)) {
          const ap = ri(30, 900) * 100, due = Math.min(ap, l.medLimit);
          const d = claim(l, '03', pick(['3999', '3999', '2302', '2312']), acc, { applyAmt: ap, dueAmt: due, paidAmt: due });
          if (rand() < 0.2) unpaid(d);
        } else if (l.medDaily > 0) {
          const adm = X.plusDays(acc, ri(0, 1)), hosp = ri(3, 22), dis = X.plusDays(adm, hosp), apply = X.plusDays(dis, ri(1, 5)), pay = X.plusDays(apply, ri(2, 10));
          claim(l, '04', '3999', acc, { admitDate: adm, dischargeDate: dis, hospDays: p3(hosp), applyDate: apply, payDate: pay, dueAmt: l.medDaily, dueDays: p3(hosp), paidAmt: l.medDaily * hosp, paidDays: p3(hosp), applyAmt: l.medDaily * hosp, applyDays: p3(hosp) });
        }
      };
      const l0 = recs[recs.length - 1];
      if (scen === 'med' || (['rider', 'rider3'].includes(scen) && rand() < 0.6)) { medClaim(l0, rdate(Y, 1, 5), false); if (rand() < 0.5) medClaim(l0, rdate(Y, 6, 10), true); }
      if (scen === 'frac') {
        const fc = pick(['02', '05', '06', '07']), days = T.fracture[fc], acc = rdate(Y, 1, 10);
        claim(l0, '04', '4101', acc, { fractureCode: fc, dueAmt: l0.medDaily, dueDays: p3(days), paidAmt: l0.medDaily * days, paidDays: p3(days), applyAmt: l0.medDaily * days, applyDays: p3(days), causeCode: 'W19    ' });
      }
      if (scen === 'burn') claim(l0, '05', '3999', rdate(Y, 1, 10), { burn2Code: pick(T.burn2.slice(0, 4)), burn3Code: pick(['0000', '9481']), dueAmt: l0.burnAmt, paidAmt: l0.burnAmt, applyAmt: l0.burnAmt, causeCode: pick(['X00', 'X10', 'X11']).padEnd(7, ' ') });
      if (scen === 'dis') {
        const g = pick(GRADE_C), due = Math.round(l0.disAmt * GRADE_RATE[+g.slice(6)]);
        claim(l0, '02', l0.disScope === '02' ? '0101' : '0100', rdate(Y, 1, 10), { disabilityGrade: g, dueAmt: due, paidAmt: due, applyAmt: due });
      }
      if (scen === 'ads') {
        const x = recs[0], ad = recs[1];
        if (x.medLimit > 0) medClaim(x, rdate(Y, 1, 2), false);
        claim(ad, '01', ad.deathScope === '02' ? '0101' : '0100', base._death, { dueAmt: ad.deathAmt, paidAmt: ad.deathAmt, applyAmt: ad.deathAmt, causeCode: pick(['V43', 'V47', 'W13']).padEnd(7, ' ') });
      }
    }
    for (const d of Ds) if (d.payDate !== '00000000' && d.payDate > dec31) throw new Error('mock payDate overflow');

    const key = [];
    if (opts.inject) injectAccident(pols, Ds, key, { Y, rand, ri, pick });
    const lines = [];
    for (const p of pols) for (const r of p.recs) lines.push(r._line != null ? r._line : C.buildLine(L, r));
    const dl = Ds.map(d => d._line != null ? d._line : C.buildLine(D, d));
    return { AL: lines.join('\n') + '\n', AD: dl.join('\n') + '\n', names: { AL: `PAL${Y}${CO}.txt`, AD: `PAD${Y}${CO}.txt` }, key, year: Y };
  }

  // 注入錯誤：每一項寫明應被找到的全部檢核編號 (rules) 與保單
  function injectAccident(pols, Ds, key, h) {
    const used = new Set();
    const pk = p => `${p.base.policyNo}/${p.base.policySeq}`;
    const take = pred => { const p = pols.find(x => !used.has(x) && pred(x)); if (p) used.add(p); return p; };
    const S = (...sc) => x => sc.includes(x.scen);
    const noClaim = x => !x.claims.length;
    const add = (p, rules, what, file) => key.push({ rules, policy: pk(p), file: file || 'AL', what });
    const all = (p, k, v) => p.recs.forEach(r => { r[k] = v; });
    const xenOnly = x => x.scen === 'xen' && noClaim(x);
    let p;
    // ---- 承保檔：欄位格式與代碼 ----
    if ((p = take(xenOnly))) { all(p, 'channel', '7'); add(p, ['PAL10B01'], '通路別填 7，不在代號表內'); }
    if ((p = take(xenOnly))) { all(p, 'occCode', '99999999'); add(p, ['PAL201_25'], '職業分類代碼 99999999 不在職業分類表'); }
    if ((p = take(x => xenOnly(x) && x.base.deathAmt > 0))) { p.recs.forEach(r => { r._line = C.buildLine(L, r).replace(/^(.{146})0/, '$1 '); }); add(p, ['PAL33B01'], '意外死亡保險金額前面補空白而不是補 0'); }
    if ((p = take(xenOnly))) { all(p, 'histCode', 'A01'); add(p, ['PAL58B01'], '年度填報資料的歷史資料修改代號填 A01'); }
    if ((p = take(xenOnly))) { all(p, 'destination', 'B'); add(p, ['PAL57B02'], '個人傷害保險的目的地填 B (國外)'); }
    if ((p = take(xenOnly))) { all(p, 'reserved', '1000000000000000'); add(p, ['PAL56B01'], '保留欄位沒有全填 0'); }
    if ((p = take(xenOnly))) { all(p, 'idNo', 'A123456789'); add(p, ['PAL21B01'], '證件編號填了身分證號 (應暫填 0)'); }
    // ---- 承保檔：單筆邏輯 ----
    if ((p = take(x => xenOnly(x) && x.base.birthDate < '19990101' && x.base.termType === 'T'))) { all(p, 'birthDate', X.plusDays(p.base.startDate, 30)); add(p, ['PAL23B04'], '出生日期晚於保險期間起日'); }
    if ((p = take(x => S('new')(x) && noClaim(x)))) { all(p, 'changeDate', X.plusDays(p.base.startDate, 5)); add(p, ['PAL13B07'], '新契約的契約變更日期不等於保險期間起日'); }
    if ((p = take(S('mad')))) { p.recs[1].changeDate = X.plusDays(p.recs[1].endDate, -10); add(p, ['PAL13B04'], '滿期 (MAD) 的契約變更日期不是保險期間迄日'); }
    if ((p = take(x => S('srd')(x) && is1A(x.base) && x.base.deathAmt > 0))) { p.recs[1].premDeathDis = 1200; add(p, ['PAL13B15'], '解約 (SRD) 那一筆還填了保費收入'); }
    if ((p = take(x => xenOnly(x) && is1A(x.base) && x.base.deathAmt > 0))) { all(p, 'netDeathDis', +p.recs[0].premDeathDis + 500); add(p, ['PAL45B03'], '意外死亡失能純保費大於保費收入'); }
    if ((p = take(x => xenOnly(x) && x.base.medLimit === 0 && is1A(x.base)))) { all(p, 'premMedLimit', 800); add(p, ['PAL46B02'], '沒有醫療限額，卻填了醫療限額保費收入'); }
    if ((p = take(x => xenOnly(x) && x.base.deathScope === '01'))) { all(p, 'deathSpecial', '0100000000'); add(p, ['PAL35B06'], '標準型 (01) 卻填了特定意外事故代號'); }
    if ((p = take(x => xenOnly(x) && x.base.disScope === '01'))) { all(p, 'disScope', '02'); add(p, ['PAL38B07'], '意外失能保險範圍改為多倍型 (02)，但特定意外事故代號全為 0'); }
    if ((p = take(x => xenOnly(x) && x.base.deathAmt > 0 && x.base.disAmt > 0))) { all(p, 'deathAmt', 0); add(p, ['PAL34B02'], '意外死亡保額為 0，保險範圍代號卻不是 00'); }
    if ((p = take(x => xenOnly(x) && x.base.medDaily > 0))) { all(p, 'maxDays', '000'); add(p, ['PAL41B01', 'PAL41B04'], '有醫療日額，最高日數限制卻填 000'); }
    if ((p = take(x => xenOnly(x) && x.base.startDate >= '20150301' && x.base.contractType === '1'))) { const c = p.base.occClass === '1' ? '2' : '1'; all(p, 'occClass', c); add(p, ['PAL25B05'], '職業類別與職業分類代碼的類別不符'); }
    if ((p = take(x => S('new', 'newB')(x) && noClaim(x) && x.base.contractType === '1'))) { const c = p.base.occClass === '1' ? '3' : '1'; all(p, 'occClass', c); add(p, ['PAL25B08'], '新契約的職業類別與職業分類代碼的類別不符'); }
    if ((p = take(x => xenOnly(x) && x.base.startDate >= '20150301' && x.base.contractType === '1'))) { all(p, 'occCode', '00000000'); add(p, ['PAL25B03'], '2015/03/01 後投保，職業分類代碼卻填 00000000'); }
    if ((p = take(x => xenOnly(x) && x.base.disabilityCat === '000'))) { all(p, 'disabilityLevel', '2'); add(p, ['PAL29B02'], '身心障礙類別 000，卻有障礙等級 2'); }
    if ((p = take(x => S('new')(x) && noClaim(x)))) { all(p, 'payerZip', '999'); add(p, ['PAL30B05'], '2020 年後投保的保單，要保人郵遞區號填 999'); }
    if ((p = take(x => xenOnly(x) && x.base.productVer === '2'))) { all(p, 'productCode', p.base.productCode.slice(0, 15) + 'B' + p.base.productCode.slice(16)); add(p, ['PAL05B40'], '商品編號第 16 碼為 B (美元)，原幣別卻是 NTD'); }
    if ((p = take(x => xenOnly(x) && x.base.productVer === '2' && x.base.termType === 'T'))) { all(p, 'productCode', p.base.productCode.slice(0, 14) + '1' + p.base.productCode.slice(15)); add(p, ['PAL05B33', 'PAL05B36'], '商品編號第 15 碼為 1 (一年期)，保險期間別卻是 T'); }
    if ((p = take(x => xenOnly(x) && x.base.productVer === '1'))) { all(p, 'productCode', p.base.productCode.slice(0, 3) + '22' + p.base.productCode.slice(5)); add(p, ['PAL05B10'], '商品編號第 4-5 碼為 22 (旅行平安保險)，不應填在 PAL 檔'); }
    if ((p = take(x => S('rider')(x) && noClaim(x)))) { all(p, 'contractType', '1'); add(p, ['PAL07B02'], '附約 (商品編號第 7 碼 R) 的契約別填 1'); }
    if ((p = take(x => S('newB')(x) && noClaim(x)))) { all(p, 'endDate', X.plusDays(p.base.endDate, 10)); add(p, ['PAL12B03'], '一年期主約的迄日不是起日加 1 年減 1 天'); }
    if ((p = take(x => xenOnly(x)))) { all(p, 'headSign', '-'); add(p, ['PAL18B02', 'PAL19L01'], 'XEN 的人數加減號填 -'); }
    if ((p = take(x => S('new', 'newB')(x) && noClaim(x)))) { all(p, 'headCount', '2'); add(p, ['PAL08B08'], '個人保單新契約的人數填 2'); }
    if ((p = take(xenOnly))) { all(p, 'changeDate', '20210315'); add(p, ['PAL13B14'], '期初有效 (XEN) 的契約變更日期不是 20210101'); }
    if ((p = take(x => S('micro')(x)))) { all(p, 'econ', '0'); add(p, [p.base.startDate >= '20250814' ? 'PAL05B58' : 'PAL05B56'], '微型保險的經濟弱勢者身分填 0'); }
    if ((p = take(x => S('micro')(x)))) { all(p, 'disAmt', 200000); add(p, ['PAL36B03'], '微型保險的意外失能保額不等於意外死亡保額'); }
    // ---- 承保檔：多筆 ----
    if ((p = take(S('lapse')))) { p.recs[2].changeType = 'GNN'; add(p, ['PAL13L09'], '停效 (LNN) 之後的下一筆不是復效 (RNN)'); }
    if ((p = take(S('inn')))) { p.recs[1].deathAmt = p.recs[0].deathAmt; p.recs[1].disAmt = p.recs[0].disAmt; add(p, ['PAL13L05'], '保額增加 (INN) 但保額沒有變大'); }
    if ((p = take(S('inn')))) { p.recs[1].changeDate = '20201215'; add(p, ['PAL14L01'], '第 2 筆的契約變更日期早於第 1 筆'); }
    if ((p = take(S('lapse')))) { p.recs[2].seq = '00002'; add(p, ['PAL04B06'], '異動序號重複'); }
    if ((p = take(x => S('inn')(x) && x.base.startDate >= '20150301'))) { const c = pick2(h, OCC_LOW.filter(x => X.occ.classOf[x] === p.base.occClass && x !== p.base.occCode)); p.recs[1].occCode = c; add(p, ['PAL25L02'], '非職業變更的異動，職業分類代碼卻與上一筆不同'); }
    if ((p = take(S('srd')))) { const r = Object.assign({}, p.recs[0], { changeType: 'GNN', changeDate: X.plusDays(p.recs[1].changeDate, 20), seq: '00003', headSign: '+', headCount: '0' }); r.year = r.changeDate.slice(0, 4); p.recs.push(r); add(p, ['PAL13L14', 'PAL19L02'], '解約之後還有一筆保費異動'); }
    if ((p = take(x => S('gnn')(x)))) { p.recs[1].sex = p.base.sex === '1' ? '2' : '1'; add(p, ['PAL22L01'], '第 2 筆的性別與第 1 筆不同'); }
    if ((p = take(S('mad')))) { p.recs.pop(); add(p, ['PAL16L01', 'PAL16L05'], '保單今年到期，卻沒有滿期 (MAD) 資料'); }
    if ((p = take(S('onn')))) { p.recs[1].changeType = 'GNN'; p.recs[1].headCount = '0'; add(p, p.base.startDate >= '20150301' ? ['PAL13L08', 'PAL25L02'] : ['PAL13L08'], '職業類別變了，契約變更型態卻不是 ONN'); }
    // ---- 給付檔 ----
    const addD = (q, rules, what) => key.push({ rules, policy: pk(q), file: 'AD', what });
    const dOf = (pred, dpred) => { const q = pols.find(x => !used.has(x) && pred(x) && x.claims.some(dpred)); if (q) used.add(q); return q ? [q, q.claims.find(dpred)] : [null, null]; };
    let q, d;
    const med03 = x => x.benefitType === '03' && x.amtNature === '1';
    const med04 = x => x.benefitType === '04' && x.benefitItem === '3999';
    [q, d] = dOf(S('med'), med03); if (q) { d.applyDate = X.plusDays(d.accidentDate, -2); addD(q, ['PAD16B02'], '申請日期早於事故日期'); }
    [q, d] = dOf(S('med'), x => med03(x) && X.dayDiff(x.accidentDate, x.applyDate) >= 2); if (q) { d.payDate = X.plusDays(d.applyDate, -1); addD(q, ['PAD17B04'], '給付日期早於申請日期'); }
    [q, d] = dOf(S('med', 'rider', 'rider3'), x => med04(x) && +x.hospDays >= 16); if (q) { d.hospDays = '001'; addD(q, ['PAD20B02'], '住院日數與入出院日期相差超過 14 天'); }
    [q, d] = dOf(S('med', 'rider', 'rider3'), med04); if (q) { d.admitDate = '00000000'; addD(q, ['PAD18B05', 'PAD20B03'], '醫療日額給付沒有填入院日期'); }
    [q, d] = dOf(S('med', 'rider', 'rider3'), x => x.benefitType === '03'); if (q) { d.benefitItem = '0100'; addD(q, ['PAD02B02'], '醫療限額給付的給付項目填 0100 (意外死亡及失能)'); }
    [q, d] = dOf(S('burn'), x => x.benefitType === '05'); if (q) { d.dueMultiple = '002000'; addD(q, ['PAD37B03', 'PAD40B03', 'PAD42B04'], '重大燒燙傷的應給付倍數填 2 倍'); }
    [q, d] = dOf(S('med', 'rider', 'rider3'), x => x.amtNature === '2'); if (q) { d.payDate = X.plusDays(d.applyDate, 5) > `${h.Y}1231` ? `${h.Y}1231` : X.plusDays(d.applyDate, 5); addD(q, ['PAD17B01'], '未付金額資料卻填了給付日期'); }
    [q, d] = dOf(S('med'), med03); if (q) { d.payStatus = 'U'; addD(q, ['PAD34B03'], '已付金額的給付狀態填 U (未給付)'); }
    [q, d] = dOf(S('frac', 'burn', 'dis'), () => true); if (q) { d.causeCode = 'Y36    '; addD(q, ['PAD32B06'], '事故原因代號填 Y36 (戰爭行動)'); }
    [q, d] = dOf(x => S('dis')(x) && x.base.disScope === '01', x => x.benefitType === '02'); if (q) { d.disabilityGrade = d.disabilityGrade.slice(6) === '07' ? '01010202' : '01010407'; addD(q, ['PALD2L10'], '失能等級改了，應給付金額卻沒有跟著改 (與失能比例不符)'); }
    [q, d] = dOf(S('med'), () => true); if (q) { for (const x of q.claims) x.policyNo = x.policyNo.slice(0, -2) + '99'; key.push({ rules: ['PALD0L02'], policy: `${q.base.policyNo.slice(0, -2)}99/${q.base.policySeq}`, file: 'AD', what: '給付資料的保單號碼打錯，承保檔找不到' }); }
    if ((q = take(x => S('ads')(x) && x.claims.length === 1))) { Ds.splice(Ds.indexOf(q.claims[0]), 1); q.claims = []; add(q, ['PALD0L01'], '意外死亡 (ADS) 卻沒有給付資料'); }
    [q, d] = dOf(x => S('ads')(x) && x.base.deathScope === '01', x => x.benefitType === '01'); if (q) { d.paidAmt = Math.round(d.dueAmt * 1.5); d.applyAmt = d.paidAmt; addD(q, ['PALD1L06', 'PAD40B03', 'PAD42B03'], '意外死亡實際給付金額超過保額'); }
    [q, d] = dOf(S('med', 'rider', 'rider3'), med03); if (q) { d.dueAmt = d.dueAmt * 0 + q.recs[0].medLimit + 5000; d.diffReason = '9'; addD(q, ['PALD3L02'], '應給付金額大於承保醫療限額'); }
    [q, d] = dOf(S('med', 'rider', 'rider3'), med04); if (q) { d.dueAmt = q.recs[0].medDaily + 500; d.diffReason = '9'; addD(q, ['PALD4L03'], '應給付日額不等於承保醫療日額'); }
    [q, d] = dOf(x => S('med', 'rider', 'rider3', 'frac')(x) && +x.recs[0].maxDays <= 180, x => x.benefitType === '04'); if (q) { d.dueDays = p3(+q.recs[0].maxDays + 5); d.diffReason = '9'; addD(q, ['PALD4L06'], '應給付日數超過承保最高日數限制'); }
    [q, d] = dOf(S('med', 'frac', 'burn', 'dis'), () => true); if (q) { for (const x of q.claims) x.sex = x.sex === '1' ? '2' : '1'; addD(q, ['PALD0L20'], '給付檔的性別與承保檔不同'); }
    [q, d] = dOf(x => S('med', 'frac', 'burn', 'dis')(x) && x.base.startDate >= '20150301' && x.base.contractType === '1', () => true); if (q) { const c = pick2(h, OCC_LOW.filter(x => X.occ.classOf[x] !== q.base.occClass)); for (const x of q.claims) { x.occCode = c; x.occClass = X.occ.classOf[c]; } addD(q, ['PALD0L22', 'PALD0L23'], '給付檔的事故時職業與承保檔不同'); }
    [q, d] = dOf(S('burn'), x => x.benefitType === '05'); if (q) { d.burn2Code = '0000'; d.burn3Code = '0000'; addD(q, ['PAD47B02'], '重大燒燙傷給付沒有填任何燒燙傷代號'); }
    [q, d] = dOf(S('frac'), x => x.benefitItem === '4101'); if (q) { d.fractureCode = '00'; addD(q, ['PAD44B02'], '骨折給付 (4101) 沒有填骨折給付代號'); }
    [q, d] = dOf(x => S('ads')(x) && x.base.deathScope === '01', x => x.benefitType === '01'); if (q) { d.benefitItem = '0103'; addD(q, ['PALD1L11', 'PALD1L18', 'PALD1L23'], '標準型意外死亡，給付項目卻填多倍型陸地大眾運輸 (0103)'); }
    [q, d] = dOf(S('med', 'frac', 'burn', 'dis'), () => true); if (q) { for (const x of q.claims) x.startDate = X.plusDays(x.startDate, -1); addD(q, ['PALD0L16'], '給付檔的保單起日與承保檔差 1 天'); }
    [q, d] = dOf(S('ads'), x => x.benefitType === '01'); if (q) { d.benefitType = '11'; addD(q, ['PAD24B03'], '成年被保險人的意外死亡填給付類別 11 (未滿 15 足歲)'); }
    [q, d] = dOf(x => S('med')(x) && x.base.medLimit === 0, () => true); if (q) {
      const acc = `${h.Y}1103`;
      Ds.push(Object.assign({}, d, { benefitType: '03', benefitItem: '3999', claimNo: `PX${h.Y}000001`, accidentDate: acc, applyDate: X.plusDays(acc, 3), payDate: X.plusDays(acc, 10), admitDate: '00000000', dischargeDate: '00000000', hospDays: '000', dueAmt: 8000, dueMultiple: '001000', dueDays: '000', paidAmt: 8000, paidMultiple: '001000', paidDays: '000', applyAmt: 8000, applyDays: '000', diffReason: '0', causeCode: d.causeCode }));
      addD(q, ['PALD3L01'], '沒有醫療限額保障，卻有醫療限額 (03) 給付');
    }
  }
  const pick2 = (h, a) => a[Math.floor(h.rand() * a.length)];

  return {
    id: 'accident', name: '個人傷害保險', version: '2021',
    layouts: { AL: L, AD: D }, tables: T, catalog,
    recordRules: { AL: recordL, AD: recordD },
    groupRules: { AL: groupL, AD: groupD },
    crossRules: [endYearL, crossLD],
    helpers: { atAccident, headSums, isMicro },
    mock,
  };
});
