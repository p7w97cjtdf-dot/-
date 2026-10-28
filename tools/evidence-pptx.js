// 證據與三分鐘展示流程的 PowerPoint 版 (16:9，可編輯)：內容與 evidence-demo.pdf 相同
//   node tools/evidence.js && node tools/evidence-pdf.js && node tools/evidence-pptx.js   輸出 docs/evidence/evidence-demo.pptx
// 需要 pptxgenjs (npm install --no-save pptxgenjs)；數字取自 docs/evidence/evidence.json，截圖取自 docs/evidence/img/
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');

const ROOT = path.join(__dirname, '..'), DIR = path.join(ROOT, 'docs', 'evidence'), IMG = path.join(DIR, 'img');
const { summary: S, rows } = JSON.parse(fs.readFileSync(path.join(DIR, 'evidence.json'), 'utf8'));
const F = JSON.parse(fs.readFileSync(path.join(IMG, 'facts.json'), 'utf8'));
const life = require(path.join(ROOT, 'src', 'rule-stats.js')).count().cats.find(c => c.key === 'detail');

const FONT = 'Microsoft JhengHei';
const K = { ink: '0B2E33', teal: '0F766E', mint: 'D1FAE5', pink: 'BE185D', gray: '6B7280', line: 'E5E7EB', soft: 'F3F6F7', red: 'B91C1C', redbg: 'FEE2E2', amber: '92400E', amberbg: 'FEF3C7', violet: '6D28D9', violetbg: 'F5F3FF', blue: '1D4ED8', bluebg: 'EFF6FF', white: 'FFFFFF' };
const W = 13.333, M = 0.6;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE';
pres.title = '申報資料檢核助手｜正確性證據與三分鐘展示';
pres.theme = { headFontFace: FONT, bodyFontFace: FONT };

const FOOT = { text: '申報資料檢核助手｜資料為模擬資料，非真實申報資料', options: { x: M, y: 7.08, w: 9, h: 0.3, fontSize: 10, color: '9CA3AF', fontFace: FONT } };
pres.defineSlideMaster({
  title: 'COVER', background: { color: K.ink },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.4, w: 12, h: 1.2, fontSize: 44, bold: true, color: K.white, fontFace: FONT, valign: 'bottom', align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: M, y: 3.75, w: 12, h: 2.2, fontSize: 18, color: 'CBD5E1', fontFace: FONT, valign: 'top', align: 'left' }, text: '' } }],
});
pres.defineSlideMaster({
  title: 'CONTENT', background: { color: K.white },
  objects: [{ placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.35, w: W - 2 * M, h: 0.7, fontSize: 30, bold: true, color: K.ink, fontFace: FONT, valign: 'middle', align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: M, y: 1.02, w: W - 2 * M, h: 0.4, fontSize: 14, color: K.gray, fontFace: FONT, valign: 'top', align: 'left' }, text: '' } },
    { text: FOOT }],
  slideNumber: { x: W - M - 0.6, y: 7.08, w: 0.6, h: 0.3, fontSize: 10, color: '9CA3AF', fontFace: FONT, align: 'right' },
});

const T = (slide, text, o) => slide.addText(text, Object.assign({ isTextBox: true, fontFace: FONT, fontSize: 14, color: K.ink, margin: 0.08, valign: 'top' }, o));
const box = (slide, o) => slide.addShape(pres.shapes.ROUNDED_RECTANGLE, Object.assign({ rectRadius: 0.08, fill: { color: K.white }, line: { color: K.line, width: 1 } }, o));
const bullets = items => items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 6 } }));
const content = (section, title, sub) => { const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: section }); s.addText(title, { placeholder: 'title' }); if (sub) s.addText(sub, { placeholder: 'body' }); return s; };

