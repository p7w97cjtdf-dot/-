/*
 * 各險種規則依據的法規版本與核實狀態 (畫面頁尾、報告、稽核軌跡都讀這裡)
 *
 * 只記錄「工具實際依據的文件」與「有沒有向官方核實過那是最新版本」，不自行推測版本是否最新：
 *  - document：實作規則時依據的文件 (放在 rules/source/，檔名照原文件)
 *  - edition：文件上標示的版本；basis：文件首頁列出的最新函文；effective：文件記載的適用起點
 *  - officialSource：可以核對最新版本的官方來源
 *  - status：'verified' 只有在 lastVerified 有日期、而且有人向官方來源核對過時才可以填；
 *            其他一律 'unverified'，畫面顯示「尚未核實最新版本」
 *  - lastVerified：最後一次向官方來源核實是最新版本的日期 (沒有核實過就是 null)
 * 更新這個檔案要經過 Pull Request 審核 (和規則程式一樣)。
 */
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else { root.DQ = root.DQ || {}; root.DQ.ruleVersions = m; }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const TII = { name: '財團法人保險事業發展中心（保發中心）填報系統與手冊公告', url: 'https://www.tii.org.tw/' };
  const list = [
    {
      id: 'life', name: '個人壽險',
      document: '附件二_人壽保險業個人壽險填報手冊_2025填報年度.pdf、新式個人壽險填報說明手冊範例&檢核規則_2025.pdf',
      edition: '2025 填報年度',
      basis: '中華民國 113 年 8 月 26 日保局(財)字第 1130423918 號函（文件首頁列出的最新函文）',
      effective: '2025 填報年度（文件名稱標示）',
      officialSource: TII,
      documentRecordedAt: '2026-10-27',
      lastVerified: null,
      status: 'unverified',
      note: '尚未向保發中心確認 2025 填報年度之後是否有新版手冊或檢核規則。',
    },
    {
      id: 'cancer', name: '個人癌症保險',
      document: '新式癌症保險填報手冊_2024.pdf',
      edition: '2024 年版（文件標示「2024 填報年開始」）',
      basis: '中華民國 108 年 12 月 12 日金管保財字第 1080437999 號函（文件首頁列出）',
      effective: '2024 填報年度起（文件記載）',
      officialSource: TII,
      documentRecordedAt: '2026-10-27',
      lastVerified: null,
      status: 'unverified',
      note: '尚未向保發中心確認是否有 2024 年版之後的手冊。',
    },
    {
      id: 'accident', name: '個人傷害保險',
      document: '新式傷害保險填報手冊.docx',
      edition: '文件沒有標示版本年；工具標示 2021 是指 2021 填報年度起適用的新式格式',
      basis: '文件沒有列出函文',
      effective: '2021 填報年度起（文件記載）；文件也提到 2025 填報年度起的歷史資料修改流程',
      officialSource: TII,
      documentRecordedAt: '2026-10-27',
      lastVerified: null,
      status: 'unverified',
      note: '文件沒有版本年，無法判斷是否為最新版；尚未向保發中心核實。',
    },
  ];
  const STATUS = { verified: '已核實為最新版本', unverified: '尚未核實最新版本' };
  // 狀態只能是 verified (有核實日期與官方來源) 或 unverified；其他一律當成尚未核實
  const status = v => v && v.status === 'verified' && /^\d{4}-\d{2}-\d{2}$/.test(v.lastVerified || '') && v.officialSource && v.officialSource.url ? 'verified' : 'unverified';
  const label = v => status(v) === 'verified' ? `${STATUS.verified}（${v.lastVerified} 核實）` : STATUS.unverified;
  const get = id => list.find(v => v.id === id);
  const allVerified = () => list.every(v => status(v) === 'verified');
  return { list, STATUS, status, label, get, allVerified };
});
