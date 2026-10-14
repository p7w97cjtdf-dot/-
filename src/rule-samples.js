/*
 * 規則匯入的範例文件，以及「預先轉換」的結果 (供無法連線 AI 時展示)。
 * 預先轉換結果於開發時由 Claude 依 rule-import.js 相同的格式說明轉出，並經人工核對。
 */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else { root.DQ = root.DQ || {}; root.DQ.ruleSamples = m; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const manual = `新式個人壽險填報說明手冊範例&檢核規則_2025　參、欄位檢核（節錄）

06. 保險期間別 X(01)
  單筆檢核：此欄=“T”，保險期間≠999；此欄=“Y”，保險期間=999 OR >094；此欄=“B”，保險期間=001　（24901~24903_L0613）

17. 保單分紅類別 X(01)
  單筆檢核：1.此欄=“S”、“T”時，保險期間起日<民國 93 年 1 月 1 日（25102_L1703）
            2.此欄=“A”、“B”、“M”、“N”時，保險期間起日≧民國 93 年 1 月 1 日（25101_L1704）

20. 保險期間迄日 9(08)
  單筆檢核：2. 此欄 >保險期間起日（25201_L2003）
            4. 保險期間=”T” ，此欄=保險期間起日+保險期間- 1 天（25204_L2005）

41. 繳費期間 9(03)
  單筆檢核：1.不能比保險期間大（25701_L4102）
            2.[繳費期間別]=”0”或”5”時，此欄為 000（25702_L4103）

13. 加保別 X(03)
  單筆檢核：4.此欄=“Rnn”時，上 1 筆退保別= “Lnn”（30214_L1306）`;

  const company = `○○人壽　個人壽險核保與理賠作業規範（申報前內部檢核）

一、新契約保險金額（臺幣）超過新臺幣 3,000 萬元者，應經體檢核保（有無體檢須為「有體檢」）。
二、被保險人投保時年齡超過 75 歲者，不得承保終身型壽險。
三、月繳保單之繳費期間不得超過 30 年。
四、外幣保單之保險金額（臺幣）應大於保險金額（原幣），以防匯率換算錯誤。
五、保額減少後之保險金額不得低於新臺幣 10 萬元。
六、停效保單申請復效，復效日距停效日不得超過 2 年。
七、死亡給付案件，給付日期距事故發生日超過 90 日者，列為理賠延遲警示。
八、保單應於簽發後 15 日內送達要保人。`;

  const converted = {
    manual: [
      { id: '24901_L0613', name: '年滿期之保險期間不可為 999', file: 'L', scope: 'record', severity: 'error', when: { field: 'termType', op: 'eq', value: 'T' }, assert: { field: 'term', op: 'ne', value: '999' }, message: '保險期間別為年滿期(T)，保險期間不可為 999', suggestion: '填入保險年期，如 010、020', source: '此欄=“T”，保險期間≠999', ref: '欄 06' },
      { id: '24902_L0613', name: '終身之保險期間為 999 或大於 94', file: 'L', scope: 'record', severity: 'error', when: { field: 'termType', op: 'eq', value: 'Y' }, assert: { any: [{ field: 'term', op: 'eq', value: '999' }, { field: 'term', op: 'gt', value: '94' }] }, message: '保險期間別為終身(Y)，保險期間應為 999 或大於 094', suggestion: '改為 999 或最終保險年齡', source: '此欄=“Y”，保險期間=999 OR >094', ref: '欄 06' },
      { id: '24903_L0613', name: '一年期之保險期間為 001', file: 'L', scope: 'record', severity: 'error', when: { field: 'termType', op: 'eq', value: 'B' }, assert: { field: 'term', op: 'eq', value: '1' }, message: '保險期間別為一年期(B)，保險期間應為 001', suggestion: '改為 001', source: '此欄=“B”，保險期間=001', ref: '欄 06' },
      { id: '25102_L1703', name: '強制分紅保單起日早於 2004 年', file: 'L', scope: 'record', severity: 'error', when: { field: 'dividendClass', op: 'in', values: ['S', 'T'] }, assert: { field: 'startDate', op: 'lt', value: '20040101' }, message: '保單分紅類別 S/T 之保險期間起日應早於 2004/01/01', suggestion: '2004 年後起保之保單請改用 A/B/M/N/Y/X', source: '此欄=“S”、“T”時，保險期間起日<民國 93 年 1 月 1 日', ref: '欄 17' },
      { id: '25101_L1704', name: '分紅/不分紅保單起日不早於 2004 年', file: 'L', scope: 'record', severity: 'error', when: { field: 'dividendClass', op: 'in', values: ['A', 'B', 'M', 'N'] }, assert: { field: 'startDate', op: 'gte', value: '20040101' }, message: '保單分紅類別 A/B/M/N 之保險期間起日應不早於 2004/01/01', suggestion: '2004 年前起保之保單請改用 C/D/P/Q', source: '此欄=“A”、“B”、“M”、“N”時，保險期間起日≧民國 93 年 1 月 1 日', ref: '欄 17' },
      { id: '25201_L2003', name: '迄日大於起日', file: 'L', scope: 'record', severity: 'error', assert: { field: 'endDate', op: 'gt', ref: 'startDate' }, message: '保險期間迄日應大於保險期間起日', suggestion: '檢查起迄日是否填反', source: '此欄 >保險期間起日', ref: '欄 20' },
      { id: '25204_L2005', name: '年滿期迄日推算', file: 'L', scope: 'record', severity: 'error', when: { field: 'termType', op: 'eq', value: 'T' }, assert: { field: 'endDate', op: 'eq', ref: { fn: 'addYearsMinusDay', args: ['startDate', 'term'] } }, message: '年滿期保單之保險期間迄日應為起日加保險期間減 1 天', suggestion: '依起日與保險期間重算迄日', source: '保險期間=”T” ，此欄=保險期間起日+保險期間- 1 天', ref: '欄 20' },
      { id: '25701_L4102', name: '繳費期間不大於保險期間', file: 'L', scope: 'record', severity: 'error', assert: { field: 'payTerm', op: 'lte', ref: 'term' }, message: '繳費期間不能比保險期間大', suggestion: '確認繳費年期', source: '不能比保險期間大', ref: '欄 41' },
      { id: '25702_L4103', name: '躉繳/彈性繳之繳費期間為 000', file: 'L', scope: 'record', severity: 'error', when: { field: 'payFreq', op: 'in', values: ['0', '5'] }, assert: { field: 'payTerm', op: 'isZero' }, message: '繳費期間別為躉繳(0)或彈性繳(5)時，繳費期間應為 000', suggestion: '改為 000', source: '[繳費期間別]=”0”或”5”時，此欄為 000', ref: '欄 41' },
      { id: '30214_L1306', name: '復效前須為停效', file: 'L', scope: 'policy', severity: 'error', when: { field: 'addType', op: 'eq', value: 'RNN' }, assert: { field: 'prev.exitType', op: 'eq', value: 'LNN' }, message: '加保別為復效(RNN)，上一筆退保別應為停效(LNN)', suggestion: '確認上一筆是否應為停效，或本筆加保別誤植', source: '此欄=“Rnn”時，上 1 筆退保別= “Lnn”', ref: '欄 13' },
    ],
    company: [
      { id: 'U001', name: '高額新契約須體檢', file: 'L', scope: 'record', severity: 'error', when: { all: [{ field: 'addType', op: 'eq', value: 'NEW' }, { field: { fn: 'amount', args: ['sumInsuredTwd'] }, op: 'gt', value: 30000000 }] }, assert: { field: 'medExam', op: 'eq', value: '1' }, message: '新契約保險金額超過新臺幣 3,000 萬元，應經體檢核保', suggestion: '確認核保紀錄；若已體檢請將有無體檢改為 1', source: '新契約保險金額（臺幣）超過新臺幣 3,000 萬元者，應經體檢核保', ref: '第一條' },
      { id: 'U002', name: '75 歲以上不得承保終身壽險', file: 'L', scope: 'record', severity: 'error', when: { field: 'termType', op: 'eq', value: 'Y' }, assert: { field: { fn: 'age', args: ['birthDate', 'startDate'] }, op: 'lte', value: 75 }, message: '被保險人投保時年齡超過 75 歲，不得承保終身型壽險', suggestion: '確認出生日期是否正確，或核保是否有例外核准', source: '被保險人投保時年齡超過 75 歲者，不得承保終身型壽險', ref: '第二條' },
      { id: 'U003', name: '月繳保單繳費期間上限 30 年', file: 'L', scope: 'record', severity: 'error', when: { field: 'payFreq', op: 'eq', value: '4' }, assert: { field: 'payTerm', op: 'lte', value: 30 }, message: '月繳保單之繳費期間不得超過 30 年', suggestion: '確認繳費期間', source: '月繳保單之繳費期間不得超過 30 年', ref: '第三條' },
      { id: 'U004', name: '外幣保單臺幣保額應大於原幣', file: 'L', scope: 'record', severity: 'error', when: { field: 'currency', op: 'ne', value: 'NTD' }, assert: { field: { fn: 'amount', args: ['sumInsuredTwd'] }, op: 'gt', ref: { fn: 'amount', args: ['sumInsuredOrig'] } }, message: '外幣保單之保險金額（臺幣）應大於保險金額（原幣）', suggestion: '檢查匯率換算是否遺漏或方向錯誤', source: '外幣保單之保險金額（臺幣）應大於保險金額（原幣）', ref: '第四條' },
      { id: 'U005', name: '減額後保額下限 10 萬元', file: 'L', scope: 'record', severity: 'error', when: { field: 'addType', op: 'eq', value: 'DNN' }, assert: { field: { fn: 'amount', args: ['sumInsuredTwd'] }, op: 'gte', value: 100000 }, message: '保額減少後之保險金額不得低於新臺幣 10 萬元', suggestion: '確認減額後保額', source: '保額減少後之保險金額不得低於新臺幣 10 萬元', ref: '第五條' },
      { id: 'U006', name: '復效期限 2 年', file: 'L', scope: 'policy', severity: 'error', when: { field: 'addType', op: 'eq', value: 'RNN' }, assert: { field: { fn: 'days', args: ['prev.exitDate', 'addDate'] }, op: 'lte', value: 730 }, message: '復效日距停效日超過 2 年', suggestion: '超過 2 年應已失效 (LOP)，確認異動紀錄', source: '復效日距停效日不得超過 2 年', ref: '第六條' },
      { id: 'U007', name: '死亡給付延遲警示', file: 'D', scope: 'record', severity: 'warning', when: { field: 'claimType', op: 'eq', value: '1' }, assert: { field: { fn: 'days', args: ['eventDate', 'payDate'] }, op: 'lte', value: 90 }, message: '死亡給付之給付日期距事故發生日超過 90 日', suggestion: '確認理賠延遲原因並留存紀錄', source: '給付日期距事故發生日超過 90 日者，列為理賠延遲警示', ref: '第七條' },
    ],
    companyUnconvertible: [{ source: '保單應於簽發後 15 日內送達要保人', reason: '申報檔沒有保單送達日期欄位，需要另外的資料來源' }],
  };
  return { manual, company, converted };
});