// ---------- 封面 ----------
pres.addSection({ title: '封面' });
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: '封面' });
  s.addText('申報資料檢核助手', { placeholder: 'title' });
  s.addText([{ text: '正確性證據表・三分鐘展示流程・架構與分工', options: { breakLine: true, fontSize: 22, color: K.white } },
    { text: `數字全部由工具實際執行產生（tools/evidence.js），測試資料為依填報手冊製作、刻意埋入已知錯誤的模擬資料。產生日期：${S.generatedAt.slice(0, 10)}`, options: { fontSize: 15 } }], { placeholder: 'body' });
}

// ---------- 證據 ----------
pres.addSection({ title: '正確性證據' });
const strayKind = S.strayByKind || {}, unexplained = S.stray.filter(x => /可能誤報/.test(x.kind)).length;
{
  const s = content('正確性證據', '證據摘要：判得對、不亂改、可核對', `資料：${S.data}｜錯誤解答 ${S.keyRows} 項`);
  const cards = [
    ['可判定的解答項目', `${S.detected} / ${S.judged}`, `全部檢出，漏報 ${S.missed} 項`, S.missed ? K.red : K.teal],
    ['解答以外的問題', `${S.stray.length} 項`, `連帶 ${strayKind['連帶問題（同一保單已在解答）'] || 0}・系統總數差額 ${strayKind['系統總數差額（對應解答中沒有編號的項目）'] || 0}・無法解釋 ${unexplained}`, unexplained ? K.red : K.teal],
    ['正確版資料', `${S.cleanIssues} 項`, `誤報 ${S.cleanIssues} 項`, S.cleanIssues ? K.red : K.teal],
    [`套用 ${S.fixApplied} 個建議值後`, `${S.issuesBefore} → ${S.issuesAfter}`, `因修改而新產生的問題 ${S.newAfterFix} 項`, S.newAfterFix ? K.red : K.teal],
  ];
  const cw = (W - 2 * M - 3 * 0.3) / 4;
  cards.forEach(([k, v, sub, c], i) => {
    const x = M + i * (cw + 0.3);
    box(s, { x, y: 1.65, w: cw, h: 1.75, fill: { color: K.soft }, line: { color: K.soft } });
    T(s, k, { x: x + 0.15, y: 1.75, w: cw - 0.3, h: 0.35, fontSize: 13, color: K.gray });
    T(s, v, { x: x + 0.15, y: 2.1, w: cw - 0.3, h: 0.75, fontSize: 36, bold: true, color: c });
    T(s, sub, { x: x + 0.15, y: 2.85, w: cw - 0.3, h: 0.5, fontSize: 12, color: K.ink });
  });
  const hw = (W - 2 * M - 0.3) / 2;
  box(s, { x: M, y: 3.7, w: hw, h: 3.15 });
  T(s, '怎麼算', { x: M + 0.2, y: 3.8, w: hw - 0.4, h: 0.4, fontSize: 17, bold: true });
  T(s, bullets([
    '放入 7 份模擬資料與錯誤解答，由工具逐項對照：檢核編號相同、且保單相同才算檢出。',
    `未判定 ${S.notJudgedNoId + S.notJudgedInactive} 項不計入分母：${S.notJudgedNoId} 項解答沒有檢核編號（系統總數時間差，工具列出差額供人工對照）、${S.notJudgedInactive} 項是預設未啟用的範例自訂規則。`,
    '「套用建議值」用工具本身的修改功能，等同每筆都按下「套用建議值」；改完自動重新檢查。']), { x: M + 0.2, y: 4.2, w: hw - 0.4, h: 2.55, fontSize: 14 });
  box(s, { x: M + hw + 0.3, y: 3.7, w: hw, h: 3.15 });
  T(s, '限制（不代表的事）', { x: M + hw + 0.5, y: 3.8, w: hw - 0.4, h: 0.4, fontSize: 17, bold: true });
  T(s, bullets(['這是模擬資料的結果，不等於真實申報資料的準確率。', '「連帶問題」依同一張保單已在解答中判定，沒有逐筆人工確認因果。', '規則依據的法規版本狀態為「尚未核實」，正式使用前須由業務單位核對。']),
    { x: M + hw + 0.5, y: 4.2, w: hw - 0.4, h: 2.55, fontSize: 14 });
}
// 證據表
const SHORT = [[/已消失/, '套用建議值後已消失'], [/仍在/, '套用後仍在・人工修正'], [/有參考值/, '有參考值・人工修正原系統'], [/沒有建議值/, '無建議值・人工修正'], [/交人工判斷/, '交人工判斷（不修改）'], [/人工對照/, '人工對照差額']];
const short = o => (SHORT.find(([re]) => re.test(o)) || [0, o])[1];
const det = d => d === '檢出' ? ['檢出', K.teal, K.mint] : d === '漏報' ? ['漏報', K.red, K.redbg] : [/範例/.test(d) ? '未判定・規則未啟用' : '未判定・無檢核編號', K.gray, K.soft];
const head = cols => cols.map(t => ({ text: t, options: { bold: true, fill: { color: K.soft }, color: K.ink } }));
const PER = Math.ceil(rows.length / Math.ceil(rows.length / 15));  // 每頁最多 15 列，平均分配
for (let i = 0; i < rows.length; i += PER) {
  const part = rows.slice(i, i + PER);
  const s = content('正確性證據', `證據表（${i + 1}–${i + part.length} / ${rows.length}）`, '預期違反規則 → 實際是否檢出 → 漏報／未判定 → 修正後結果');
  const data = [head(['#', '檢核編號', '保單／案例', '預期問題（解答）', '實際', '工具標示', '修正後結果'])].concat(part.map(r => {
    const [t, c, bg] = det(r.detected);
    return [String(r.no), r.ruleId || '—', r.policy || '—', r.expected, { text: t, options: { color: c, fill: { color: bg }, bold: true } }, r.severity || '—', short(r.outcome)];
  }));
  s.addTable(data, { x: M, y: 1.5, w: W - 2 * M, colW: [0.4, 1.15, 1.75, 4.48, 1.55, 0.9, 1.9], fontFace: FONT, fontSize: 10, color: K.ink, rowH: 0.27, valign: 'middle', border: { type: 'solid', pt: 0.5, color: K.line }, margin: [0.02, 0.06, 0.02, 0.06], autoPage: false });
  T(s, '修正後結果：「套用建議值後已消失」= 規則算出正確值，套用後重新檢查已不再出現；「無建議值・人工修正」= 工具無法確定正確值，由人修正原始資料；「有參考值・人工修正原系統」= 對帳或報表資料，工具列出參考值但不修改；「交人工判斷」= 疑似異常，不提供修改。',
    { x: M, y: 6.55, w: W - 2 * M, h: 0.45, fontSize: 10, color: K.gray });
}
for (let i = 0, n = Math.ceil(S.stray.length / 2); i < S.stray.length; i += n) {
  const part = S.stray.slice(i, i + n);
  const s = content('正確性證據', `解答以外的問題（${i + 1}–${i + part.length} / ${S.stray.length}）`, '不在解答裡的問題全部列出，讓評審自行核對是否為誤報');
  const data = [head(['分類', '檢核編號', '保單', '工具標示', '工具訊息'])].concat(part.map(x => [x.kind.replace(/（.*）/, ''), x.ruleId, x.policy || '—', x.severity, x.message]));
  s.addTable(data, { x: M, y: 1.5, w: W - 2 * M, colW: [1.6, 1.2, 1.9, 1.0, 6.43], fontFace: FONT, fontSize: 11, color: K.ink, rowH: 0.3, valign: 'middle', border: { type: 'solid', pt: 0.5, color: K.line }, margin: [0.03, 0.06, 0.03, 0.06], autoPage: false });
}

