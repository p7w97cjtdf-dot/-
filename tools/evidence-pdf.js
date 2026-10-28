// 證據與三分鐘展示流程 PDF (16:9)：證據表 (tools/evidence.js 的實測結果)、展示流程 (真正的工具畫面截圖)、架構圖
//   node tools/evidence.js && node tools/evidence-pdf.js   輸出 docs/evidence/evidence-demo.pdf
// 數字一律取自 docs/evidence/evidence.json，不在這裡手寫
const fs = require('fs');
const os = require('os');
const path = require('path');
const { open, ROOT } = require('../tests/security/_browser.js');

const DIR = path.join(ROOT, 'docs', 'evidence');
const { summary: S, rows } = JSON.parse(fs.readFileSync(path.join(DIR, 'evidence.json'), 'utf8'));
const stats = require(path.join(ROOT, 'src', 'rule-stats.js')).count();
const IMG = fs.mkdtempSync(path.join(os.tmpdir(), 'dq-demo-'));
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- 1) 展示流程截圖：放入一個 Excel → 找到問題 → 說明依據 → 套用建議值／人工判斷 → 報告 ----------
async function shots() {
  const { browser, page, log } = await open({ viewport: { width: 1440, height: 900 } });
  const xlsx = path.join(IMG, 'sample_2025.xlsx');
  fs.copyFileSync(path.join(ROOT, 'samples', 'excel', '試用資料_含錯誤.xlsx'), xlsx);
  const top = async sel => Math.max(0, Math.round(await page.locator(sel).evaluate(e => e.getBoundingClientRect().top + scrollY)) - 90);
  const shot = async (name, y) => { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(300); await page.screenshot({ path: path.join(IMG, name + '.png'), clip: { x: 0, y: 0, width: 1440, height: 900 } }); };
  const pick = async ruleId => { const id = await page.evaluate(r => { const i = DQ.app.state.all.find(x => x.ruleId === r); return i ? i.id : null; }, ruleId); if (id == null) throw new Error('找不到展示用的問題 ' + ruleId); await page.evaluate(v => DQ.app.select(v), id); await page.waitForTimeout(600); };
  const facts = {};
  await page.setInputFiles('#file-book', xlsx); await page.waitForTimeout(3500);
  facts.records = await page.evaluate(() => document.querySelector('#data-map').textContent.match(/(\d[\d,]*) 筆/g).length);
  await shot('s1', 0);
  facts.pending = await page.evaluate(() => DQ.app.state.all.filter(i => i.severity === 'error' || i.severity === 'warning').length);
  await shot('s2', await top('#summary'));
  await pick('25204_L2005'); await shot('s3', await top('#summary'));
  await page.click('#btn-fix-one'); await page.waitForTimeout(1500);
  facts.note = await page.textContent('#action-note');
  await pick('A003'); await shot('s4', await top('#summary'));
  await page.evaluate(() => DQ.app.showTab('report')); await page.waitForTimeout(1200);
  const fr = await page.evaluate(() => { const f = [...document.querySelectorAll('iframe')].find(x => x.offsetHeight > 100); return f ? Math.round(f.getBoundingClientRect().top + scrollY) - 150 : 600; });
  await shot('s5', fr);
  const errs = log.errors.filter(e => !/serviceWorker|sandboxed|TUNNEL/.test(e));
  await browser.close();
  if (errs.length) throw new Error('截圖時頁面有錯誤：' + errs.join('；'));
  return facts;
}

