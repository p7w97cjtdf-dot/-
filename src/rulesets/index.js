/*
 * 合併各險種規則集，讓工具一次檢查所有放入的資料：
 *   個人壽險 L/D、癌症保險 CL/CD、傷害保險 AL/AD
 * 各險種的檔案代號不重複，跨檔檢核只會看到自己險種的資料。
 */
(function (root, factory) {
  const isNode = typeof module === 'object' && module.exports;
  const list = isNode
    ? [require('./life.js'), require('./cancer.js'), (() => { try { return require('./accident.js'); } catch (e) { return null; } })()]
    : [root.DQ.rulesets.life, root.DQ.rulesets.cancer, root.DQ.rulesets.accident];
  const m = factory(list.filter(Boolean));
  if (isNode) module.exports = m; else root.DQ.rulesets.all = m;
})(typeof self !== 'undefined' ? self : this, function (list) {
  'use strict';
  const merged = { id: 'all', name: list.map(r => r.name).join('、'), layouts: {}, tables: list[0].tables, catalog: [], recordRules: {}, groupRules: {}, crossRules: [], products: list };
  for (const r of list) {
    Object.assign(merged.layouts, r.layouts);
    merged.catalog.push(...r.catalog.filter(c => !merged.catalog.some(x => x.id === c.id)));
    Object.assign(merged.recordRules, r.recordRules);
    Object.assign(merged.groupRules, r.groupRules || {});
    merged.crossRules.push(...(r.crossRules || []));
  }
  // 每個檔案屬於哪個險種
  merged.productOf = fid => list.find(r => r.layouts[fid]) || null;
  return merged;
});