// ---------- 三分鐘展示 ----------
pres.addSection({ title: '三分鐘展示' });
const STEPS = [
  ['0:00–0:25', '上傳資料', `拖入一個 Excel；工具辨識 ${F.records} 種資料。資料只在瀏覽器裡處理。`],
  ['0:25–1:00', '找到問題', `${F.pending} 項待處理，依類型分組；先看「必須修改」。`],
  ['1:00–1:40', '說明依據', '點一項：問題、怎麼改、依據的手冊條文與檢核編號。'],
  ['1:40–2:30', '確認修正或交人工', '有建議值的看過後套用；疑似異常只標示，交人工判斷。'],
  ['2:30–3:00', '匯出報告', '檢查報告、問題清單、改好的資料、稽核紀錄。'],
];
{
  const s = content('三分鐘展示', '三分鐘展示流程', '固定路線，每一步都用同一份試用資料（一個 Excel 檔，7 張工作表）');
  const cw = (W - 2 * M - 4 * 0.25) / 5;
  STEPS.forEach(([time, t, d], i) => {
    const x = M + i * (cw + 0.25);
    box(s, { x, y: 1.6, w: cw, h: 2.55, fill: { color: K.soft }, line: { color: K.soft } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: 1.8, w: 0.5, h: 0.5, fill: { color: K.teal }, line: { color: K.teal } });
    T(s, String(i + 1), { x: x + 0.2, y: 1.8, w: 0.5, h: 0.5, fontSize: 18, bold: true, color: K.white, align: 'center', valign: 'middle', margin: 0 });
    T(s, time, { x: x + 0.8, y: 1.85, w: cw - 0.9, h: 0.4, fontSize: 12, color: K.pink, bold: true, valign: 'middle' });
    T(s, t, { x: x + 0.15, y: 2.42, w: cw - 0.3, h: 0.45, fontSize: 17, bold: true });
    T(s, d, { x: x + 0.15, y: 2.9, w: cw - 0.3, h: 1.2, fontSize: 13 });
  });
  const hw = (W - 2 * M - 0.3) / 2;
  box(s, { x: M, y: 4.45, w: hw, h: 2.4 });
  T(s, '展示時要講的三句話', { x: M + 0.2, y: 4.55, w: hw - 0.4, h: 0.4, fontSize: 17, bold: true });
  T(s, bullets(['判斷由規則引擎做，每個問題都對得到手冊條文。', '工具不會自動改資料：每個修改都要有人看過依據。', '看起來不合理但沒有違規的，只提醒，交給人判斷。']), { x: M + 0.2, y: 5.0, w: hw - 0.4, h: 1.75, fontSize: 15 });
  box(s, { x: M + hw + 0.3, y: 4.45, w: hw, h: 2.4 });
  T(s, '不要展示的', { x: M + hw + 0.5, y: 4.55, w: hw - 0.4, h: 0.4, fontSize: 17, bold: true });
  T(s, bullets(['AI 功能（需連網、結果會變動；三分鐘內不展示）。', '規則更新與主管核可（另附說明）。']), { x: M + hw + 0.5, y: 5.0, w: hw - 0.4, h: 1.75, fontSize: 15 });
}
const stepSlide = (i, img, lines, notes) => {
  const [time, t] = STEPS[i];
  const s = content('三分鐘展示', `STEP ${i + 1}｜${t}`, time);
  const iw = 8.4, ih = iw * 900 / 1440;
  s.addImage({ path: path.join(IMG, img), x: M, y: 1.55, w: iw, h: ih, altText: `工具畫面：${t}` });
  s.addShape(pres.shapes.RECTANGLE, { x: M, y: 1.55, w: iw, h: ih, fill: { type: 'none' }, line: { color: K.line, width: 1 } });
  T(s, lines.map((l, k) => ({ text: l, options: { breakLine: k < lines.length - 1, paraSpaceAfter: 10 } })), { x: M + iw + 0.35, y: 1.55, w: W - 2 * M - iw - 0.35, h: ih, fontSize: 15 });
  s.addNotes(notes);
};
stepSlide(0, 's1.png', ['把試用資料 Excel 拖進上方框。', `工具依工作表名稱分配成 ${F.records} 份資料，列出每份的筆數；「說明」「錯誤解答」不是申報資料，標示「沒有使用」。`, '資料只在瀏覽器裡讀取與檢查，不上傳伺服器。'],
  '把這個 Excel 拖進來。工具依工作表名稱自動分配成七份資料，每份多少筆都列出來。資料只在瀏覽器裡處理，不會上傳。');
