// 企畫書格式的 PowerPoint (16:9，可編輯)：提案摘要 + 01 提案概述 + 02 解決方案與架構 + 03 應用技術 + 04 預期效益 + 05 補充資料
//   node tools/evidence.js && node tools/evidence-pdf.js && node tools/proposal-pptx.js   輸出 docs/evidence/proposal.pptx
// 數字取自 docs/evidence/evidence.json，截圖取自 docs/evidence/img/ (皆由工具實跑產生，展示資料刻意含錯誤)。
// 團隊名稱與選擇的企業題目用【】佔位符，請在 PowerPoint 裡自行填入。
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'docs', 'evidence'), IMG = path.join(DIR, 'img');
const { summary: S, rows } = JSON.parse(fs.readFileSync(path.join(DIR, 'evidence.json'), 'utf8'));
const F = JSON.parse(fs.readFileSync(path.join(IMG, 'facts.json'), 'utf8'));
const life = require(path.join(ROOT, 'src', 'rule-stats.js')).count().cats.find(c => c.key === 'detail');

const TEAM = '【請填入團隊名稱】', TOPIC = '【請填入選擇的企業題目】', PRODUCT = '申報資料檢核助手';
const FONT = 'Microsoft JhengHei';
const K = { ink: '0B2E33', teal: '0F766E', mint: 'D1FAE5', pink: 'BE185D', gray: '6B7280', line: 'E5E7EB', soft: 'F3F6F7', red: 'B91C1C', redbg: 'FEE2E2', amber: '92400E', amberbg: 'FEF3C7', violet: '6D28D9', violetbg: 'F5F3FF', blue: '1D4ED8', bluebg: 'EFF6FF', white: 'FFFFFF' };
const W = 13.333, M = 0.6;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = `${PRODUCT}｜企畫書`;
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

const FOOT = { text: `${PRODUCT}｜企畫書　展示資料為依填報手冊製作、刻意含錯誤的模擬資料，非真實申報資料`, options: { x: M, y: 7.08, w: 11, h: 0.3, fontSize: 10, color: '9CA3AF', fontFace: FONT } };
pres.defineSlideMaster({
  title: 'COVER', background: { color: K.ink },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.3, w: 12, h: 1.4, fontSize: 40, bold: true, color: K.white, fontFace: FONT, valign: 'bottom', align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: M, y: 3.9, w: 12, h: 2.4, fontSize: 18, color: 'CBD5E1', fontFace: FONT, valign: 'top', align: 'left' }, text: '' } }],
});
pres.defineSlideMaster({
  title: 'CONTENT', background: { color: K.white },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.35, w: W - 2 * M, h: 0.7, fontSize: 28, bold: true, color: K.ink, fontFace: FONT, valign: 'middle', align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: M, y: 1.0, w: W - 2 * M, h: 0.4, fontSize: 14, color: K.gray, fontFace: FONT, valign: 'top', align: 'left' }, text: '' } },
    { text: FOOT }],
  slideNumber: { x: W - M - 0.6, y: 7.08, w: 0.6, h: 0.3, fontSize: 10, color: '9CA3AF', fontFace: FONT, align: 'right' },
});
pres.defineSlideMaster({
  title: 'DIVIDER', background: { color: K.teal },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.9, w: 12, h: 1.4, fontSize: 34, bold: true, color: K.white, fontFace: FONT, valign: 'middle', align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: M, y: 4.2, w: 12, h: 1.2, fontSize: 17, color: 'CFF2EC', fontFace: FONT, valign: 'top', align: 'left' }, text: '' } }],
});

const T = (slide, text, o) => slide.addText(text, Object.assign({ isTextBox: true, fontFace: FONT, fontSize: 14, color: K.ink, margin: 0.08, valign: 'top' }, o));
const box = (slide, o) => slide.addShape(pres.shapes.ROUNDED_RECTANGLE, Object.assign({ rectRadius: 0.08, fill: { color: K.white }, line: { color: K.line, width: 1 } }, o));
const bullets = (items, sz) => items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: sz || 6 } }));
const content = (section, title, sub) => { const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: section }); s.addText(title, { placeholder: 'title' }); if (sub) s.addText(sub, { placeholder: 'body' }); return s; };
const divider = (section, title, sub) => { const s = pres.addSlide({ masterName: 'DIVIDER', sectionTitle: section }); s.addText(title, { placeholder: 'title' }); if (sub) s.addText(sub, { placeholder: 'body' }); return s; };
const head = cols => cols.map(t => ({ text: t, options: { bold: true, fill: { color: K.soft }, color: K.ink } }));

