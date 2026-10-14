/*
 * 財報勾稽規則集：資產負債表 (含準備金) 科目檢核
 * 會計科目表為示範用簡化版 (參考保險業財務報告編製準則之科目結構)，
 * 實務上請替換為公司正式科目表；停用科目含 IFRS 9 轉換後停用之舊科目。
 */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.DQ = root.DQ || {}; root.DQ.rulesets = root.DQ.rulesets || {}; root.DQ.rulesets.finance = m; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // [代號, 名稱, 類別 A/L/E, 停用日, 替代科目]
  const CHART = [
    ['1', '資產總計', 'A'],
    ['11', '現金及約當現金', 'A'], ['1101', '庫存現金及週轉金', 'A'], ['1102', '銀行存款', 'A'], ['1103', '約當現金', 'A'],
    ['12', '應收款項', 'A'], ['1201', '應收保費', 'A'], ['1202', '應收利息', 'A'],
    ['13', '金融資產', 'A'], ['1301', '透過損益按公允價值衡量之金融資產', 'A'], ['1302', '透過其他綜合損益按公允價值衡量之金融資產', 'A'],
    ['1303', '按攤銷後成本衡量之金融資產', 'A'], ['1304', '備供出售金融資產', 'A', '2018-01-01', '1302'], ['1305', '持有至到期日金融資產', 'A', '2018-01-01', '1303'],
    ['14', '放款', 'A'], ['1401', '壽險貸款', 'A'], ['1402', '擔保放款', 'A'],
    ['15', '投資性不動產', 'A'], ['1501', '投資性不動產', 'A'],
    ['16', '再保險合約資產', 'A'], ['1601', '應攤回再保賠款與給付', 'A'],
    ['2', '負債總計', 'L'],
    ['21', '應付款項', 'L'], ['2101', '應付保險給付', 'L'], ['2102', '應付佣金', 'L'], ['2103', '其他應付款', 'L'],
    ['23', '保險負債', 'L'], ['2301', '未滿期保費準備金', 'L'], ['2302', '賠款準備金', 'L'], ['2303', '責任準備金', 'L'],
    ['2304', '特別準備金', 'L'], ['2305', '保費不足準備金', 'L'], ['2306', '負債適足準備金', 'L'],
    ['24', '外匯價格變動準備金', 'L'], ['2401', '外匯價格變動準備金', 'L'],
    ['3', '權益總計', 'E'],
    ['31', '股本', 'E'], ['3101', '普通股股本', 'E'],
    ['32', '保留盈餘', 'E'], ['3201', '法定盈餘公積', 'E'], ['3202', '特別盈餘公積', 'E'], ['3203', '未分配盈餘', 'E'],
    ['33', '其他權益', 'E'], ['3301', '透過其他綜合損益按公允價值衡量之金融資產未實現評價損益', 'E'],
  ].map(([code, name, type, until, replacedBy]) => ({ code, name, type, until: until || null, replacedBy: replacedBy || null }));
  const byCode = new Map(CHART.map(a => [a.code, a]));
  for (const a of CHART) {
    a.parent = null;
    for (let k = a.code.length - 1; k >= 1; k--) if (byCode.has(a.code.slice(0, k))) { a.parent = a.code.slice(0, k); break; }
  }
  const children = code => CHART.filter(a => a.parent === code);

  const catalog = [
    { id: 'S001', name: '科目代號不存在於會計科目表', level: '財報', ref: '會計科目表', severity: 'error' },
    { id: 'S002', name: '使用已停用之舊科目代號', level: '財報', ref: '會計科目表 (停用日/替代科目)', severity: 'error' },
    { id: 'S003', name: '期初餘額 + 本期增加 − 本期減少 = 期末餘額', level: '財報', ref: '餘額結轉', severity: 'error' },
    { id: 'S004', name: '上層科目 = 下層科目合計', level: '財報', ref: '科目層級加總', severity: 'error' },
    { id: 'S005', name: '資產總計 = 負債總計 + 權益總計', level: '財報', ref: '資產負債表平衡', severity: 'error' },
    { id: 'S006', name: '科目代號重複', level: '財報', ref: '會計科目表', severity: 'error' },
    { id: 'S007', name: '科目名稱與科目表不一致', level: '財報', ref: '會計科目表', severity: 'warning' },
    { id: 'S008', name: '應付保險給付本期減少 = 給付明細實際給付合計', level: '財報×明細', ref: '財報與申報明細勾稽', severity: 'error' },
    { id: 'S009', name: '金額欄位格式', level: '財報', ref: '數值欄位', severity: 'error' },
    { id: 'R001', name: '上游系統控制總數 = 申報明細彙總', level: '跨系統對帳', ref: '控制總數', severity: 'error' },
    { id: 'P001', name: '上年度期末有效保單，本年度無資料 (漏報)', level: '期初期末結轉', ref: '上年度申報檔', severity: 'error' },
    { id: 'P002', name: '本年度期初有效 (XED)，但上年度期末非有效保單', level: '期初期末結轉', ref: '上年度申報檔', severity: 'error' },
    { id: 'P003', name: '本年度期初保額 = 上年度期末保額', level: '期初期末結轉', ref: '上年度申報檔', severity: 'error' },
    { id: 'P004', name: '保額變動須有對應之保額異動 (INN/DNN/PAU/ROL/CTC)', level: '期初期末結轉', ref: '保額結轉', severity: 'error' },
  ];
  return { id: 'finance', name: '財報勾稽', chart: CHART, byCode, children, catalog };
});
