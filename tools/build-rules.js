#!/usr/bin/env node
// 由 rules/source/ 的填報手冊產生 rules/rules.js：承保、給付欄位定義 (名稱、位置、格式、代碼表) 與檢核規則 (編號、說明、嚴重度、手冊頁碼)
// 需要 pdftotext (poppler-utils)。用法：node tools/build-rules.js
// 規則的條件邏輯在 src/rulesets/life.js；tests/rules-source.test.js 確認兩者的編號、嚴重度、欄位位置一致。
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const life = require('../src/rulesets/life.js');
const fin = require('../src/rulesets/finance.js');
const master = require('../src/master.js');
const anomaly = require('../src/anomaly.js');

const SRC = path.join(__dirname, '../rules/source');
const DOCS = {
  rules: { file: '新式個人壽險填報說明手冊範例&檢核規則_2025.pdf', title: '新式個人壽險填報說明手冊範例&檢核規則 (2025)' },
  manual: { file: '附件二_人壽保險業個人壽險填報手冊_2025填報年度.pdf', title: '附件二 人壽保險業個人壽險填報手冊 (2025 填報年度)' },
};
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rules-'));
const pages = {};
for (const [k, d] of Object.entries(DOCS)) {
  const out = path.join(tmp, k + '.txt');
  execFileSync('pdftotext', ['-layout', path.join(SRC, d.file), out]);
  pages[k] = fs.readFileSync(out, 'utf8').split('\f');
}
// 頁面上印的頁碼 (頁首右側，如「伍-14」；填報手冊為阿拉伯數字)
const label = (doc, n) => {
  const first = (pages[doc][n - 1] || '').split('\n').find(l => l.trim()) || '';
  const m = first.match(/([壹貳參肆伍陸柒]-\d+)\s*$/) || first.match(/\s(\d{1,3})\s*$/);
  return m ? m[1] : '';
};
const ref = (doc, n, note) => ({ doc, page: n, label: label(doc, n), ...(note ? { note } : {}) });
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hits = (doc, re, from = 1, to = Infinity) => pages[doc].map((p, i) => i + 1).filter(n => n >= from && n <= to && re.test(pages[doc][n - 1]));

// 檢核規則手冊的章節：參、欄位檢核 (條文) 46–66；肆、檢核程式項目及代碼表 67–78；檢核程式說明表 79–125
const SEC = { clause: [46, 66], codes: [67, 78], program: [79, 125] };
const OVERRIDE = {
  F001: ref('manual', 6, '參、一、資料總說明：檔案命名原則'),
  F002: ref('rules', 67, '肆、代碼表 106「檔案是空的」'),
  F003: ref('rules', 44, '貳、資料上傳格式：文字檔資料格式'),
  F004: ref('rules', 44, '貳、資料上傳格式：文字檔資料格式'),
  10300: ref('rules', 67, '肆、代碼表 101「總長度錯誤」、103「資料型態錯誤」'),
  10400: ref('rules', 67, '肆、代碼表 104「數字資料範圍錯誤」'),
  20000: ref('rules', 67, '肆、代碼表 2xx「代碼錯誤」'),
  L5501: ref('manual', 32, '承保欄 57 生存還本金給付條件'),
  L6101: ref('manual', 32, '承保欄 61 保留欄位'),
  LINS: ref('rules', 49, '加保別/退保別 INS 時保額欄位'),
  L5601: ref('rules', 57, '承保欄 58 生存還本金初次給付日期'),
  '30308_LD000': ref('rules', 63, '給付檔欄位=事故時承保檔欄位 (LD01–LD13)'),
  K0001: ref('rules', hits('rules', /30202_L0302/, ...SEC.clause)[0] || 46, '同保單異動序號不可重複'),
};

function sourceOf(c) {
  if (OVERRIDE[c.id]) return OVERRIDE[c.id];
  if (c.level === '邏輯合理性') return { doc: 'tool', note: '本工具補充的合理性檢查，手冊無對應條文' };
  const ids = [c.id, c.id.includes('_') ? c.id.split('_')[1] : null].filter(Boolean);
  for (const id of ids) {
    const re = new RegExp('(^|[^0-9A-Z_])' + esc(id) + '($|[^0-9])');
    const pick = hits('rules', re, ...SEC.clause)[0] || hits('rules', re, ...SEC.program)[0] || hits('rules', re, ...SEC.codes)[0] || hits('rules', re)[0];
    if (pick) {
      const prog = hits('rules', re, ...SEC.program)[0];
      return Object.assign(ref('rules', pick, id === c.id ? '' : `以舊編號 ${id} 查得`), prog && prog !== pick ? { program: prog } : {});
    }
  }
  return { doc: 'tool', note: '手冊未查得此編號' };
}