// ========== 封面 ==========
pres.addSection({ title: '封面' });
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: '封面' });
  s.addText([{ text: 'AI 應用企畫書', options: { fontSize: 20, color: '7FD8C9', breakLine: true, bold: true } },
    { text: `${PRODUCT}`, options: {} }], { placeholder: 'title' });
  s.addText([
    { text: '在瀏覽器內，用規則引擎檢核保險年度申報資料：找出對不上規則的地方、說明依據、給可核對的修正。', options: { breakLine: true, fontSize: 18, color: K.white } },
    { text: `團隊名稱：${TEAM}`, options: { breakLine: true, fontSize: 16 } },
    { text: `選擇題目：${TOPIC}`, options: { breakLine: true, fontSize: 16 } },
    { text: `日期：${S.generatedAt.slice(0, 10)}（文中數字與截圖皆由工具實際執行產生）`, options: { fontSize: 14, color: '9FB4B0' } },
  ], { placeholder: 'body' });
}

// ========== 提案摘要 ==========
pres.addSection({ title: '提案摘要' });
{
  const s = content('提案摘要', '提案摘要', '協助評審快速掌握方案核心');
  const rowsSum = [
    ['團隊名稱', TEAM],
    ['選擇的題目', TOPIC],
    ['產品／服務名稱', `${PRODUCT}（單一網頁工具，可離線、可直接開啟）`],
    ['解決方案設計重點', '上傳申報資料 → 規則引擎找出問題並說明依據 → 逐筆確認後套用可核對的修正 → 疑似異常交人工判斷 → 匯出報告與稽核紀錄。資料只在瀏覽器內處理，不上傳。'],
    ['使用技術', '規則引擎（自訂 DSL、三值邏輯、十進位精度）為核心；AI（Claude）只做白話說明與整理，結論一律由規則引擎重算核對；安全技術：DOMPurify 防 XSS、送 AI 前個資遮蔽、提示注入標籤隔離、法規更新主管數位簽章核可。'],
    ['預期效益', `申報前自我檢查、減少退件往返。實測（模擬資料）：可判定錯誤 ${S.detected}/${S.judged} 全數檢出、漏報 ${S.missed}；正確版資料誤報 ${S.cleanIssues}；套用 ${S.fixApplied} 個建議值後問題 ${S.issuesBefore}→${S.issuesAfter}。`],
  ];
  const data = rowsSum.map(([k, v]) => [{ text: k, options: { bold: true, fill: { color: K.soft }, color: K.ink, valign: 'middle' } }, { text: v, options: { color: K.ink } }]);
  s.addTable(data, { x: M, y: 1.55, w: W - 2 * M, colW: [2.4, W - 2 * M - 2.4], fontFace: FONT, fontSize: 14, rowH: [0.4, 0.4, 0.55, 1.0, 1.1, 0.95], valign: 'middle', border: { type: 'solid', pt: 1, color: K.line }, margin: [0.06, 0.12, 0.06, 0.12], autoPage: false });
}