stepSlide(1, 's2.png', [`上方三張卡片：資料正確比例、待修正 ${F.pending} 項、有建議值的數量。`, '清單依「格式錯誤／內容矛盾／檔案對不上／總數不符／需人工判斷」分組。'],
  `幾秒鐘就檢查完。待修正 ${F.pending} 項，依類型分組，先看必須修改的。`);
stepSlide(2, 's3.png', ['點「年滿期 20 年，迄日應為起日+20年-1天」。', '右側三段：問題、怎麼改（建議值 20321117）、依據（檢核編號 25204_L2005）。', '建議值由規則計算，不是 AI 產生。'],
  '點一項看說明：問題是什麼、要怎麼改、依據手冊哪一條。這個建議值是規則算出來的，不是 AI 猜的。');
stepSlide(3, 's4.png', [`看過依據後按「套用建議值」：只改這一筆並重新檢查（畫面顯示「${F.note.replace(/。可以下載改好的資料。/, '')}」）。`, '再點「保險期間起日後 45 天即發生身故」：標示「請人工判斷」，沒有修改按鈕——不違規但可疑，交給核保／理賠人員。'],
  '看過依據才按套用，一次只改一筆，改完馬上重新檢查。這一項是起保 45 天就身故，不違反規定但可疑，工具只提醒，不給修改按鈕，交給人判斷。');