// 欄位定義：承保 填報手冊第 7–8 頁 (格式表)、說明 9–32 頁；給付 第 33 頁 (格式表)、說明 33–38 頁
const RANGE = { L: { table: 7, desc: [9, 32] }, D: { table: 33, desc: [33, 38] } };
const codeList = codes => Array.isArray(codes) ? codes : Object.keys(codes);
const fields = {};
for (const fid of ['L', 'D']) {
  const lay = life.layouts[fid];
  fields[fid] = { title: lay.title, recordLength: lay.recordLength, fileName: lay.fileName.pattern, page: ref('manual', RANGE[fid].table),
    fields: lay.fields.map(f => {
      const p = hits('manual', new RegExp(esc(f.name)), ...RANGE[fid].desc)[0] || hits('manual', new RegExp(esc(f.name.slice(-6))), ...RANGE[fid].desc)[0];
      const o = { no: f.no, key: f.key, name: f.name, start: f.start, end: f.start + f.len - 1, len: f.len, format: `${f.type}(${String(f.len).padStart(2, '0')})`, type: f.type === '9' ? '數字' : '文數字' };
      if (f.codes) {
        const list = codeList(f.codes);
        const tk = Object.keys(life.tables).find(k => { const t = life.tables[k]; const ks = Array.isArray(t) ? t : Object.keys(t); return ks.length === list.length && ks.every(x => list.includes(x)); });
        o.codeTable = f.codeTable || ''; o.codes = list; if (tk) o.table = tk;
      }
      if (f.typeRule) o.typeRule = f.typeRule;
      if (f.codeRule) o.codeRule = f.codeRule;
      if (p) o.page = ref('manual', p);
      return o;
    }) };
}
// 代碼表：名稱、代碼與中文說明
const tables = {};
for (const [k, v] of Object.entries(life.tables)) if (k !== 'zip' && k !== 'companyAlias') tables[k] = v;

const CAT = { 檔案: '格式', 資料類型: '格式', 代碼: '代碼', 單筆: '單筆邏輯', 多筆: '多筆邏輯', 跨檔: '跨檔', 邏輯合理性: '邏輯合理性' };
const fileOf = c => /LD|^30[3]\d{2}_/.test(c.id + c.ref) ? 'L/D' : /給付/.test(c.ref) || /_D\d|^D\d/.test(c.id) ? 'D' : /承保/.test(c.ref) || /_L\d|^L|^LU|^K|^30[12]\d{2}_P/.test(c.id) ? 'L' : 'L/D';
const rules = life.catalog.map(c => ({ id: c.id, name: c.name, category: CAT[c.level] || c.level, level: c.level, severity: c.severity, file: fileOf(c), ref: c.ref, source: sourceOf(c) }));
const tool = [].concat(
  master.catalog.map(c => ({ id: c.id, name: c.name, category: '主檔交叉比對', severity: c.severity || 'error', file: c.id.startsWith('PM') ? '商品資料' : '客戶資料', ref: c.ref || '', source: { doc: 'tool', note: '客戶／商品主檔與承保檔交叉比對 (本工具)' } })),
  fin.catalog.map(c => ({ id: c.id, name: c.name, category: c.level === '跨系統對帳' ? '跨系統對帳' : c.level === '期初期末結轉' ? '期初期末結轉' : '財報勾稽', severity: c.severity || 'error', file: c.level === '期初期末結轉' ? '上年度承保資料' : c.level === '跨系統對帳' ? '控制總數' : '資產負債表', ref: c.ref || '', source: { doc: 'tool', note: '會計科目表與對帳規則為示範用 (本工具)' } })),
  anomaly.catalog.map(c => ({ id: c.id, name: c.name, category: '合理性（疑似異常）', severity: 'suspect', file: c.id < 'A003' ? 'L' : 'D', ref: c.ref, source: { doc: 'tool', note: '疑似異常，需人工判斷 (本工具)' } })),
);

const data = { generatedBy: 'tools/build-rules.js', docs: Object.fromEntries(Object.entries(DOCS).map(([k, d]) => [k, d.title])), fields, tables, rules, toolRules: tool };
const body = `// 由 tools/build-rules.js 依 rules/source/ 的填報手冊產生，請勿手動修改。
// fields：承保 (L)、給付 (D) 欄位定義；rules：手冊檢核規則 (source.page 為 PDF 頁碼，label 為頁面上印的頁碼)；
// toolRules：本工具補充的主檔、對帳、財報、合理性規則。
(function (root, data) {
  if (typeof module === 'object' && module.exports) module.exports = data;
  else { root.DQ = root.DQ || {}; root.DQ.ruleSource = data; }
})(typeof self !== 'undefined' ? self : this, ${JSON.stringify(data, null, 1)});
`;
fs.writeFileSync(path.join(__dirname, '../rules/rules.js'), body);
fs.rmSync(tmp, { recursive: true, force: true });
const noPage = rules.filter(r => r.source.doc === 'tool');
console.log(`rules/rules.js：承保 ${fields.L.fields.length} 欄、給付 ${fields.D.fields.length} 欄；手冊規則 ${rules.length} 條 (有頁碼 ${rules.length - noPage.length}，本工具補充 ${noPage.length}：${noPage.map(r => r.id).join('、')})；其他本工具規則 ${tool.length} 條`);