// ========== 01 提案概述 ==========
pres.addSection({ title: '01 提案概述' });
// 01-1 企業題目 + 三大痛點（每個痛點標出工具如何解）
{
  const s = content('01 提案概述', '01　提案概述：核心問題（三大痛點）', `選擇的企業題目：${TOPIC}（佔位符，請填入實際題目）`);
  const cw = (W - 2 * M - 2 * 0.3) / 3;
  const pains = [
    ['痛點 1｜跨系統整併的「時間差」斷層', [
      '財報要匯總銷售、理賠、投資等上游系統；各系統結帳時點或定義有微小差異，金額常兜不攏。',
      '缺乏自動依檢核規則驗證時，只能人工逐筆比對。'],
      '工具如何解：自動與各系統「控制總數」逐期比對，差異自動歸因（結帳日不同／定義不同／需追查），不必人工對帳。'],
    ['痛點 2｜跨欄位邏輯矛盾與代碼錯置', [
      '資產負債表各項加總不平、期初與期末結轉兜不攏。',
      '商品代號、會計科目代號輸入錯誤，或使用了已失效的舊代號。'],
      '工具如何解：財報勾稽（加總、上下層合計、資產＝負債）、期初期末結轉檢查、商品與科目代號比對（含停售日）。'],
    ['痛點 3｜退件除錯的「黑盒子」', [
      '退件常只給籠統代碼（如 Error 504：欄位驗證失敗），不指出哪一列、哪個變數。',
      '精算與財務人員得在數萬筆資料中重查，耗時極大。'],
      '工具如何解：每個問題定位到具體資料、第幾列、哪個欄位與檢核編號；退件通知可貼進「看懂退件通知」反查。'],
  ];
  pains.forEach(([title, body, fix], i) => {
    const x = M + i * (cw + 0.3);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: cw, h: 3.0, rectRadius: 0.08, fill: { color: 'FEF2F2' }, line: { color: 'FEF2F2' } });
    T(s, title, { x: x + 0.18, y: 1.72, w: cw - 0.36, h: 0.7, fontSize: 14.5, bold: true, color: K.red });
    T(s, bullets(body, 6), { x: x + 0.18, y: 2.5, w: cw - 0.36, h: 2.0, fontSize: 12.5 });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.75, w: cw, h: 2.1, rectRadius: 0.08, fill: { color: 'ECFDF5' }, line: { color: 'ECFDF5' } });
    T(s, fix, { x: x + 0.18, y: 4.88, w: cw - 0.36, h: 1.85, fontSize: 12.5, color: K.teal });
  });
}
// 01-2 價值主張、服務對象與核心需求
{
  const s = content('01 提案概述', '01　提案概述：價值主張與服務對象', '');
  const hw = (W - 2 * M - 0.3) / 2;
  const card = (x, y, w, h, title, color, bg, body) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: bg }, line: { color: bg } });
    T(s, title, { x: x + 0.2, y: y + 0.15, w: w - 0.4, h: 0.4, fontSize: 17, bold: true, color });
    T(s, body, { x: x + 0.2, y: y + 0.65, w: w - 0.4, h: h - 0.8, fontSize: 14 });
  };
  card(M, 1.55, hw, 3.1, '價值主張', K.blue, K.bluebg, bullets([
    '把「好幾天的人工對帳」變成幾秒的自動交叉邏輯驗證：跨系統對帳、財報勾稽、代碼比對一次跑完。',
    '把「籠統的退件代碼」變成可定位的逐列問題：每項都指到第幾列、哪個欄位、依據哪一條。',
    '每個修改都有建議值且可核對、不亂改；未違規但可疑的只提醒、交人工判斷。',
    '資料只在瀏覽器內處理、不上傳；可切換完全離線。'], 8));
  card(M + hw + 0.3, 1.55, hw, 3.1, '服務對象與核心需求', K.violet, K.violetbg, bullets([
    '對象：保險公司的精算、財務、申報人員，以及受理申報的內部或主管機關單位。',
    '需求：在龐大複雜的報表中快速定位錯誤、知道依據哪一條、拿到可直接套用的修正。',
    '需求：保護個資、流程可稽核（誰在何時改了什麼）、可離線作業。'], 8));
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 4.9, w: W - 2 * M, h: 1.9, rectRadius: 0.08, fill: { color: K.soft }, line: { color: K.soft } });
  T(s, '目標與邊界', { x: M + 0.2, y: 5.0, w: W - 2 * M - 0.4, h: 0.4, fontSize: 15, bold: true });
  T(s, [{ text: '目標是把申報失誤與退件風險降到最低、縮短對帳與除錯時間。', options: { breakLine: true, bullet: true, paraSpaceAfter: 4 } },
    { text: '工具是申報前的自我檢查，不是主管機關的正式審核，通過檢查不保證不被退件；判斷由規則引擎做、對得到條文，AI 只負責說明。', options: { bullet: true } }],
    { x: M + 0.2, y: 5.45, w: W - 2 * M - 0.4, h: 1.3, fontSize: 13.5, color: K.ink });
}