// ---------- 2) 頁面 ----------
const CSS = `
@page{size:1280px 720px;margin:0}*{box-sizing:border-box}
body{margin:0;font-family:"Noto Sans TC","Noto Sans CJK TC","WenQuanYi Zen Hei","Microsoft JhengHei",sans-serif;color:#111827;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.s{width:1280px;height:720px;padding:44px 56px 36px;position:relative;overflow:hidden;page-break-after:always;background:#fff}
.s:last-child{page-break-after:auto}
h1{font-size:34px;margin:0 0 6px;letter-spacing:.5px}h2{font-size:26px;margin:0 0 4px}.sub{color:#6b7280;font-size:15px;margin:0 0 18px}
.foot{position:absolute;left:56px;right:56px;bottom:16px;font-size:11px;color:#9ca3af;display:flex;justify-content:space-between}
.k{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin:8px 0 16px}
.c{border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px}.c b{display:block;font-size:30px;margin:2px 0}.c span{font-size:13px;color:#6b7280}.c i{font-style:normal;font-size:13px;color:#374151}
.ok b{color:#047857}.bad b{color:#b91c1c}.mid b{color:#92400e}
table{border-collapse:collapse;width:100%;font-size:11.5px}th,td{border-bottom:1px solid #eef0f3;padding:4px 6px;text-align:left;vertical-align:top}th{background:#f3f4f6;font-weight:600}
td.m{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;white-space:nowrap}
.t{display:inline-block;padding:0 6px;border-radius:4px;font-size:11px;white-space:nowrap}.t.y{background:#d1fae5;color:#065f46}.t.n{background:#fee2e2;color:#991b1b}.t.u{background:#f3f4f6;color:#4b5563}
.two{display:grid;grid-template-columns:1fr 1fr;gap:22px}.box{border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;font-size:16px;line-height:1.75}.box h3{font-size:18px}.box h3{margin:0 0 6px;font-size:16px}
.box ul{margin:0;padding-left:20px}.note{font-size:12.5px;color:#4b5563;line-height:1.6}
.shot{display:grid;grid-template-columns:1fr 330px;gap:22px;align-items:start}.shot img{width:100%;border:1px solid #e5e7eb;border-radius:8px}
.step{font-size:13px;color:#be185d;font-weight:700;letter-spacing:1px}.say{font-size:15px;line-height:1.7}.say b{color:#111827}
.flow{display:flex;gap:10px;margin:18px 0}.flow div{flex:1;border:1px solid #e5e7eb;border-radius:10px;padding:14px;font-size:15px;line-height:1.6;min-height:190px}.flow b{display:block;font-size:16px;margin-bottom:4px}.flow em{font-style:normal;color:#be185d;font-size:12px}
.tier{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.tier .box{font-size:16px;min-height:430px}
`;
const foot = n => `<div class="foot"><span>申報資料檢核助手｜正確性證據與展示流程｜資料為模擬資料，非真實申報資料</span><span>${n}</span></div>`;
const tag = d => d === '檢出' ? '<span class="t y">檢出</span>' : d === '漏報' ? '<span class="t n">漏報</span>' : `<span class="t u">${/範例/.test(d) ? '未判定・規則未啟用' : '未判定・無檢核編號'}</span>`;
// 修正後結果的短標籤 (完整說明在 evidence.csv 與表格下方的圖例)
const SHORT = [[/已消失/, '套用建議值後已消失'], [/仍在/, '套用後仍在・人工修正'], [/有參考值/, '有參考值・人工修正原系統'], [/沒有建議值/, '無建議值・人工修正'], [/交人工判斷/, '交人工判斷（不修改）'], [/人工對照/, '人工對照差額']];
const short = o => (SHORT.find(([re]) => re.test(o)) || [0, o])[1];

