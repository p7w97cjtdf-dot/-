/*
 * 規則集：人壽保險業「個人壽險」年度填報 (2025 填報年度)
 * 來源：
 *   - 附件二_人壽保險業個人壽險填報手冊_2025填報年度 (欄位格式、代碼表)
 *   - 新式個人壽險填報說明手冊範例&檢核規則_2025 (參、欄位檢核；新檢核編號)
 * 檢核編號沿用手冊「(新)檢核編號」，例如 20200_L0612；
 * 以 X 開頭者為本工具補充之「邏輯合理性」檢核 (手冊未列，預設為警告)。
 */
(function (root, factory) {
  const core = (typeof module === 'object' && module.exports) ? require('../core.js') : root.DQ;
  const m = factory(core);
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.DQ = root.DQ || {}; root.DQ.rulesets = root.DQ.rulesets || {}; root.DQ.rulesets.life = m; }
})(typeof self !== 'undefined' ? self : this, function (C) {
  'use strict';
  const { isValidDate, addYearsMinusDay, monthsBetween, ageAt, big, isZero, num } = C;

  // ================= 代碼表 =================
  const T = {
    company: { '01': '臺銀人壽', '02': '台灣人壽', '03': '保誠人壽', '04': '國泰人壽', '05': '凱基人壽', '06': '南山人壽',
      '08': '新光人壽', '09': '富邦人壽', '11': '三商美邦人壽', '16': '遠雄人壽', '17': '宏泰人壽', '18': '安聯人壽',
      '20': '中華郵政壽險處', '21': '第一金人壽', '22': '合作金庫人壽', '55': '台新人壽', '56': '安達國際人壽',
      '57': '友邦人壽', '61': '元大人壽', '64': '全球人壽', '67': '法國巴黎人壽' },
    // 保險商品類別編號第 2-3 碼允許之公司代碼別名 (21001~21007_L1803)
    companyAlias: { '02': ['02', '54', '58'], '04': ['04', '10', '15'], '05': ['05', '03', '62'], '06': ['06', '12'],
      '09': ['09', '52'], '18': ['18', '71'], '64': ['64', '07'] },
    idType: ['0', '1', '2', '3', '9'],
    termType: { B: '一年期', G: '一年期保證續保', T: '年滿期', W: '歲滿期', Y: '終身' },
    sex: { '1': '男', '2': '女' },
    medExam: { '1': '有體檢', '2': '無體檢' },
    examClass: { '1': '標準體', '2': '次標準體或弱體', '3': '優體' },
    substd: { '0': '非次標準體', '1': '體檢', '2': '職業', '8': '含 2 項以上原因', '9': '其它' },
    addType: { NEW: '新契約', NCT: '契約轉換1', CTC: '契約轉換2', INN: '保額增加', DNN: '保額減少', RNN: '復效',
      XED: '持續有效(期初)', XDD: '罹患重大疾病未終止', XAB: '生命末期未終止', PAU: '繳清', ROL: '展期',
      INV: '登記疾病身故保險金', HCC: '危險分類欄位變更', TPD: '繳費期間別變更', EOY: '補充新增欄位資料',
      SIB: '生存還本金', HLM: '祝壽金', MAB: '滿期金', INS: '登記生存還本保險金' },
    exitType: { XED: '持續有效(期末)', CTC: '契約轉換2', INN: '保額增加', DNN: '保額減少', LNN: '停效',
      DEA: '疾病死亡', ADS: '意外死亡', TDI: '疾病完全失能', ATS: '意外完全失能', MAD: '滿期', SRD: '解約',
      SRE: '解除契約', RES: '撤銷', LOP: '失效', TMD: '終止', PAU: '繳清', ROL: '展期', DDA: '罹患重大疾病終止',
      XDD: '罹患重大疾病未終止', ABD: '生命末期終止', XAB: '生命末期未終止', INV: '登記疾病身故保險金',
      HCC: '危險分類欄位變更', TPD: '繳費期間別變更', EOY: '期末有效', SIB: '生存還本金', HLM: '祝壽金',
      MAB: '滿期金', INS: '登記生存還本保險金' },
    dividend: ['S', 'T', 'A', 'B', 'M', 'N', 'Y', 'X', 'C', 'D', 'P', 'Q'],
    survivalType: { '0': '無還本', '1': '定期還本', '2': '終身還本', '3': '非分期還本' },
    smoker: { '0': '無分類', '1': '吸煙', '2': '非吸煙' },
    disabilityLevel: { '0': '非身心障礙', '1': '極重度', '2': '重度', '3': '中度', '4': '輕度' },
    econ: ['0', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'Z'],
    groupLink: ['0', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'Z'],
    channel: { '1': '壽險公司', '2': '銀行保經', '3': '銀行保代', '4': '一般保經', '5': '一般保代' },
    salesMethod: { '1': '保險業務員', '2': '郵寄', '3': '電話行銷', '4': '網路銷售', '5': '直接投保', '6': '直效行銷', '7': '網路投保', '9': '其他' },
    relation: { '1': '本人', '2': '配偶', '3': '子女', '4': '父母', '9': '其他' },
    currency: ['AUD', 'CAD', 'CHF', 'CNY', 'DKK', 'EUR', 'GBP', 'HKD', 'IDR', 'JPY', 'KRW', 'MYR', 'NTD', 'NZD', 'PHP', 'SEK', 'SGD', 'THB', 'USD', 'ZAR'],
    occClass: ['0', '1', '2', '3', '4', '5', '6', '8', '9'],
    productVer: { '1': '15 碼版本', '2': '27 碼版本' },
    payFreq: { '0': '躉繳', '1': '年繳', '2': '半年繳', '3': '季繳', '4': '月繳', '5': '彈性繳' },
    lapse: { B: '同時有保單貸款與墊繳', D: '保單貸款', N: '非停失效之異動', P: '墊繳', S: '不繳費', T: '其他' },
    survivalCond: { '0': '無給付', '1': '繳費期滿後給付', '2': '到達約定年期後給付', '3': '到達約定年齡後給付' },
    claimType: { '1': '死亡', '2': '完全失能', '3': '生命末期提前給付', '4': '生存還本金', '5': '祝壽金', '6': '滿期金' },
    diffReason: { '0': '相同', '1': '削額給付', '2': '和解', '3': '違反告知義務', '4': '條款除外責任', '5': '含紅利給付', '6': '意外事故', '7': '生命表差額增額給付', '8': '其他' },
    payMethod: { '1': '一次性給付', '2': '約定期間且分期給付', '3': '終身且分期給付' },
    // 表 3．1．46 臺灣地區郵遞區號前 3 碼一覽表
    zip: ('100 103 104 105 106 108 110 111 112 114 115 116 200 201 202 203 204 205 206 207 208 209 210 211 212 220 221 222 223 224 226 227 228 231 232 233 234 235 236 237 238 239 241 242 243 244 247 248 249 251 252 253 260 261 262 263 264 265 266 267 268 269 270 272 290 300 302 303 304 305 306 307 308 310 311 312 313 314 315 320 324 325 326 327 328 330 333 334 335 336 337 338 350 351 352 353 354 356 357 358 360 361 362 363 364 365 366 367 368 369 400 401 402 403 404 406 407 408 411 412 413 414 420 421 422 423 424 426 427 428 429 432 433 434 435 436 437 438 439 500 502 503 504 505 506 507 508 509 510 511 512 513 514 515 516 520 521 522 523 524 525 526 527 528 530 540 541 542 544 545 546 551 552 553 555 556 557 558 600 602 603 604 605 606 607 608 611 612 613 614 615 616 621 622 623 624 625 630 631 632 633 634 635 636 637 638 640 643 646 647 648 649 651 652 653 654 655 700 701 702 704 708 709 710 711 712 713 714 715 716 717 718 719 720 721 722 723 724 725 726 727 730 731 732 733 734 735 736 737 741 742 743 744 745 800 801 802 803 804 805 806 807 811 812 813 814 815 817 819 820 821 822 823 824 825 826 827 828 829 830 831 832 833 840 842 843 844 845 846 847 848 849 851 852 880 881 882 883 884 885 890 891 892 893 894 896 900 901 902 903 904 905 906 907 908 909 911 912 913 920 921 922 923 924 925 926 927 928 929 931 932 940 941 942 943 944 945 946 947 950 951 952 953 954 955 956 957 958 959 961 962 963 964 965 966 970 971 972 973 974 975 976 977 978 979 981 982 983').split(' '),
  };
  const keys = o => Object.keys(o);
  const PERIOD_END = ['XED', 'EOY'];                // 期末/期初有效 (日期為 0)
  const TERMINAL = ['XED', 'EOY', 'DEA', 'ADS', 'TDI', 'ATS', 'MAD', 'SRE', 'SRD', 'RES', 'LOP', 'TMD', 'DDA', 'ABD', 'HLM'];
  const FIRST_NOT = ['DEA', 'ADS', 'TDI', 'ATS', 'MAD', 'SRD', 'RES', 'LOP', 'TMD', 'DDA', 'ABD'];
  const CHAIN = ['INN', 'DNN', 'PAU', 'ROL', 'XDD', 'XAB', 'INV', 'HCC', 'CTC', 'TPD', 'SIB', 'MAB', 'INS'];
  const LAPSE = ['LNN', 'LOP'];
  const CLAIM_EXIT = { DEA: '1', ADS: '1', TDI: '2', ATS: '2', ABD: '3' };
  const BENEFIT_EXIT = { SIB: '4', HLM: '5', MAB: '6' };
  const MIX_P4 = {
    '1': ['1A', '2A', '2B', '2C', '2G', '2H', '2I', '2K', 'IA', 'IB', 'UA', 'UB'],
    '2': ['1G', '2A', '2G', '2H', '2J', '2K', '3G', '4G', '5G', '6G', '9G'],
    '3': ['1G', '2B', '2G', '2I', '2K', '5G', '6G', '9G'],
    '4': ['2C', '2H', '2I', '2K'],
  };
  const P5_BY_P4 = { '1': '12349', '2': '12349', '3': '1234569', '4': '129' };
  const isDisabilityCat = v => v === '000' || /^(0[1-9]0|1[0-8]0|990)$/.test(v) || /^A0[1-8]$/.test(v) || /^M[0-9A-F]{2}$/.test(v);
  const ALNUM = /^[A-Z0-9 ]*$/;

  // ================= 欄位格式 =================
  // [key, 名稱, 起, 長度, 型態, 其他屬性]
  function layout(id, title, recordLength, defs, extra) {
    const fields = defs.map(([key, name, start, len, type, o], i) =>
      Object.assign({ no: i + 1, key, name, start, len, type }, o || {}));
    const L = Object.assign({ id, title, recordLength, fields, field: k => fields.find(f => f.key === k) }, extra);
    const total = fields.reduce((s, f) => s + f.len, 0);
    if (total !== recordLength) throw new Error(`${id} 欄位長度合計 ${total} ≠ ${recordLength}`);
    return L;
  }
  const amt = (key, name, start, o) => [key, name, start, 18, '9', o];

  const L = layout('L', '承保資料檔', 425, [
    ['company', '公司代號', 1, 2, '9', { notZero: true, codes: keys(T.company), codeTable: '表 3．1．1 公司代號表', typeRule: '10400_L0101', codeRule: '20100_L0102' }],
    ['policyNo', '保單編號', 3, 15, 'X', { notBlank: true, notZero: true, leftAlign: true, charset: ALNUM, charsetHint: '限大寫 A~Z、0~9，靠左、後補空白', typeRule: '10400_L0201' }],
    ['policySeq', '保單編號序號', 18, 5, 'X', { leftAlign: true, charset: ALNUM, charsetHint: '限大寫 A~Z、0~9，靠左、後補空白', typeRule: '10400_L0202' }],
    ['txnSeq', '異動序號', 23, 5, '9', { typeRule: '10400_L0301' }],
    ['idType', '證件種類', 28, 1, 'X', { codes: T.idType, codeTable: '表 3．1．5 證件類別代號表', typeRule: '10400_L0411', codeRule: '22900_L0411' }],
    ['idNo', '證件編號', 29, 10, 'X', { typeRule: '10400_L0421' }],
    amt('sumInsuredOrig', '保險金額(原幣金額)', 39, { notZero: true, typeRule: '10400_L0501' }),
    ['termType', '保險期間別', 57, 1, 'X', { notBlank: true, codes: keys(T.termType), codeTable: '表 3．1．8 保險期間別代號表', typeRule: '10400_L0611', codeRule: '20200_L0612' }],
    ['term', '保險期間', 58, 3, '9', { notZero: true, typeRule: '10400_L0711' }],
    ['birthDate', '出生日期', 61, 8, '9', { typeRule: '10400_L0811' }],
    ['sex', '性別', 69, 1, '9', { codes: keys(T.sex), codeTable: '性別代號(男 1/女 2)', typeRule: '10400_L0911', codeRule: '20300_L0902' }],
    ['medExam', '有無體檢', 70, 1, '9', { notZero: true, codes: keys(T.medExam), codeTable: '表 3．1．12 有無體檢代號表', typeRule: '10400_L1011', codeRule: '20400_L1012' }],
    ['examClass', '體檢類別', 71, 1, '9', { notZero: true, codes: keys(T.examClass), codeTable: '表 3．1．13 體檢類別代號表', typeRule: '10400_L1121', codeRule: '20500_L1122' }],
    ['substdReason', '次標準體原因', 72, 1, '9', { codes: keys(T.substd), codeTable: '表 3．1．14 次標準體原因代號表', typeRule: '10400_L1231', codeRule: '20600_L1232' }],
    ['addType', '加保別', 73, 3, 'X', { notBlank: true, codes: keys(T.addType), codeTable: '表 3．1．15 加保別代號表', typeRule: '10400_L1301', codeRule: '20700_L1302' }],
    ['addDate', '加保日期', 76, 8, '9', { typeRule: '10400_L1401' }],
    ['exitType', '退保別', 84, 3, 'X', { notBlank: true, codes: keys(T.exitType), codeTable: '表 3．1．17 退保別代號表', typeRule: '10400_L1501', codeRule: '20800_L1501' }],
    ['exitDate', '退保日期', 87, 8, '9', { typeRule: '10400_L1601' }],
    ['dividendClass', '保單分紅類別', 95, 1, 'X', { notZero: true, codes: T.dividend, codeTable: '表 3．1．19 保單分紅類別表', typeRule: '10400_L1701', codeRule: '20900_L1702' }],
    ['productClass', '保險商品類別編號', 96, 13, 'X', { notZero: true, charset: ALNUM, typeRule: '10400_L1801' }],
    ['startDate', '保險期間起日', 109, 8, '9', { notZero: true, typeRule: '10400_L1901' }],
    ['endDate', '保險期間迄日', 117, 8, '9', { notZero: true, typeRule: '10400_L2001' }],
    ['survivalType', '還本型態', 125, 1, '9', { codes: keys(T.survivalType), codeTable: '表 3．1．23 還本型態代號表', typeRule: '10400_L2101', codeRule: '21100_L2102' }],
    ['benefitType', '保單給付型態', 126, 1, '9', { typeRule: '10400_L2201' }],
    ['longevityAge', '祝壽保險金給付年齡', 127, 3, '9', { typeRule: '10400_L2301' }],
    ['screening', '有篩選被保險人性質的保單', 130, 1, '9', { typeRule: '10400_L2401' }],
    ['smoker', '吸煙及非吸煙', 131, 1, '9', { codes: keys(T.smoker), codeTable: '表 3．1．27 吸煙及非吸煙代號表', typeRule: '10400_L2501', codeRule: '21200_L2502' }],
    ['disabilityCat', '身心障礙類別', 132, 3, 'X', { codes: isDisabilityCat, codeTable: '表 3．1．28 身心障礙類別代號表', codeHint: '非身心障礙者填「000」；舊制 010~180、990；新制 A01~A08、M03~MFF', typeRule: '10400_L2601', codeRule: '21300_L2601' }],
    ['disabilityLevel', '身心障礙等級', 135, 1, '9', { codes: keys(T.disabilityLevel), codeTable: '表 3．1．29 身心障礙等級代號表', typeRule: '10400_L2701', codeRule: '21400_L2702' }],
    ['econStatus', '經濟弱勢者身分', 136, 1, 'X', { notBlank: true, codes: T.econ, codeTable: '表 3．1．30 經濟弱勢者身分代號表', codeHint: '非微型保單填「0」', typeRule: '10400_L2801', codeRule: '22700_L2802' }],
    ['groupLink', '集體投保之連結關係', 137, 1, 'X', { notBlank: true, codes: T.groupLink, codeTable: '表 3．1．31 集體投保之連結關係代號表', codeHint: '非集體投保微型保險填「0」', typeRule: '10400_L2901', codeRule: '22800_L2902' }],
    ['channel', '通路別', 138, 1, '9', { notZero: true, codes: keys(T.channel), codeTable: '表 3．1．32 通路別代號表', typeRule: '10400_L3001', codeRule: '21500_L3002' }],
    ['salesMethod', '招攬方式', 139, 1, '9', { notZero: true, codes: keys(T.salesMethod), codeTable: '表 3．1．33 招攬方式代號表', typeRule: '10400_L3101', codeRule: '21600_L3102' }],
    ['insuredRelation', '被保險人身份', 140, 1, '9', { codes: keys(T.relation), codeTable: '表 3．1．34 被保險人身份代號表', typeRule: '10400_L3201', codeRule: '21700_L3202' }],
    ['currency', '原幣別', 141, 3, 'X', { notBlank: true, codes: T.currency, codeTable: '表 3．1．35 幣別代號表', typeRule: '10400_L3301', codeRule: '21800_L3302' }],
    amt('illnessDeathOrig', '疾病身故保險金(原幣金額)', 144, { notZero: true, typeRule: '10400_L3401' }),
    ['occClass', '職業類別', 162, 1, '9', { codes: T.occClass, codeTable: '表 3．1．37 職業類別代號表', codeHint: '1~6 類；拒保填 8；適用特別費率填 9', typeRule: '10400_L3501', codeRule: '22500_L3502' }],
    ['productCode', '保險商品編號', 163, 15, 'X', { notBlank: true, notZero: true, charset: ALNUM, typeRule: '10400_L3601' }],
    ['companyPlanCode', '公司保單險種代號', 178, 20, 'X', { notBlank: true, typeRule: '10400_L3701' }],
    ['productCodeVer', '保險商品編號適用版本代號', 198, 1, 'X', { notZero: true, codes: keys(T.productVer), codeTable: '表 3．1．40 保險商品編號適用版本代號表', typeRule: '10400_L3801', codeRule: '21900_L3802' }],
    ['productCode2', '保險商品編號2', 199, 12, 'X', { notBlank: true, charset: ALNUM, typeRule: '10400_L3901' }],
    ['payFreq', '繳費期間別', 211, 1, 'X', { notBlank: true, codes: keys(T.payFreq), codeTable: '表 3．1．42 繳費期間別代號表', typeRule: '10400_L4001', codeRule: '22000_L4002' }],
    ['payTerm', '繳費期間', 212, 3, '9', { typeRule: '10400_L4101' }],
    ['paidMonths', '累計繳費月數', 215, 3, '9', { typeRule: '10400_L4201' }],
    ['lapseReason', '停(失)效原因', 218, 1, 'X', { codes: keys(T.lapse), codeTable: '表 3．1．45 停(失)效原因代號表', codeHint: '非停失效之異動填「N」', typeRule: '10400_L4301', codeRule: '22100_L4301' }],
    ['occCode', '職業分類代碼', 219, 8, 'X', { notBlank: true, charset: /^[0-9 ]*$/, charsetHint: '應為數字代碼，靠左', typeRule: '10400_L4401' }],
    ['ownerZip', '要保人住所郵遞區號', 227, 3, 'X', { codes: v => T.zip.includes(v) || v === '999' || v === '888', codeTable: '表 3．1．46 郵遞區號前 3 碼一覽表', typeRule: '10400_L4501', codeRule: '22200_L4502' }],
    ['insuredZip', '被保險人住所郵遞區號', 230, 3, 'X', { codes: v => T.zip.includes(v) || v === '999' || v === '888', codeTable: '表 3．1．46 郵遞區號前 3 碼一覽表', typeRule: '10400_L4601', codeRule: '22300_L4602' }],
    amt('totalPremOrig', '應繳總保費合計(原幣金額)', 233),
    amt('totalPremTwd', '應繳總保費合計(臺幣金額)', 251),
    amt('survivalAmtOrig', '生存還本保險金額(原幣金額)', 269),
    amt('survivalAmtTwd', '生存還本保險金額(臺幣金額)', 287),
    amt('longevityAmtOrig', '祝壽保險金額(原幣金額)', 305),
    amt('longevityAmtTwd', '祝壽保險金額(臺幣金額)', 323),
    amt('maturityAmtOrig', '滿期保險金額(原幣金額)', 341),
    amt('maturityAmtTwd', '滿期保險金額(臺幣金額)', 359),
    ['survivalCond', '生存還本金給付條件', 377, 1, '9', { codes: keys(T.survivalCond), codeTable: '表 3．1．54 生存還本金給付條件代號表' }],
    ['survivalFirstDate', '生存還本金初次給付日期', 378, 8, '9'],
    amt('sumInsuredTwd', '保險金額(臺幣金額)', 386, { notZero: true }),
    amt('illnessDeathTwd', '疾病身故保險金(臺幣金額)', 404, { notZero: true }),
    ['reserved', '保留欄位', 422, 4, 'X', { default: '0000' }],
  ], {
    fileName: { re: /^LFL\d{2}_\d{4}\.txt$/i, pattern: 'LFL公司代號_填報年度.txt', example: 'LFL01_2025.txt' },
    keyOf: r => (r.policyNo || '').trimEnd() + '/' + (r.policySeq || '').trimEnd(),
  });

  const D = layout('D', '給付資料檔', 225, [
    ['claimType', '給付類別', 1, 1, '9', { notZero: true, codes: keys(T.claimType), codeTable: '表 3．2．1 給付類別代號表', typeRule: '10400_D0101', codeRule: '23000_D0102' }],
    ['company', '公司代號', 2, 2, '9', { notZero: true, codes: keys(T.company), codeTable: '表 3．1．1 公司代號表', typeRule: '10400_D0201', codeRule: 'D0202' }],
    ['policyNo', '保單編號', 4, 15, 'X', { notBlank: true, notZero: true, leftAlign: true, charset: ALNUM, typeRule: '10400_D0301' }],
    ['policySeq', '保單編號序號', 19, 5, 'X', { leftAlign: true, charset: ALNUM, typeRule: '10400_D0321' }],
    ['idType', '證件種類', 24, 1, 'X', { notBlank: true, codes: T.idType, codeTable: '證件類別代號表', typeRule: '10400_D0411', codeRule: 'D0412' }],
    ['idNo', '證件編號', 25, 10, 'X', { notBlank: true, typeRule: '10400_D0421' }],
    ['termType', '保險期間別', 35, 1, 'X', { notBlank: true, codes: keys(T.termType), codeTable: '表 3．1．8 保險期間別代號表', typeRule: '10400_D0511', codeRule: 'D0512' }],
    ['term', '保險期間', 36, 3, '9', { notZero: true, typeRule: '10400_D0521' }],
    ['birthDate', '出生日期', 39, 8, '9', { typeRule: '10400_D0601' }],
    ['sex', '性別', 47, 1, '9', { codes: keys(T.sex), codeTable: '性別代號', typeRule: '10400_D0701', codeRule: 'D0702' }],
    ['medExam', '有無體檢', 48, 1, '9', { notZero: true, codes: keys(T.medExam), codeTable: '有無體檢代號表', typeRule: '10400_D0811', codeRule: 'D0812' }],
    ['examClass', '體檢類別', 49, 1, '9', { notZero: true, codes: keys(T.examClass), codeTable: '體檢類別代號表', typeRule: '10400_D0821', codeRule: 'D0822' }],
    ['substdReason', '次標準體原因', 50, 1, '9', { codes: keys(T.substd), codeTable: '次標準體原因代號表', typeRule: '10400_D0831', codeRule: 'D0832' }],
    ['startDate', '保險期間起日', 51, 8, '9', { notZero: true, typeRule: '10400_D0901' }],
    ['eventDate', '發生日期', 59, 8, '9', { notZero: true, typeRule: '10400_D1001' }],
    amt('dueAmtOrig', '應給付金額(原幣金額)', 67, { notZero: true, typeRule: '10400_D1101' }),
    amt('paidAmtOrig', '實際給付金額(原幣金額)', 85, { notZero: true, typeRule: '10400_D1201' }),
    ['diffReason', '應給付與實際給付金額不同原因', 103, 4, 'X', { notBlank: true, typeRule: '10400_D1301' }],
    ['causeIcd', '死亡及完全失能原因(ICD-10-CM)', 107, 5, 'X', { notBlank: true, charset: /^[A-Z0-9 ]*$/, typeRule: '10400_D1401' }],
    ['disabilityItem', '完全失能項次等級', 112, 8, 'X', { charset: /^[0-9]*$/, typeRule: '10400_D1501' }],
    ['productClass', '保險商品類別編號', 120, 13, 'X', { notZero: true, charset: ALNUM, typeRule: '10400_D1601' }],
    ['currency', '原幣別', 133, 3, 'X', { codes: T.currency, codeTable: '幣別代號表', typeRule: '10400_D1701', codeRule: 'D1701' }],
    ['payDate', '給付日期', 136, 8, '9', { notZero: true, typeRule: '10400_D1801' }],
    ['occClass', '事故時職業類別', 144, 1, 'X', { notBlank: true, codes: T.occClass, codeTable: '職業類別代號表', typeRule: '10400_D1901', codeRule: 'D1902' }],
    ['disabilityCat', '身心障礙類別', 145, 3, 'X', { notBlank: true, codes: isDisabilityCat, codeTable: '身心障礙類別代號表', typeRule: '10400_D2001', codeRule: 'D2002' }],
    ['disabilityLevel', '身心障礙等級', 148, 1, '9', { codes: keys(T.disabilityLevel), codeTable: '身心障礙等級代號表', typeRule: '10400_D2101', codeRule: 'D2102' }],
    ['companyPlanCode', '公司保單險種代號', 149, 20, 'X', { typeRule: '10400_D2201' }],
    ['payMethod', '給付方式', 169, 1, 'X', { codes: keys(T.payMethod), codeTable: '表 3．2．28 給付方式代號表' }],
    amt('dueAmtTwd', '應給付金額(臺幣金額)', 170, { notZero: true }),
    amt('paidAmtTwd', '實際給付金額(臺幣金額)', 188, { notZero: true }),
    ['reserved', '保留欄位', 206, 20, 'X', { default: '00000000000000000000' }],
  ], {
    fileName: { re: /^LFD\d{2}_\d{4}\.txt$/i, pattern: 'LFD公司代號_填報年度.txt', example: 'LFD01_2025.txt' },
    keyOf: r => (r.policyNo || '').trimEnd() + '/' + (r.policySeq || '').trimEnd(),
  });

  // ================= 規則目錄 =================
  const catalog = [];
  const R = (id, name, level, ref, severity) => catalog.push({ id, name, level, ref, severity: severity || 'error' });
  // 檔案層級
  R('F001', '檔名命名原則', '檔案', '參、一、資料總說明', 'warning');
  R('F002', '檔案為空', '檔案', '貳、二、(三) 文字檔基本檢測');
  R('F003', '不能有空白行', '檔案', '貳、二、(一) 文字檔資料格式 2');
  R('F004', '限使用半形英數字', '檔案', '貳、二、(一) 文字檔資料格式 3');
  R('10300', '每筆資料長度', '檔案', '承保檔 425 / 給付檔 225');
  // 承保 欄位型態 / 代碼 (自動產生)
  for (const f of L.fields) {
    if (f.typeRule) R(f.typeRule, `${f.name} 資料類型`, '資料類型', `承保欄 ${f.no}`);
    if (f.codeRule) R(f.codeRule, `${f.name} 代碼`, '代碼', `承保欄 ${f.no}；${f.codeTable}`);
  }
  for (const f of D.fields) {
    if (f.typeRule) R(f.typeRule, `${f.name} 資料類型`, '資料類型', `給付欄 ${f.no}`);
    if (f.codeRule) R(f.codeRule, `${f.name} 代碼`, '代碼', `給付欄 ${f.no}；${f.codeTable}`);
  }
  R('10400', '數字資料範圍錯誤', '資料類型', '肆、檢核程式項目及代碼表 104');
  R('20000', '代碼檢核', '代碼', '代碼表');
  // 承保 單筆
  R('L0422', '證件編號暫填 0000000000', '單筆', '承保欄 6', 'warning');
  R('L0501', '新契約臺幣基本型保額不得小於 1 萬元', '單筆', '承保欄 7');
  R('24901_L0613', '保險期間別=T 時保險期間≠999', '單筆', '承保欄 8/9');
  R('24902_L0613', '保險期間別=Y 時保險期間=999 或 ≥095', '單筆', '承保欄 8/9');
  R('24903_L0613', '保險期間別=B 時保險期間=001', '單筆', '承保欄 8/9');
  R('24904_L0613', '保險期間別=W/G 時保險期間合理', '單筆', '承保欄 8/9');
  R('24906_L0643', '繳費期間不得大於保險期間', '單筆', '承保欄 9/43');
  R('23900_L0802', '出生日期為合法日期', '單筆', '承保欄 10');
  R('25001_L1233', '次標準體原因=0 時體檢類別=1 或 3', '單筆', '承保欄 13/14');
  R('25002_L1233', '次標準體原因≠0 時體檢類別=2', '單筆', '承保欄 13/14');
  R('24801_L1303', '加保別 NEW/NCT 時異動序號為 00000 或 00001', '單筆', '承保欄 4/15');
  R('24802_L1304', '加保別=NEW 時加保日期≠0', '單筆', '承保欄 15/16');
  R('24803_L1304', '加保別=XED 時加保日期=0', '單筆', '承保欄 15/16');
  R('24804_L1304', '加保別≠XED 時加保日期≠0', '單筆', '承保欄 15/16');
  R('24805_L1307', '加保別=HCC 時危險分類欄位不可全為 0', '單筆', '承保欄 15/27~29');
  R('23900_L1402', '加保日期為合法日期', '單筆', '承保欄 16');
  R('26001_L1403', '加保日期 ≤ 退保日期', '單筆', '承保欄 16/18');
  R('26002_L1404', '加保日期介於保險期間起迄日', '單筆', '承保欄 16/21/22');
  R('26101_L1502', '加保別、退保別不能同時為 XED', '單筆', '承保欄 15/17');
  R('26102_L1503', '退保別=MAD 時退保日期=保險期間迄日', '單筆', '承保欄 17/18/22');
  R('26104_L1504', '退保別=XED 時退保日期=0；其餘退保日期≠0', '單筆', '承保欄 17/18');
  R('23900_L1602', '退保日期為合法日期', '單筆', '承保欄 18');
  R('26201_L1603', '退保日期不可超過滿期日', '單筆', '承保欄 18/22');
  R('26203_L1607', '退保日期 ≥ 加保日期', '單筆', '承保欄 16/18');
  R('L1605', '退保日期 ≥ 保險期間起日', '單筆', '承保欄 18/21');
  R('26700_L0303', '異動序號=00001 時退保別不可為終止類', '單筆', '承保欄 4/17');
  R('25102_L1703', '分紅類別 S/T/C/D/P/Q：起日 < 2004/01/01', '單筆', '承保欄 19/21');
  R('25101_L1704', '分紅類別 A/B/M/N/Y/X：起日 ≥ 2004/01/01', '單筆', '承保欄 19/21');
  R('21001_L1803', '保險商品類別編號編碼原則', '單筆', '承保欄 20；表 3．1．20');
  R('21003_L1804', '商品類別編號第 4、5 碼組合', '單筆', '承保欄 20');
  R('21008_L1805', '投資型/萬能型第 9-10 碼與第 4、8 碼', '單筆', '承保欄 20');
  R('21011_L1806', '商品類別編號第 4 碼與第 9-10 碼組合', '單筆', '承保欄 20');
  R('23900_L1902', '保險期間起日為合法日期', '單筆', '承保欄 21');
  R('24200_L1903', '保險期間起日 ≥ 出生日期', '單筆', '承保欄 10/21');
  R('24300_L1904', '加保別 NEW/NCT 時起日=加保日期', '單筆', '承保欄 16/21');
  R('23900_L2002', '保險期間迄日為合法日期', '單筆', '承保欄 22');
  R('25201_L2003', '保險期間迄日 > 起日', '單筆', '承保欄 21/22');
  R('25203_L2004', '歲滿期(W)迄日與出生日期、保險期間相符', '單筆', '承保欄 9/10/22', 'warning');
  R('25204_L2005', '年滿期(T)迄日=起日+保險期間-1天', '單筆', '承保欄 9/21/22');
  R('25301_L2103', '還本型態=1 且 W 時保險期間 <95', '單筆', '承保欄 23');
  R('25302_L2104', '還本型態=2 時保險期間為終身或 W≥95', '單筆', '承保欄 23');
  R('25303_L2105', '生存險/生死合險還本型態不為 0', '單筆', '承保欄 20/23');
  R('25304_L2106', '定期/終身壽險還本型態為 0', '單筆', '承保欄 20/23');
  R('26301_L2302', '有祝壽保險金時給付年齡 ≥95', '單筆', '承保欄 25/53');
  R('26302_L2303', '祝壽金給付年齡>0 時保險期間為終身', '單筆', '承保欄 8/25');
  R('24400_L2503', '吸煙分類≠0 時商品編碼第 17 碼=2', '單筆', '承保欄 27/41', 'warning');
  R('24601_L2703', '身障等級=0 時身障類別=000', '單筆', '承保欄 28/29');
  R('24602_L2703', '身障等級≠0 時身障類別≠000', '單筆', '承保欄 28/29');
  R('25501_L2803', '經濟弱勢身分≠0 時為微型保單(第 8 碼=4)', '單筆', '承保欄 20/30');
  R('25502_L2804', '經濟弱勢身分與集體投保連結關係', '單筆', '承保欄 30/31');
  R('25601_L2903', '集體投保連結關係≠0 時為微型保單', '單筆', '承保欄 20/31');
  R('25602_L2904', '集體投保連結關係≠0 時經濟弱勢身分≠0', '單筆', '承保欄 30/31');
  R('L3903', '商品編號版本=1 時編號2 全 0；=2 時不為全 0', '單筆', '承保欄 40/41');
  R('L3904', '起日 ≥ 2017/03/21 應使用 27 碼商品編號', '單筆', '承保欄 21/41', 'warning');
  R('25701_L4102', '繳費期間不能比保險期間大', '單筆', '承保欄 9/43');
  R('25702_L4103', '躉繳/彈性繳時繳費期間=000，其餘為年期', '單筆', '承保欄 42/43');
  R('25800_L4201', '停效/失效時累計繳費月數一定要有值', '單筆', '承保欄 17/44');
  R('25802_L4203', '累計繳費月數與理論值 vs 停失效原因', '單筆', '承保欄 44/45', 'warning');
  R('25805_L4202', '停(失)效原因與退保別一致', '單筆', '承保欄 17/45');
  R('L4401', '2015/03/01 後生效保單職業分類代碼不可為 00000000', '單筆', '承保欄 46');
  R('L4403', '職業類別 0/8 時職業分類代碼=00000000', '單筆', '承保欄 37/46');
  R('24701_L4501', '郵遞區號 999 僅限 2019 年前契約', '單筆', '承保欄 47/48');
  R('L4701', '彈性繳時應繳總保費合計=0', '單筆', '承保欄 42/49/50');
  R('L5501', '還本型態=0 時生存還本金給付條件=0', '單筆', '承保欄 23/57');
  R('L5601', '生存還本金初次給付日期為合法日期且 > 起日', '單筆', '承保欄 58');
  R('L6101', '保留欄位填 0000', '單筆', '承保欄 61', 'warning');
  // 承保 多筆
  R('30201_L0302', '保單只有一筆時異動序號=00000', '多筆', '承保欄 4');
  R('30202_L0302', '多筆異動時異動序號自 00001 起依序', '多筆', '承保欄 4');
  R('K0001', '主鍵重複 (保單號碼+異動序號)', '多筆', 'key 值');
  R('30245_P1307', '加保別 NEW 只會出現 1 次且為第一筆', '多筆', '承保欄 15');
  R('30212_L1305', '加保別=上一筆退保別，加保日=上一筆退保日', '多筆', '承保欄 15~18');
  R('30213_L1306', '上一筆退保別=LNN 時本筆加保別=RNN', '多筆', '承保欄 15/17');
  R('30214_L1306', '加保別=RNN 時上一筆退保別=LNN', '多筆', '承保欄 15/17');
  R('30222_P1401', '加保日期 ≥ 上一筆退保日期', '多筆', '承保欄 16/18');
  R('30228_P1504', '終止類退保別應為保單最後一筆', '多筆', '承保欄 17');
  R('30233_P1601', '退保日期 ≥ 上一筆退保日期', '多筆', '承保欄 18');
  R('30205_P0502', '加保別=INN 時保額 > 上一筆', '多筆', '承保欄 7/15');
  R('30206_P0503', '加保別=DNN 時保額 < 上一筆', '多筆', '承保欄 7/15');
  R('30215_P3401', '疾病身故保險金上下一致 (INN/DNN/INV 除外)', '多筆', '承保欄 36');
  R('30217_P1302', '加保別=HCC 時危險分類或職業類別須有變動', '多筆', '承保欄 27~29/37');
  R('30234_P2601', '身障類別上下一致 (HCC 除外)', '多筆', '承保欄 28');
  R('30235_P2701', '身障等級上下一致 (HCC 除外)', '多筆', '承保欄 29');
  R('30203_P1801', '展期(ROL)後商品類別編號才能為 ETI', '多筆', '承保欄 20');
  R('30210_P0702', '展期時保險期間 ≤ 上一筆', '多筆', '承保欄 9');
  R('30402_P1508', '退保別=HLM 時到達年齡=祝壽保險金給付年齡', '多筆', '承保欄 18/25', 'warning');
  R('LINS', '加保別=INS 時保額欄位與上一筆相同', '多筆', '承保欄 7/36/59/60');
  const SAME = [
    ['company', '30101_P0101'], ['sex', '30107_P0901'], ['birthDate', '30108_P0801'], ['medExam', '30109_P1011'],
    ['examClass', '30110_P1121'], ['substdReason', '30114_P1231'], ['startDate', '30104_P1901'], ['currency', '30113_P3301'],
    ['econStatus', '30123_P2801'], ['groupLink', '30124_P2901'], ['channel', '30102_P3001'], ['salesMethod', '30103_P3101'],
    ['idNo', '30106_P0421'],
  ];
  const SAME_EXCEPT = [
    ['termType', '30208_P0611', ['ROL', 'CTC']], ['term', '30209_P0701', ['ROL', 'CTC']],
    ['dividendClass', '30115_P1701', ['CTC']], ['endDate', '30231_P2001', ['ROL', 'CTC']],
    ['survivalType', '30117_P1801', ['ROL', 'CTC']], ['longevityAge', '30121_P2301', ['ROL', 'CTC']],
    ['productCodeVer', 'LU3801', ['CTC']],
  ];
  for (const [k, id] of SAME) R(id, `${L.field(k).name}上下筆相同`, '多筆', `承保欄 ${L.field(k).no}`);
  for (const [k, id, ex] of SAME_EXCEPT) R(id, `${L.field(k).name}上下筆相同 (${ex.join('/')} 除外)`, '多筆', `承保欄 ${L.field(k).no}`);
  // 給付 單筆
  R('26501_D0103', '給付類別與完全失能項次相呼應', '單筆', '給付欄 1/20');
  R('D0513', '保險期間別與保險期間相符', '單筆', '給付欄 7/8', 'warning');
  R('23900_D0601', '出生日期為合法日期', '單筆', '給付欄 9');
  R('26800_D0602', '出生日期 ≤ 保險期間起日', '單筆', '給付欄 9/14');
  R('25001_D0831', '次標準體原因與體檢類別相符', '單筆', '給付欄 12/13');
  R('23900_D0901', '保險期間起日為合法日期', '單筆', '給付欄 14');
  R('23900_D1001', '發生日期為合法日期', '單筆', '給付欄 15');
  R('26600_D1002', '發生日期 > 保險期間起日', '單筆', '給付欄 14/15');
  R('23100_D1302', '不同原因代號', '單筆', '給付欄 18；表 3．2．18');
  R('24101_D1303', '不同原因與應付/實付金額一致', '單筆', '給付欄 16~18');
  R('26901_D1402', '死亡/失能給付須填 ICD-10-CM；其他給付填 00000', '單筆', '給付欄 19');
  R('D1601', '保險商品類別編號編碼原則', '單筆', '給付欄 21');
  R('23900_D1802', '給付日期為合法日期', '單筆', '給付欄 23');
  R('26400_D1803', '給付日期 ≥ 發生日期', '單筆', '給付欄 15/23');
  R('D2003', '身障類別與身障等級同時為 0 或同時不為 0', '單筆', '給付欄 25/26');
  // 跨檔
  R('30301_LD012', '死亡/失能/生命末期退保須有給付資料', '跨檔', 'LD00-01');
  R('30307_LD013', '給付資料須有對應承保資料', '跨檔', 'LD00-02');
  R('30304_LD014', '退保別 DEA/ADS 須有給付類別=1', '跨檔', 'LD00-03');
  R('30305_LD015', '退保別 TDI/ATS 須有給付類別=2', '跨檔', 'LD00-04');
  R('30306_LD016', '退保別 ABD 須有給付類別=3', '跨檔', 'LD00-05');
  R('30311_LD018', '給付類別與承保退保別一致', '跨檔', 'LD00-07/09/11');
  R('30312_LD019', '承保退保日期=給付發生日期', '跨檔', 'LD00-08/10/12');
  R('LD00-13', '退保別 SIB/HLM/MAB 須有給付類別 4/5/6', '跨檔', 'LD00-13~15');
  R('LD00-16', '祝壽金給付時到達年齡 ≥ 祝壽保險金給付年齡', '跨檔', 'LD00-16');
  R('30308_LD000', '給付檔欄位=事故時承保檔欄位', '跨檔', 'LD01~LD13');
  R('30309_LD012', '疾病死亡應給付金額=疾病身故保險金', '跨檔', 'LD11', 'warning');
  R('26904_D1402', '外因(V~Y)死亡/失能退保別應為意外類', '跨檔', 'D1402');
  // 擴充：邏輯合理性
  R('X001', '臺幣保單原幣金額應等於臺幣金額', '邏輯合理性', '本工具補充', 'warning');
  R('X002', '投保年齡合理範圍 (0~100 歲)', '邏輯合理性', '本工具補充', 'warning');
  R('X003', '保額異常偏高 (> 新臺幣 5 億)', '邏輯合理性', '本工具補充', 'warning');
  R('X004', '應繳總保費不應大於保額 3 倍 (非躉繳)', '邏輯合理性', '本工具補充', 'warning');

  // ================= 單筆檢核：承保 =================
  const dateOk = v => v && isValidDate(v);
  const nz = v => v && !isZero(v);
  const recordL = [];
  const rl = fn => recordL.push(fn);

  // 證件編號
  rl((r, p) => { if (r.idNo !== '0000000000') p({ ruleId: 'L0422', category: '單筆邏輯', fields: ['idNo'], value: r.idNo, message: '證件編號目前規定暫填「0000000000」(個資保護)', suggestion: '改為 0000000000', fix: { field: 'idNo', value: '0000000000' } }); });
  // 保額下限
  rl((r, p) => {
    if (r.addType === 'NEW' && r.currency === 'NTD' && r.productClass.slice(8, 10) === '1A' && big(r.sumInsuredOrig) !== null && big(r.sumInsuredOrig) < 1000000n)
      p({ ruleId: 'L0501', category: '單筆邏輯', fields: ['sumInsuredOrig'], value: C.fmtAmount(r.sumInsuredOrig), message: '新契約臺幣基本型保單保額不得小於 1 萬元', suggestion: '請確認金額是否漏乘 100 (欄位含兩位小數，不含小數點)' });
  });
  // 保險期間別 vs 保險期間
  rl((r, p) => {
    const t = num(r.term); if (isNaN(t)) return;
    const f = ['termType', 'term'], v = `${r.termType}/${r.term}`;
    if (r.termType === 'T' && t === 999) p({ ruleId: '24901_L0613', category: '單筆邏輯', fields: f, value: v, message: '年滿期(T)保險期間不可為 999', suggestion: '填入年期，如 010、020' });
    if (r.termType === 'Y' && !(t === 999 || t >= 95)) p({ ruleId: '24902_L0613', category: '單筆邏輯', fields: f, value: v, message: '終身(Y)保險期間應為 999 或 ≥095', suggestion: '改為 999 或最終保險年齡', fix: { field: 'term', value: '999' } });
    if (r.termType === 'B' && t !== 1) p({ ruleId: '24903_L0613', category: '單筆邏輯', fields: f, value: v, message: '一年期(B)保險期間應為 001', suggestion: '改為 001', fix: { field: 'term', value: '001' } });
    if (r.termType === 'G' && !(t > 1 && t < 94)) p({ ruleId: '24904_L0613', category: '單筆邏輯', fields: f, value: v, message: '一年期保證續保(G)保險期間應為續保最終年齡 (002~093)', suggestion: '填入保證續保最終年齡，如 065' });
    if (r.termType === 'W' && !(t > 1 && t <= 150)) p({ ruleId: '24904_L0613', category: '單筆邏輯', fields: f, value: v, message: '歲滿期(W)保險期間應為滿期歲數', suggestion: '填入滿期歲數，如 060、065' });
    // 繳費期間不得大於保險期間 (皆為年期數字、保險期間非 999 終身時)：常見於繳費年期誤填
    const pt = num(r.payTerm);
    if (t !== 999 && t > 0 && !isNaN(pt) && pt > 0 && pt > t)
      p({ ruleId: '24906_L0643', category: '單筆邏輯', fields: ['term', 'payTerm'], value: `保險期間 ${r.term} / 繳費期間 ${r.payTerm}`, message: `繳費期間 ${pt} 年不得大於保險期間 ${t} 年`, suggestion: '繳費期間應小於或等於保險期間；請確認是否誤填' });
  });
  // 出生日期
  rl((r, p) => { if (!dateOk(r.birthDate)) p({ ruleId: '23900_L0802', category: '格式', fields: ['birthDate'], value: r.birthDate, message: '出生日期不是合法日期 (YYYYMMDD，需考慮大小月與閏年)', suggestion: '請確認是否誤填民國年或月日顛倒' + (/^0\d{7}$/.test(r.birthDate) || +r.birthDate.slice(0, 4) < 200 ? `；疑似民國年，西元應為 ${+r.birthDate.slice(0, 4) + 1911}${r.birthDate.slice(4)}` : '') }); });
  // 次標準體
  rl((r, p) => {
    if (r.substdReason === '0' && !['1', '3'].includes(r.examClass)) p({ ruleId: '25001_L1233', category: '單筆邏輯', fields: ['substdReason', 'examClass'], value: `${r.substdReason}/${r.examClass}`, message: '次標準體原因=0 時，體檢類別應為 1(標準體)或 3(優體)', suggestion: '若為次標準體請填寫次標準體原因 (1/2/8/9)' });
    if (r.substdReason !== '0' && /^\d$/.test(r.substdReason) && r.examClass !== '2') p({ ruleId: '25002_L1233', category: '單筆邏輯', fields: ['substdReason', 'examClass'], value: `${r.substdReason}/${r.examClass}`, message: '有次標準體原因時，體檢類別應為 2(次標準體)', suggestion: r.examClass === '1' || r.examClass === '3' ? '若為標準/優體，次標準體原因應填 0' : '請確認體檢類別', fix: ['1', '3'].includes(r.examClass) ? { field: 'substdReason', value: '0' } : null });
  });
  // 加保別
  rl((r, p) => {
    if (['NEW', 'NCT'].includes(r.addType) && !['00000', '00001'].includes(r.txnSeq)) p({ ruleId: '24801_L1303', category: '單筆邏輯', fields: ['addType', 'txnSeq'], value: `${r.addType}/${r.txnSeq}`, message: `加保別=${r.addType} 應為保單第 1 筆 (異動序號 00000 或 00001)`, suggestion: '檢查異動序號排序或加保別是否誤植' });
    if (r.addType === 'NEW' && isZero(r.addDate)) p({ ruleId: '24802_L1304', category: '缺漏', fields: ['addDate'], value: r.addDate, message: '新契約(NEW)加保日期不可為 0', suggestion: r.startDate && dateOk(r.startDate) ? `新契約加保日期通常=保險期間起日 ${r.startDate}` : '請補上加保日期', fix: dateOk(r.startDate) ? { field: 'addDate', value: r.startDate } : null });
    else if (PERIOD_END.includes(r.addType) && !isZero(r.addDate)) p({ ruleId: '24803_L1304', category: '單筆邏輯', fields: ['addDate'], value: r.addDate, message: `加保別=${r.addType}(持續有效)時加保日期應為 00000000`, suggestion: '改為 00000000', fix: { field: 'addDate', value: '00000000' } });
    else if (!PERIOD_END.includes(r.addType) && r.addType !== 'NEW' && isZero(r.addDate)) p({ ruleId: '24804_L1304', category: '缺漏', fields: ['addDate'], value: r.addDate, message: `加保別=${r.addType} 時加保日期不可為 0`, suggestion: '填入異動發生日期 (應=上一筆退保日期)' });
    if (r.addType === 'HCC' && r.smoker === '0' && r.disabilityCat === '000' && r.disabilityLevel === '0') p({ ruleId: '24805_L1307', category: '單筆邏輯', fields: ['addType', 'smoker', 'disabilityCat', 'disabilityLevel'], value: 'HCC', message: '危險分類欄位變更(HCC)時，危險分類欄位不能全部為 0', suggestion: '確認吸煙、身障類別/等級是否漏填' });
  });
  // 加保日期
  rl((r, p) => {
    if (!isZero(r.addDate) && !dateOk(r.addDate)) return p({ ruleId: '23900_L1402', category: '格式', fields: ['addDate'], value: r.addDate, message: '加保日期不是合法日期', suggestion: '格式 YYYYMMDD (西元)' });
    if (nz(r.addDate) && nz(r.exitDate) && dateOk(r.exitDate) && r.addDate > r.exitDate) p({ ruleId: '26001_L1403', category: '單筆邏輯', fields: ['addDate', 'exitDate'], value: `${r.addDate} > ${r.exitDate}`, message: '加保日期不能大於退保日期', suggestion: '檢查兩日期是否填反' });
    if (nz(r.addDate) && dateOk(r.startDate) && dateOk(r.endDate) && (r.addDate < r.startDate || r.addDate > r.endDate)) p({ ruleId: '26002_L1404', category: '單筆邏輯', fields: ['addDate', 'startDate', 'endDate'], value: r.addDate, message: `加保日期應介於保險期間 ${r.startDate}~${r.endDate}`, suggestion: '確認加保日期或保險期間起迄日' });
  });
  // 退保別 / 退保日期
  rl((r, p) => {
    if (r.addType === 'XED' && r.exitType === 'XED') p({ ruleId: '26101_L1502', category: '單筆邏輯', fields: ['addType', 'exitType'], value: 'XED/XED', message: '加保別、退保別不能同時為 XED', suggestion: '期初有效且期末仍有效之保單，加保別 XED、退保別應改為 EOY 或補報異動' });
    if (PERIOD_END.includes(r.exitType) && !isZero(r.exitDate)) p({ ruleId: '26104_L1504', category: '單筆邏輯', fields: ['exitType', 'exitDate'], value: r.exitDate, message: `退保別=${r.exitType}(期末有效)時退保日期應為 00000000`, suggestion: '改為 00000000', fix: { field: 'exitDate', value: '00000000' } });
    if (!PERIOD_END.includes(r.exitType) && keys(T.exitType).includes(r.exitType) && isZero(r.exitDate)) p({ ruleId: '26104_L1504', category: '缺漏', fields: ['exitType', 'exitDate'], value: r.exitDate, message: `退保別=${r.exitType} 時退保日期不可為 0`, suggestion: r.exitType === 'MAD' && dateOk(r.endDate) ? `滿期退保日期應=保險期間迄日 ${r.endDate}` : '填入異動發生日期', fix: r.exitType === 'MAD' && dateOk(r.endDate) ? { field: 'exitDate', value: r.endDate } : null });
    if (isZero(r.exitDate)) return;
    if (!dateOk(r.exitDate)) return p({ ruleId: '23900_L1602', category: '格式', fields: ['exitDate'], value: r.exitDate, message: '退保日期不是合法日期', suggestion: '格式 YYYYMMDD (西元)' });
    if (r.exitType === 'MAD' && dateOk(r.endDate) && r.exitDate !== r.endDate) p({ ruleId: '26102_L1503', category: '單筆邏輯', fields: ['exitDate', 'endDate'], value: `${r.exitDate} vs ${r.endDate}`, message: '滿期(MAD)時退保日期應等於保險期間迄日', suggestion: `改為 ${r.endDate}`, fix: { field: 'exitDate', value: r.endDate } });
    else if (dateOk(r.endDate) && r.exitDate > r.endDate) p({ ruleId: '26201_L1603', category: '單筆邏輯', fields: ['exitDate', 'endDate'], value: `${r.exitDate} > ${r.endDate}`, message: '退保日期超過保險期間迄日 (已過滿期點)', suggestion: '確認是否應為滿期(MAD)或迄日填錯' });
    if (dateOk(r.startDate) && r.exitDate < r.startDate) p({ ruleId: 'L1605', category: '單筆邏輯', fields: ['exitDate', 'startDate'], value: `${r.exitDate} < ${r.startDate}`, message: '退保日期早於保險期間起日', suggestion: '確認退保日期' });
    if (nz(r.addDate) && dateOk(r.addDate) && r.exitDate < r.addDate) p({ ruleId: '26203_L1607', category: '單筆邏輯', fields: ['exitDate', 'addDate'], value: `${r.exitDate} < ${r.addDate}`, message: '退保日期早於加保日期', suggestion: '檢查兩日期是否填反' });
  });
  rl((r, p) => { if (r.txnSeq === '00001' && FIRST_NOT.includes(r.exitType)) p({ ruleId: '26700_L0303', category: '單筆邏輯', fields: ['txnSeq', 'exitType'], value: `${r.txnSeq}/${r.exitType}`, message: `多筆保單的第一筆(00001)退保別不可為 ${r.exitType}(${T.exitType[r.exitType]})`, suggestion: '若保單僅此一筆，異動序號應為 00000' }); });
  // 分紅類別 vs 起日
  rl((r, p) => {
    if (!dateOk(r.startDate)) return;
    const before = r.startDate < '20040101';
    if (['S', 'T', 'C', 'D', 'P', 'Q'].includes(r.dividendClass) && !before) p({ ruleId: '25102_L1703', category: '單筆邏輯', fields: ['dividendClass', 'startDate'], value: `${r.dividendClass}/${r.startDate}`, message: `分紅類別 ${r.dividendClass} 僅適用民國 93 年(2004)前起保之保單`, suggestion: r.dividendClass === 'S' || r.dividendClass === 'T' ? '2004 年後強制分紅保單應填 Y/X；分紅 A/B；不分紅 M/N' : '請依表 3．1．19 重新判斷' });
    if (['A', 'B', 'M', 'N', 'Y', 'X'].includes(r.dividendClass) && before) p({ ruleId: '25101_L1704', category: '單筆邏輯', fields: ['dividendClass', 'startDate'], value: `${r.dividendClass}/${r.startDate}`, message: `分紅類別 ${r.dividendClass} 僅適用民國 93 年(2004)起保之保單`, suggestion: '2004 年前起保：強制分紅 S/T、分紅 C/D、不分紅 P/Q' });
  });
  // 保險商品類別編號
  // 承保檔依手冊分別回報：21001 基本編碼、21003 第 4/5 碼組合、21008 投資型/萬能第 9-10 碼、21011 第 4 碼=2 的第 9-10 碼；給付檔統一回報 D1601
  function checkProductClass(pc, company, p, ids, sub) {
    const c = pc;
    if (c.trim().length !== 13) return;
    const errs = { base: [], p45: [], inv: [], mix2: [] };
    if (c[0] !== '2') errs.base.push('第 1 碼應為「2」(壽險業)');
    const alias = T.companyAlias[company] || [company];
    if (!alias.includes(c.slice(1, 3))) errs.base.push(`第 2-3 碼「${c.slice(1, 3)}」應為公司代號 ${alias.join('/')}`);
    if (!'1234'.includes(c[3])) errs.base.push(`第 4 碼險別大分類「${c[3]}」應為 1~4`);
    else if (!P5_BY_P4[c[3]].includes(c[4])) errs.p45.push(`第 4 碼=${c[3]} 時第 5 碼應為 ${P5_BY_P4[c[3]].split('').join('/')}`);
    if (!'12'.includes(c[5])) errs.base.push(`第 6 碼「${c[5]}」應為 1(個人)或 2(連生)`);
    if (!'MRA'.includes(c[6])) errs.base.push(`第 7 碼「${c[6]}」應為 M/R/A`);
    if (!'1234'.includes(c[7])) errs.base.push(`第 8 碼「${c[7]}」應為 1~4`);
    const mix = c.slice(8, 10);
    if (MIX_P4[c[3]] && !MIX_P4[c[3]].includes(mix)) errs[c[3] === '2' ? 'mix2' : 'base'].push(`第 4 碼=${c[3]} 時第 9-10 碼「${mix}」應為 ${MIX_P4[c[3]].join('/')}`);
    if (['IA', 'IB'].includes(mix) && !(c[3] === '1' && c[7] === '3')) errs.inv.push('第 9-10 碼=IA/IB(投資型)時第 4 碼應=1 且第 8 碼=3');
    if (['UA', 'UB'].includes(mix) && !(c[3] === '1' && '12'.includes(c[7]))) errs.inv.push('第 9-10 碼=UA/UB(萬能)時第 4 碼應=1 且第 8 碼=1 或 2');
    if (c.slice(10, 13) === 'ETI' && c[4] !== '3') errs.base.push('第 11-13 碼=ETI(展期)時第 5 碼應=3(定期壽險)');
    const groups = sub ? [[ids, errs.base], [sub.p45, errs.p45], [sub.inv, errs.inv], [sub.mix2, errs.mix2]] : [[ids, [].concat(errs.base, errs.p45, errs.inv, errs.mix2)]];
    for (const [id, list] of groups) if (list.length) p({ ruleId: id, category: '單筆邏輯', fields: ['productClass'], value: c, message: '保險商品類別編號不符編碼原則：' + list.join('；'), suggestion: '請依表 3．1．20 保險商品類別編號表重編' });
  }
  rl((r, p) => checkProductClass(r.productClass, r.company, p, '21001_L1803', { p45: '21003_L1804', inv: '21008_L1805', mix2: '21011_L1806' }));
  // 起迄日
  rl((r, p) => {
    if (!dateOk(r.startDate)) return isZero(r.startDate) ? null : p({ ruleId: '23900_L1902', category: '格式', fields: ['startDate'], value: r.startDate, message: '保險期間起日不是合法日期', suggestion: '格式 YYYYMMDD (西元)' });
    if (dateOk(r.birthDate) && r.startDate < r.birthDate) {
      // 婦嬰險放寬：出生前一年內
      if (!(r.startDate >= addYearsMinusDay(r.birthDate, -1))) p({ ruleId: '24200_L1903', category: '單筆邏輯', fields: ['startDate', 'birthDate'], value: `${r.startDate} < ${r.birthDate}`, message: '保險期間起日早於出生日期', suggestion: '確認出生日期 (常見：誤植民國年、年份差 1)' });
    }
    if (['NEW', 'NCT'].includes(r.addType) && nz(r.addDate) && r.addDate !== r.startDate) p({ ruleId: '24300_L1904', category: '單筆邏輯', fields: ['startDate', 'addDate'], value: `${r.startDate} vs ${r.addDate}`, message: `加保別=${r.addType} 時保險期間起日應等於加保日期`, suggestion: `確認何者正確；若起日正確，加保日期改為 ${r.startDate}`, fix: { field: 'addDate', value: r.startDate } });
    if (!dateOk(r.endDate)) return isZero(r.endDate) ? null : p({ ruleId: '23900_L2002', category: '格式', fields: ['endDate'], value: r.endDate, message: '保險期間迄日不是合法日期', suggestion: '格式 YYYYMMDD (西元)' });
    if (r.endDate <= r.startDate) return p({ ruleId: '25201_L2003', category: '單筆邏輯', fields: ['startDate', 'endDate'], value: `${r.startDate}~${r.endDate}`, message: '保險期間迄日應大於起日', suggestion: '檢查兩日期是否填反' });
    const t = num(r.term);
    if (r.termType === 'T' && t && t !== 999) {
      const exp = addYearsMinusDay(r.startDate, t);
      if (r.endDate !== exp) p({ ruleId: '25204_L2005', category: '單筆邏輯', fields: ['endDate', 'startDate', 'term'], value: r.endDate, message: `年滿期 ${t} 年，迄日應為起日+${t}年-1天 = ${exp}`, suggestion: `改為 ${exp}`, fix: { field: 'endDate', value: exp } });
    }
    if (r.termType === 'B') {
      const exp = addYearsMinusDay(r.startDate, 1);
      if (r.endDate !== exp) p({ ruleId: '25204_L2005', category: '單筆邏輯', fields: ['endDate'], value: r.endDate, message: `一年期迄日應為 ${exp}`, suggestion: `改為 ${exp}`, fix: { field: 'endDate', value: exp } });
    }
    if (r.termType === 'W' && t && dateOk(r.birthDate)) {
      const a = ageAt(r.birthDate, r.endDate);
      if (a < t - 1 || a > t) p({ ruleId: '25203_L2004', category: '單筆邏輯', fields: ['endDate', 'birthDate', 'term'], value: r.endDate, message: `歲滿期 ${t} 歲，但迄日時被保險人為 ${a} 歲`, suggestion: '確認迄日、出生日期或保險期間' });
    }
  });
  // 還本型態
  rl((r, p) => {
    const t = num(r.term), p45 = r.productClass.slice(3, 5), s = r.survivalType;
    if (s === '1' && r.termType === 'W' && t >= 95) p({ ruleId: '25301_L2103', category: '單筆邏輯', fields: ['survivalType', 'term'], value: `${s}/${r.termType}${r.term}`, message: '定期還本(1)且歲滿期時保險期間需 <95', suggestion: '若還本至 95 歲以上應為終身還本(2)' });
    if (s === '2' && !(r.termType === 'Y' || (r.termType === 'W' && t >= 95))) p({ ruleId: '25302_L2104', category: '單筆邏輯', fields: ['survivalType', 'termType'], value: `${s}/${r.termType}${r.term}`, message: '終身還本(2)時保險期間別應為 Y，或 W 且 ≥95', suggestion: '確認還本型態或保險期間別' });
    if (['11', '12'].includes(p45) && s === '0') p({ ruleId: '25303_L2105', category: '單筆邏輯', fields: ['survivalType', 'productClass'], value: `${s}/${p45}`, message: `商品類別第 4-5 碼=${p45}(${p45 === '11' ? '生存險' : '生死合險'})時還本型態不為 0`, suggestion: '依商品條款填 1/2/3' });
    if (['13', '14'].includes(p45) && s !== '0' && /^\d$/.test(s)) p({ ruleId: '25304_L2106', category: '單筆邏輯', fields: ['survivalType', 'productClass'], value: `${s}/${p45}`, message: `商品類別第 4-5 碼=${p45}(${p45 === '13' ? '定期壽險' : '終身壽險'})時還本型態必為 0`, suggestion: '改為 0，或確認商品類別編號', fix: { field: 'survivalType', value: '0' } });
  });
  // 祝壽金年齡
  rl((r, p) => {
    const a = num(r.longevityAge); if (isNaN(a)) return;
    const active = r.addDate >= '20240101' || r.exitDate >= '20240101';
    if (active && a !== 999 && (nz(r.longevityAmtOrig) || nz(r.longevityAmtTwd)) && a < 95) p({ ruleId: '26301_L2302', category: '單筆邏輯', fields: ['longevityAge', 'longevityAmtOrig'], value: r.longevityAge, message: '有祝壽保險金額時，祝壽保險金給付年齡應 ≥095', suggestion: '95 歲前給付者屬滿期金，應填於滿期保險金額欄' });
    if (a > 0 && !(r.termType === 'Y' || (r.termType === 'W' && num(r.term) > 94))) p({ ruleId: '26302_L2303', category: '單筆邏輯', fields: ['longevityAge', 'termType'], value: `${r.longevityAge}/${r.termType}`, message: '祝壽保險金給付年齡>0 時，保險期間別應為終身(Y)或 W 且 >94', suggestion: '無祝壽金者填 000', fix: { field: 'longevityAge', value: '000' } });
  });
  rl((r, p) => { if (r.smoker !== '0' && r.productCodeVer === '2' && /^[A-Z0-9]{12}$/.test(r.productCode2) && r.productCode2[1] !== '2') p({ ruleId: '24400_L2503', category: '單筆邏輯', fields: ['smoker', 'productCode2'], value: `${r.smoker}/${r.productCode2}`, message: '吸煙分類≠0 時，商品編碼第 17 碼應為 2', suggestion: '若商品未區分吸煙，吸煙及非吸煙欄應填 0' }); });
  // 身障
  rl((r, p) => {
    if (r.disabilityLevel === '0' && r.disabilityCat !== '000') p({ ruleId: '24601_L2703', category: '單筆邏輯', fields: ['disabilityCat', 'disabilityLevel'], value: `${r.disabilityCat}/${r.disabilityLevel}`, message: '身障等級=0 時身障類別應=000', suggestion: '補填身障等級，或將類別改為 000' });
    if (/^[1-4]$/.test(r.disabilityLevel) && r.disabilityCat === '000') p({ ruleId: '24602_L2703', category: '單筆邏輯', fields: ['disabilityCat', 'disabilityLevel'], value: `${r.disabilityCat}/${r.disabilityLevel}`, message: '身障等級≠0 時身障類別不可為 000', suggestion: '補填身障類別' });
  });
  // 微型保單
  rl((r, p) => {
    const micro = r.productClass[7] === '4';
    if (micro && !T.econ.includes(r.econStatus)) p({ ruleId: '25502_L2804', category: '單筆邏輯', fields: ['econStatus', 'productClass'], value: r.econStatus, message: '微型保單 (商品類別第 8 碼=4) 的經濟弱勢者身分應為表 3．1．30 的代號', suggestion: '依經濟弱勢者身分代號表填寫' });
    if (r.econStatus !== '0' && T.econ.includes(r.econStatus) && !micro) p({ ruleId: '25501_L2803', category: '單筆邏輯', fields: ['econStatus', 'productClass'], value: r.econStatus, message: '經濟弱勢者身分僅適用微型保單 (商品類別第 8 碼=4)', suggestion: '非微型保單此欄應填 0', fix: { field: 'econStatus', value: '0' } });
    if (r.groupLink !== '0' && T.groupLink.includes(r.groupLink) && !micro) p({ ruleId: '25601_L2903', category: '單筆邏輯', fields: ['groupLink', 'productClass'], value: r.groupLink, message: '集體投保之連結關係僅適用微型保單 (第 8 碼=4)', suggestion: '非微型保單此欄應填 0', fix: { field: 'groupLink', value: '0' } });
    if (r.groupLink !== '0' && T.groupLink.includes(r.groupLink) && r.econStatus === '0') p({ ruleId: '25602_L2904', category: '單筆邏輯', fields: ['groupLink', 'econStatus'], value: `${r.groupLink}/${r.econStatus}`, message: '集體投保之連結關係≠0 時經濟弱勢身分不可為 0', suggestion: '補填經濟弱勢者身分代號' });
  });
  // 商品編號版本
  rl((r, p) => {
    if (r.productCodeVer === '1' && r.productCode2 !== '000000000000') p({ ruleId: 'L3903', category: '單筆邏輯', fields: ['productCodeVer', 'productCode2'], value: r.productCode2, message: '版本代號=1(15 碼)時保險商品編號2應為 000000000000', suggestion: '改為 000000000000，或版本代號應為 2', fix: { field: 'productCode2', value: '000000000000' } });
    if (r.productCodeVer === '2' && r.productCode2 === '000000000000') p({ ruleId: 'L3903', category: '缺漏', fields: ['productCodeVer', 'productCode2'], value: r.productCode2, message: '版本代號=2(27 碼)時保險商品編號2不可為全 0', suggestion: '填入保險商品資料庫商品編號第 16~27 碼' });
    if (dateOk(r.startDate) && r.startDate >= '20170321' && r.productCodeVer === '1') p({ ruleId: 'L3904', category: '單筆邏輯', fields: ['productCodeVer', 'startDate'], value: `${r.productCodeVer}/${r.startDate}`, message: '2017/03/21 後起保之保單應使用 27 碼商品編號(版本代號 2)', suggestion: '確認保險商品資料庫之商品編號' });
  });
  // 繳費
  rl((r, p) => {
    const pt = num(r.payTerm), t = num(r.term);
    if (['0', '5'].includes(r.payFreq) && pt !== 0) p({ ruleId: '25702_L4103', category: '單筆邏輯', fields: ['payFreq', 'payTerm'], value: `${r.payFreq}/${r.payTerm}`, message: `繳費期間別=${r.payFreq}(${T.payFreq[r.payFreq]})時繳費期間應為 000`, suggestion: '改為 000', fix: { field: 'payTerm', value: '000' } });
    if (['1', '2', '3', '4'].includes(r.payFreq) && pt === 0) p({ ruleId: '25702_L4103', category: '缺漏', fields: ['payFreq', 'payTerm'], value: `${r.payFreq}/${r.payTerm}`, message: '分期繳費時繳費期間應填年期', suggestion: '填入繳費年期，如 006、020' });
    if (r.termType === 'T' && t && pt > t) p({ ruleId: '25701_L4102', category: '單筆邏輯', fields: ['payTerm', 'term'], value: `${r.payTerm} > ${r.term}`, message: '繳費期間不能比保險期間大', suggestion: '確認繳費年期' });
    if (r.payFreq === '5' && (nz(r.totalPremOrig) || nz(r.totalPremTwd))) p({ ruleId: 'L4701', category: '單筆邏輯', fields: ['totalPremOrig', 'totalPremTwd'], value: C.fmtAmount(r.totalPremOrig), message: '彈性繳時應繳總保費合計應填 0', suggestion: '兩欄皆改為 0' });
  });
  // 停失效
  rl((r, p) => {
    const lapse = LAPSE.includes(r.exitType), pm = num(r.paidMonths);
    if (lapse && pm === 0 && r.startDate >= '20170101') p({ ruleId: '25800_L4201', category: '缺漏', fields: ['exitType', 'paidMonths'], value: r.paidMonths, message: `退保別=${r.exitType}(${T.exitType[r.exitType]})時累計繳費月數一定要有值`, suggestion: '填入停(失)效時已累計之繳費月數 (含墊繳月數)' });
    if (!lapse && r.lapseReason !== 'N' && keys(T.lapse).includes(r.lapseReason)) p({ ruleId: '25805_L4202', category: '單筆邏輯', fields: ['exitType', 'lapseReason'], value: `${r.exitType}/${r.lapseReason}`, message: '退保別非停效/失效時停(失)效原因應填 N', suggestion: '改為 N', fix: { field: 'lapseReason', value: 'N' } });
    if (lapse && r.lapseReason === 'N' && pm > 0) p({ ruleId: '25805_L4202', category: '缺漏', fields: ['exitType', 'lapseReason'], value: `${r.exitType}/N`, message: '停效/失效時須填停(失)效原因', suggestion: '依表 3．1．45 填 B/D/P/S/T' });
    if (lapse && pm > 0 && dateOk(r.startDate) && dateOk(r.exitDate) && r.lapseReason !== 'N') {
      const th = monthsBetween(r.startDate, r.exitDate);
      const ok = pm === th ? 'BST' : pm > th ? 'PBT' : 'DBT';
      if (!ok.includes(r.lapseReason)) p({ ruleId: '25802_L4203', category: '單筆邏輯', fields: ['paidMonths', 'lapseReason'], value: `${r.paidMonths}/${r.lapseReason}`, message: `累計繳費月數 ${pm} ${pm === th ? '=' : pm > th ? '>' : '<'} 理論值 ${th}，停(失)效原因應為 ${ok.split('').join('/')}`, suggestion: '確認累計繳費月數或停(失)效原因' });
    }
  });
  // 職業
  rl((r, p) => {
    if (r.occCode === '00000000' && dateOk(r.startDate) && r.startDate >= '20150301' && !['0', '8'].includes(r.occClass)) p({ ruleId: 'L4401', category: '缺漏', fields: ['occCode', 'startDate'], value: r.occCode, message: '2015/03/01 後生效之保單職業分類代碼不可為 00000000', suggestion: '依台灣地區傷害保險個人職業分類表填列' });
    if (['0', '8'].includes(r.occClass) && r.occCode !== '00000000') p({ ruleId: 'L4403', category: '單筆邏輯', fields: ['occClass', 'occCode'], value: `${r.occClass}/${r.occCode}`, message: `職業類別=${r.occClass} 時職業分類代碼應為 00000000`, suggestion: '改為 00000000', fix: { field: 'occCode', value: '00000000' } });
  });
  rl((r, p) => {
    for (const k of ['ownerZip', 'insuredZip']) if (r[k] === '999' && r.addType === 'NEW' && r.addDate >= '20190101') p({ ruleId: '24701_L4501', category: '缺漏', fields: [k], value: '999', message: `${L.field(k).name}：2019 填報年度起新投保保單應按實際住所填列，不可填 999`, suggestion: '填入實際郵遞區號前 3 碼' });
  });
  // 生存還本
  rl((r, p) => {
    if (r.survivalType === '0' && r.survivalCond !== '0' && /^\d$/.test(r.survivalCond)) p({ ruleId: 'L5501', category: '單筆邏輯', fields: ['survivalType', 'survivalCond'], value: `${r.survivalType}/${r.survivalCond}`, message: '無還本(0)時生存還本金給付條件應為 0', suggestion: '改為 0', fix: { field: 'survivalCond', value: '0' } });
    if (!isZero(r.survivalFirstDate)) {
      if (!dateOk(r.survivalFirstDate)) p({ ruleId: 'L5601', category: '格式', fields: ['survivalFirstDate'], value: r.survivalFirstDate, message: '生存還本金初次給付日期不是合法日期', suggestion: '格式 YYYYMMDD' });
      else if (dateOk(r.startDate) && r.survivalFirstDate <= r.startDate) p({ ruleId: 'L5601', category: '單筆邏輯', fields: ['survivalFirstDate', 'startDate'], value: r.survivalFirstDate, message: '生存還本金初次給付日期應大於保險期間起日', suggestion: '確認給付日期' });
    } else if ((nz(r.survivalAmtOrig) || nz(r.survivalAmtTwd)) && (r.addDate >= '20240101' || r.exitDate >= '20240101')) {
      p({ ruleId: 'L5601', category: '缺漏', fields: ['survivalFirstDate'], value: r.survivalFirstDate, message: '有生存還本保險金額時應填生存還本金初次給付日期', suggestion: '依保單約定填入' });
    }
  });
  rl((r, p) => { if (r.reserved !== '0000') p({ ruleId: 'L6101', category: '格式', fields: ['reserved'], value: r.reserved, message: '保留欄位應填 0000', suggestion: '改為 0000', fix: { field: 'reserved', value: '0000' } }); });
  // 邏輯合理性 (本工具補充)
  const PAIRS = [['sumInsuredOrig', 'sumInsuredTwd'], ['illnessDeathOrig', 'illnessDeathTwd'], ['totalPremOrig', 'totalPremTwd'], ['survivalAmtOrig', 'survivalAmtTwd'], ['longevityAmtOrig', 'longevityAmtTwd'], ['maturityAmtOrig', 'maturityAmtTwd']];
  rl((r, p) => {
    if (r.currency !== 'NTD') return;
    for (const [o, t] of PAIRS) if (/^\d+$/.test(r[o]) && /^\d+$/.test(r[t]) && r[o] !== r[t] && !(isZero(r[t]) && r.addDate < '20240101' && r.exitDate < '20240101'))
      p({ ruleId: 'X001', category: '邏輯合理性', fields: [o, t], value: `${C.fmtAmount(r[o])} vs ${C.fmtAmount(r[t])}`, message: `原幣別為 NTD，但「${L.field(o).name}」與「${L.field(t).name}」不相等`, suggestion: '臺幣保單兩欄應相同；請確認是否誤套匯率或少填', fix: isZero(r[t]) ? { field: t, value: r[o] } : null });
  });
  rl((r, p) => {
    if (!dateOk(r.birthDate) || !dateOk(r.startDate)) return;
    const a = ageAt(r.birthDate, r.startDate);
    if (a > 100) p({ ruleId: 'X002', category: '邏輯合理性', fields: ['birthDate', 'startDate'], value: `${a} 歲`, message: `投保年齡 ${a} 歲，超出合理範圍`, suggestion: '確認出生日期是否誤植 (如民國/西元混用)' });
  });
  rl((r, p) => { const v = big(r.sumInsuredTwd); if (v !== null && v > 50000000000n) p({ ruleId: 'X003', category: '邏輯合理性', fields: ['sumInsuredTwd'], value: C.fmtAmount(r.sumInsuredTwd), message: '保險金額(臺幣)超過 5 億元，請確認', suggestion: '常見原因：金額少/多兩位小數 (欄位含 2 位小數)' }); });
  rl((r, p) => { const pr = big(r.totalPremTwd), s = big(r.sumInsuredTwd); if (pr && s && r.payFreq !== '0' && pr > s * 3n) p({ ruleId: 'X004', category: '邏輯合理性', fields: ['totalPremTwd', 'sumInsuredTwd'], value: `${C.fmtAmount(r.totalPremTwd)} / ${C.fmtAmount(r.sumInsuredTwd)}`, message: '應繳總保費合計大於保額 3 倍，請確認', suggestion: '確認總保費是否為「繳費期間內應繳總額」且單位一致' }); });

  // ================= 單筆檢核：給付 =================
  const recordD = [];
  const rd = fn => recordD.push(fn);
  rd((r, p) => {
    const hasItem = /^\d{8}$/.test(r.disabilityItem) && !isZero(r.disabilityItem);
    if (hasItem && r.claimType !== '2') p({ ruleId: '26501_D0103', category: '單筆邏輯', fields: ['claimType', 'disabilityItem'], value: `${r.claimType}/${r.disabilityItem}`, message: '有完全失能項次時給付類別應為 2(完全失能)', suggestion: '確認給付類別或將失能項次改為 00000000' });
    if (!hasItem && r.claimType === '2') p({ ruleId: '26501_D0103', category: '缺漏', fields: ['claimType', 'disabilityItem'], value: r.disabilityItem, message: '完全失能給付應填完全失能項次等級', suggestion: '依失能程度與保險金給付表填列' });
  });
  rd((r, p) => {
    const t = num(r.term);
    if ((r.termType === 'T' && t === 999) || (r.termType === 'Y' && !(t === 999 || t >= 95)) || (r.termType === 'B' && t !== 1))
      p({ ruleId: 'D0513', category: '單筆邏輯', fields: ['termType', 'term'], value: `${r.termType}/${r.term}`, message: '保險期間別與保險期間不符', suggestion: '應與承保檔相同' });
  });
  rd((r, p) => {
    if (!dateOk(r.birthDate)) return p({ ruleId: '23900_D0601', category: '格式', fields: ['birthDate'], value: r.birthDate, message: '出生日期不是合法日期', suggestion: '格式 YYYYMMDD (西元)' });
    if (dateOk(r.startDate) && r.birthDate > r.startDate) p({ ruleId: '26800_D0602', category: '單筆邏輯', fields: ['birthDate', 'startDate'], value: `${r.birthDate} > ${r.startDate}`, message: '出生日期晚於保險期間起日', suggestion: '確認出生日期' });
  });
  rd((r, p) => { if ((r.substdReason === '0' && !['1', '3'].includes(r.examClass)) || (/^[1289]$/.test(r.substdReason) && r.examClass !== '2')) p({ ruleId: '25001_D0831', category: '單筆邏輯', fields: ['substdReason', 'examClass'], value: `${r.substdReason}/${r.examClass}`, message: '次標準體原因與體檢類別不符', suggestion: '次標準體原因 0 ↔ 體檢類別 1/3；非 0 ↔ 2' }); });
  rd((r, p) => {
    if (!isZero(r.startDate) && !dateOk(r.startDate)) p({ ruleId: '23900_D0901', category: '格式', fields: ['startDate'], value: r.startDate, message: '保險期間起日不是合法日期', suggestion: '格式 YYYYMMDD' });
    if (isZero(r.eventDate)) return;
    if (!dateOk(r.eventDate)) return p({ ruleId: '23900_D1001', category: '格式', fields: ['eventDate'], value: r.eventDate, message: '發生日期不是合法日期', suggestion: '格式 YYYYMMDD' });
    if (dateOk(r.startDate) && r.eventDate <= r.startDate) p({ ruleId: '26600_D1002', category: '單筆邏輯', fields: ['eventDate', 'startDate'], value: `${r.eventDate} ≤ ${r.startDate}`, message: '發生日期應晚於保險期間起日', suggestion: '確認發生日期' });
  });
  rd((r, p) => {
    const codes = r.diffReason.trimEnd();
    if (!/^[0-8]{1,4}$/.test(codes)) return p({ ruleId: '23100_D1302', category: '代碼', fields: ['diffReason'], value: r.diffReason, message: `不同原因代號「${r.diffReason}」不符代號表 (0~8，靠左、未滿 4 位補空白)`, suggestion: '金額相同填 0；不同時依表 3．2．18 由左至右填列' });
    const same = r.dueAmtOrig === r.paidAmtOrig;
    if (codes === '0' && !same) p({ ruleId: '24101_D1303', category: '單筆邏輯', fields: ['diffReason', 'dueAmtOrig', 'paidAmtOrig'], value: `${C.fmtAmount(r.dueAmtOrig)} ≠ ${C.fmtAmount(r.paidAmtOrig)}`, message: '應給付與實際給付金額不同，不同原因卻填 0', suggestion: '依表 3．2．18 填寫原因，如 5(含紅利給付)、1(削額給付)' });
    if (codes !== '0' && same) p({ ruleId: '24101_D1303', category: '單筆邏輯', fields: ['diffReason'], value: r.diffReason, message: '應給付與實際給付金額相同，不同原因應填 0', suggestion: '改為「0   」', fix: { field: 'diffReason', value: '0' } });
  });
  rd((r, p) => {
    const c = r.causeIcd.trim();
    if (['1', '2', '3'].includes(r.claimType)) {
      if (!c || isZero(c)) p({ ruleId: '26901_D1402', category: '缺漏', fields: ['causeIcd'], value: r.causeIcd, message: '死亡/完全失能/生命末期給付須填死亡及完全失能原因 (ICD-10-CM)', suggestion: '依附錄 ICD-10-CM 代碼，不含小數點靠左填報' });
      else if (!/^[A-Z][0-9][0-9A-Z]{1,3}$/.test(c)) p({ ruleId: '26901_D1402', category: '代碼', fields: ['causeIcd'], value: r.causeIcd, message: `ICD-10-CM 代碼「${c}」格式不正確`, suggestion: '格式為 1 英文字母 + 數字，不含小數點，例如 C349、I219' + (c.includes('.') ? `；去掉小數點應為 ${c.replace('.', '')}` : ''), fix: c.includes('.') ? { field: 'causeIcd', value: c.replace('.', '') } : null });
    } else if (['4', '5', '6'].includes(r.claimType) && !isZero(c)) p({ ruleId: '26901_D1402', category: '單筆邏輯', fields: ['causeIcd'], value: r.causeIcd, message: '非死亡或完全失能給付，死亡及完全失能原因應填 00000', suggestion: '改為 00000', fix: { field: 'causeIcd', value: '00000' } });
  });
  rd((r, p) => checkProductClass(r.productClass, r.company, p, 'D1601'));
  rd((r, p) => {
    if (isZero(r.payDate)) return;
    if (!dateOk(r.payDate)) return p({ ruleId: '23900_D1802', category: '格式', fields: ['payDate'], value: r.payDate, message: '給付日期不是合法日期', suggestion: '格式 YYYYMMDD' });
    if (dateOk(r.eventDate) && r.payDate < r.eventDate) p({ ruleId: '26400_D1803', category: '單筆邏輯', fields: ['payDate', 'eventDate'], value: `${r.payDate} < ${r.eventDate}`, message: '給付日期早於發生日期', suggestion: '檢查兩日期是否填反' });
  });
  rd((r, p) => { if ((r.disabilityCat === '000') !== (r.disabilityLevel === '0')) p({ ruleId: 'D2003', category: '單筆邏輯', fields: ['disabilityCat', 'disabilityLevel'], value: `${r.disabilityCat}/${r.disabilityLevel}`, message: '身障類別與身障等級必須同時為 0 或同時不為 0', suggestion: '補齊另一欄或兩欄皆填 0' }); });
  rd((r, p) => {
    if (r.currency !== 'NTD') return;
    for (const [o, t] of [['dueAmtOrig', 'dueAmtTwd'], ['paidAmtOrig', 'paidAmtTwd']]) if (/^\d+$/.test(r[o]) && /^\d+$/.test(r[t]) && r[o] !== r[t])
      p({ ruleId: 'X001', category: '邏輯合理性', fields: [o, t], value: `${C.fmtAmount(r[o])} vs ${C.fmtAmount(r[t])}`, message: `原幣別為 NTD，但「${D.field(o).name}」與「${D.field(t).name}」不相等`, suggestion: '臺幣保單兩欄應相同', fix: isZero(r[t]) ? { field: t, value: r[o] } : null });
  });

  // ================= 多筆檢核：承保 (同一保單號碼) =================
  const groupL = [];
  const gl = fn => groupL.push(fn);
  const bySeq = recs => recs.slice().sort((a, b) => a.txnSeq.localeCompare(b.txnSeq) || a._line - b._line);
  gl((recs, p) => {
    const s = bySeq(recs);
    if (s.length === 1) {
      if (s[0].txnSeq !== '00000') p(s[0], { ruleId: '30201_L0302', category: '多筆邏輯', fields: ['txnSeq'], value: s[0].txnSeq, message: '保單只有一筆資料時異動序號應為 00000', suggestion: '改為 00000', fix: { field: 'txnSeq', value: '00000' } });
      return;
    }
    const seen = new Map();
    s.forEach((r, i) => {
      if (seen.has(r.txnSeq)) p(r, { ruleId: 'K0001', category: '多筆邏輯', fields: ['txnSeq'], value: r.txnSeq, message: `主鍵重複：與第 ${seen.get(r.txnSeq)} 行保單號碼與異動序號相同`, suggestion: '確認是否重複填送，或重新編排異動序號' });
      seen.set(r.txnSeq, r._line);
      const exp = String(i + 1).padStart(5, '0');
      if (r.txnSeq !== exp) p(r, { ruleId: '30202_L0302', category: '多筆邏輯', fields: ['txnSeq'], value: r.txnSeq, message: `保單有 ${s.length} 筆異動，異動序號應自 00001 起依序編排，本筆應為 ${exp}`, suggestion: `改為 ${exp}`, fix: { field: 'txnSeq', value: exp } });
    });
  });
  gl((recs, p) => {
    const s = bySeq(recs);
    const news = s.filter(r => r.addType === 'NEW');
    if (news.length > 1) news.slice(1).forEach(r => p(r, { ruleId: '30245_P1307', category: '多筆邏輯', fields: ['addType'], value: 'NEW', message: '加保別 NEW 在同一保單只會出現 1 次', suggestion: '後續異動應填對應的加保別 (如 INN、RNN)' }));
    if (news.length && s[0] !== news[0]) p(news[0], { ruleId: '30245_P1307', category: '多筆邏輯', fields: ['addType'], value: 'NEW', message: '加保別 NEW 應為保單的第一筆', suggestion: '確認異動序號排序' });
    if (s.length > 1) s.slice(1).filter(r => r.addType === 'XED').forEach(r => p(r, { ruleId: '30212_L1305', category: '多筆邏輯', fields: ['addType'], value: 'XED', message: '加保別 XED(期初有效) 只能是保單的第一筆', suggestion: '應填上一筆退保別' }));
  });
  gl((recs, p) => {
    const s = bySeq(recs);
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      // 鏈結
      if (a.exitType === 'LNN' && b.addType !== 'RNN') p(b, { ruleId: '30213_L1306', category: '多筆邏輯', fields: ['addType'], value: b.addType, message: '上一筆退保別=LNN(停效)，本筆加保別應為 RNN(復效)', suggestion: '改為 RNN', fix: { field: 'addType', value: 'RNN' } });
      if (b.addType === 'RNN' && a.exitType !== 'LNN') p(b, { ruleId: '30214_L1306', category: '多筆邏輯', fields: ['addType'], value: 'RNN', message: `加保別=RNN(復效)，但上一筆退保別為 ${a.exitType} 而非 LNN`, suggestion: '確認上一筆是否應為停效(LNN)' });
      if (CHAIN.includes(a.exitType) && b.addType !== a.exitType) p(b, { ruleId: '30212_L1305', category: '多筆邏輯', fields: ['addType'], value: b.addType, message: `上一筆退保別=${a.exitType}，本筆加保別應相同`, suggestion: `改為 ${a.exitType}`, fix: { field: 'addType', value: a.exitType } });
      else if (CHAIN.includes(b.addType) && a.exitType !== b.addType) p(b, { ruleId: '30212_L1305', category: '多筆邏輯', fields: ['addType'], value: b.addType, message: `加保別=${b.addType}，但上一筆退保別為 ${a.exitType}`, suggestion: '加保別應=上一筆退保別' });
      if (CHAIN.includes(b.addType) && b.addType === a.exitType && b.addDate !== a.exitDate) p(b, { ruleId: '30212_L1305', category: '多筆邏輯', fields: ['addDate'], value: b.addDate, message: `加保日期應等於上一筆退保日期 ${a.exitDate}`, suggestion: `改為 ${a.exitDate}`, fix: { field: 'addDate', value: a.exitDate } });
      if (nz(b.addDate) && nz(a.exitDate) && b.addDate < a.exitDate) p(b, { ruleId: '30222_P1401', category: '多筆邏輯', fields: ['addDate'], value: `${b.addDate} < ${a.exitDate}`, message: '加保日期早於上一筆退保日期', suggestion: '確認異動順序' });
      if (nz(b.exitDate) && nz(a.exitDate) && b.exitDate < a.exitDate) p(b, { ruleId: '30233_P1601', category: '多筆邏輯', fields: ['exitDate'], value: `${b.exitDate} < ${a.exitDate}`, message: '退保日期早於上一筆退保日期', suggestion: '確認異動序號是否依日期排序' });
      if (TERMINAL.includes(a.exitType)) p(a, { ruleId: '30228_P1504', category: '多筆邏輯', fields: ['exitType'], value: a.exitType, message: `退保別=${a.exitType}(${T.exitType[a.exitType]})應為保單最後一筆異動，但其後仍有資料`, suggestion: '確認退保別或刪除其後之重複資料' });
      // 金額
      const sa = big(a.sumInsuredOrig), sb = big(b.sumInsuredOrig);
      if (sa !== null && sb !== null) {
        if (b.addType === 'INN' && !(sb > sa)) p(b, { ruleId: '30205_P0502', category: '多筆邏輯', fields: ['sumInsuredOrig'], value: `${C.fmtAmount(b.sumInsuredOrig)} ≤ ${C.fmtAmount(a.sumInsuredOrig)}`, message: '保額增加(INN)後保額應大於上一筆', suggestion: '本筆應記錄增額後保額，上一筆記錄增額前保額' });
        if (b.addType === 'DNN' && !(sb < sa)) p(b, { ruleId: '30206_P0503', category: '多筆邏輯', fields: ['sumInsuredOrig'], value: `${C.fmtAmount(b.sumInsuredOrig)} ≥ ${C.fmtAmount(a.sumInsuredOrig)}`, message: '保額減少(DNN)後保額應小於上一筆', suggestion: '本筆應記錄減額後保額' });
        if (b.addType === 'INS') for (const k of ['sumInsuredOrig', 'sumInsuredTwd', 'illnessDeathOrig', 'illnessDeathTwd']) if (a[k] !== b[k]) p(b, { ruleId: 'LINS', category: '多筆邏輯', fields: [k], value: C.fmtAmount(b[k]), message: `加保別=INS 時「${L.field(k).name}」應與上一筆相同`, suggestion: `改為 ${a[k]}`, fix: { field: k, value: a[k] } });
      }
      if (!['INN', 'DNN', 'INV', 'PAU', 'CTC', 'ROL', 'INS'].includes(b.addType) && a.illnessDeathOrig !== b.illnessDeathOrig) p(b, { ruleId: '30215_P3401', category: '多筆邏輯', fields: ['illnessDeathOrig'], value: C.fmtAmount(b.illnessDeathOrig), message: `疾病身故保險金與上一筆 (${C.fmtAmount(a.illnessDeathOrig)}) 不一致，但加保別 ${b.addType} 非保額異動`, suggestion: '若疾病身故保險金有變更，應以 INV 異動填報' });
      // 危險分類
      const risk = r => [r.smoker, r.disabilityCat, r.disabilityLevel, r.occClass, r.occCode].join('|');
      if (b.addType === 'HCC' && risk(a) === risk(b)) p(b, { ruleId: '30217_P1302', category: '多筆邏輯', fields: ['addType'], value: 'HCC', message: '危險分類欄位變更(HCC)，但危險分類及職業欄位皆與上一筆相同', suggestion: '本筆應記錄異動後狀態' });
      if (b.addType !== 'HCC') {
        if (a.disabilityCat !== b.disabilityCat) p(b, { ruleId: '30234_P2601', category: '多筆邏輯', fields: ['disabilityCat'], value: b.disabilityCat, message: `身障類別與上一筆 (${a.disabilityCat}) 不同，但非 HCC 異動`, suggestion: '身障類別變更請以 HCC 填報' });
        if (a.disabilityLevel !== b.disabilityLevel) p(b, { ruleId: '30235_P2701', category: '多筆邏輯', fields: ['disabilityLevel'], value: b.disabilityLevel, message: `身障等級與上一筆 (${a.disabilityLevel}) 不同，但非 HCC 異動`, suggestion: '身障等級變更請以 HCC 填報' });
      }
      if (b.addType === 'ROL' && num(b.term) > num(a.term)) p(b, { ruleId: '30210_P0702', category: '多筆邏輯', fields: ['term'], value: `${b.term} > ${a.term}`, message: '展期(ROL)後保險期間應減短或相等', suggestion: '確認保險期間' });
      // 上下一致
      for (const [k, id] of SAME) if (a[k] !== b[k]) p(b, { ruleId: id, category: '多筆邏輯', fields: [k], value: `${a[k]} → ${b[k]}`, message: `「${L.field(k).name}」與上一筆不同 (同一保單應一致)`, suggestion: `確認正確值；若上一筆正確則改為 ${a[k]}`, fix: { field: k, value: a[k] } });
      for (const [k, id, ex] of SAME_EXCEPT) if (!ex.includes(b.addType) && a[k] !== b[k]) p(b, { ruleId: id, category: '多筆邏輯', fields: [k], value: `${a[k]} → ${b[k]}`, message: `「${L.field(k).name}」與上一筆不同，但加保別 ${b.addType} 不屬 ${ex.join('/')}`, suggestion: `確認正確值；若上一筆正確則改為 ${a[k]}`, fix: { field: k, value: a[k] } });
    }
    // ETI 只能在 ROL 後
    let rol = false;
    for (const r of s) {
      if (r.addType === 'ROL') rol = true;
      if (r.productClass.slice(10, 13) === 'ETI' && !rol) p(r, { ruleId: '30203_P1801', category: '多筆邏輯', fields: ['productClass'], value: r.productClass, message: '商品類別編號第 11-13 碼為 ETI(展期)，但之前沒有展期(ROL)異動', suggestion: '確認是否漏報展期異動' });
    }
    // HLM 年齡
    for (const r of s) if (r.exitType === 'HLM' && dateOk(r.birthDate) && dateOk(r.exitDate) && num(r.longevityAge) > 0 && ageAt(r.birthDate, r.exitDate) !== num(r.longevityAge))
      p(r, { ruleId: '30402_P1508', category: '多筆邏輯', fields: ['exitDate', 'longevityAge'], value: `${ageAt(r.birthDate, r.exitDate)} 歲 / ${r.longevityAge}`, message: '退保別=HLM(祝壽金) 時到達年齡應等於祝壽保險金給付年齡', suggestion: '確認退保日期、出生日期或祝壽金給付年齡' });
  });

  // ================= 多筆檢核：給付 (同一保單號碼) =================
  // 整筆內容完全相同的給付資料 (重複填送；安全測試 T04 發現原本沒有檢查)，歸在主鍵重複 K0001
  const groupD = [(recs, p) => {
    const seen = new Map();
    for (const r of recs) {
      if (seen.has(r._raw)) p(r, { ruleId: 'K0001', category: '多筆邏輯', fields: ['policyNo'], value: r.policyNo, message: `與第 ${seen.get(r._raw)} 行的給付資料完全相同 (重複填送)`, suggestion: '刪除重複的那一筆；同一事故多次給付時，給付日期或金額應不同' });
      else seen.set(r._raw, r._line);
    }
  }];

  // ================= 跨檔檢核 =================
  const cross = [];
  cross.push((data, p) => {
    const Ls = data.L || [], Ds = data.D || [];
    if (!Ls.length || !Ds.length) return;
    const okL = Ls.filter(r => r._raw.length === L.recordLength), okD = Ds.filter(r => r._raw.length === D.recordLength);
    const lBy = new Map(), dBy = new Map();
    for (const r of okL) { const k = L.keyOf(r); if (!lBy.has(k)) lBy.set(k, []); lBy.get(k).push(r); }
    for (const r of okD) { const k = D.keyOf(r); if (!dBy.has(k)) dBy.set(k, []); dBy.get(k).push(r); }
    // 承保 → 給付
    for (const [k, recs] of lBy) for (const r of recs) {
      const need = CLAIM_EXIT[r.exitType] || (BENEFIT_EXIT[r.exitType] && (r.exitType !== 'SIB' || r.exitDate > '20231231') ? BENEFIT_EXIT[r.exitType] : null);
      if (!need) continue;
      const ds = dBy.get(k) || [];
      if (!ds.length) {
        p('L', r, { ruleId: CLAIM_EXIT[r.exitType] ? '30301_LD012' : 'LD00-13', fields: ['exitType'], value: r.exitType, message: `退保別=${r.exitType}(${T.exitType[r.exitType]})，但給付檔找不到此保單之給付資料`, suggestion: `補報給付檔一筆 (給付類別=${need}，發生日期=${r.exitDate})` });
        continue;
      }
      const match = ds.filter(d => d.claimType === need);
      if (!match.length) p('L', r, { ruleId: { 1: '30304_LD014', 2: '30305_LD015', 3: '30306_LD016' }[need] || 'LD00-13', fields: ['exitType'], value: r.exitType, message: `退保別=${r.exitType}，給付檔應有給付類別=${need}(${T.claimType[need]})之資料，實際為 ${ds.map(d => d.claimType).join('、')}`, suggestion: '確認承保退保別或給付類別' });
      else if (!match.some(d => d.eventDate === r.exitDate)) p('L', r, { ruleId: need <= '3' ? '30312_LD019' : 'LD00-13', fields: ['exitDate'], value: r.exitDate, message: `承保退保日期 ${r.exitDate} 與給付發生日期 ${match.map(d => d.eventDate).join('、')} 不相等`, suggestion: '兩者應為同一事故日' });
    }
    // 給付 → 承保
    for (const [k, ds] of dBy) for (const d of ds) {
      const ls = lBy.get(k);
      if (!ls) { p('D', d, { ruleId: '30307_LD013', fields: ['policyNo', 'policySeq'], value: k, message: '給付資料在承保檔找不到相同保單號碼', suggestion: '確認保單編號/序號是否一致 (含空白補位)，或補報承保資料' }); continue; }
      const exits = { '1': ['DEA', 'ADS'], '2': ['TDI', 'ATS'], '3': ['ABD'], '4': ['SIB'], '5': ['HLM'], '6': ['MAB'] }[d.claimType];
      if (exits && ['1', '2', '3'].includes(d.claimType) && !ls.some(l => exits.includes(l.exitType))) p('D', d, { ruleId: '30311_LD018', fields: ['claimType'], value: d.claimType, message: `給付類別=${d.claimType}(${T.claimType[d.claimType]})，承保檔退保別應有 ${exits.join('/')}`, suggestion: '確認承保檔是否漏報退保異動' });
      // 事故時承保資料
      const atEvent = ls.filter(l => nz(l.exitDate) && l.exitDate === d.eventDate)[0] || ls.slice().sort((a, b) => b.txnSeq.localeCompare(a.txnSeq))[0];
      const pairs = [['company', 'LD01'], ['termType', 'LD02'], ['term', 'LD03'], ['birthDate', 'LD04'], ['sex', 'LD05'], ['medExam', 'LD06'], ['examClass', 'LD07'], ['substdReason', 'LD08'], ['startDate', 'LD09'], ['productClass', 'LD12'], ['currency', 'LD13']];
      const diffs = pairs.filter(([f]) => atEvent[f] !== d[f]);
      for (const [f, code] of diffs) p('D', d, { ruleId: '30308_LD000', fields: [f], value: `給付 ${d[f]} / 承保 ${atEvent[f]}`, message: `${code}：給付檔「${D.field(f).name}」與事故時承保檔(第 ${atEvent._line} 行)不一致`, suggestion: `以承保檔為準改為 ${atEvent[f]}`, fix: { field: f, value: atEvent[f] } });
      const ext = /^[V-Y]/.test(d.causeIcd);
      const lex = ls.find(l => l.exitDate === d.eventDate && CLAIM_EXIT[l.exitType]);
      if (ext && lex && ['DEA', 'TDI', 'ABD'].includes(lex.exitType)) p('L', lex, { ruleId: '26904_D1402', fields: ['exitType'], value: `${lex.exitType} / ${d.causeIcd.trim()}`, message: `給付原因 ${d.causeIcd.trim()} 屬外因(意外)，承保退保別卻為疾病類 ${lex.exitType}`, suggestion: lex.exitType === 'DEA' ? '應為 ADS(意外死亡)' : lex.exitType === 'TDI' ? '應為 ATS(意外完全失能)' : '確認退保別', fix: { field: 'exitType', value: lex.exitType === 'DEA' ? 'ADS' : lex.exitType === 'TDI' ? 'ATS' : lex.exitType } });
      if (d.claimType === '1' && lex && lex.exitType === 'DEA' && d.currency === atEvent.currency && d.dueAmtOrig !== lex.illnessDeathOrig) p('D', d, { ruleId: '30309_LD012', fields: ['dueAmtOrig'], value: `${C.fmtAmount(d.dueAmtOrig)} vs ${C.fmtAmount(lex.illnessDeathOrig)}`, message: '疾病死亡之應給付金額與承保檔疾病身故保險金不同', suggestion: '若含紅利或其他給付請確認金額組成' });
      if (d.claimType === '5' && dateOk(d.birthDate) && dateOk(d.eventDate) && num(atEvent.longevityAge) > 0 && ageAt(d.birthDate, d.eventDate) < num(atEvent.longevityAge)) p('D', d, { ruleId: 'LD00-16', fields: ['eventDate'], value: `${ageAt(d.birthDate, d.eventDate)} 歲`, message: `祝壽金給付時到達年齡小於承保檔祝壽保險金給付年齡 ${num(atEvent.longevityAge)}`, suggestion: '確認給付類別或發生日期' });
    }
  });

  return {
    id: 'life', name: '個人壽險 (2025 填報年度)', version: '2025',
    layouts: { L, D }, tables: T, catalog,
    recordRules: { L: recordL, D: recordD },
    groupRules: { L: groupL, D: groupD },
    crossRules: cross,
  };
});