// ========== 02 解決方案與架構 ==========
pres.addSection({ title: '02 解決方案與架構' });
divider('02 解決方案與架構', '02　解決方案與架構說明', '整體架構、運作流程、操作體驗，以及痛點如何被解決');
// 02-1 架構圖
{
  const s = content('02 解決方案與架構', '整體方案架構：誰負責判斷、誰負責決定', '判斷對錯只由規則引擎做；AI 只負責說明與整理，結論要經規則引擎重算；修改與規則變更由人決定');
  const card = (x, y, w, h, title, items, color, bg, dash) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: bg }, line: { color, width: 1.5, dashType: dash ? 'dash' : 'solid' } });
    T(s, title, { x: x + 0.12, y: y + 0.08, w: w - 0.24, h: 0.4, fontSize: 15, bold: true, color, align: 'center' });
    T(s, Array.isArray(items) ? bullets(items, 2) : items, { x: x + 0.12, y: y + 0.5, w: w - 0.24, h: h - 0.58, fontSize: 12, paraSpaceAfter: 2, align: Array.isArray(items) ? 'left' : 'center' });
  };
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.55, w: 7.7, h: 5.3, rectRadius: 0.1, fill: { color: 'F9FAFB' }, line: { color: K.line } });
  T(s, '使用者的瀏覽器（資料不離開這裡）', { x: M + 0.15, y: 1.6, w: 5, h: 0.35, fontSize: 11, color: K.gray });
  card(M + 0.2, 2.05, 1.5, 1.2, '申報資料', 'TXT／CSV／Excel', K.gray, K.white);
  card(M + 2.05, 2.0, 2.65, 2.15, '規則引擎（判斷）', [`壽險手冊檢查 ${life ? life.n : ''} 條`, '主檔比對、跨系統對帳、財報勾稽', '同樣資料永遠同樣結果', '每個問題附檢核編號與條文', '能確定正確值時給建議值'], K.teal, 'ECFDF5');
  card(M + 5.05, 2.0, 2.5, 2.15, '人（決定）', ['逐筆確認後套用建議值', '判斷「請人工判斷」項目', '決定是否送出給 AI', '主管簽章核可規則更新'], K.blue, K.bluebg);
  card(M + 2.05, 4.55, 2.65, 2.1, '輸出', ['檢查報告、問題清單', '改好的資料（原檔不動）', '稽核紀錄：誰、何時、改了什麼'], K.gray, K.white);
  card(M + 5.05, 4.55, 2.5, 2.1, '送出前的關卡', ['遮蔽身分證、姓名、電話等', '顯示內容，使用者確認才送', '只送允許清單內的網址', '可切換「完全離線」'], K.amber, 'FFF7ED');
  card(8.65, 1.55, W - M - 8.65, 5.3, 'AI：Claude（選用，說明與整理）', ['claude.ai 線上版，用開啟者自己的帳號，不需金鑰', '白話解釋單一問題、整理重點、看懂退件通知', '把法規文件轉成規則草稿', '不判斷對錯、不修改資料', 'AI 說的筆數、建議值都由規則引擎重算驗證', 'AI 轉換的規則要主管核可才會套用', '回覆以純文字顯示，不執行', '送出前遮蔽個資、顯示完整內容讓使用者確認', '可切換「完全離線」，完全不連外部網站'], K.violet, K.violetbg);
  const arrow = (x, y, w, h, color, flip, dash) => s.addShape(pres.shapes.LINE, { x, y, w, h, flipV: flip === 'V', flipH: flip === 'H', line: { color, width: 1.75, endArrowType: 'triangle', dashType: dash ? 'dash' : 'solid' } });
  arrow(M + 1.7, 2.65, 0.35, 0, K.gray);
  arrow(M + 4.7, 3.05, 0.35, 0, K.gray);
  arrow(M + 5.05 + 1.25, 4.15, 0, 0.4, K.amber, false, true);
  arrow(M + 4.7, 4.15, 0.35, 0.4, K.gray, 'H');
  arrow(M + 7.55, 4.1, 0.5, 0, K.amber, false, true);
}
// 02-2 運作流程 (含痛點如何被解決)
{
  const s = content('02 解決方案與架構', '運作流程與操作體驗', '用一份「刻意含錯誤」的試用 Excel（7 張工作表）走完整流程');
  const STEPS = [
    ['1 上傳資料', `拖入一個 Excel，辨識 ${F.records} 種資料`, '對應痛點 1：多個上游系統的資料一次放入，自動辨識、幾秒內跑完'],
    ['2 找到問題', `列出 ${F.pending} 項待處理，依類型分組`, '對應痛點 1、2：跨系統對帳、財報勾稽、代碼比對的問題全部列出'],
    ['3 說明依據', '問題、怎麼改、依據的手冊條文與編號', '對應痛點 3：每項定位到第幾列、哪個欄位，不再是黑盒子'],
    ['4 確認或交人工', '看過依據後套用建議值；疑似異常只標示', '對應痛點 2：結轉、加總等可確定值的直接套用，其餘交人工'],
    ['5 匯出報告', '報告、問題清單、改好的資料、稽核紀錄', '對應痛點 1–3：系統總數比對與歸因、逐列問題、稽核軌跡'],
  ];
  const cw = (W - 2 * M - 4 * 0.25) / 5;
  STEPS.forEach(([t, d, pain], i) => {
    const x = M + i * (cw + 0.25);
    box(s, { x, y: 1.6, w: cw, h: 4.4, fill: { color: K.soft }, line: { color: K.soft } });
    s.addShape(pres.shapes.OVAL, { x: x + (cw - 0.5) / 2, y: 1.8, w: 0.5, h: 0.5, fill: { color: K.teal }, line: { color: K.teal } });
    T(s, String(i + 1), { x: x + (cw - 0.5) / 2, y: 1.8, w: 0.5, h: 0.5, fontSize: 18, bold: true, color: K.white, align: 'center', valign: 'middle', margin: 0 });
    T(s, t.replace(/^\d /, ''), { x: x + 0.1, y: 2.4, w: cw - 0.2, h: 0.6, fontSize: 15, bold: true, align: 'center' });
    T(s, d, { x: x + 0.12, y: 3.05, w: cw - 0.24, h: 1.4, fontSize: 12.5 });
    s.addShape(pres.shapes.LINE, { x: x + 0.12, y: 4.5, w: cw - 0.24, h: 0, line: { color: K.line } });
    T(s, pain, { x: x + 0.12, y: 4.6, w: cw - 0.24, h: 1.3, fontSize: 11.5, color: K.pink });
  });
}
// 02-3..7 五張實機畫面
const stepShot = (img, title, sub, lines) => {
  const s = content('02 解決方案與架構', title, sub);
  const iw = 8.4, ih = iw * 900 / 1440;
  s.addImage({ path: path.join(IMG, img), x: M, y: 1.5, w: iw, h: ih, altText: title });
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 1.5, w: iw, h: ih, fill: { type: 'none' }, line: { color: K.line, width: 1 } });
  T(s, bullets(lines, 10), { x: M + iw + 0.35, y: 1.5, w: W - 2 * M - iw - 0.35, h: ih, fontSize: 15 });
  return s;
};
stepShot('s1.png', '操作體驗 1：上傳資料', '資料只在瀏覽器內處理，不上傳', [`拖入含錯誤的試用 Excel，工具依工作表名稱分配成 ${F.records} 份資料並列出筆數。`, '「說明」「錯誤解答」不是申報資料，標示「沒有使用」。']);
stepShot('s2.png', '操作體驗 2：找到問題', '刻意含錯誤的資料，凸顯工具抓得到', [`上方卡片：資料正確比例、待修正 ${F.pending} 項、有建議值數量。`, '清單依「格式錯誤／內容矛盾／檔案對不上／總數不符／需人工判斷」分組。']);
stepShot('s3.png', '操作體驗 3：說明依據', '每個問題對得到手冊條文', ['點「年滿期 20 年，迄日應為起日+20年-1天」。', '右側三段：問題、怎麼改（建議值），以及依據（檢核編號 25204_L2005）。', '建議值由規則計算，不是 AI 產生。']);
stepShot('s4.png', '操作體驗 4：確認修正或交人工判斷', '不亂改：每個修改都要有人看過依據', [`看過依據後按「套用建議值」，只改這一筆並重新檢查（${F.note.replace(/。可以下載改好的資料。/, '')}）。`, '「保險期間起日後 45 天即發生身故」標示「請人工判斷」，沒有修改按鈕，交核保／理賠人員。']);
stepShot('s5.png', '操作體驗 5：匯出報告', '結果可核對、可稽核', ['檢查報告列出資料來源、各類問題數、與系統總數的比對與原因。', '可下載：檢查報告、問題清單（Excel）、改好的資料、稽核紀錄。']);