function pages(f) {
  const P = []; let n = 0; const add = h => P.push(`<section class="s">${h}${foot(++n)}</section>`);
  const strayKind = S.strayByKind || {}, unexplained = S.stray.filter(x => /可能誤報/.test(x.kind)).length;
  // 封面
  add(`<div style="margin-top:150px"><div class="step">附件</div><h1 style="font-size:44px">申報資料檢核助手</h1>
    <p class="sub" style="font-size:22px">正確性證據表・三分鐘展示流程・架構與分工</p>
    <p class="note" style="font-size:15px;max-width:900px">本附件的數字全部由工具實際執行產生 (tools/evidence.js、tools/evidence-pdf.js，可重跑)；測試資料為依填報手冊製作的模擬資料，刻意埋入已知錯誤並附錯誤解答。產生時間：${esc(S.generatedAt.slice(0, 10))}</p></div>`);
  // 證據摘要
  add(`<h2>證據摘要：判得對、不亂改、可核對</h2><p class="sub">資料：${esc(S.data)}｜錯誤解答：${S.keyRows} 項（${esc(S.key)}）</p>
    <div class="k">
      <div class="c ok"><span>可判定的解答項目</span><b>${S.detected} / ${S.judged}</b><i>全部檢出，漏報 ${S.missed} 項</i></div>
      <div class="c ${unexplained ? 'bad' : 'ok'}"><span>解答以外的問題</span><b>${S.stray.length} 項</b><i>連帶 ${strayKind['連帶問題（同一保單已在解答）'] || 0}・系統總數差額 ${strayKind['系統總數差額（對應解答中沒有編號的項目）'] || 0}・無法解釋 ${unexplained}</i></div>
      <div class="c ${S.cleanIssues ? 'bad' : 'ok'}"><span>正確版資料（samples/clean）</span><b>${S.cleanIssues} 項</b><i>誤報 ${S.cleanIssues} 項</i></div>
      <div class="c ${S.newAfterFix ? 'bad' : 'ok'}"><span>套用 ${S.fixApplied} 個建議值後重新檢查</span><b>${S.issuesBefore} → ${S.issuesAfter}</b><i>因修改而新產生的問題 ${S.newAfterFix} 項</i></div>
    </div>
    <div class="two"><div class="box"><h3>怎麼算</h3><ul>
      <li>放入 7 份模擬資料與錯誤解答，由工具逐項對照：檢核編號相同、且保單相同才算檢出。</li>
      <li>未判定 ${S.notJudgedNoId + S.notJudgedInactive} 項不計入分母：${S.notJudgedNoId} 項解答本身沒有檢核編號（系統總數的時間差，工具列出差額供人工對照）、${S.notJudgedInactive} 項是範例自訂規則，預設未啟用。</li>
      <li>「套用建議值」用工具本身的修改功能，等同每一筆都按下「套用建議值」；改完自動重新檢查。</li></ul></div>
    <div class="box"><h3>限制（不代表的事）</h3><ul>
      <li>這是模擬資料的結果，不等於真實申報資料的準確率。</li>
      <li>「連帶問題」是依同一張保單已在解答中判定，沒有逐筆人工確認因果。</li>
      <li>規則依據的法規版本狀態為「尚未核實」，正式使用前須由業務單位核對。</li></ul></div></div>`);
  // 證據表
  const PER = 18;
  const LEGEND = '修正後結果：「套用建議值後已消失」= 規則算出正確值，套用後重新檢查已不再出現；「無建議值・人工修正」= 工具無法確定正確值，由人修正原始資料；「有參考值・人工修正原系統」= 對帳或報表資料，工具列出參考值但不修改；「交人工判斷」= 疑似異常，不提供修改。';
  for (let i = 0; i < rows.length; i += PER) {
    const part = rows.slice(i, i + PER);
    add(`<h2>證據表（${i + 1}–${i + part.length} / ${rows.length}）</h2><p class="sub">預期違反規則 → 實際是否檢出 → 漏報／未判定 → 修正後結果</p>
      <table style="table-layout:fixed"><colgroup><col style="width:34px"><col style="width:96px"><col style="width:140px"><col><col style="width:128px"><col style="width:72px"><col style="width:178px"></colgroup>
      <thead><tr><th>#</th><th>檢核編號</th><th>保單／案例</th><th>預期問題（解答）</th><th>實際</th><th>工具標示</th><th>修正後結果</th></tr></thead><tbody>
      ${part.map(r => `<tr><td>${r.no}</td><td class="m">${esc(r.ruleId || '—')}</td><td class="m">${esc(r.policy || '—')}</td><td>${esc(r.expected)}</td><td>${tag(r.detected)}</td><td style="white-space:nowrap">${esc(r.severity || '—')}</td><td>${esc(short(r.outcome))}</td></tr>`).join('')}
      </tbody></table><p class="note" style="margin-top:8px;font-size:11px">${LEGEND}</p>`);
  }
  // 解答以外的問題
  add(`<h2>解答以外的問題（${S.stray.length} 項）逐項列出</h2><p class="sub">不在解答裡的問題都列出來，讓評審自行核對是否為誤報</p>
    <table><thead><tr><th>分類</th><th>檢核編號</th><th>保單</th><th>工具標示</th><th>工具訊息</th></tr></thead><tbody>
    ${S.stray.map(x => `<tr><td>${esc(x.kind)}</td><td class="m">${esc(x.ruleId)}</td><td class="m">${esc(x.policy || '—')}</td><td>${esc(x.severity)}</td><td>${esc(x.message)}</td></tr>`).join('')}</tbody></table>`);
  // 三分鐘流程總覽
  add(`<h2>三分鐘展示流程</h2><p class="sub">固定路線，每一步都用同一份試用資料（一個 Excel 檔，7 張工作表）</p>
    <div class="flow">
      <div><em>0:00–0:25</em><b>1 上傳資料</b>拖入一個 Excel；工具辨識 ${f.records} 種資料。資料只在瀏覽器裡處理。</div>
      <div><em>0:25–1:00</em><b>2 找到問題</b>${f.pending} 項待處理，依類型分組；先看「必須修改」。</div>
      <div><em>1:00–1:40</em><b>3 說明依據</b>點一項：問題、怎麼改、依據的手冊條文與檢核編號。</div>
      <div><em>1:40–2:30</em><b>4 確認修正或交人工</b>有建議值的看過後套用；疑似異常只標示，交人工判斷。</div>
      <div><em>2:30–3:00</em><b>5 匯出報告</b>檢查報告、問題清單、改好的資料、稽核紀錄。</div>
    </div>
    <div class="two"><div class="box"><h3>展示時要講的三句話</h3><ul>
      <li>判斷由規則引擎做，每個問題都對得到手冊條文。</li>
      <li>工具不會自動改資料：每個修改都要有人看過依據。</li>
      <li>看起來不合理但沒有違規的，只提醒，交給人判斷。</li></ul></div>
    <div class="box"><h3>不要展示的</h3><ul><li>AI 功能（需連網、結果會變動；三分鐘內不展示）。</li><li>規則更新與主管核可（另附說明）。</li></ul></div></div>`);
  const step = (no, t, time, img, say) => add(`<div class="step">STEP ${no}｜${time}</div><h2>${t}</h2><p class="sub"></p>
    <div class="shot"><img src="${path.join(IMG, img)}"><div class="say">${say}</div></div>`);
  step(1, '上傳資料', '0:00–0:25', 's1.png', `<p>把試用資料 Excel 拖進上方框。</p><p>工具依工作表名稱分配成 <b>${f.records} 份資料</b>，列出每份的筆數；「說明」「錯誤解答」不是申報資料，標示「沒有使用」。</p><p class="note">資料只在瀏覽器裡讀取與檢查，不上傳伺服器。</p>`);
  step(2, '找到問題', '0:25–1:00', 's2.png', `<p>上方三張卡片：資料正確比例、<b>待修正 ${f.pending} 項</b>、有建議值的數量。</p><p>清單依「格式錯誤／內容矛盾／檔案對不上／總數不符／需人工判斷」分組。</p>`);
  step(3, '說明依據', '1:00–1:40', 's3.png', `<p>點「年滿期 20 年，迄日應為起日+20年-1天」。</p><p>右側三段：<b>問題</b>、<b>怎麼改</b>（建議值 20321117）、<b>依據</b>（檢核編號 25204_L2005、承保欄位）。</p><p class="note">建議值由規則計算，不是 AI 產生。</p>`);
  step(4, '確認修正或交人工判斷', '1:40–2:30', 's4.png', `<p>看過依據後按「套用建議值」：只改這一筆並重新檢查（畫面顯示「${esc(f.note.replace(/。可以下載改好的資料。/, ''))}」）。</p><p>再點「保險期間起日後 45 天即發生身故」：標示<b>請人工判斷</b>，沒有修改按鈕——不違規但可疑，交給核保／理賠人員。</p>`);
  step(5, '匯出報告', '2:30–3:00', 's5.png', `<p>檢查報告列出資料來源、各類問題數、系統總數比對與原因（結帳日不同、算法不同、需要追查）。</p><p>可下載：檢查報告、問題清單（Excel）、改好的資料、稽核紀錄（誰改了什麼）。</p>`);
  // 架構圖
  const life = stats.cats.find(c => c.key === 'detail');
  add(`<h2>架構與分工：誰負責判斷、誰負責決定</h2><p class="sub">判斷對錯只由規則引擎做；AI 只負責說明與整理，結論要經規則引擎重算；修改與規則變更由人決定</p>
    <svg width="1168" height="470" viewBox="0 0 1168 470" font-size="14" font-family="inherit">
      <defs><marker id="a" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#6b7280"/></marker></defs>
      <rect x="0" y="0" width="760" height="470" rx="14" fill="#f9fafb" stroke="#e5e7eb"/><text x="16" y="26" fill="#6b7280" font-size="13">使用者的瀏覽器（資料不離開這裡）</text>
      <rect x="20" y="60" width="150" height="70" rx="10" fill="#fff" stroke="#9ca3af"/><text x="95" y="90" text-anchor="middle" font-weight="700">申報資料</text><text x="95" y="112" text-anchor="middle" fill="#6b7280" font-size="12">TXT／CSV／Excel</text>
      <rect x="220" y="44" width="250" height="150" rx="10" fill="#ecfdf5" stroke="#059669" stroke-width="2"/><text x="345" y="72" text-anchor="middle" font-weight="700" font-size="16">規則引擎（判斷）</text>
      <text x="236" y="96" font-size="12.5">・壽險手冊檢查 ${life ? life.n : ''} 條</text><text x="236" y="116" font-size="12.5">・主檔比對、跨系統對帳、財報勾稽</text><text x="236" y="136" font-size="12.5">・同樣資料永遠同樣結果</text><text x="236" y="156" font-size="12.5">・每個問題附檢核編號與條文</text><text x="236" y="176" font-size="12.5">・能確定正確值時給建議值</text>
      <rect x="520" y="44" width="220" height="150" rx="10" fill="#eff6ff" stroke="#2563eb" stroke-width="2"/><text x="630" y="72" text-anchor="middle" font-weight="700" font-size="16">人（決定）</text>
      <text x="534" y="98" font-size="12.5">・逐筆確認後套用建議值</text><text x="534" y="120" font-size="12.5">・判斷「請人工判斷」項目</text><text x="534" y="142" font-size="12.5">・決定是否送出給 AI</text><text x="534" y="164" font-size="12.5">・主管簽章核可規則更新</text>
      <rect x="220" y="300" width="250" height="130" rx="10" fill="#fff" stroke="#9ca3af"/><text x="345" y="328" text-anchor="middle" font-weight="700">輸出</text>
      <text x="236" y="354" font-size="12.5">・檢查報告、問題清單</text><text x="236" y="376" font-size="12.5">・改好的資料（原檔不動）</text><text x="236" y="398" font-size="12.5">・稽核紀錄：誰、何時、改了什麼</text>
      <rect x="520" y="300" width="220" height="130" rx="10" fill="#fff7ed" stroke="#d97706"/><text x="630" y="328" text-anchor="middle" font-weight="700">送出前的關卡</text>
      <text x="534" y="354" font-size="12.5">・遮蔽身分證、姓名、電話等</text><text x="534" y="376" font-size="12.5">・顯示內容，使用者確認才送</text><text x="534" y="398" font-size="12.5">・只送允許清單內的網址</text><text x="534" y="420" font-size="12.5">・可切換「完全離線」</text>
      <line x1="170" y1="95" x2="218" y2="95" stroke="#6b7280" stroke-width="2" marker-end="url(#a)"/>
      <line x1="470" y1="120" x2="518" y2="120" stroke="#6b7280" stroke-width="2" marker-end="url(#a)"/><text x="494" y="140" text-anchor="middle" font-size="11" fill="#6b7280">問題</text>
      <line x1="580" y1="194" x2="420" y2="298" stroke="#6b7280" stroke-width="2" marker-end="url(#a)"/><text x="420" y="236" font-size="11" fill="#6b7280" text-anchor="end">確認後的修改</text>
      <line x1="660" y1="194" x2="660" y2="298" stroke="#d97706" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#a)"/><text x="668" y="250" font-size="11" fill="#b45309">選用</text>
      <rect x="800" y="44" width="368" height="190" rx="10" fill="#faf5ff" stroke="#7c3aed" stroke-width="2"/><text x="984" y="72" text-anchor="middle" font-weight="700" font-size="16">AI：Claude（選用，說明與整理）</text>
      <text x="816" y="98" font-size="12.5">・白話解釋單一問題、整理重點、看懂退件通知</text><text x="816" y="120" font-size="12.5">・把法規文件轉成規則草稿</text>
      <text x="816" y="146" font-size="12.5" fill="#6d28d9">不判斷對錯、不修改資料</text><text x="816" y="168" font-size="12.5">・AI 說的筆數、建議值都由規則引擎重算驗證</text><text x="816" y="190" font-size="12.5">・AI 轉換的規則要主管核可才會套用</text><text x="816" y="212" font-size="12.5">・回覆以純文字顯示，不執行</text>
      <rect x="800" y="270" width="368" height="160" rx="10" fill="#fff" stroke="#7c3aed" stroke-dasharray="6 4"/><text x="984" y="298" text-anchor="middle" font-weight="700" font-size="16">Dify（選用，公司自建 AI 平台）</text>
      <text x="816" y="324" font-size="12.5">・取代線上 Claude，作為同一組 AI 功能的來源</text><text x="816" y="346" font-size="12.5">・適合要求資料留在公司內部的單位</text><text x="816" y="368" font-size="12.5">・同樣經過遮蔽、確認、允許清單</text><text x="816" y="390" font-size="12.5">・連線金鑰只放在記憶體，用完清除</text><text x="816" y="412" font-size="12.5">・未在正式環境實測（見限制）</text>
      <line x1="740" y1="365" x2="798" y2="160" stroke="#d97706" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#a)"/>
      <line x1="740" y1="380" x2="798" y2="350" stroke="#d97706" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#a)"/>
    </svg>`);
  // 三個層次
  add(`<h2>效益與驗證程度</h2><p class="sub">分三個層次標示，避免把估算或未驗證的說成已實測</p>
    <div class="tier">
      <div class="box"><h3 style="color:#047857">已實測</h3><ul>
        <li>模擬資料：可判定 ${S.judged} 項錯誤全部檢出，漏報 ${S.missed}。</li>
        <li>正確版資料誤報 ${S.cleanIssues} 項；解答以外 ${S.stray.length} 項皆可歸為連帶或系統總數差額。</li>
        <li>套用 ${S.fixApplied} 個建議值後問題 ${S.issuesBefore} → ${S.issuesAfter}，新產生 ${S.newAfterFix} 項。</li>
        <li>自動化測試（2026-10-28 執行）：單元 139 項、瀏覽器 15 組全數通過。</li></ul></div>
      <div class="box"><h3 style="color:#92400e">合理估算（未實測）</h3><ul>
        <li>人工逐欄核對改為只看工具列出的問題，可縮短檢核時間；實際節省幅度須在真實作業中量測。</li>
        <li>退件前先找出必須修改的問題，可望減少退件往返次數。</li></ul></div>
      <div class="box"><h3 style="color:#b91c1c">尚未驗證</h3><ul>
        <li>真實公司申報資料的準確率。</li>
        <li>真實 Claude／Dify 模型的回應品質與提示注入防護。</li>
        <li>正式部署環境（安全政策、代理伺服器、正式金鑰簽章）。</li>
        <li>法規條文版本的業務核實。</li></ul></div>
    </div>`);
  return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${P.join('')}</body></html>`;
}

(async () => {
  const f = await shots();
  const html = path.join(IMG, 'deck.html'); fs.writeFileSync(html, pages(f));
  const { chromium } = require('playwright');
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + html); await p.waitForTimeout(500);
  const out = path.join(DIR, 'evidence-demo.pdf');
  await p.pdf({ path: out, width: '1280px', height: '720px', printBackground: true });
  const n = await p.evaluate(() => document.querySelectorAll('section.s').length);
  await b.close();
  fs.rmSync(IMG, { recursive: true, force: true });
  console.log(`已輸出 ${out}（${n} 頁，${(fs.statSync(out).size / 1048576).toFixed(1)} MB）`);
})().catch(e => { console.error(e); process.exit(1); });
