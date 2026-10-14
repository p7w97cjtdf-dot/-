/*
 * 畫面與報告上的用語：把檢查程式內部的分類名稱換成一般人看得懂的說法。
 * 檢查程式內部仍用原本的名稱 (測試與規則都依賴它們)，只在顯示時轉換。
 */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.DQ = root.DQ || {}; root.DQ.labels = m; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // 嚴重程度
  const SEV = { error: '必須修改', warning: '建議確認', suspect: '請人工判斷' };
  const SEV_HINT = { error: '不改會被退件', warning: '可能有誤，請確認', suspect: '沒有違反規定，但看起來不太合理' };
  // 問題類別
  const CAT = {
    格式: '格式不對', 代碼: '代號不在清單內', 缺漏: '漏填',
    單筆邏輯: '同一筆資料前後矛盾', 多筆邏輯: '同一張保單前後不一致', 跨檔: '保單和理賠對不上',
    邏輯合理性: '數字不合理', '合理性（疑似異常）': '不太合理', 客戶資料: '客戶資料有誤', 商品資料: '商品資料有誤',
    跨系統對帳: '和系統總數不同', 期初期末結轉: '去年和今年接不上', 財報勾稽: '報表數字對不上', 匯入規則: '自訂規則',
  };
  // 規則清單的類型
  const LEVEL = {
    檔案: '檔案格式', 資料類型: '格式', 代碼: '代號', 單筆: '同一筆前後矛盾', 多筆: '同一張保單前後', 跨檔: '保單和理賠',
    邏輯合理性: '數字合理性', 疑似異常: '不太合理', 客戶資料: '客戶資料', 商品資料: '商品資料',
    財報: '報表數字', '財報×明細': '報表和理賠', 跨系統對帳: '系統總數', 期初期末結轉: '去年和今年', 匯入規則: '自訂規則',
  };
  // 和系統總數比對的結果
  const STATUS = { 一致: '相符', 時間差: '結帳日不同', 定義差: '算法不同', 待查: '需要追查', 格式錯誤: '格式有誤' };
  // 工作表 / 資料名稱 (Excel 工作表也用這些名稱)
  const SHEET = { L: '保單資料', D: '理賠資料', prior: '去年保單資料', C: '客戶資料', P: '商品資料', R: '系統總數', S: '資產負債表', CL: '癌症險保單資料', CD: '癌症險理賠資料', AL: '傷害險保單資料', AD: '傷害險理賠資料' };
  const cat = c => CAT[c] || c, level = l => LEVEL[l] || l, status = s => STATUS[s] || s;
  return { SEV, SEV_HINT, CAT, LEVEL, STATUS, SHEET, cat, level, status };
});