// ========== 03 應用技術 ==========
pres.addSection({ title: '03 應用技術' });
{
  const s = content('03 應用技術', '03　應用技術說明', '採用的 AI 與其它技術、選用原因，以及在哪些步驟發揮作用');
  const data = [head(['技術', '用途', '選用原因', '作用步驟'])].concat([
    ['規則引擎（自訂 DSL）', `依填報手冊把 ${life ? life.n : ''} 條檢核寫成可讀規則；三值邏輯、十進位精度（不經浮點）`, '判斷要固定、可追查、可逐條對到條文；金額比較不能失真', '找出問題（步驟 2）、給建議值（步驟 4）'],
    ['Claude（claude.ai 線上版）', '白話解釋單一問題、整理重點、看懂退件通知、把法規文件轉成規則草稿', '降低理解門檻；用開啟者自己的帳號、不需 API 金鑰', '說明（步驟 3）；結論一律由規則引擎重算驗證'],
    ['個資遮蔽（自建比對＋樣式）', '送 AI 前遮蔽身分證、姓名、地址、電話、Email、卡號；送出前再掃描一次', '保護被保險人個資；fail-closed：仍偵測到個資就不送', 'AI 送出前（步驟 3）'],
    ['提示注入防護', '使用者資料包在 <declaration_data> 標籤、加安全指示；偵測資料裡的指令並標示', '避免資料裡的惡意指令操控 AI', 'AI 送出與回覆（步驟 3）'],
    ['DOMPurify', '所有寫入畫面的內容先過濾，AI 回覆以純文字顯示', '防 DOM XSS（檔案、規則包、AI 回覆都可能夾帶）', '全程畫面渲染'],
    ['數位簽章核可（ECDSA P-256）', '法規更新包要主管私鑰簽章、驗章通過才套用', '避免未授權或被竄改的規則被套用', '法規更新流程'],
    ['SheetJS / DOMPurify 等前端元件', '解析 Excel、壓縮炸彈預檢、安全渲染', '純前端、免安裝、可離線、資料不出瀏覽器', '上傳與解析（步驟 1）'],
  ].map(r => r.map((c, i) => ({ text: c, options: i === 0 ? { bold: true, color: K.ink } : { color: K.ink } }))));
  s.addTable(data, { x: M, y: 1.5, w: W - 2 * M, colW: [2.5, 4.1, 3.3, 2.23], fontFace: FONT, fontSize: 11.5, valign: 'middle', border: { type: 'solid', pt: 0.5, color: K.line }, rowH: 0.7, margin: [0.04, 0.08, 0.04, 0.08], autoPage: false });
}