stepSlide(4, 's5.png', ['檢查報告列出資料來源、各類問題數、系統總數比對與原因（結帳日不同、算法不同、需要追查）。', '可下載：檢查報告、問題清單（Excel）、改好的資料、稽核紀錄（誰改了什麼）。'],
  '最後匯出報告：問題數、跟各系統總數的比對和原因，還有稽核紀錄，誰在什麼時候改了什麼都查得到。');

// ---------- 架構 ----------
pres.addSection({ title: '架構與效益' });
{
  const s = content('架構與效益', '架構與分工：誰負責判斷、誰負責決定', '判斷對錯只由規則引擎做；AI 只負責說明與整理，結論要經規則引擎重算；修改與規則變更由人決定');
  const card = (x, y, w, h, title, items, color, bg, dash) => {
    const body = Array.isArray(items) ? bullets(items) : items;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: bg }, line: { color, width: 1.5, dashType: dash ? 'dash' : 'solid' } });
    T(s, title, { x: x + 0.12, y: y + 0.08, w: w - 0.24, h: 0.4, fontSize: 15, bold: true, color, align: 'center' });
    T(s, body, { x: x + 0.12, y: y + 0.5, w: w - 0.24, h: h - 0.58, fontSize: 12, paraSpaceAfter: 2, align: Array.isArray(items) ? 'left' : 'center' });
  };
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: M, y: 1.55, w: 7.7, h: 5.3, rectRadius: 0.1, fill: { color: 'F9FAFB' }, line: { color: K.line } });
  T(s, '使用者的瀏覽器（資料不離開這裡）', { x: M + 0.15, y: 1.6, w: 5, h: 0.35, fontSize: 11, color: K.gray });
  card(M + 0.2, 2.05, 1.5, 1.2, '申報資料', 'TXT／CSV／Excel', K.gray, K.white);
  card(M + 2.05, 2.0, 2.65, 2.15, '規則引擎（判斷）', [`壽險手冊檢查 ${life ? life.n : ''} 條`, '主檔比對、跨系統對帳、財報勾稽', '同樣資料永遠同樣結果', '每個問題附檢核編號與條文', '能確定正確值時給建議值'], K.teal, 'ECFDF5');
  card(M + 5.05, 2.0, 2.5, 2.15, '人（決定）', ['逐筆確認後套用建議值', '判斷「請人工判斷」項目', '決定是否送出給 AI', '主管簽章核可規則更新'], K.blue, K.bluebg);
  card(M + 2.05, 4.55, 2.65, 2.1, '輸出', ['檢查報告、問題清單', '改好的資料（原檔不動）', '稽核紀錄：誰、何時、改了什麼'], K.gray, K.white);
  card(M + 5.05, 4.55, 2.5, 2.1, '送出前的關卡', ['遮蔽身分證、姓名、電話等', '顯示內容，使用者確認才送', '只送允許清單內的網址', '可切換「完全離線」'], K.amber, 'FFF7ED');
  card(8.65, 1.55, W - M - 8.65, 5.3, 'AI：Claude（選用，說明與整理）', ['claude.ai 線上版，用開啟者自己的帳號，不需金鑰', '白話解釋單一問題、整理重點、看懂退件通知', '把法規文件轉成規則草稿', '不判斷對錯、不修改資料', 'AI 說的筆數、建議值都由規則引擎重算驗證', 'AI 轉換的規則要主管核可才會套用', '回覆以純文字顯示，不執行', '送出前遮蔽個資、顯示完整內容讓使用者確認', '可切換「完全離線」，完全不連外部網站', '部署者另可改接公司自建 AI 平台（Dify）作為來源，屬部署設定、非使用者介面；未在正式環境實測'], K.violet, K.violetbg);
  const arrow = (x, y, w, h, color, flip, dash) => s.addShape(pres.shapes.LINE, { x, y, w, h, flipV: flip === 'V', flipH: flip === 'H', line: { color, width: 1.75, endArrowType: 'triangle', dashType: dash ? 'dash' : 'solid' } });
  arrow(M + 1.7, 2.65, 0.35, 0, K.gray);
  arrow(M + 4.7, 3.05, 0.35, 0, K.gray);
  arrow(M + 5.05 + 1.25, 4.15, 0, 0.4, K.amber, false, true);
  arrow(M + 4.7, 4.15, 0.35, 0.4, K.gray, 'H');
  arrow(M + 7.55, 4.1, 0.5, 0, K.amber, false, true);
}
{
  const s = content('架構與效益', '效益與驗證程度', '分三個層次標示，避免把估算或未驗證的說成已實測');
  const cols = [
    ['已實測', K.teal, 'ECFDF5', [`模擬資料：可判定 ${S.judged} 項錯誤全部檢出，漏報 ${S.missed}。`, `正確版資料誤報 ${S.cleanIssues} 項；解答以外 ${S.stray.length} 項皆可歸為連帶或系統總數差額。`, `套用 ${S.fixApplied} 個建議值後問題 ${S.issuesBefore} → ${S.issuesAfter}，新產生 ${S.newAfterFix} 項。`, '自動化測試（2026-10-28 執行）：單元 139 項、瀏覽器 15 組全數通過。']],
    ['合理估算（未實測）', K.amber, 'FFFBEB', ['人工逐欄核對改為只看工具列出的問題，可縮短檢核時間；實際節省幅度須在真實作業中量測。', '退件前先找出必須修改的問題，可望減少退件往返次數。']],
    ['尚未驗證', K.red, 'FEF2F2', ['真實公司申報資料的準確率。', '真實 Claude 模型的回應品質與提示注入防護。', '正式部署環境（安全政策、代理伺服器、正式金鑰簽章）。', '法規條文版本的業務核實。']],
  ];
  const cw = (W - 2 * M - 2 * 0.3) / 3;
  cols.forEach(([t, c, bg, items], i) => {
    const x = M + i * (cw + 0.3);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.6, w: cw, h: 5.25, rectRadius: 0.08, fill: { color: bg }, line: { color: bg } });
    T(s, t, { x: x + 0.25, y: 1.75, w: cw - 0.5, h: 0.5, fontSize: 20, bold: true, color: c });
    T(s, bullets(items), { x: x + 0.25, y: 2.35, w: cw - 0.5, h: 4.35, fontSize: 15, paraSpaceAfter: 10 });
  });
}

const out = path.join(DIR, 'evidence-demo.pptx');
pres.writeFile({ fileName: out }).then(() => console.log(`已輸出 ${out}（${(fs.statSync(out).size / 1048576).toFixed(1)} MB）`));