// ========== 04 預期效益與商業潛力 ==========
pres.addSection({ title: '04 預期效益與商業潛力' });
{
  const s = content('04 預期效益與商業潛力', '04　預期效益與商業潛力', '以量化／質化說明效益並回扣痛點，分三層標示驗證程度，避免過度宣稱');
  const cols = [
    ['已實測（模擬資料）', K.teal, 'ECFDF5', [`回扣痛點 1、2（對帳與邏輯）：可判定錯誤 ${S.detected}/${S.judged} 全數檢出、漏報 ${S.missed}，含跨系統總數差額與結轉、代碼等。`, `回扣「不亂改」：正確版資料誤報 ${S.cleanIssues}；套用 ${S.fixApplied} 個建議值後問題 ${S.issuesBefore}→${S.issuesAfter}，新產生 ${S.newAfterFix}。`, '自動化測試：單元 139 項、瀏覽器全數通過。']],
    ['合理估算（未實測）', K.amber, 'FFFBEB', ['回扣痛點 3（黑盒子）：籠統退件變成可定位的逐列問題，大幅縮短除錯時間。', '回扣「好幾天的人工對帳」：自動交叉邏輯驗證，可縮短對帳時間、減少退件往返。', '實際節省幅度須在真實作業中量測。']],
    ['商業潛力與落地', K.blue, K.bluebg, ['落地條件：純前端、免安裝、可離線，資料不出公司；法規版本需業務單位核實。', '擴大應用：同架構可擴到其他險種（已含癌症、傷害險）與其他格式嚴格的申報。', '可包成內部工具或 SaaS；規則更新走主管簽章核可，便於治理。']],
  ];
  const cw = (W - 2 * M - 2 * 0.3) / 3;
  cols.forEach(([t, c, bg, items], i) => {
    const x = M + i * (cw + 0.3);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.55, w: cw, h: 5.25, rectRadius: 0.08, fill: { color: bg }, line: { color: bg } });
    T(s, t, { x: x + 0.25, y: 1.7, w: cw - 0.5, h: 0.6, fontSize: 18, bold: true, color: c });
    T(s, bullets(items, 10), { x: x + 0.25, y: 2.35, w: cw - 0.5, h: 4.3, fontSize: 14.5 });
  });
}

// ========== 05 補充資料（不計入頁數） ==========
pres.addSection({ title: '05 補充資料' });
divider('05 補充資料', '05　補充資料／備註', '資料來源與假設、證據明細、測試方法、限制（本節不計入簡報頁數限制）');
// 05-1 資料來源與假設
{
  const s = content('05 補充資料', '資料來源、假設與方法', '');
  const hw = (W - 2 * M - 0.3) / 2;
  box(s, { x: M, y: 1.5, w: hw, h: 5.3 });
  T(s, '資料來源與假設', { x: M + 0.2, y: 1.6, w: hw - 0.4, h: 0.4, fontSize: 17, bold: true });
  T(s, bullets([
    '規則來源：主辦單位提供之個人壽險（2025 填報年度）、個人癌症保險（2024）、新式傷害保險（2021）填報手冊與檢核規則。',
    '測試資料：依手冊格式自建的模擬資料，刻意埋入已知錯誤並附「錯誤解答」，非真實申報資料。',
    `證據統計假設：檢核編號相同、且保單相同才算「檢出」；未判定 ${S.notJudgedNoId + S.notJudgedInactive} 項不計入分母（${S.notJudgedNoId} 項解答無編號、${S.notJudgedInactive} 項為預設未啟用的範例規則）。`,
    '「連帶問題」依同一張保單已在解答中判定，未逐筆人工確認因果。',
  ], 8), { x: M + 0.2, y: 2.05, w: hw - 0.4, h: 4.6, fontSize: 13.5 });
  box(s, { x: M + hw + 0.3, y: 1.5, w: hw, h: 5.3 });
  T(s, '測試方法與可重現', { x: M + hw + 0.5, y: 1.6, w: hw - 0.4, h: 0.4, fontSize: 17, bold: true });
  T(s, bullets([
    '證據表由工具在真正的頁面上實跑產生（放入資料與錯誤解答、逐項對照、套用建議值後重新檢查），可重跑。',
    '安全測試：紅隊實跑 XSS、提示注入、個資遮蔽繞過、惡意規則包、金鑰竊取等 payload，均擋下。',
    '限制與未驗證：真實公司資料的準確率、真實 Claude 模型的回應、正式部署環境、法規版本的業務核實，均尚未驗證。',
    `SheetJS 目前為 0.18.5（官方修補版 0.20.3 下載網域被擋）；解析前有壓縮檔預檢與原型污染防護。`,
  ], 8), { x: M + hw + 0.5, y: 2.05, w: hw - 0.4, h: 4.6, fontSize: 13.5 });
}
// 05-2 證據摘要卡
{
  const s = content('05 補充資料', '正確性證據摘要', `資料：${S.data}｜錯誤解答 ${S.keyRows} 項（皆為工具實跑結果）`);
  const strayKind = S.strayByKind || {}, unexplained = S.stray.filter(x => /可能誤報/.test(x.kind)).length;
  const cards = [
    ['可判定的解答項目', `${S.detected} / ${S.judged}`, `全部檢出，漏報 ${S.missed} 項`, S.missed ? K.red : K.teal],
    ['解答以外的問題', `${S.stray.length} 項`, `連帶 ${strayKind['連帶問題（同一保單已在解答）'] || 0}・系統總數差額 ${strayKind['系統總數差額（對應解答中沒有編號的項目）'] || 0}・無法解釋 ${unexplained}`, unexplained ? K.red : K.teal],
    ['正確版資料', `${S.cleanIssues} 項`, `誤報 ${S.cleanIssues} 項`, S.cleanIssues ? K.red : K.teal],
    [`套用 ${S.fixApplied} 個建議值後`, `${S.issuesBefore} → ${S.issuesAfter}`, `新產生問題 ${S.newAfterFix} 項`, S.newAfterFix ? K.red : K.teal],
  ];
  const cw = (W - 2 * M - 3 * 0.3) / 4;
  cards.forEach(([k, v, sub, c], i) => {
    const x = M + i * (cw + 0.3);
    box(s, { x, y: 1.7, w: cw, h: 1.9, fill: { color: K.soft }, line: { color: K.soft } });
    T(s, k, { x: x + 0.15, y: 1.82, w: cw - 0.3, h: 0.4, fontSize: 13, color: K.gray });
    T(s, v, { x: x + 0.15, y: 2.2, w: cw - 0.3, h: 0.75, fontSize: 34, bold: true, color: c });
    T(s, sub, { x: x + 0.15, y: 2.98, w: cw - 0.3, h: 0.55, fontSize: 12, color: K.ink });
  });
  T(s, '詳細逐項對照見下一頁起的「證據表」。數字全部由 tools/evidence.js 實跑產生，可重跑。', { x: M, y: 3.9, w: W - 2 * M, h: 0.5, fontSize: 13, color: K.gray });
}
// 05-3 證據表（分頁，每頁 ~15 列）
const SHORT = [[/已消失/, '套用建議值後已消失'], [/仍在/, '套用後仍在・人工修正'], [/有參考值/, '有參考值・人工修正原系統'], [/沒有建議值/, '無建議值・人工修正'], [/交人工判斷/, '交人工判斷（不修改）'], [/人工對照/, '人工對照差額']];
const short = o => (SHORT.find(([re]) => re.test(o)) || [0, o])[1];
const det = d => d === '檢出' ? ['檢出', K.teal, K.mint] : d === '漏報' ? ['漏報', K.red, K.redbg] : [/範例/.test(d) ? '未判定・規則未啟用' : '未判定・無檢核編號', K.gray, K.soft];
const PER = Math.ceil(rows.length / Math.ceil(rows.length / 15));
for (let i = 0; i < rows.length; i += PER) {
  const part = rows.slice(i, i + PER);
  const s = content('05 補充資料', `證據表（${i + 1}–${i + part.length} / ${rows.length}）`, '預期違反規則 → 實際是否檢出 → 漏報／未判定 → 修正後結果');
  const data = [head(['#', '檢核編號', '保單／案例', '預期問題（解答）', '實際', '工具標示', '修正後結果'])].concat(part.map(r => {
    const [t, c, bg] = det(r.detected);
    return [String(r.no), r.ruleId || '—', r.policy || '—', r.expected, { text: t, options: { color: c, fill: { color: bg }, bold: true } }, r.severity || '—', short(r.outcome)];
  }));
  s.addTable(data, { x: M, y: 1.5, w: W - 2 * M, colW: [0.4, 1.15, 1.75, 4.48, 1.55, 0.9, 1.9], fontFace: FONT, fontSize: 10, color: K.ink, rowH: 0.27, valign: 'middle', border: { type: 'solid', pt: 0.5, color: K.line }, margin: [0.02, 0.06, 0.02, 0.06], autoPage: false });
}
// 05-4 解答以外的問題（分兩頁）
for (let i = 0, n = Math.ceil(S.stray.length / 2); i < S.stray.length; i += n) {
  const part = S.stray.slice(i, i + n);
  const s = content('05 補充資料', `解答以外的問題（${i + 1}–${i + part.length} / ${S.stray.length}）`, '不在解答裡的問題全部列出，供評審自行核對是否為誤報');
  const data = [head(['分類', '檢核編號', '保單', '工具標示', '工具訊息'])].concat(part.map(x => [x.kind.replace(/（.*）/, ''), x.ruleId, x.policy || '—', x.severity, x.message]));
  s.addTable(data, { x: M, y: 1.5, w: W - 2 * M, colW: [1.6, 1.2, 1.9, 1.0, 6.43], fontFace: FONT, fontSize: 11, color: K.ink, rowH: 0.3, valign: 'middle', border: { type: 'solid', pt: 0.5, color: K.line }, margin: [0.03, 0.06, 0.03, 0.06], autoPage: false });
}
// 05-5 參考來源
{
  const s = content('05 補充資料', '參考來源與補充說明', '');
  T(s, bullets([
    '填報手冊與檢核規則：主辦單位提供之個人壽險（2025 填報年度）、個人癌症保險（2024 版）、新式傷害保險（2021 版）。工具內「檢查項目一覽」可逐條對應編號與手冊頁碼。',
    '法規版本核實狀態：目前標示為「尚未核實」，正式使用前須由業務單位核對最新版本；一律以正式手冊與退件通知為準。',
    'AI 技術補充：採用 claude.ai 線上版（開啟者自己的帳號）；AI 只負責說明與整理，輸出的筆數、建議值一律由規則引擎重算驗證，AI 不判斷對錯、不修改資料。部署者另可改接公司自建 AI 平台（Dify）作為來源，屬部署設定、非使用者介面，未在正式環境實測。',
    '安全技術補充：DOMPurify（XSS）、個資遮蔽（送 AI 前，fail-closed）、提示注入標籤隔離、法規更新 ECDSA P-256 主管簽章核可、Excel 壓縮炸彈預檢與原型污染防護。',
    '可重現：證據表與本頁數字由 tools/evidence.js、tools/evidence-pdf.js、tools/proposal-pptx.js 產生，資料與截圖皆為工具實跑結果。',
  ], 10), { x: M, y: 1.55, w: W - 2 * M, h: 5.2, fontSize: 14 });
}

const out = path.join(DIR, 'proposal.pptx');
pres.writeFile({ fileName: out }).then(() => console.log(`已輸出 ${out}（${(fs.statSync(out).size / 1048576).toFixed(1)} MB）`));
