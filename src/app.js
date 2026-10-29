/* 介面控制 */
(function () {
  'use strict';
  const { DQ } = window;
  // BASE：內建規則；rs：加上自訂規則與法規更新包之後實際使用的規則 (每次檢查前重算)
  const BASE = DQ.rulesets.all, fin = DQ.rulesets.finance, R = DQ.recon;
  let rs = BASE;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LB = DQ.labels, SEV = LB.SEV, SHEET = LB.SHEET;
  const yuan = R.yuan;
  let INTRO = '檢查已完成。按「請 AI 整理重點」，AI 會用白話說明問題主要出在哪裡、先改什麼，以及被退件的可能性。';

  const state = { files: {}, res: null, sel: null, cat: '', customRules: [], audit: [] };
  // 稽核軌跡：放入哪些檔案、檢查結果、改了哪些值、下載了什麼 (含檔案內容的 SHA-256，可事後比對檔案有沒有被動過)
  // 只存在這個畫面，關掉就沒有；匯出時遮蔽個資
  // more：修改時分欄記下 資料、位置、保單、欄位、原本的值、改成、檢核編號 (匯出時各自一欄)
  function audit(action, detail, hashOf, more) {
    const e = Object.assign({ at: new Date(), action, detail, sha: '' }, more);
    state.audit.push(e);
    if (typeof hashOf === 'string' && window.crypto && crypto.subtle) sha256(hashOf).then(h => { e.sha = h; }).catch(() => {});
  }
  // 匯入並套用的規則與內建規則合併
  function activeRules() {
    const base = state.customRules.length ? DQ.dsl.extend(BASE, state.customRules) : BASE;

    const live = state.packs.filter(x => x.on && usable(x)).map(x => x.pack);
    const out = DQ.rulePacks.apply(base, live, { catalog: DQ.rulesets.finance.catalog.concat(DQ.master.catalog, DQ.anomaly.catalog) });
    state.disabled = out.disabled;
    // 自訂規則與更新包規則：無法判定的筆數、格式不對沒有執行的規則一起算進「檢查範圍」
    const ps = out.ruleset.dslStats || { unjudged: {}, invalid: [] };
    // 格式不對的更新包整包不套用 (不會只套用一部分)，列在「檢查範圍」
    const skipped = (out.rejected || []).map(p => `更新包「${p.name}」（格式不對，整包沒有套用）`);
    // (統計物件在檢查時才會累計筆數，所以存參照，檢查完再合併)
    state.dslSources = [base.dslStats, ps].filter(Boolean); state.dslSkipped = skipped;
    return (rs = out.ruleset);
  }
  // 法規更新包 (src/rule-packs.js)：存在這台電腦的瀏覽器
  state.packs = [];
  // 法規更新要主管核可：自行匯入或本機建立的更新包，只有附主管簽章 (approvedFile) 且驗證通過 (verified) 才會套用；
  // 驗證在開啟時重新做 (存在這台電腦的「已核可」狀態不能被改來繞過)
  try { const saved = JSON.parse(localStorage.getItem('dq-rule-packs') || '[]'); if (Array.isArray(saved)) state.packs = saved.filter(x => x && x.pack).map(x => ({ pack: DQ.rulePacks.normalize(x.pack), on: x.on !== false, imported: !!x.imported, approvedFile: x.approvedFile || null, approval: null, verified: false, impact: x.impact || null })); } catch (e) { /* 無法讀取時忽略 */ }
  // 可以套用：官方發布，或主管核可且驗證通過；而且格式要正確 (格式不對的整包不套用，見 rule-packs.js apply)
  // (與 apply 相同：一併考慮其他更新包新增的欄位；更新包清單換了就重算)
  let packOk = new WeakMap(), packList = null;
  const wellFormed = x => {
    if (packList !== state.packs) { packOk = new WeakMap(); packList = state.packs; }
    if (!packOk.has(x.pack)) {
      let ok = false;
      try { ok = DQ.rulePacks.validate(x.pack, Object.assign({}, BASE, { catalog: BASE.catalog.concat(DQ.rulesets.finance.catalog, DQ.master.catalog, DQ.anomaly.catalog) }), state.packs.filter(y => y !== x).map(y => y.pack)).ok; } catch (e) { ok = false; }
      packOk.set(x.pack, ok);
    }
    return packOk.get(x.pack);
  };
  const usable = x => !!(x.official || (x.verified && x.approval)) && wellFormed(x);
  // 官方發布的更新包 (rules/updates/index.json)：打開工具時自動下載並套用，不存進瀏覽器；使用者可在本機關閉
  const officialOff = () => { try { return new Set(JSON.parse(localStorage.getItem('dq-official-off') || '[]')); } catch (e) { return new Set(); } };
  const offKey = p => `${p.id}@${p.version || ''}`;
  async function sha256(text) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // 停用的檢查隱藏了多少問題 (結果畫面與報告都要寫出來，不讓問題「默默消失」)
  function hiddenNote() {
    const h = state.disabledCount || {}, ids = Object.keys(h), n = ids.reduce((t, k) => t + h[k], 0);
    return n ? `注意：法規更新停用了 ${ids.length} 項檢查（${ids.slice(0, 5).join('、')}${ids.length > 5 ? '…' : ''}），隱藏了 ${n} 個問題；如果更新包的來源不確定，請到「法規更新」關掉後重新檢查。` : '';
  }
  // 官方更新包的簽章公鑰 (rules/updates/public-key.json)：只套用用對應私鑰簽過的更新包；取不到公鑰就一律不套用 (fail closed)。
  // PACK_KEY_PINS：這個版本核准的公鑰指紋，固定在程式裡 (tools/pack-keygen.js 產生金鑰時印出)。網站上的公鑰指紋必須在清單中，
  // 不採用「第一次看到就信任」：公鑰被換掉、拿掉，或清單是空的，官方更新包都不套用。更換公鑰要改這裡並經審核發布新版本。
  const PACK_KEY_PINS = Object.freeze(['7fb780c45230b133']);
  const b64 = s => Uint8Array.from(atob(String(s)), c => c.charCodeAt(0));
  const keyIdOf = async k => (await sha256(JSON.stringify([k.x, k.y]))).slice(0, 16);   // 和 tools/pack-keygen.js 同一算法
  async function packKey(base) {
    state.packKey = null;
    if (!PACK_KEY_PINS.length) return { reject: '這個版本沒有核准的簽章公鑰，官方更新包一律不套用' };
    let k = null;
    try { const r = await fetch(base + 'rules/updates/public-key.json', { cache: 'no-cache' }); if (r.ok) k = await r.json(); } catch (e) { k = null; }
    if (!k || !k.key || !k.key.x || !k.key.y) return { reject: '讀不到簽章公鑰，為了安全不套用官方更新包' };
    const id = await keyIdOf(k.key);   // 指紋自己算，不採用檔案裡寫的 keyId
    if (!PACK_KEY_PINS.includes(id)) return { reject: `簽章公鑰（${id}）不是這個版本核准的公鑰（${PACK_KEY_PINS.join('、')}）` };
    try {
      const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: k.key.x, y: k.key.y, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      state.packKey = id;
      return { key };
    } catch (e) { return { reject: '簽章公鑰格式不正確' }; }
  }
  async function loadOfficial() {
    // 完全離線模式：不自動讀取線上法規更新
    if (DQ.ai && DQ.ai.isOffline && DQ.ai.isOffline()) { state.officialLoaded = { at: new Date(), count: 0, offline: true }; return; }
    const bases = location.protocol.startsWith('http') ? [''] : [];
    bases.push('https://p7w97cjtdf-dot.github.io/-/');  // 單一檔案的線上版：改從公開網站讀取
    for (const b of bases) {
      try {
        const idx = await (await fetch(b + 'rules/updates/index.json', { cache: 'no-cache' })).json();
        const packs = [];
        state.officialRejected = [];
        const signer = await packKey(b);
        for (const ent of idx.packs || []) {
          // index.json 的每一項可以是檔名，或 { file, sha256 }：有 sha256 時內容必須完全相同 (被改過就不套用)
          const f = typeof ent === 'string' ? ent : ent && ent.file, want = ent && ent.sha256;
          try {
            const text = await (await fetch(b + 'rules/updates/' + encodeURIComponent(f), { cache: 'no-cache' })).text();
            if (want && await sha256(text) !== String(want).toLowerCase()) { state.officialRejected.push(`${f}：內容和發布時登記的雜湊值不同`); continue; }
            if (signer.reject) { state.officialRejected.push(`${f}：${signer.reject}`); continue; }
            if (!(signer.key && ent && ent.sig && await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, signer.key, b64(ent.sig), new TextEncoder().encode(text)))) { state.officialRejected.push(`${f}：沒有核准者的簽章，或簽章不對`); continue; }
            const p = DQ.rulePacks.normalize(JSON.parse(text), f);
            const v = DQ.rulePacks.validate(p, Object.assign({}, BASE, { catalog: BASE.catalog.concat(DQ.rulesets.finance.catalog, DQ.master.catalog, DQ.anomaly.catalog) }), packs);
            if (v.errors.length) { state.officialRejected.push(`${f}：${v.errors.join('；')}`); continue; }
            packs.push(p);
          } catch (e) { /* 單一檔案讀不到就略過 */ }
        }
        const off = officialOff();
        state.packs = packs.map(p => ({ pack: p, on: !off.has(offKey(p)), official: true })).concat(state.packs.filter(x => !x.official && !packs.some(p => p.id === x.pack.id)));
        state.officialLoaded = { at: new Date(), count: packs.length };
        // 第一次看到某版官方更新時提示一次
        let seen; try { seen = new Set(JSON.parse(localStorage.getItem('dq-official-seen') || '[]')); } catch (e) { seen = new Set(); }
        const fresh = packs.filter(p => !seen.has(offKey(p)));
        if (fresh.length) {
          $('#update-notice').hidden = false;
          DQ.safe($('#update-notice')).innerHTML = `已自動套用官方法規更新：${fresh.map(p => esc(p.name + (p.version ? ` 第 ${p.version} 版` : '') + (p.basis ? `（${p.basis}）` : ''))).join('、')}。<a href="#updates" data-goto="updates">查看內容</a>`;
          try { localStorage.setItem('dq-official-seen', JSON.stringify([...seen, ...fresh.map(offKey)])); } catch (e) { /* ignore */ }
        }
        if (DQ.app && DQ.app.setPacks) DQ.app.setPacks(state.packs);
        return;
      } catch (e) { /* 這個位置讀不到，換下一個 */ }
    }
  }
  state.droppedRules = [];   // 存起來的自訂規則格式不對、沒有執行的 (檢查範圍會寫出來)
  try { const saved = JSON.parse(localStorage.getItem('dq-custom-rules') || '[]'); if (Array.isArray(saved)) { state.customRules = saved.filter(r => !DQ.dsl.validateRule(r, BASE.layouts).length); state.droppedRules = saved.filter(r => !state.customRules.includes(r)).map(r => (r && r.id) || '（沒有編號）'); } } catch (e) { /* 無法讀取時忽略 */ }

  // ---------- 檔案 ----------
  const SLOTS = ['L', 'D', 'prior', 'control', 'statement', 'products', 'customers', 'CL', 'CD', 'AL', 'AD'];
  const DETAIL = ['L', 'D', 'CL', 'CD', 'AL', 'AD'];  // 固定長度的明細檔 (依規則集檢查)
  // 「已放入的資料」：每一份資料來自哪個檔案 / 工作表、幾筆；這次沒有用到的工作表與原因
  state.src = {}; state.notes = []; state.fixed = {};   // fixed：放入時自動調整了什麼 (欄位名稱、日期格式…)
  function clearFiles() {
    for (const k of SLOTS) { delete state.files[k]; $('#name-' + k).textContent = '尚未放入'; }
    state.src = {}; state.fixed = {};
  }
  const recCount = k => { const n = state.files[k].text.split(/\r?\n/).filter(l => l.trim()).length; return DETAIL.includes(k) || k === 'prior' ? n : Math.max(0, n - 1); };
  // 沒有用到的工作表：同一個檔案、同樣原因的合併成一列 (例：a.xlsx「說明」「錯誤解答」)
  function unused() {
    const g = new Map();
    for (const n of state.notes) { const m = n.source.match(/^(.*?)(「.*」)$/), key = n.why + '\u0000' + (m ? m[1] : n.source); if (!g.has(key)) g.set(key, { why: n.why, file: m ? m[1] : '', parts: [] }); g.get(key).parts.push(m ? m[2] : n.source); }
    return [...g.values()].map(x => [x.why, [x.file + x.parts.join('')]]);
  }
  function renderMap() {
    const el = $('#data-map'), have = SLOTS.filter(k => state.files[k]);
    el.hidden = !have.length && !state.notes.length && !state.answer;
    if (el.hidden) return;
    // 檔名、工作表名稱、沒有讀取的原因都是外來的文字：用文字節點放入 (DQ.safe.texts)
    const T = DQ.safe.texts();
    const row = (k, src, n, cls, fix) => `<li class="dm-row${cls ? ' ' + cls : ''}"><b class="dm-k">${T(k)}</b><span class="dm-src">${T(src)}</span><span class="dm-n">${T(n)}</span>${fix ? `<span class="dm-fix">已自動調整：${T(fix.join('；'))}</span>` : ''}</li>`;
    DQ.safe(el).innerHTML = `<div class="dm-head"><b>${have.length ? `這次檢查的資料（${have.length} 份）` : '這次沒有可以檢查的資料'}</b>${have.length || state.answer ? '<button class="linkish" type="button" id="btn-clear-files">清除，重新放入</button>' : ''}</div>
      <ul class="dm-list">${have.map(k => row(SLOT_NAME[k] || k, state.src[k] || state.files[k].name, `${recCount(k).toLocaleString()} 筆`, '', state.fixed[k])).join('')}
      ${state.answer ? row('錯誤解答', state.answer.name, `${state.answer.key.length} 項${have.length ? '・用來對照' : '・放入資料後自動對照'}`, 'dm-ans') : ''}
      ${unused().map(([why, srcs]) => row('沒有使用', srcs.join('、'), why, 'dm-off')).join('')}</ul>
      ${have.length && !DETAIL.some(k => state.files[k]) ? '<p class="dm-foot">還需要保單資料或理賠資料（壽險、癌症險或傷害險）才能開始檢查。</p>' : ''}
      ${!have.length && !state.answer ? '<p class="dm-foot">之前放入的資料與結果已清除。請放入有資料的檔案（第一列是欄位名稱，從第二列開始每列一筆）。</p>' : ''}
      ${state.notes.some(n => /欄位對不上/.test(n.why)) ? '<p class="dm-foot dm-tpl">欄位名稱要和申報格式一樣。<button class="linkish" type="button" id="btn-template">下載正確格式的空白範本</button>（每張工作表的第一列就是要用的欄位名稱）</p>' : ''}`;
    T.fill(el);
    const t = $('#btn-template'); if (t) t.onclick = downloadTemplate;
    const b = $('#btn-clear-files'); if (b) b.onclick = () => { clearFiles(); state.notes = []; state.answer = null; $('#sample-note').textContent = ''; run(); };
  }
  // 空白範本：每一種資料一張工作表，第一列是正確的欄位名稱
  function downloadTemplate() {
    if (!window.XLSX) return;
    const wb = XLSX.utils.book_new(), add = (name, head) => { const ws = XLSX.utils.aoa_to_sheet([head]); ws['!cols'] = head.map(h => ({ wch: Math.max(10, String(h).length * 2) })); XLSX.utils.book_append_sheet(wb, ws, name); };
    add('說明', ['填寫說明']);
    const info = wb.Sheets['說明'];
    XLSX.utils.sheet_add_aoa(info, [['1. 每張工作表的第一列是欄位名稱，請不要修改；從第二列開始每列填一筆資料。'], ['2. 代號、日期、保單號碼等欄位請先把儲存格設為「文字」，避免 Excel 去掉開頭的 0。'], ['3. 至少要有一張保單資料或理賠資料（壽險、癌症險或傷害險）；用不到的工作表可以留空或刪除。'], ['4. 日期寫成 YYYYMMDD，例如 20250101。']], { origin: 'A2' });
    info['!cols'] = [{ wch: 80 }];
    for (const k of ['L', 'D']) add(SLOT_NAME[k], rs.layouts[k].fields.map(f => f.name));
    add('客戶資料', ['保單編號', '保單序號', '角色', '證件編號', '姓名', '出生日期', '性別', '郵遞區號', '地址']);
    add('商品資料', ['商品代號', '商品名稱', '險種', '繳費年期', '起售日', '停售日', '替代代號']);
    add('去年保單資料', rs.layouts.L.fields.map(f => f.name));
    add('系統總數', ['來源系統', '項目代號', '項目名稱', '期間', '筆數', '金額']);
    add('資產負債表', ['科目代號', '科目名稱', '期初餘額', '本期增加', '本期減少', '期末餘額']);
    for (const k of ['CL', 'CD', 'AL', 'AD']) if (rs.layouts[k]) add(SLOT_NAME[k], rs.layouts[k].fields.map(f => f.name));
    download('blank_template.xlsx', new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }
  function setFile(fid, name, text, fromSheet, srcName) {
    // CSV 依欄位定義轉成固定長度 (去年保單資料和保單資料同格式)
    const lay = DETAIL.includes(fid) ? rs.layouts[fid] : fid === 'prior' ? rs.layouts.L : null;
    if (lay && /\.csv$/i.test(name)) { text = DQ.csvToFixedWidth(text, lay); name = name.replace(/\.csv$/i, '.txt'); }
    state.src[fid] = srcName || name;
    state.files[fid] = { name, text, fromSheet: !!fromSheet };
    audit('放入資料', `${SLOT_NAME[fid] || fid}：${name}（${text.split(/\r?\n/).filter(Boolean).length.toLocaleString()} 行）`, text);
    $('#name-' + fid).textContent = name;
  }
  function guessSlot(name, fallback) {
    if (/^CRL/i.test(name) || /癌症.*(保單|承保)/.test(name)) return 'CL';
    if (/^CRD/i.test(name) || /癌症.*(理賠|給付)/.test(name)) return 'CD';
    if (/^PAL/i.test(name) || /傷害.*(保單|承保)/.test(name)) return 'AL';
    if (/^PAD/i.test(name) || /傷害.*(理賠|給付)/.test(name)) return 'AD';
    if (/^LFD/i.test(name) || /理賠|給付|claim/i.test(name)) return 'D';
    if (/去年|上年度|prior/i.test(name)) return 'prior';
    if (/^LFL/i.test(name)) { const y = name.match(/_(\d{4})/), cur = state.files.L && state.files.L.name.match(/_(\d{4})/); return y && cur && +y[1] < +cur[1] ? 'prior' : 'L'; }
    if (/^(保單|承保)|policy/i.test(name)) return 'L';
    if (/控制|系統總數|control/i.test(name)) return 'control';
    if (/商品|product/i.test(name)) return 'products';
    if (/客戶|customer/i.test(name)) return 'customers';
    if (/資產負債|財報|statement|balance/i.test(name)) return 'statement';
    return fallback;
  }
  // Excel 活頁簿：依工作表名稱分配到各檔案 (src/workbook.js)
  const BOOK = /\.(xlsx|xlsm|xls|ods)$/i;
  // 錯誤解答：不是申報資料，放入後只用來對照檢查結果 (不影響已放入的資料)
  function setAnswer(name, key) {
    state.answer = { name, key };
    audit('放入錯誤解答', `${name}（${key.length} 項）`);
    if (DETAIL.some(k => state.files[k]) && state.res) { renderMap(); renderAnswer(); }
    else renderMap();
    $('#sample-note').textContent = DETAIL.some(k => state.files[k]) ? `已放入錯誤解答「${name}」，對照結果列在檢查結果上方。` : `已放入錯誤解答「${name}」（${key.length} 項）。這不是申報資料，請再放入保單或理賠資料，工具會自動對照找到了哪些。`;
  }
  function renderAnswer() {
    const el = $('#answer-check');
    if (!state.answer || !state.res || !state.all) { el.hidden = true; return; }
    const r = DQ.workbook.checkAnswers(state.answer.key, state.all), T = DQ.safe.texts();
    // 解答裡的檢核編號不是這次有執行的檢查 (例如「新增檢查規則」的範例 U001)：另外列出，不算「沒找到」
    const known = new Set(state.all.map(i => i.ruleId).concat((rs.catalog || []).map(c => c.id), DQ.rulesets.finance.catalog.map(c => c.id), DQ.master.catalog.map(c => c.id), DQ.anomaly.catalog.map(c => c.id)));
    for (const x of r.rows) if (x.status === 'missing' && !known.has(x.ruleId)) x.status = 'inactive';
    const miss = r.rows.filter(x => x.status === 'missing'), manual = r.rows.filter(x => x.status === 'manual'), inactive = r.rows.filter(x => x.status === 'inactive');
    r.total -= inactive.length;
    const li = x => `<li>${T([x.ruleId, x.policy].filter(Boolean).join('　') || x.category)}：${T(x.desc)}</li>`;
    el.hidden = false; el.className = 'answer-check ' + (miss.length ? 'bad' : 'ok');
    DQ.safe(el).innerHTML = `<summary>對照錯誤解答（${T(state.answer.name)}）：找到 <b>${r.found} / ${r.total}</b> 項${miss.length ? `，沒找到 ${miss.length} 項` : '，全部找到'}${inactive.length ? `；${inactive.length} 項是這次沒有執行的檢查` : ''}${manual.length ? `；另有 ${manual.length} 項沒有檢核編號，請人工對照` : ''}</summary>
      ${miss.length ? `<p class="hint">沒找到的項目（可能是資料和解答不是同一份，或檢查被停用）：</p><ul>${miss.map(li).join('')}</ul>` : ''}
      ${inactive.length ? `<p class="hint">這次沒有執行這些檢查（例如「新增檢查規則」的範例規則，要先在「法規更新」加入才會檢查），不列入對照：</p><ul>${inactive.map(li).join('')}</ul>` : ''}
      ${manual.length ? `<p class="hint">沒有檢核編號、要人工對照的項目（例如系統總數的時間差）：</p><ul>${manual.map(li).join('')}</ul>` : ''}`;
    T.fill(el);
  }
  // 讀檔或解析的例外訊息可能夾帶檔案內容 (例如 JSON 解析錯誤會引用一段原文)：畫面只顯示固定的說明，不顯示原始內容
  const READ_FAIL = '讀取時發生錯誤（檔案可能已損毀或格式不正確）';
  // 檔案沒有讀取時 (太大、不是文字檔、標題不符、Excel 損毀或預檢不通過、讀取失敗)，處理方式都一樣：
  // 這個檔案原本要放的資料格 (Excel 是一整套，就是全部) 清掉舊資料、重新計算結果，並說明沒有讀取的原因，
  // 不會讓畫面上的結果看起來像是新檔案檢查通過
  function rejectFile(name, why, slots) {
    const had = (slots || []).filter(k => state.files[k]);
    for (const k of had) { delete state.files[k]; delete state.src[k]; delete state.fixed[k]; $('#name-' + k).textContent = '尚未放入'; }
    if (had.length) state.key = state.reconKey = state.masterKey = state.anomalyKey = null;
    state.notes.push({ source: name, why: `沒有讀取：${why}` });
    audit('拒絕檔案', `${name}（${why}）${had.length ? `；移除原本的${had.map(k => SLOT_NAME[k] || k).join('、')}` : ''}`);
    run();
    $('#sample-note').textContent = `「${name}」${why}，沒有讀取。` + (had.length ? `原本放入的「${had.map(k => SLOT_NAME[k] || k).join('」「')}」已移除，下方結果${SLOTS.some(k => state.files[k]) ? '只包含其他已放入的資料' : '已清空'}，不是這個檔案的檢查結果。` : '');
  }
  const WB_ZIP = /\.(xlsx|xlsm|ods)$/i;
  async function readWorkbook(file) {
    if (!window.XLSX) { $('#sample-note').textContent = '讀取 Excel 的元件沒有載入成功：工具的 vendor 資料夾可能不完整。請重新下載整個工具資料夾，或改用網址開啟。'; return; }
    // 一個 Excel 是一整套資料：放入新的 Excel 就取代之前放入的資料；讀不到資料時也清掉舊結果，避免畫面還留著上一份的結果
    const fail = why => rejectFile(file.name, why, SLOTS);
    const L = DQ.workbook.ZIP_LIMITS;
    if (file.size > L.maxArchive) return fail(`有 ${Math.round(file.size / 1048576)} MB，超過 Excel 檔 ${L.maxArchive / 1048576} MB 上限 (解開後太大，瀏覽器可能記憶體不足)。請把資料拆成幾個檔案`);
    let buf;
    try { buf = await file.arrayBuffer(); } catch (e) { return fail('讀取檔案時發生錯誤，請重新選擇檔案'); }
    // 交給 Excel 元件 (XLSX.read) 之前先預檢：壓縮檔大小、解開後總大小、單一項目大小、項目數、壓縮比、目錄結構
    const head = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
    const isZip = head[0] === 0x50 && head[1] === 0x4b, isOle = head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0;
    if (WB_ZIP.test(file.name) && !isZip) return fail('不是有效的 Excel 檔（.xlsx 應為壓縮檔格式），可能已損毀或副檔名被改過');
    if (/\.xls$/i.test(file.name) && !isZip && !isOle) return fail('不是有效的舊版 Excel 檔（.xls），可能已損毀或副檔名被改過');
    const zp = isZip ? DQ.workbook.zipProblem(buf) : '';
    if (zp) return fail(`${zp}，為避免瀏覽器記憶體不足或判讀錯誤`);
    let wb;
    // 原型污染防護：舊版 Excel 元件解析特製檔案時可能在 Object.prototype 加上屬性 (CVE-2023-30533)。
    // 解析前後比對，有被加上的屬性就移除並拒絕這個檔案
    const protoBefore = new Set(Object.getOwnPropertyNames(Object.prototype));
    try { wb = XLSX.read(buf, { type: 'array', cellFormula: false, cellHTML: false, bookVBA: false }); }
    catch (e) { return fail('無法開啟：檔案可能已損毀或設有密碼。請在 Excel 打開後另存新檔（.xlsx，不設密碼）再試一次'); }
    const polluted = Object.getOwnPropertyNames(Object.prototype).filter(k => !protoBefore.has(k));
    if (polluted.length) { for (const k of polluted) delete Object.prototype[k]; return fail('含有會改寫程式內部物件的特製內容（可能是惡意檔案）'); }
    const { got, from, blank, skipped: skipped0, fixed } = DQ.workbook.slots(XLSX, wb);
    // 活頁簿裡的「錯誤解答」工作表：拿來對照，不列在「沒有使用」
    const ansSheet = wb.SheetNames.find(n => DQ.workbook.isAnswerKey((XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false, defval: '' })[0]) || []));
    const skipped = skipped0.filter(x => x.name !== ansSheet);
    if (ansSheet) state.answer = { name: `${file.name}「${ansSheet}」`, key: DQ.workbook.answerKey(XLSX.utils.sheet_to_json(wb.Sheets[ansSheet], { header: 1, blankrows: false, raw: false, defval: '' })) };
    for (const name of blank) state.notes.push({ source: `${file.name}「${name}」`, why: '只有標題列，沒有資料' });
    for (const x of skipped) state.notes.push({ source: `${file.name}「${x.name}」`, why: x.why });
    if (!DETAIL.some(k => got[k]) && blank.length) return fail('的工作表只有標題列、還沒有資料，沒有可以檢查的內容。請從第二列開始填入保單資料或理賠資料，再放進來');
    if (!Object.keys(got).length && skipped.some(x => /欄位對不上/.test(x.why))) return fail('的工作表欄位不是申報資料的格式，沒有可以檢查的資料。每張工作表缺少的欄位列在下方；格式可參考「完整說明」的「可以放哪些檔案」或試用資料');
    if (!Object.keys(got).length) return fail('裡找不到可以辨識的工作表。工作表名稱需包含：保單資料、理賠資料、客戶資料、商品資料、去年保單資料、系統總數或資產負債表（癌症險、傷害險在前面加上類別）');
    clearFiles();
    const fs = DQ.workbook.files(got);
    for (const [slot, f] of Object.entries(fs)) { state.files[slot] = f; state.src[slot] = `${file.name}「${from[slot]}」`; $('#name-' + slot).textContent = `工作表「${from[slot]}」`; }
    for (const [slot, notes] of Object.entries(fixed || {})) { state.fixed[slot] = notes; audit('自動調整', `${file.name}「${from[slot]}」：${notes.join('；')}`); }
    audit('放入資料', `${file.name}：${Object.keys(fs).map(k => `${from[k]}（${fs[k].text.split(/\r?\n/).filter(Boolean).length.toLocaleString()} 行）`).join('、')}`, null);
    const entry = state.audit[state.audit.length - 1];
    if (window.crypto && crypto.subtle) crypto.subtle.digest('SHA-256', buf).then(b => { entry.sha = [...new Uint8Array(b)].map(v => v.toString(16).padStart(2, '0')).join(''); }).catch(() => {});
    state.key = state.reconKey = state.masterKey = state.anomalyKey = null;
    $('#sample-note').textContent = '';   // 讀到哪些工作表列在「這次檢查的資料」
    run();
  }
  // 文字檔與 CSV：先當 UTF-8 讀，失敗時改用 Big5 (Windows 的 Excel「另存 CSV」預設是 Big5)
  function decodeText(buf) {
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, ''); }
    catch (e) { return new TextDecoder('big5').decode(buf); }
  }
  // 申報檔是純文字：前 64KB 出現 NUL 或大量控制字元，就是壓縮檔、圖片等其他檔案 (安全測試 T07)
  function looksBinary(buf) {
    const b = new Uint8Array(buf, 0, Math.min(buf.byteLength, 65536));
    let ctl = 0;
    for (const c of b) { if (c === 0) return true; if (c < 9 || (c > 13 && c < 32)) ctl++; }
    return b.length > 0 && ctl / b.length > 0.01;
  }
  const NOT_TEXT = '看起來不是文字檔（可能是壓縮檔、圖片或其他程式的檔案）。申報資料請放 .txt、.csv 或 Excel 檔';
  // CSV 的標題列要符合放入的那一份資料；不符時不採用，列出缺了哪些欄位
  // 回傳 { text, notes } (已改成標準格式) 或 { problem }
  function csvFix(fid, name, text) {
    if (!/\.csv$/i.test(name)) return { text, notes: [] };
    return DQ.workbook.normalizeCsv(fid, text);
  }
  function keepFix(fid, name, notes) { if (notes && notes.length) { state.fixed[fid] = notes; audit('自動調整', `${name}：${notes.join('；')}`); } else delete state.fixed[fid]; }
  // 放進某一格的檔案：沒有讀取時，這一格原本的資料一併移除 (rejectFile)
  async function readFile(fid, file) {
    try {
      if (BOOK.test(file.name)) return await readWorkbook(file);
      if (tooBig(file)) return rejectFile(file.name, tooBigWhy(file), [fid]);
      const buf = await file.arrayBuffer();
      if (looksBinary(buf)) return rejectFile(file.name, NOT_TEXT, [fid]);
      const text = decodeText(buf);
      if (/\.csv$/i.test(file.name) && DQ.workbook.isAnswerKey(DQ.parseCSV(text.slice(0, 4096))[0] || [])) return setAnswer(file.name, DQ.workbook.answerKey(DQ.parseCSV(text)));
      const fx = csvFix(fid, file.name, text);
      if (fx.problem) return rejectFile(file.name, fx.problem, [fid]);
      setFile(fid, file.name, fx.text); keepFix(fid, file.name, fx.notes);
      run();
    } catch (e) { rejectFile(file.name, READ_FAIL, BOOK.test(file.name) ? SLOTS : [fid]); }
  }
  for (const fid of SLOTS) {
    const input = $('#file-' + fid), drop = $('#drop-' + fid);
    input.addEventListener('change', () => { if (input.files[0]) { state.notes = []; sizeNote(input.files); readFile(fid, input.files[0]); } input.value = ''; });
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('over'));
    drop.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); drop.classList.remove('over'); state.notes = []; (async () => { for (const f of [...e.dataTransfer.files]) await readFile(guessSlot(f.name, fid), f); })(); });
  }
  // 上方的大框：Excel 依工作表名稱分配；文字檔、CSV 依檔名判斷是哪一份資料
  // 檔名看不出來時，依第一行的長度判斷是哪一種申報檔
  const DETAIL_LAYOUTS = Object.fromEntries(DETAIL.filter(k => rs.layouts[k]).map(k => [k, rs.layouts[k]]));
  const BY_LENGTH = Object.fromEntries(DETAIL.filter(k => rs.layouts[k]).map(k => [rs.layouts[k].recordLength, k]));
  // 大檔案提醒：實測 56 MB (14.7 萬筆) 約用 600 MB 記憶體，約為檔案大小的 11 倍 (安全測試 T07)
  const BIG = 40 * 1048576;
  function sizeNote(files) {
    const big = [...files].filter(f => f.size > BIG);
    const el = $('#size-note');
    el.hidden = !big.length;
    if (!big.length) return;
    const mb = n => Math.round(n / 1048576), need = mb(big.reduce((t, f) => t + f.size, 0) * 11), dev = navigator.deviceMemory;   // deviceMemory：GB (部分瀏覽器才有)
    const tight = dev && need > dev * 1024 * 0.25;
    el.className = 'size-note' + (tight ? ' tight' : '');
    el.textContent = `「${big.map(f => `${f.name}（${mb(f.size)} MB）`).join('」「')}」檔案較大，檢查約需 ${need.toLocaleString()} MB 記憶體${dev ? `；這台裝置約有 ${dev} GB 記憶體` : ''}。` +
      (tight ? '可能會變慢或沒有回應，建議拆成每個 50 MB 以內的檔案分開檢查，並先關掉其他分頁。' : '記憶體 4 GB 以下的電腦建議拆成每個 50 MB 以內的檔案分開檢查。');
  }
  // 硬性上限：超過就不讀取 (避免瀏覽器分頁耗盡記憶體)。上限只放到有實測的大小：
  // 文字檔、CSV 實測 56 MB (14.7 萬筆) 約用 600 MB 記憶體 → 上限 60 MB；Excel 檔另有上限 (src/workbook.js ZIP_LIMITS)。
  // 更大的檔案沒有實測過，請拆檔檢查
  const MAX_FILE = 60 * 1048576;
  const tooBig = file => !!file && file.size > MAX_FILE;
  const tooBigWhy = file => `有 ${Math.round(file.size / 1048576)} MB，超過文字檔、CSV 單檔 ${MAX_FILE / 1048576} MB 上限 (為避免瀏覽器記憶體不足)。請拆成每份 50 MB 以內的檔案再放入`;
  // 一次放入多個檔案：一個一個讀完再讀下一個 (避免同時讀取、結果互相覆蓋)；沒有讀取的檔案，
  // 依檔名或內容判斷原本要放的資料格，清掉那一格的舊資料 (rejectFile)
  async function readMany(files) {
    state.notes = [];
    sizeNote([...files].filter(f => f.size <= MAX_FILE));
    const unknown = [];
    // 同時放入兩個年度的保單資料 (LFL01_2024、LFL01_2025)：先讀年度新的，舊年度的才會判斷成「去年保單資料」
    const year = f => { const m = /^LFL\w*?_(\d{4})/i.exec(f.name); return m ? +m[1] : 0; };
    files = [...files].sort((a, b) => year(b) - year(a));
    for (const f of files) {
      try { await readOne(f, unknown); }
      catch (e) { rejectFile(f.name, READ_FAIL, BOOK.test(f.name) ? SLOTS : [guessSlot(f.name, null)].filter(Boolean)); }
    }
    for (const n of unknown) state.notes.push({ source: n, why: '看不出是哪一份資料' });
    if (unknown.length) renderMap();
    if (unknown.length) {
      $('#sample-note').textContent = `看不出「${unknown.join('」「')}」是哪一份資料（CSV 的第一列要是欄位名稱，例如「公司代號、保單編號…」；文字檔每行長度要符合申報格式），請展開下方「分別放入各份資料」，放進對應的格子。`;
      document.querySelector('details.more').open = true;
    }
  }
  async function readOne(f, unknown) {
    {
      if (BOOK.test(f.name)) return await readWorkbook(f);
      if (tooBig(f)) return rejectFile(f.name, tooBigWhy(f), [guessSlot(f.name, null)].filter(Boolean));
      // 先看內容 (CSV 的標題列、文字檔每行的長度) 判斷是哪一份申報檔，看不出來才看檔名；
      // 保單資料的檔名寫著「去年」時放到去年保單資料
      let slot = guessSlot(f.name, null);
      if (/\.(txt|csv)$/i.test(f.name)) {
        const buf = await f.arrayBuffer();
        if (looksBinary(buf)) return rejectFile(f.name, NOT_TEXT, [slot].filter(Boolean));
        const text = decodeText(buf);
        // 錯誤解答 (試用資料附的解答表)：不是申報資料，用來對照檢查結果
        if (/\.csv$/i.test(f.name)) { const head = DQ.parseCSV(text.slice(0, 4096))[0] || []; if (DQ.workbook.isAnswerKey(head)) return setAnswer(f.name, DQ.workbook.answerKey(DQ.parseCSV(text))); }
        const byContent = /\.csv$/i.test(f.name) ? DQ.csvLayout(text, DETAIL_LAYOUTS) : BY_LENGTH[text.split(/\r?\n/)[0].length] || null;
        if (byContent) slot = byContent === 'L' && slot === 'prior' ? 'prior' : byContent;
        // 標題不是標準名稱時，看欄位最多對得上哪一種申報明細檔
        if (!slot && /\.csv$/i.test(f.name)) slot = DQ.workbook.guessByHead(DQ.parseCSV(text.slice(0, 65536))[0] || [], DETAIL);
        const fx = slot ? csvFix(slot, f.name, text) : null;
        if (fx && fx.problem) return rejectFile(f.name, fx.problem, [slot]);
        if (slot) { setFile(slot, f.name, fx.text); keepFix(slot, f.name, fx.notes); run(); } else unknown.push(f.name);
        return;
      }
      if (slot) await readFile(slot, f); else unknown.push(f.name);
    }
  }
  $('#file-book').addEventListener('change', e => { readMany([...e.target.files]); e.target.value = ''; });
  const book = $('#drop-book');
  book.addEventListener('dragover', e => { e.preventDefault(); book.classList.add('over'); });
  book.addEventListener('dragleave', () => book.classList.remove('over'));
  book.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); book.classList.remove('over'); readMany([...e.dataTransfer.files]); });
  // 檔案沒拖進框內時，瀏覽器預設會直接打開檔案、離開這個頁面：改成一樣讀取
  document.addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  document.addEventListener('drop', e => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); if (!e.target.closest('.drop')) readMany([...e.dataTransfer.files]); });

  // ---------- 執行 ----------
  const SLOT_NAME = Object.assign({ control: '系統總數', statement: '資產負債表', products: '商品資料', customers: '客戶資料' }, SHEET);
  function run() {
    const f = state.files;
    // 沒有保單資料也沒有理賠資料時無法檢查：說明還缺什麼，不顯示「0 個問題」
    renderMap();
    if (!DETAIL.some(k => f[k])) {
      document.body.classList.add('no-data');
      // 已放入的資料與還缺什麼列在「這次檢查的資料」；什麼都沒放入時保留上方的原因說明
      if (Object.keys(f).some(k => f[k])) $('#sample-note').textContent = '';
      return;
    }
    document.body.classList.remove('no-data');
    const t0 = performance.now();
    state.res = DQ.validate(activeRules(), Object.fromEntries(DETAIL.filter(k => f[k]).map(k => [k, f[k]])));
    // 客戶資料、商品資料：指向承保檔某一列的問題併入明細檢核 (可用欄位尺規與自動修正)
    state.cust = f.customers && f.L ? DQ.master.customers(state.res, f.customers.text) : null;
    state.prod = f.products && f.L ? DQ.master.products(state.res, f.products.text) : null;
    const mst = [].concat(state.cust ? state.cust.issues : [], state.prod ? state.prod.issues : []);
    let nextId = state.res.issues.length;
    for (const i of mst) if (i.file === 'L') {
      const d = DQ.master.catalog.find(c => c.id === i.ruleId);
      state.res.issues.push(Object.assign(i, { id: ++nextId, ruleName: d ? d.name : '', ref: d ? d.ref : '' }));
    }
    // 資料邏輯合理性：疑似異常 (不計入錯誤)
    state.anom = f.L || f.D ? DQ.anomaly.check(state.res, f.customers && f.customers.text) : null;
    for (const i of state.anom ? state.anom.issues : []) {
      const d = DQ.anomaly.catalog.find(c => c.id === i.ruleId);
      state.res.issues.push(Object.assign(i, { id: ++nextId, ref: d ? d.ref : '' }));
    }
    state.disabledCount = {};
    const drop = list => list.filter(i => { if (!state.disabled.has(i.ruleId)) return true; state.disabledCount[i.ruleId] = (state.disabledCount[i.ruleId] || 0) + 1; return false; });
    state.res.issues = drop(state.res.issues);
    state.res.summary = DQ.summarize(rs, state.res.issues, state.res.meta);
    state.roll = f.L ? R.rollForward(state.res, f.prior && f.prior.text) : null;
    state.ctl = f.control ? R.controlRecon(state.res, f.control.text, state.roll ? state.roll.issues : []) : null;
    state.stmt = f.statement ? R.statement(f.statement.text, state.res) : null;
    state.elapsed = performance.now() - t0;
    console.info(`[檢核耗時] ${(state.elapsed / 1000).toFixed(3)} 秒：承保 ${(f.L && state.res.meta.L) ? state.res.meta.L.count : 0} 筆、給付 ${(f.D && state.res.meta.D) ? state.res.meta.D.count : 0} 筆，${Object.values(f).filter(Boolean).length} 個檔案`);
    state.extra = [].concat(state.roll ? state.roll.issues : [], state.ctl ? state.ctl.issues : [], state.stmt ? state.stmt.issues : [], mst.filter(i => i.file !== 'L'));
    state.extra = drop(state.extra);
    // 對帳、客戶與商品等段落 (報告會逐段列出) 也拿掉停用的檢查，畫面與報告一致
    for (const o of [state.roll, state.ctl, state.stmt, state.cust, state.prod]) if (o && o.issues) o.issues = o.issues.filter(i => !state.disabled.has(i.ruleId));
    // 全部工作表的問題併成一張結果表 (明細、客戶、商品、上年度、控制總數、資產負債表)
    for (const i of state.res.issues) i.sheet = SHEET[i.file];
    for (const i of state.roll ? state.roll.issues : []) i.sheet = i.line ? SHEET.L : SHEET.prior;
    const cat = fin.catalog.concat(DQ.master.catalog);
    for (const i of state.extra) {
      if (!i.sheet) i.sheet = SHEET[i.file] || i.file;
      if (i.id == null) i.id = ++nextId;
      const d = cat.find(c => c.id === i.ruleId); if (d && !i.ruleName) { i.ruleName = d.name; i.ref = i.ref || d.ref; }
    }
    state.all = state.res.issues.concat(state.extra.filter(i => !state.res.issues.includes(i)));
    // 檢查範圍：沒有執行或結果不完整的檢查 (停用、無法判定、格式不對、沒檢查完、沒放入的資料)
    const src = state.dslSources || [], unjudged = Object.assign({}, ...src.map(x => x.unjudged)), invalid = [...new Set(src.flatMap(x => x.invalid).concat(state.dslSkipped || [], state.droppedRules || []))];
    state.scope = DQ.coverage.scope(SLOTS.filter(k => state.files[k]), { disabled: state.disabledCount, unjudged, invalid, truncated: Object.values(state.res.summary.byFile).some(b => b.truncated) });
    doneBack('detail');
    state.sel = null; state.aiSummary = null; state.aiInsights = null; state.aiChecks = null; state.focus = null;   // 資料變了，AI 的結論要重新產生與驗證
    // 寬螢幕：右側直接顯示第一個問題的說明 (不留空白的說明欄)
    state.openGroups = null; state.fullGroups = null;
    if (window.matchMedia('(min-width: 1101px)').matches) { const g = grouped(filtered())[0]; if (g) state.sel = g[2][0].id; }
    renderSummary(); renderCats(); renderTable(); renderDetail(); renderRecon(true); renderReport(); renderRules(); renderDecodeExamples(); renderAnswer();
    { const c = sev => state.all.filter(i => i.severity === sev).length, h = Object.values(state.disabledCount || {}).reduce((t, n) => t + n, 0);
      audit('檢查', `必須修改 ${c('error')}、建議確認 ${c('warning')}、請人工判斷 ${c('suspect')}${h ? `；停用的檢查隱藏 ${h} 個` : ''}${state.scope.complete ? '' : `；檢查範圍：${DQ.coverage.summary(state.scope)}`}`); }
    // 手機上資料一放進來就捲到結果區 (上傳區在畫面上方會佔掉整個螢幕)
    if (window.matchMedia('(max-width: 720px)').matches) requestAnimationFrame(() => $('#summary').scrollIntoView({ block: 'start', behavior: 'smooth' }));
    if (DQ.app && DQ.app.onRun) DQ.app.onRun();
    DQ.safe($('#dec-out')).innerHTML = ''; $('#dec-ai').textContent = '';
    $('#ai-box').hidden = true; $('#ai-out').className = 'ai-out'; $('#ai-out').textContent = '';
    const reconErr = state.extra.filter(i => i.severity === 'error').length;
    $('#tc-check').textContent = state.all.filter(i => i.severity === 'error').length || '';
    $('#tc-recon').textContent = reconErr || '';
  }

  // ---------- 明細檢核 ----------
  function hitCount(key) { return key.filter(k => state.res.issues.some(i => i.ruleId === k.ruleId && (!k.policy || (i.policy || '').trim() === k.policy))).length; }
  // 摘要：四個重點數字；其他資訊 (耗時、範例錯誤找到幾個) 放在下方一行小字
  // 只要有一筆要修改就不能顯示 100%：無條件捨去到小數一位 (29,395 筆中 52 筆有問題 → 99.8%，不是四捨五入成 100%)
  const okPct = (n, bad) => !bad ? '100' : String(Math.min(99.9, Math.floor((n - bad) / n * 1000) / 10));
  let tileBtns = null;
  function renderSummary() {
    const s = state.res.summary, all = state.all;
    const n = sev => all.filter(i => i.severity === sev).length;
    const fixable = all.filter(i => i.fix && state.res.issues.includes(i)).length;
    const ICON = { err: '!', warn: '?', suspect: '…', ok: '✓', fix: '↺' };
    // 卡片只放名稱與數字 (細項放在滑鼠停留的說明裡)，不一次塞太多資訊
    const tile = (cls, k, v, sub) => `<div class="tile ${cls}" title="${esc(sub)}"><div><span class="k">${k}</span><span class="v">${v}</span></div><span class="tile-i" hidden></span></div>`;
    const nRec0 = Object.values(s.byFile).reduce((t, b) => t + b.records, 0), nBad0 = Object.values(s.byFile).reduce((t, b) => t + b.badRecords, 0);
    const pending = n('error') + n('warning');
    // 三張卡：資料正確的比例、待修正的問題、有建議修正值的問題 (要逐筆看過說明再套用，不提供整批修改)
    DQ.safe($('#summary')).innerHTML =
      tile(nBad0 ? 'warn' : 'ok', '資料正確比例', nRec0 ? `${okPct(nRec0, nBad0)}%` : '—', `已檢查 ${nRec0.toLocaleString()} 筆資料`) +
      tile(n('error') ? 'err' : 'ok', '待修正問題', `${pending} 項`, `必須修改 ${n('error')}・建議確認 ${n('warning')}${n('suspect') ? `・請人工判斷 ${n('suspect')}` : ''}`) +
      tile('fix', '有建議值', `${fixable} 項`, '點這張卡只看有建議值的問題；工具能確定正確值，請逐筆確認後套用');
    // 有改過資料時，第三張卡片放「下載改好的資料」
    // (重畫卡片會清掉裡面的按鈕，所以記住按鈕本身，每次移進卡片或收回備用區)
    tileBtns = tileBtns || { got: $('#btn-get-fixed') };
    const t3 = $('#summary .tile.fix'), changed = state.changed && state.changed.size;
    const btn = changed ? tileBtns.got : null;
    for (const b of Object.values(tileBtns)) if (b !== btn) $('#tile-btns').appendChild(b);
    if (btn) { t3.querySelector('.tile-i').replaceWith(btn); t3.classList.add('has-btn'); }
    // 點「有建議值」卡：只看有建議值的問題 (再點一次取消)
    if (t3 && fixable) {
      t3.classList.add('clickable');
      t3.classList.toggle('on', $('#f-sev').value === 'fixable');
      t3.setAttribute('role', 'button');
      t3.setAttribute('tabindex', '0');
      const toggleFix = e => {
        if (e.target.closest('button')) return;
        const sel = $('#f-sev');
        sel.value = sel.value === 'fixable' ? '' : 'fixable';
        t3.classList.toggle('on', sel.value === 'fixable');
        state.openGroups = null; renderTable();
        $('#issue-list').scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      t3.onclick = toggleFix;
      t3.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFix(e); } };
    }
    const recs = Object.entries(s.byFile).map(([fid, b]) => `${SHEET[fid]} ${b.records} 筆`).join('、');
    const allMst = [].concat(state.cust ? state.cust.issues : [], state.prod ? state.prod.issues : []);
    const found = state.key ? `　範例刻意放的錯誤找到：保單與理賠 ${hitCount(state.key)}/${state.key.length}、客戶與商品 ${state.masterKey.filter(k => allMst.some(i => i.ruleId === k.ruleId && i.policy === k.policy)).length}/${state.masterKey.length}。` : '';
    const nRec = Object.values(s.byFile).reduce((t, b) => t + b.records, 0), nBad = Object.values(s.byFile).reduce((t, b) => t + b.badRecords, 0);
    $('#run-status').className = 'run-status ' + (n('error') ? 'bad' : 'ok');
    // 一筆資料都沒讀到時不能顯示「100% 沒有問題」(安全測試 T07)
    if (!nRec) $('#run-status').className = 'run-status bad';
    const cut = Object.values(s.byFile).some(b => b.truncated);
    if (cut) { $('#run-status').className = 'run-status bad'; DQ.safe($('#run-status')).innerHTML = `<i></i><span>問題超過 ${DQ.MAX_ISSUES.toLocaleString()} 項，只列出前 ${DQ.MAX_ISSUES.toLocaleString()} 項；檔案可能整個格式不對，請先改最常見的問題再檢查</span>`; }
    else DQ.safe($('#run-status')).innerHTML = nRec ? `<i></i><span>已檢查 ${nRec.toLocaleString()} 筆資料・${okPct(nRec, nBad)}% 沒有必須修改的問題</span>` : '<i></i><span>沒有讀到任何資料，請確認檔案內容</span>';
    $('#summary-note').textContent = `已檢查 ${recs}，共 ${Object.values(state.files).filter(Boolean).length} 份資料，花了 ${(state.elapsed / 1000).toFixed(2)} 秒。${found}`;
    const hn = hiddenNote(); $('#hidden-note').hidden = !hn; $('#hidden-note').textContent = hn;
    // 結果不完整 (停用、無法判定、格式不對、沒檢查完) 時：卡片不顯示成正常、頂端狀態註明；沒放入的資料列在下面一行
    const sc = state.scope, warns = sc.warn.filter(w => w.kind !== 'disabled');
    $('#scope-note').hidden = sc.complete || (!warns.length && !sc.notRun.length);
    DQ.safe($('#scope-note')).innerHTML = warns.map(w => `<p class="scope-warn">${esc(w.text)}</p>`).join('') +
      (sc.notRun.length ? `<p class="scope-off" title="${esc(sc.notRun.map(x => `${x.what}（${x.why}）`).join('\n'))}"><b>沒有檢查：</b>${sc.notRun.map(x => esc(x.short || x.what)).join('、')}（沒有放入這些資料）</p>` : '');
    if (!sc.safe) {
      // 結果不完整時不顯示「100%」：有隱藏、無法判定或沒檢查完的資料，不能說全部正確
      const t1 = $('#summary .tile'), v = t1.querySelector('.v');
      t1.classList.remove('ok'); t1.classList.add('warn', 'partial');
      if (/^100%$/.test(v.textContent.trim())) v.textContent = '無法確認';
      DQ.safe(v).insertAdjacentHTML('beforeend', '<small class="v-note">結果不完整，見下方說明</small>');
      t1.title = DQ.coverage.summary(sc);
      $('#run-status').className = 'run-status bad';
      if (nRec && !cut) DQ.safe($('#run-status')).innerHTML = `<i></i><span>已檢查 ${nRec.toLocaleString()} 筆資料・${nBad ? `${okPct(nRec, nBad)}% 沒有必須修改的問題` : '沒有發現必須修改的問題'}・<b class="scope-flag">結果不完整</b></span>`;
    } else if (!sc.complete && nRec && !cut) DQ.safe($('#run-status')).insertAdjacentHTML('beforeend', `<span class="scope-flag">・有 ${sc.notRun.length} 類檢查沒有執行</span>`);
  }
  function renderCats() {
    // 「資料」篩選：只列出有問題的工作表
    const cur = $('#f-file').value, sheets = [...new Set(state.all.map(i => i.sheet).filter(Boolean))];
    DQ.safe($('#f-file')).innerHTML = '<option value="">全部資料</option>' + sheets.map(n => `<option${n === cur ? ' selected' : ''}>${esc(n)}</option>`).join('');
    const byCat = {};
    for (const i of state.all) byCat[i.category] = (byCat[i.category] || 0) + 1;
    const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    if ($('#cats')) DQ.safe($('#cats')).innerHTML = cats.map(([c, n]) => `<button class="chip" data-cat="${esc(c)}" aria-pressed="${state.cat === c}">${esc(LB.cat(c))}<b>${n}</b></button>`).join('');
    if ($('#cats')) $('#cats').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; state.cat = state.cat === b.dataset.cat ? '' : b.dataset.cat; $('#f-cat').value = state.cat; renderCats(); renderTable(); };
    DQ.safe($('#f-cat')).innerHTML = '<option value="">全部問題類型</option>' + cats.map(([c]) => `<option value="${esc(c)}"${c === state.cat ? ' selected' : ''}>${esc(LB.cat(c))}</option>`).join('');
  }
  function filtered() {
    const sev = $('#f-sev').value, sheet = $('#f-file').value, cat = $('#f-cat').value, q = $('#f-q').value.trim().toLowerCase();
    const fo = state.focus;
    return state.all.filter(i => (!fo || (i.file === fo.file && fo.lines.has(i.line) && (!fo.rules.size || fo.rules.has(i.ruleId)))) &&
      (!sev || (sev === 'fixable' ? (i.fix && state.res.issues.includes(i)) : i.severity === sev)) && (!sheet || i.sheet === sheet) && (!cat || i.category === cat) &&
      (!q || [i.policy, i.ruleId, i.ruleName, i.message, DQ.report.fieldLabel(rs, i), i.value].join(' ').toLowerCase().includes(q)));
  }
  // 表格的「欄位」只列前兩個，其餘在右側說明中看
  function shortFields(i) {
    const names = DQ.report.fieldLabel(rs, i).replace(/欄\d+ /g, '').split('、').filter(Boolean);
    return names.length > 2 ? `${names.slice(0, 2).join('、')} 等 ${names.length} 欄` : names.join('、');
  }
  // 清單右側的值寫成人看得懂的樣子：「保險金額：5,000,000 元」「出生日期：1991/02/30」「原幣別：TWD → NTD」
  function niceVal(f, v) {
    v = String(v == null ? '' : v).trim();
    if (!v) return '（空白）';
    if (f && f.type === '9' && f.len === 18 && /^\d+$/.test(v)) return `${(Number(v) / 100).toLocaleString('zh-TW', { maximumFractionDigits: 2 })} 元`;
    if (f && /Date$|^birthDate$/.test(f.key)) return /^0+$/.test(v) ? v : v.replace(/\b(\d{4})(\d{2})(\d{2})\b/g, '$1/$2/$3');
    return v.replace(/\s+/g, ' ');
  }
  function sideText(i, val, fixable, T) {
    const lay = rs.layouts[i.file];
    const fs = lay ? (i.fields || []).map(k => lay.field(k)).filter(Boolean) : [];
    // 欄位名稱去掉括號說明；去掉後同名時保留括號 (例如原幣金額／臺幣金額)
    const short = fs.map(f => f.name.replace(/\(.*?\)|（.*?）/g, ''));
    const names = fs.map((f, k) => short.indexOf(short[k]) !== short.lastIndexOf(short[k]) ? f.name : short[k]);
    const cut = t => t.length > 38 ? t.slice(0, 37) + '…' : t;
    // 有建議修正值：寫要改的欄位、這筆資料目前的值、改成的值；只是補 0 或空白時寫「調整格式」
    if (fixable) {
      const f = lay && lay.field(i.fix.field), rec = (state.res.data[i.file] || []).find(r => r._line === i.line);
      const now = niceVal(f, rec && f ? rec[f.key] : val), to = niceVal(f, i.fix.value);
      const name = f ? f.name.replace(/\(.*?\)|（.*?）/g, '') : '';
      return T(`${name ? name + '：' : ''}${cut(now)}`) + ` <span class="to">${now === to ? '（調整格式）' : T('→ ' + cut(to))}</span>`;
    }
    if (!val) return '';
    // 多個欄位一起比對 (值以 / 或 vs 等分隔)：逐一寫出「欄位 值」
    const parts = val.split(/\s*(?:\/| vs |≤|≥|<|>)\s*/);
    if (fs.length > 1 && parts.length === fs.length) return T(cut(fs.map((f, k) => `${names[k]} ${niceVal(f, parts[k])}`).join('・')));
    const label = names[0] || shortFields(i).split(/[、 ]/)[0] || '內容';
    return T(cut(`${label ? label + '：' : ''}${niceVal(fs[0], val)}`));
  }
  // 清單分 5 大類 (13 種問題類型歸併)，一類一個收合區；一開始只展開第一個有問題的類別
  const GROUPS = [['format', '格式錯誤'], ['logic', '內容矛盾'], ['cross', '檔案對不上'], ['total', '總數不符'], ['judge', '需人工判斷']];
  const GROUP_OF = { 格式: 'format', 代碼: 'format', 缺漏: 'format', 單筆邏輯: 'logic', 多筆邏輯: 'logic', 邏輯合理性: 'logic',
    跨檔: 'cross', 客戶資料: 'cross', 商品資料: 'cross', 期初期末結轉: 'cross', 跨系統對帳: 'total', 財報勾稽: 'total' };
  const groupOf = i => i.severity === 'suspect' ? 'judge' : GROUP_OF[i.category] || 'logic';
  function grouped(list) {
    const by = Object.fromEntries(GROUPS.map(([k]) => [k, []]));
    for (const i of list) by[groupOf(i)].push(i);
    return GROUPS.map(([k, label]) => [k, label, by[k]]).filter(g => g[2].length);
  }
  function renderTable() {
    // 手機上說明會插在選取的那一項下面：重畫清單前先放回右側欄
    if ($('#issue-list').contains($('#detail'))) $('.bench-side').appendChild($('#detail'));
    const fb = $('#focus-bar');
    fb.hidden = !state.focus;
    if (state.focus) DQ.safe(fb).innerHTML = `只看 AI 原因「${esc(state.focus.label)}」驗證到的資料 <button class="linkish" type="button" id="btn-focus-off">顯示全部</button>`;
    const list = filtered(), open = state.all.filter(i => i.severity !== 'suspect').length;
    $('#issue-count').textContent = state.all.length ? (list.length === state.all.length ? `${open} 項待處理` : `顯示 ${list.length} / ${state.all.length} 項`) : '沒有問題';
    $('#issue-count').className = 'count-pill' + (state.all.some(i => i.severity === 'error') ? ' err' : '');
    const groups = grouped(list);
    // 展開的類別：選取的問題所在的類別一定展開；沒有指定時展開第一類
    state.openGroups = state.openGroups || new Set();
    const selG = state.sel != null && list.find(i => i.id === state.sel);
    if (selG) state.openGroups.add(groupOf(selG));
    if (!state.openGroups.size && groups[0]) state.openGroups.add(groups[0][0]);
    // 問題很多時每類只畫前 500 項 (一次畫幾萬項會讓瀏覽器卡住)；其餘用篩選或下載問題清單查看
    // 每類先列 5 項 (所有類別一眼看得到)，按「顯示其餘」才列出全部
    const SHOW = 500, FIRST = 5;
    state.fullGroups = state.fullGroups || new Set();
    // 一項兩行：問題；位置・「欄位：值」(有建議修正值時加上改成的值)。只有「建議確認」加標籤，其餘都是必須修改
    // 問題說明、工作表名稱、欄位的值都是外來的文字：用文字節點放入
    const T = DQ.safe.texts();
    const item = i => {
      const val = String(i.value == null ? '' : i.value).trim(), side = sideText(i, val, i.fix && state.res.issues.includes(i), T);
      return `<div class="issue ${i.severity}${state.sel === i.id ? ' sel' : ''}" data-id="${i.id}" role="listitem" tabindex="0">
        <div class="issue-main">
          <p class="issue-msg">${i.severity === 'warning' ? '<span class="sev-tag warning">建議確認</span>' : ''}${T(i.message)}</p>
          <p class="issue-where">${T(i.sheet || '')} ${rowLabel(i)}${side ? `<span class="issue-side">・${side}</span>` : ''}</p>
        </div>
      </div>`;
    };
    DQ.safe($('#issue-list')).innerHTML = groups.length ? groups.map(([k, label, items]) => {
      const on = state.openGroups.has(k);
      return `<div class="grp${on ? ' open' : ''}" data-grp="${k}">
        <button class="grp-h" type="button" aria-expanded="${on}"><span class="grp-k">${label}</span><span class="grp-n">${items.length}</span></button>
        ${on ? (() => {
          const full = state.fullGroups.has(k) || (state.sel != null && items.findIndex(i => i.id === state.sel) >= FIRST), n = full ? SHOW : FIRST;
          return `<div class="grp-body" role="list">${items.slice(0, n).map(item).join('')}${items.length > n ? (full ? `<p class="empty">還有 ${(items.length - n).toLocaleString()} 項，請用篩選或下載問題清單查看。</p>` : `<button class="grp-more" type="button">顯示其餘 ${items.length - n} 項</button>`) : ''}</div>`;
        })() : ''}
      </div>`;
    }).join('') : `<p class="empty">${state.all.length ? '沒有符合條件的問題' : (state.scope && !state.scope.complete ? '目前執行的檢查沒有發現問題，但檢查不完整（見上方說明），不代表資料都正確。' : '目前的檢核沒有發現問題；送件前仍請依正式手冊與主管機關規範確認。')}</p>`;
    T.fill($('#issue-list'));
  }

  // 行號：文字檔為第 N 筆；由 Excel 匯入時換算成 Excel 列號 (第 1 列為標題)；CSV 工作表為檔案中的列號
  function rowLabel(i) {
    if (!i.line) return '';
    if (i.file === 'L' || i.file === 'D') { const f = state.files[i.file]; return f && f.fromSheet ? `第 ${i.line + 1} 列` : `第 ${i.line} 行`; }
    return `第 ${i.line} 列`;
  }
  ['#f-sev', '#f-file', '#f-q'].forEach(s => $(s).addEventListener('input', () => { state.openGroups = null; renderTable(); }));
  $('#f-cat').addEventListener('input', () => { state.cat = $('#f-cat').value; renderCats(); renderTable(); });
  $('#issue-list').addEventListener('click', e => {
    const m = e.target.closest('.grp-more');
    if (m) { state.fullGroups.add(m.closest('.grp').dataset.grp); renderTable(); return; }
    const h = e.target.closest('.grp-h');
    if (h) { const k = h.parentElement.dataset.grp; state.openGroups.has(k) ? state.openGroups.delete(k) : state.openGroups.add(k); renderTable(); const g = $(`#issue-list [data-grp="${k}"] .grp-h`); if (g) g.focus(); return; }
    const r = e.target.closest('[data-id]'); if (r) select(+r.dataset.id);
  });
  $('#issue-list').addEventListener('keydown', e => { const r = e.target.closest('[data-id]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); select(+r.dataset.id); } });
  function select(id, quiet) {
    state.sel = id; renderTable(); renderDetail();
    const r = $(`#issue-list [data-id="${id}"]`); if (r && !quiet) r.scrollIntoView({ block: 'nearest' });
    // 手機 / 窄螢幕：說明直接展開在選取的那一項下面 (不用捲到整張清單的最下面)
    if (window.matchMedia('(max-width: 1100px)').matches && r) { r.after($('#detail')); onBack('detail', closeDetail); if (!quiet) r.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  }

  // 收起手機上展開的說明，回到原本那一項
  function closeDetail() {
    const id = state.sel; state.sel = null; renderTable(); renderDetail(); doneBack('detail');
    const r = $(`#issue-list [data-id="${id}"]`); if (r) { r.scrollIntoView({ block: 'nearest' }); r.focus({ preventScroll: true }); }
  }
  function ruler(lay, raw, hitFields) {
    const marks = new Array(raw.length).fill(false);
    for (const k of hitFields) { const f = lay.field(k); if (f) for (let p = f.start - 1; p < f.start - 1 + f.len; p++) marks[p] = true; }
    const W = 50, rows = [];
    for (let s = 0; s < Math.max(raw.length, 1); s += W) {
      let line = `<span class="tick">${String(s + 1).padStart(3, '0')}│</span>`, open = false;
      for (let p = s; p < Math.min(s + W, raw.length); p++) {
        if (marks[p] && !open) { line += '<mark>'; open = true; }
        if (!marks[p] && open) { line += '</mark>'; open = false; }
        line += raw[p] === ' ' ? '·' : esc(raw[p]);
      }
      if (open) line += '</mark>';
      rows.push(line);
    }
    return rows.join('\n');
  }
  function renderDetail() {
    const el = $('#detail');
    const i = state.res && state.all.find(x => x.id === state.sel);
    if (!i) {
      DQ.safe(el).innerHTML = `<div class="detail-head"><div class="d-title"><div><h3>詳細說明</h3><p class="hint">點左邊的問題</p></div></div></div>`;
      return;
    }
    const lay = rs.layouts[i.file] || { title: i.sheet, recordLength: -1, fields: [], field: () => null, keyOf: () => '' };
    const rec = i.line ? (state.res.data[i.file] || []).find(r => r._line === i.line) : null;
    const okLen = rec && rec._raw.length === lay.recordLength;
    const all = okLen ? lay.fields.map(f => ({ f, hit: i.fields.includes(f.key) })) : [];
    const hits = all.filter(x => x.hit), rest = all.filter(x => !x.hit);
    // 欄位名稱、資料值、問題說明、保單號碼都用文字節點放入 (屬性裡的文字用 esc 跳脫)
    const T = DQ.safe.texts();
    const row = ({ f, hit }) => `<tr class="${hit ? 'hit' : ''}"><td class="num">${f.no}</td><td>${T(f.name)}</td><td class="num mono">${f.start}-${f.start + f.len - 1}</td><td class="v">${T(rec[f.key])}</td></tr>`;
    // 原始資料預設收合；摘要顯示出問題欄位的字元起迄 (多個欄位分別列出，例：第 87–94、117–124 字)
    const spans = hits.map(x => x.f).sort((a, b) => a.start - b.start).map(f => f.len > 1 ? `${f.start}–${f.start + f.len - 1}` : `${f.start}`);
    const range = spans.length ? `（第 ${spans.join('、')} 字）` : '';
    const siblings = okLen && i.file === 'L' ? state.res.data.L.filter(r => r !== rec && r._raw.length === lay.recordLength && lay.keyOf(r) === lay.keyOf(rec)) : [];
    const fixable = i.fix && state.res.issues.includes(i);
    DQ.safe(el).innerHTML = `
      <div class="detail-head">
        <div class="d-title"><div><h3>詳細說明</h3><p class="hint">${T(i.sheet || lay.title)} ${rowLabel(i) || ''}${i.policy ? `・保單 <span class="mono">${T(i.policy.trim())}</span>` : ''}${i.code ? `・科目 <span class="mono">${T(i.code)}</span>` : ''}</p></div></div>
        <span class="sev-pill ${i.severity}">${SEV[i.severity]}</span>
        <button class="d-close" type="button" aria-label="收起這個問題的說明">收起</button>
      </div>
      <section class="d-sec"><p class="d-label">問題</p>
        <div class="d-box ${i.severity}"><b>${T(i.message)}</b></div></section>
      <section class="d-sec"><p class="d-label">怎麼改</p>
        <div class="d-box plain">${T(i.suggestion || '請人工確認')}
          ${i.fix ? `<p class="d-meta">建議值：<b class="mono fixval">${T(i.fix.value)}</b></p>` : ''}</div></section>
      <section class="d-sec"><p class="d-label">依據</p>
        <div class="d-box basis">${T(i.ruleName || LB.cat(i.category))}（檢核編號 <span class="mono">${T(i.ruleId)}</span>${i.ref ? `・${T(i.ref)}` : ''}）</div></section>
      ${rec ? `<details class="raw"><summary>原始資料${range}</summary>
        <p class="hint">左邊數字是第幾個字；「·」代表空白；黃色是有問題的地方。</p>
        <div class="ruler">${ruler(lay, rec._raw, i.fields)}</div>
        ${hits.length ? `<table class="fields"><tbody>${hits.map(row).join('')}</tbody></table>` : ''}
        ${rest.length ? `<details><summary class="hint">看這一行的其他 ${rest.length} 個欄位</summary><table class="fields"><tbody>${rest.map(row).join('')}</tbody></table></details>` : ''}
      </details>` : ''}
      ${siblings.length ? `<details class="raw"><summary>同一張保單的其他資料（${siblings.length} 筆）</summary><table class="fields"><tbody>${[rec].concat(siblings).sort((a, b) => a.txnSeq.localeCompare(b.txnSeq)).map(r => `<tr class="${r === rec ? 'hit' : ''}"><td class="num">第${r._line}行</td><td class="v">${T(r.txnSeq)}</td><td class="v">${T(`${r.addType} ${r.addDate}`)}</td><td class="v">${T(`→ ${r.exitType} ${r.exitDate}`)}</td></tr>`).join('')}</tbody></table></details>` : ''}
      <div class="ai-explain"><button class="linkish ai-btn" type="button" id="btn-explain">請 AI 用白話解釋</button><p class="ai-notice" hidden>按下後會把這個問題和相關欄位送給 AI（Claude），不會送出整筆資料；身分證號、姓名、地址、電話、Email 會先遮蔽。</p><div class="ask" id="explain-out"></div></div>
      ${fixable ? `<div class="detail-foot"><button class="btn cta" id="btn-fix-one" title="${esc(lay.field(i.fix.field).name)} → ${esc(i.fix.value)}">套用建議值</button></div>` : ''}`;
    T.fill(el);
    el.querySelector('.d-close').onclick = closeDetail;
    const one = $('#btn-fix-one');
    if (one) one.onclick = () => applyFix([i.id]);
    $('#btn-explain').onclick = async () => {
      const out = $('#explain-out');
      if (!DQ.ai.available()) { out.textContent = DQ.ai.OFFLINE; return; }
      out.textContent = 'AI 說明中…';
      try {
        const got = DQ.aiVerify.split(await DQ.ai.explain(rs, state.res, i, reconCtx()));
        // AI 建議的值：改進副本重新檢查；系統性問題：用同一檢核編號的筆數判定
        const files = Object.fromEntries(DETAIL.filter(k => state.files[k]).map(k => [k, state.files[k]]));
        const fx = DQ.aiVerify.verifyFix(got.fix, i, rs, files), sys = DQ.aiVerify.verifySystemic(got.systemic, state.res.issues.filter(x => x.ruleId === i.ruleId).length);
        audit('AI 洞見驗證', `${SHEET[i.file] || i.file} ${rowLabel(i)} ${i.ruleId} 建議值「${fx.value == null ? '—' : fx.value}」：${VS[fx.status]}${fx.why ? '（' + fx.why + '）' : ''}`);
        const fxBody = fx.status === 'invalid' ? [`<span class="hint">${esc(fx.why)}</span>`] : fx.why ? [esc(fx.why)] :
          [`把${esc(fx.fieldName)}從「${esc(fx.before)}」改成「${esc(fx.value)}」，在資料副本重新檢查：${fx.solved ? '這個問題消失' : '這個問題仍然存在'}${fx.newIssues.length ? `，但多了 ${fx.newIssues.length} 個新問題` : fx.solved ? '，也沒有產生新問題' : ''}`].concat(fx.newIssues.map(x => `<span class="hint">新問題：${esc(x)}</span>`));
        const sysBody = [sys.claim == null ? 'AI 沒有判斷是否為系統性問題' : `AI 說${sys.claim ? '是' : '不是'}系統性問題`, `同一檢核編號本次共 ${sys.sameRule} 筆（3 筆以上視為系統性）`];
        showAI(out, got.text, null, vBlock('AI 的建議・工具驗證', [vItem(fx.status, '建議的正確值', fxBody), vItem(sys.status, '是否為系統性問題', sysBody)], ''));
      } catch (e) { out.textContent = e.message; }
    };
  }

  // ---------- 修正 / 下載 ----------
  let saver = null;
  if (window.claude && window.claude.use) window.claude.use('downloads').then(d => { saver = d; }, () => {});
  // 檔名一律用英數字：有些瀏覽器會丟掉中文檔名，存成沒有副檔名的「download」，打開就變亂碼
  async function download(name, data, type) {
    if (name !== state.auditName) audit('下載', name, typeof data === 'string' ? data : null);
    if (saver) {
      try { await saver.save({ filename: name, data }); }
      catch (e) { $('#action-note').textContent = e && e.code === 'declined' ? '已取消下載。' : '這裡無法下載檔案。'; }
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: type || 'text/plain;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function applyFix(ids) {
    let total = 0;
    // 先記下要改的值 (改之前的值 → 建議的值)
    const sel = ids ? new Set(ids) : null;
    for (const i of state.res.issues) {
      if (!i.fix || !DETAIL.includes(i.file) || !state.files[i.file] || (sel && !sel.has(i.id))) continue;
      const lay = rs.layouts[i.file], f = lay && lay.field(i.fix.field), rec = (state.res.data[i.file] || []).find(r => r._line === i.line);
      if (!f || !rec || rec._raw.length !== lay.recordLength) continue;
      audit('修改', `${SHEET[i.file]} ${rowLabel(i)}${i.policy ? ` ${i.policy.trim()}` : ''} ${f.name}：「${String(rec[f.key]).trim()}」→「${String(i.fix.value).trim()}」（${i.ruleId}）`, null,
        { sheet: SHEET[i.file], where: rowLabel(i), policy: (i.policy || '').trim(), field: f.name, from: String(rec[f.key]).trim(), to: String(i.fix.value).trim(), rule: i.ruleId, why: i.message });
    }
    state.changed = state.changed || new Set();
    for (const fid of DETAIL) {
      if (!state.files[fid]) continue;
      const out = DQ.applyFixes(rs, state.res, fid, ids);
      if (out.applied) { state.files[fid] = Object.assign({}, state.files[fid], { text: out.text }); total += out.applied; state.changed.add(fid); }
    }
    // 與問題清單「N 項待處理」同一個算法 (全部工作表的必須修改＋建議確認)
    const pending = () => state.all.filter(i => i.severity === 'error' || i.severity === 'warning').length;
    const before = pending();
    run();
    const after = pending();
    $('#action-note').textContent = total ? `已修改 ${total} 個地方，問題從 ${before} 個減為 ${after} 個。可以下載改好的資料。` : '沒有工具可以自動修改的地方。';
    return { total, before, after };
  }
  $('#btn-get-fixed').onclick = () => $('#btn-dl-fixed').click();
  // 使用者自己的檔名若含中文，去掉中文字，避免存成「download」
  const safeName = (name, fallback) => { const n = String(name || '').replace(/[^\x21-\x7e]/g, ''); return /^[^.]+\.\w+$/.test(n) ? n : fallback; };
  // 下載改過的明細檔 (沒有改過時下載保單資料)
  $('#btn-dl-fixed').onclick = () => {
    const ids = DETAIL.filter(k => state.files[k] && state.changed && state.changed.has(k));
    for (const k of ids.length ? ids : DETAIL.filter(x => state.files[x]).slice(0, 1)) download(safeName(state.files[k].name, `fixed_${k}.txt`), state.files[k].text);
  };
  // 問題清單：Excel 檔 (不會有編碼問題)；Excel 元件未載入時改用 CSV (含 BOM，Excel 也能正確顯示中文)
  $('#btn-dl-csv').onclick = () => {
    const rows = DQ.report.toRows(rs, state.res, state.extra);
    if (window.XLSX) {
      const ws = XLSX.utils.aoa_to_sheet(rows), wb = XLSX.utils.book_new();
      ws['!cols'] = [6, 14, 12, 6, 18, 18, 24, 16, 18, 48, 40, 18, 14].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, '問題清單');
      // 檢查範圍：沒有執行或結果不完整的檢查，和問題清單放在同一個檔案
      const sc = state.scope, scRows = [['項目', '內容']].concat(sc.warn.map(w => ['結果不完整', w.text]), sc.notRun.map(x => ['沒有執行', `${x.what}（${x.why}）`]));
      if (scRows.length === 1) scRows.push(['完整', '這次所有檢查都有執行']);
      const wsc = XLSX.utils.aoa_to_sheet(scRows); wsc['!cols'] = [{ wch: 12 }, { wch: 100 }]; XLSX.utils.book_append_sheet(wb, wsc, '檢查範圍');
      download('issues_list.xlsx', new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } else download('issues_list.csv', DQ.report.toCSV(rs, state.res, state.extra), 'text/csv;charset=utf-8');
  };
  $('#btn-dl-reject').onclick = () => download('reject_' + safeName(state.files.L && state.files.L.name, 'policies.txt'), DQ.report.toRejectFile(rs, state.res, 'L'));
  // 稽核軌跡：CSV (含 BOM，Excel 可直接開)；內容先遮蔽個資，避免轉寄時外流
  // 稽核軌跡：Excel 檔，每一項各自一欄 (修改紀錄分成 資料、位置、保單號碼、欄位、原本的值、改成、檢核編號)，
  // 第二張工作表寫匯出時間、檢查依據與檢查的資料。內容先遮蔽個資，避免轉寄時外流。Excel 元件沒載入時改用 CSV (同樣的欄位)
  async function exportAudit() {
    await new Promise(r => setTimeout(r, 50));   // 等雜湊值算完
    const ctx = DQ.aiPayload.context(state.res || { data: {} }, reconCtx());
    const red = v => DQ.pii.redact(String(v == null ? '' : v), ctx).text;
    const p2 = n => String(n).padStart(2, '0'), d = new Date();
    const day = x => `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`, ts = x => `${day(x)} ${p2(x.getHours())}:${p2(x.getMinutes())}:${p2(x.getSeconds())}`;
    // 分類放：修改紀錄 (每個改過的欄位一列)、檢查與檔案 (放入、檢查、下載)、AI 使用 (送出、驗證、設定)
    const AI_ACT = /AI|加入檢查/;
    const fixHead = ['時間', '資料', '位置', '保單號碼', '欄位', '原本的值', '改成', '檢核編號', '問題'];
    const fixRows = state.audit.filter(e => e.action === '修改' && e.field).map(e => [ts(e.at), e.sheet, e.where, e.policy, e.field, red(e.from), red(e.to), e.rule, e.why || '']);
    const logHead = ['時間', '動作', '內容', '檔案內容 SHA-256'];
    const logRows = state.audit.filter(e => !(e.action === '修改' && e.field) && !AI_ACT.test(e.action)).map(e => [ts(e.at), e.action, red(e.detail), e.sha]);
    const CELL = 32000, full = v => { const t = red(v || ''); return t.length > CELL ? t.slice(0, CELL) + `…（共 ${t.length.toLocaleString()} 字，超過 Excel 一格的上限，其餘略）` : t; };
    const aiRows = state.audit.filter(e => AI_ACT.test(e.action)).map(e => [ts(e.at), e.action, red(e.detail), e.payload ? full(e.payload) : '']);
    const rows = fixRows.concat(logRows, aiRows);
    const info = [['項目', '內容'], ['工具', '申報資料檢核助手'], ['匯出時間', ts(d)], ['檢查依據', $('#rule-version').textContent], ['法規版本核實狀態', versionStatus()], ['Excel 讀取元件', `SheetJS ${state.xlsxLib ? state.xlsxLib.version : ''}${state.xlsxLib && !state.xlsxLib.ok ? `（低於官方修補版本 ${state.xlsxLib.min}，尚未更新）` : ''}`],
      ['檢查的資料', SLOTS.filter(k => state.files[k]).map(k => `${SLOT_NAME[k] || k}：${state.src[k] || state.files[k].name}（${recCount(k)} 筆）`).join('\n') || '（沒有）'],
      ['紀錄筆數', String(rows.length)], ['說明', '身分證號、姓名、地址、電話、Email 已遮蔽。SHA-256 是放入或下載的檔案內容的雜湊值，可用來確認檔案事後沒有被改過。紀錄只存在網頁上，關掉網頁就沒有。']];
    // 檔名：稽核軌跡_資料檔名_日期_時間
    const k0 = SLOTS.find(k => state.files[k]);
    const stem = k0 ? String(state.src[k0] || state.files[k0].name).replace(/「.*$/, '').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 40) : '';
    const name = `稽核軌跡_${stem ? stem + '_' : ''}${day(d)}_${p2(d.getHours())}${p2(d.getMinutes())}`;
    if (window.XLSX) {
      const wb = XLSX.utils.book_new();
      const sheet = (title, head, data, widths) => {
        const ws = XLSX.utils.aoa_to_sheet([head].concat(data.length ? data : [['（沒有紀錄）']]));
        ws['!cols'] = widths.map(w => ({ wch: w }));
        if (data.length) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: data.length, c: head.length - 1 } }) };
        XLSX.utils.book_append_sheet(wb, ws, title);
      };
      sheet('修改紀錄', fixHead, fixRows, [19, 10, 10, 16, 18, 18, 18, 14, 48]);
      sheet('檢查與檔案', logHead, logRows, [19, 10, 80, 18]);
      sheet('AI 使用', ['時間', '動作', '內容', '送出的完整內容'], aiRows, [19, 12, 50, 100]);
      const wi = XLSX.utils.aoa_to_sheet(info); wi['!cols'] = [{ wch: 12 }, { wch: 100 }];
      XLSX.utils.book_append_sheet(wb, wi, '匯出資訊');
      state.auditName = name + '.xlsx';
      return download(state.auditName, new Uint8Array(XLSX.write(wb, { type: 'array', bookType: 'xlsx' })), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    }
    const q = DQ.report.csvCell;   // CSV 公式注入防護 (和問題清單共用)
    state.auditName = name + '.csv';
    const all = [['類別', '時間', '動作', '內容']].concat(fixRows.map(r => ['修改紀錄', r[0], '修改', `${r[1]} ${r[2]} ${r[3]} ${r[4]}：「${r[5]}」→「${r[6]}」（${r[7]}）`]), logRows.map(r => ['檢查與檔案', r[0], r[1], r[2]]), aiRows.map(r => ['AI 使用', r[0], r[1], r[2]]));
    download(state.auditName, '\uFEFF' + all.map(r => r.map(q).join(',')).join('\r\n') + '\r\n', 'text/csv;charset=utf-8');
  }

  $('#btn-dl-audit').onclick = exportAudit;
  $('#btn-dl-report').onclick = () => download('check_report.html', reportHTML(), 'text/html;charset=utf-8');

  // ---------- 跨系統對帳 ----------
  const STATUS_CLS = { 一致: 'ok', 時間差: 'info', 定義差: 'info', 待查: 'bad', 格式錯誤: 'bad' };
  function renderRecon(resetOpen) {
    // 控制總數
    if (!state.ctl) { DQ.safe($('#ctl-chips')).innerHTML = '<span class="hint">還沒有放入「系統總數」資料。</span>'; DQ.safe($('#ctl-table tbody')).innerHTML = ''; }
    else {
      const s = state.ctl.summary;
      DQ.safe($('#ctl-chips')).innerHTML = [['一致', s.ok], ['時間差', s.timing], ['定義差', s.definition], ['待查', s.open]].map(([k, n]) => `<span class="st ${STATUS_CLS[k]}">${LB.status(k)} <b>${n}</b></span>`).join('');
      const only = $('#ctl-diff-only').checked;
      // 需要追查的排最前面
      const ORDER_ST = { 待查: 0, 格式錯誤: 1, 時間差: 2, 定義差: 3, 一致: 4 };
      const rows = state.ctl.rows.filter(r => !only || r.status !== '一致').slice().sort((a, b) => (ORDER_ST[a.status] ?? 5) - (ORDER_ST[b.status] ?? 5));
      DQ.safe($('#ctl-table tbody')).innerHTML = rows.length ? rows.map(r => r.up ? `<tr>
        <td>${esc(r.source)}</td><td>${esc(r.name)}</td><td class="mono">${esc(r.period)}</td>
        <td class="num">${r.up.cnt} 筆<br>${yuan(r.up.amt)} 元</td><td class="num">${r.fil.cnt} 筆<br>${yuan(r.fil.amt)} 元</td>
        <td class="num ${r.diff.cnt || r.diff.amt ? 'neg' : ''}">${r.diff.cnt} 筆<br>${yuan(r.diff.amt)}</td>
        <td><span class="st ${STATUS_CLS[r.status]}">${LB.status(r.status)}</span></td>
        <td class="explain">${esc(r.explain || '')}${r.suggestion && r.status !== '時間差' && r.status !== '定義差' ? `<div class="hint">${esc(r.suggestion)}</div>` : ''}${(r.related || []).length ? `<div>${[...new Set(r.related.map(i => i.id).filter(Boolean))].slice(0, 6).map(id => `<button class="chip jump" data-id="${id}">相關問題 #${id}</button>`).join(' ')}</div>` : ''}</td></tr>`
        : `<tr><td colspan="8">${esc(r.explain)}</td></tr>`).join('') : '<tr><td colspan="8" class="empty">申報資料的加總和各系統的總數完全相符。</td></tr>';
    }
    // 各區標題右邊的數字；一開始只展開第一個需要處理的區
    const pill = (id, text, bad) => { const el = $('#rc-n-' + id); el.textContent = text; el.className = 'rc-n' + (bad ? ' err' : text ? ' ok' : ''); return bad; };
    const need = [];
    if (state.ctl) {
      const s = state.ctl.summary, soft = s.timing + s.definition;
      need.push(['ctl', pill('ctl', s.open ? `需要追查 ${s.open}` : soft ? `對不上 ${soft}（不需修改）` : '全部相符', s.open > 0)]);
      $('#ctl-note').hidden = !soft; $('#ctl-note').textContent = '「結帳日不同」「算法不同」：不需要修改申報檔，請在對帳底稿註明原因，並確認兩邊的截止日或計算方式。';
    } else pill('ctl', '沒有放入', false);
    // 客戶與商品資料
    const mstAll = [].concat(state.cust ? state.cust.issues : [], state.prod ? state.prod.issues : []);
    if (state.cust || state.prod) need.push(['mst', pill('mst', mstAll.length ? `問題 ${mstAll.length}` : '都對得上', mstAll.length > 0)]); else pill('mst', '沒有放入', false);
    if (!state.cust && !state.prod) { DQ.safe($('#mst-chips')).innerHTML = '<span class="hint">還沒有放入客戶資料或商品資料。</span>'; DQ.safe($('#mst-table tbody')).innerHTML = ''; }
    else {
      DQ.safe($('#mst-chips')).innerHTML = (state.cust ? `<span class="st ${state.cust.issues.length ? 'bad' : 'ok'}">客戶資料 ${state.cust.summary.rows} 列（${state.cust.summary.people} 人），問題 <b>${state.cust.issues.length}</b></span>` : '') +
        (state.prod ? ` <span class="st ${state.prod.issues.length ? 'bad' : 'ok'}">商品 ${state.prod.summary.products} 項（已停售 ${state.prod.summary.stopped}），問題 <b>${state.prod.issues.length}</b></span>` : '') +
        (mstAll.some(i => i.fix) ? ` <span class="st ok">可用客戶資料自動修改 <b>${mstAll.filter(i => i.fix).length}</b></span>` : '');
      DQ.safe($('#mst-table tbody')).innerHTML = mstAll.length ? mstAll.map(i => `<tr><td><span class="badge ${i.severity}">${SEV[i.severity]}</span></td>
        <td class="num">${i.file === 'L' && i.id ? `<button class="chip jump" data-id="${i.id}">${SHEET.L} ${rowLabel(i)}</button>` : `${SHEET[i.file]} 第 ${i.line} 列`}</td>
        <td class="mono">${esc((i.policy || '').trim())}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}${i.fix ? ` <span class="pill">→ ${esc(i.fix.value)}</span>` : ''}</td></tr>`).join('')
        : '<tr><td colspan="5" class="empty">客戶資料、商品資料和保單資料都對得上。</td></tr>';
    }
    // 結轉
    if (state.roll) {
      const m = state.roll.movement, row = (k, c, a, cls) => `<tr class="${cls || ''}"><td>${k}</td><td class="num">${c == null ? '' : c.toLocaleString()}</td><td class="num">${a == null ? '' : yuan(a)}</td></tr>`;
      const priorDiff = state.roll.hasPrior ? [m.open[0] - m.priorClose[0], m.open[1] - m.priorClose[1]] : null;
      DQ.safe($('#roll-table tbody')).innerHTML =
        (state.roll.hasPrior ? row('去年底仍有效（去年申報）', m.priorClose[0], m.priorClose[1], 'muted') : '') +
        row('今年初有效', m.open[0], m.open[1], 'strong') +
        (priorDiff && (priorDiff[0] || priorDiff[1]) ? row('　和去年底的差異', priorDiff[0], priorDiff[1], 'bad') : '') +
        row('＋ 今年新保單', m.new[0], m.new[1]) + row('＋ 保額增加', null, m.inc[1]) + row('－ 保額減少', null, m.dec[1]) +
        row('± 繳清、展期、轉換', null, m.adj[1]) + (m.unexplained[1] ? row('± 保額變了卻沒有對應的異動', null, m.unexplained[1], 'bad') : '') +
        Object.entries(m.term).map(([k, v]) => row(`－ 結束：${k}`, -v[0], -v[1])).join('') +
        row('＝ 今年底應有效（推算）', m.close[0], m.close[1], 'strong') + row('今年底有效（申報資料）', m.closeActual[0], m.closeActual[1], m.close[1] === m.closeActual[1] ? 'muted' : 'bad');
      const iss = state.roll.issues;
      need.push(['roll', pill('roll', iss.length ? `必須修改 ${iss.filter(i => i.severity === 'error').length || iss.length}` : '接得上', iss.length > 0)]);
      DQ.safe($('#roll-issues tbody')).innerHTML = iss.length ? iss.map(i => `<tr><td><span class="badge ${i.severity}">${SEV[i.severity]}</span></td><td class="mono">${esc(i.policy)}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}</td></tr>`).join('')
        : `<tr><td colspan="4" class="empty">${state.roll.hasPrior ? '去年底和今年初的保單一張不少、保額相同；今年保額的變動也都有對應的異動。' : '放入去年保單資料後，可以逐張核對去年底和今年初是否接得上。'}</td></tr>`;
    }
    // 財報
    if (!state.roll) pill('roll', '沒有放入', false);
    if (state.stmt) need.push(['stmt', pill('stmt', state.stmt.issues.length ? `必須修改 ${state.stmt.summary.errors}` : '報表是平的', state.stmt.summary.errors > 0)]); else pill('stmt', '沒有放入', false);
    const firstBad = need.find(x => x[1]);
    if (resetOpen === true) for (const k of ['ctl', 'roll', 'mst', 'stmt']) $('#rc-' + k).open = !!firstBad && firstBad[0] === k;
    if (!state.stmt) { DQ.safe($('#stmt-banner')).innerHTML = '<p class="hint">還沒有放入資產負債表。</p>'; DQ.safe($('#stmt-chains')).innerHTML = ''; DQ.safe($('#stmt-table tbody')).innerHTML = ''; return; }
    const st = state.stmt;
    DQ.safe($('#stmt-banner')).innerHTML = `<div class="banner ${st.summary.balanced ? 'ok' : 'bad'}"><b>${st.summary.balanced ? '資產 = 負債 + 權益，報表是平的' : '資產不等於負債加權益，報表不平'}</b>　${SEV.error} ${st.summary.errors} 項、${SEV.warning} ${st.summary.warnings} 項</div>`;
    DQ.safe($('#stmt-chains')).innerHTML = st.chains.map(ch => `<div class="chain"><div class="label">源頭只有一個：改好它，另外 ${ch.effects.length} 個問題會一起消失</div>
      <div class="chain-root"><span class="badge error">源頭</span> <span class="mono">${esc(ch.root.code)}</span> ${esc(ch.root.message)}<div class="hint">${esc(ch.root.suggestion)}</div></div>
      <div class="chain-fx">${ch.effects.map(e => `<div>↳ <span class="mono">${e.ruleId} ${esc(e.code)}</span> ${esc(e.message)}</div>`).join('')}</div></div>`).join('') +
      st.issues.filter(i => !i.chain).map(i => `<div class="chain single"><span class="badge ${i.severity}">${SEV[i.severity]}</span> <span class="mono">${esc(i.code)}</span> ${esc(i.message)}<div class="hint">${esc(i.explain || '')} ${esc(i.suggestion)}</div></div>`).join('');
    const byRow = new Map();
    for (const i of st.issues) { if (!byRow.has(i.line)) byRow.set(i.line, []); byRow.get(i.line).push(i); }
    DQ.safe($('#stmt-table tbody')).innerHTML = st.rows.map(r => {
      const iss = byRow.get(r.line) || [];
      const depth = r.code.length <= 1 ? 0 : r.code.length <= 2 ? 1 : 2;
      return `<tr class="${iss.some(i => i.severity === 'error') ? 'row-bad' : iss.length ? 'row-warn' : ''} d${depth}"><td class="mono">${esc(r.code)}</td><td class="ind">${esc(r.name)}</td>
        <td class="num">${yuan(r.open)}</td><td class="num">${yuan(r.inc)}</td><td class="num">${yuan(r.dec)}</td><td class="num">${yuan(r.close)}</td>
        <td>${iss.map(i => `<span class="badge ${i.severity}" title="${esc(i.message)}">${SEV[i.severity]}${i.chainRole ? '・' + (i.chainRole === '根因' ? '源頭' : '受影響') : ''}</span>`).join(' ')}</td></tr>`;
    }).join('');
  }
  $('#ctl-diff-only').addEventListener('change', renderRecon);
  document.addEventListener('click', e => {
    const j = e.target.closest('.jump'); if (!j) return;
    showTab('check'); select(+j.dataset.id);
  });

  // ---------- 退件解碼 ----------
  function renderDecodeExamples() {
    const i = state.res.issues.find(x => x.file === 'L' && x.line > 10 && x.fields.length);
    const ex = document.querySelectorAll('.chip.ex');
    if (i && ex[3]) ex[3].textContent = `第 ${i.line} 行資料有誤，${rs.layouts.L.field(i.fields[0]).name}錯誤`;
  }
  document.querySelectorAll('.chip.ex').forEach(b => b.onclick = () => { $('#dec-text').value = b.textContent; decodeNow(); });
  const KIND = { 檢核編號: '規則編號', 手冊錯誤代碼: '手冊上的錯誤代碼', 籠統錯誤代碼: '只有代碼的通知', 行號: '行號', 欄位名稱: '欄位', 關鍵字: '關鍵字' };
  function decodeNow() {
    const text = $('#dec-text').value;
    state.decoded = R.decode(text, { res: state.res, extra: state.extra, catalogs: [rs.catalog, fin.catalog] });
    const d = state.decoded;
    $('#dec-ai').textContent = '';
    DQ.safe($('#dec-out')).innerHTML = d.findings.length ? `<p class="hint">找到 ${d.located} 個對應的問題。</p>` + d.findings.map(f => `
      <div class="finding">
        <div class="f-head"><span class="badge info">${esc(KIND[f.kind] || f.kind)}</span> <b class="mono">${esc(f.clue)}</b></div>
        <p>${esc(f.explain)}</p>
        ${f.matches.length ? f.groups.map(g => `<details ${f.groups.length <= 3 ? 'open' : ''}><summary><span class="mono">${esc(g.ruleId)}</span> ${esc(g.name)} <b>${g.items.length} 筆</b></summary>
          <div class="table-wrap flat"><table><thead><tr><th>位置</th><th>保單／科目</th><th>欄位</th><th>目前的值</th><th>問題</th><th>建議怎麼改</th></tr></thead><tbody>
          ${g.items.slice(0, 50).map(i => `<tr><td class="num">${i.id && (i.file === 'L' || i.file === 'D') ? `<button class="chip jump" data-id="${i.id}">${SHEET[i.file]} ${rowLabel(i)}</button>` : `${SHEET[i.file] || ''}${i.line ? ' 第 ' + i.line + ' 列' : ''}`}</td>
            <td class="mono">${esc((i.policy || i.code || '').trim())}</td><td>${esc(i.file === 'L' || i.file === 'D' ? DQ.report.fieldLabel(rs, i).replace(/欄\d+ /g, '') : '')}</td>
            <td class="mono">${esc(String(i.value).trim())}</td><td>${esc(i.message)}</td><td>${esc(i.suggestion)}${i.fix ? ` <span class="pill">→ ${esc(i.fix.value)}</span>` : ''}</td></tr>`).join('')}
          </tbody></table></div></details>`).join('') : '<p class="hint">目前的資料裡沒有這個問題：可能已經改好了，或退件時用的是另一個版本的檔案。</p>'}
      </div>`).join('') : '<p class="hint">請貼上退件通知的內容。</p>';
  }
  $('#btn-decode').onclick = decodeNow;
  $('#btn-decode-ai').onclick = async () => {
    const out = $('#dec-ai');
    if (!$('#dec-text').value.trim()) { out.textContent = '請先貼上退件通知的內容。'; return; }
    if (!state.decoded) decodeNow();
    if (!DQ.ai.available()) { out.textContent = DQ.ai.OFFLINE; return; }
    out.className = 'ai-out'; out.textContent = 'AI 正在閱讀退件通知…';
    try {
      const got = DQ.aiVerify.split(await DQ.ai.decode($('#dec-text').value, state.decoded, state.res, reconCtx()));
      const lk = DQ.aiVerify.verifyLikely(got.likely, state.decoded, state.res);
      for (const x of lk) audit('AI 洞見驗證', `退件最可能指「${x.title}」（${x.ruleIds.join('、') || '—'}）：${VS[x.status]}${x.count != null ? `，定位到 ${x.count} 筆` : ''}`);
      const items = lk.map(x => vItem(x.status, x.title, x.status === 'invalid' ? [`<span class="hint">${esc(x.why)}</span>`] :
        [`${x.claim != null ? `AI 估計 ${x.claim} 筆 → ` : ''}<b>這則退件訊息定位到 ${x.count} 筆</b>（${esc(x.ruleIds.join('、'))}）`, x.count ? '' : `<span class="hint">${x.inData ? `資料中有 ${x.inData} 筆這類問題，但退件訊息沒有指到` : '這次的資料沒有這類問題'}</span>`].filter(Boolean)));
      showAI(out, got.text, null, vBlock('AI 判斷的退件原因・核對定位結果', items, 'AI 沒有指出可以核對的檢核編號，上面的判斷都只是推測。'));
      out.className = 'ai-out done';
    } catch (e) { out.textContent = e.message; }
  };

  // ---------- AI ----------
  const reconCtx = () => ({ ctl: state.ctl, roll: state.roll, stmt: state.stmt, cust: state.cust, prod: state.prod });
  // AI 回覆一律加上「AI 產出」標示
  // AI 回答的內文是外部產生的文字：用 textContent 放入 (不組成 HTML)；工具驗證後的結果卡片經 DQ.safe 過濾
  function showAI(out, text, insights, checks) {
    DQ.safe(out).innerHTML = `<div class="ai-tag"></div><div class="ai-text"></div>${insights ? insightsHTML(insights) : ''}${checks || ''}<p class="ai-redact"></p>`;
    out.querySelector('.ai-tag').textContent = DQ.ai.LABEL;
    out.querySelector('.ai-text').textContent = text;
    out.querySelector('.ai-redact').textContent = DQ.ai.redactionNote();
  }
  // 驗證結果共用的一列
  const VS = { verified: '已驗證', mismatch: '部分成立', refuted: '不成立', invalid: '無法驗證（推測）' };
  const vItem = (st, title, body, extra) => `<li class="ins ${st}"><div class="ins-top"><span class="ins-st">${VS[st]}</span><b>${esc(title)}</b></div>${body.map(b => `<p>${b}</p>`).join('')}${extra || ''}</li>`;
  const vBlock = (h, items, empty) => `<div class="insights"><h4>${h}</h4>${items.length ? `<ol>${items.join('')}</ol>` : `<p class="hint">${empty}</p>`}</div>`;
  // 重點整理的第 1、3、4 點：風險、修改順序、預防檢查
  function summaryChecksHTML(c) {
    if (!c) return '';
    const r = c.risk;
    const risk = vItem(r.status, '整體狀況：退件可能性', [r.claim ? `AI 說「${esc(r.claim)}」，工具判定「${esc(r.tool)}」` : `${esc(r.why)}；工具判定「${esc(r.tool)}」`, '<span class="hint">工具的判定：有「必須修改」為高，只有「建議確認」為中，都沒有為低。</span>']);
    const pri = c.priorities.map(p => vItem(p.status, `第 ${p.order} 優先：${p.ruleIds.join('、') || (p.unknown || []).join('、') || '（未指定）'}`,
      [`理由：${esc(p.reason || '（沒寫）')}${p.note ? `　${esc(p.note)}` : ''}`, p.why ? `<span class="hint">${esc(p.why)}</span>` : `實際：${esc(p.fact)}`]));
    const pre = c.preventions.map((p, k) => vItem(p.status, p.title, p.status === 'invalid' ? [`<span class="hint">${esc(p.errors.join('；'))}</span>`] :
      [`試跑 ${p.checked.toLocaleString()} 筆：抓到現有問題 <b>${p.caught}</b> / ${p.target} 筆，誤報（沒有任何問題的資料被擋下）<b>${p.falseAlarm}</b> 筆`, `<span class="hint">檢查條件：${esc(SHEET[p.file] || p.file)}的資料應該 ${esc(p.text)}</span>`],
      p.caught && !((state.packs.find(x => x.pack.id === 'local') || { pack: { rules: [] } }).pack.rules.some(x => x.name === p.title)) ? `<button class="linkish" type="button" data-add-prev="${k}">加入本機自訂更新（主管核可後套用）</button>` : ''));
    return vBlock('整體狀況・工具判定', [risk], '') + vBlock('先改什麼・用數字檢查 AI 的理由', pri, 'AI 沒有提供可以檢查的修改順序。') + vBlock('以後怎麼避免・預防檢查拿現在的資料試跑', pre, 'AI 沒有提供可以試跑的預防檢查。');
  }
  // AI 提出的共同原因 → 工具用原始資料驗證的結果 (第 3 級：只有驗證過的筆數才顯示為事實)
  function insightsHTML(list) {
    const V = DQ.aiVerify;
    if (!list.length) return '<div class="insights"><h4>AI 提出的共同原因</h4><p class="hint">AI 沒有提供可以檢查的條件，上面的原因都只是推測。</p></div>';
    const n = s => list.filter(x => x.status === s).length;
    return `<div class="insights"><h4>AI 提出的共同原因・工具用原始資料驗證</h4>
      <p class="hint">已驗證 ${n('verified')}、原因成立但數字不對 ${n('mismatch')}、不成立 ${n('refuted')}、無法驗證 ${n('invalid')}。筆數一律以工具實際算出的為準。</p>
      <ol>${list.map((x, k) => `<li class="ins ${x.status}">
        <div class="ins-top"><span class="ins-st">${esc(V.STATUS[x.status])}</span><b>${esc(x.title)}</b><span class="hint">${esc(x.type)}</span></div>
        ${x.status === 'invalid' ? `<p class="hint">${esc(x.errors.join('；'))}</p>` : `
        <p>${x.claim != null ? `AI 估計 ${x.claim} 筆 → ` : ''}<b>實際 ${x.count} 筆</b>${x.issueLines ? `，解釋了 ${esc(x.ruleIds.join('、'))} 問題的 ${Math.round(x.coverage * 100)}%（${x.count}/${x.issueLines} 筆）` : `（${esc(SHEET[x.file] || x.file)}中符合條件的資料）`}</p>
        <p class="hint">檢查條件：${esc(SHEET[x.file] || x.file)}的${esc(x.text)}${x.unknownRules && x.unknownRules.length ? `；這次沒有出現的檢核編號：${esc(x.unknownRules.join('、'))}` : ''}</p>
        ${x.count ? `<button class="linkish" type="button" data-focus="${k}">在清單中只看這 ${x.count} 筆</button>` : ''}`}
      </li>`).join('')}</ol></div>`;
  }
  $('#ai-out').addEventListener('click', e => {
    const add = e.target.closest('[data-add-prev]');
    if (add && state.aiChecks) {
      // 加入預防檢查：重新檢查後保留 AI 的整理 (資料沒變，只多了檢查)
      const p = state.aiChecks.preventions[+add.dataset.addPrev], keep = { s: state.aiSummary, i: state.aiInsights, c: state.aiChecks };
      addDraftRules([p.rule], 'ai');
      audit('加入檢查', `AI 提出、經試跑驗證的預防檢查「${p.title}」（抓到 ${p.caught}/${p.target}、誤報 ${p.falseAlarm}），已放入本機自訂更新，主管核可後才會套用`);
      Object.assign(state, { aiSummary: keep.s, aiInsights: keep.i, aiChecks: keep.c });
      $('#ai-box').hidden = false; const out = $('#ai-out'); out.className = 'ai-out done'; showAI(out, keep.s, keep.i, summaryChecksHTML(keep.c)); renderReport();
      return;
    }
    const b = e.target.closest('[data-focus]'); if (!b || !state.aiInsights) return;
    const x = state.aiInsights[+b.dataset.focus];
    state.focus = { file: x.file, lines: new Set(x.lines), rules: new Set(x.ruleIds), label: x.title };
    renderTable(); document.querySelector('.issues').scrollIntoView({ behavior: 'smooth' });
  });
  document.addEventListener('click', e => { if (e.target.id === 'btn-focus-off') { state.focus = null; renderTable(); } });
  $('#btn-ai').onclick = async () => {
    const out = $('#ai-out');
    $('#ai-box').hidden = false;
    if (!DQ.ai.available()) { out.textContent = DQ.ai.OFFLINE; return; }
    $('#btn-ai').disabled = true; out.className = 'ai-out'; out.textContent = 'AI 正在整理重點…';
    try {
      const got = DQ.aiVerify.split(await DQ.ai.summarize(rs, state.res, reconCtx()));
      state.aiSummary = got.text;
      state.aiInsights = DQ.aiVerify.verify(got.insights, rs, state.res);
      const V = DQ.aiVerify;
      state.aiChecks = { risk: V.verifyRisk(got.risk, state.res), priorities: V.verifyPriorities(got.priorities, state.res), preventions: V.verifyPreventions(got.preventions, rs, state.res) };
      audit('AI 洞見驗證', `退件可能性：AI 說 ${state.aiChecks.risk.claim || '—'}，工具判定 ${state.aiChecks.risk.tool}（${VS[state.aiChecks.risk.status]}）`);
      for (const p of state.aiChecks.priorities) audit('AI 洞見驗證', `修改順序 ${p.order}：${p.ruleIds.join('、') || '—'}／${p.reason || '—'}（${VS[p.status]}${p.fact ? '；' + p.fact : ''}）`);
      for (const p of state.aiChecks.preventions) audit('AI 洞見驗證', `預防檢查「${p.title}」：${VS[p.status]}${p.status === 'invalid' ? '' : `（抓到 ${p.caught}/${p.target}、誤報 ${p.falseAlarm}）`}`);
      for (const x of state.aiInsights) audit('AI 洞見驗證', `${DQ.aiVerify.STATUS[x.status]}：${x.title}${x.status === 'invalid' ? '' : `（AI 估計 ${x.claim == null ? '—' : x.claim} 筆，實際 ${x.count} 筆；條件：${x.text}）`}`);
      out.className = 'ai-out done'; showAI(out, state.aiSummary, state.aiInsights, summaryChecksHTML(state.aiChecks)); renderReport();
    } catch (e) { out.textContent = e.message; }
    $('#btn-ai').disabled = false;
  };

  // ---------- 報告 / 規則 ----------
  // 報告整份 HTML 也經過 DOMPurify 過濾 (畫面上的預覽與下載的檔案相同)
  function reportHTML() { return DQ.safe.doc(DQ.report.toHTML(rs, state.res, { sources: state.src, versionStatus: versionStatus(), elapsed: state.elapsed, aiSummary: state.aiSummary, aiInsights: state.aiInsights, aiChecks: state.aiChecks, hidden: hiddenNote(), scope: state.scope, totals: { error: state.all.filter(i => i.severity === 'error').length, warning: state.all.filter(i => i.severity === 'warning').length, suspect: state.all.filter(i => i.severity === 'suspect').length }, packs: state.packs.filter(x => x.on).map(x => x.pack), recon: { ctl: state.ctl, roll: state.roll, stmt: state.stmt, cust: state.cust, prod: state.prod } })); }
  function renderReport() { $('#report-frame').srcdoc = reportHTML(); }
  // 手冊頁碼 (rules/rules.js)：PDF 頁碼與頁面上印的頁碼
  const SRCDOC = { rules: '檢核規則手冊', manual: '填報手冊' };
  function pageOf(id) {
    const src = window.DQ.ruleSource, r = src && src.rules.concat(src.toolRules).find(x => x.id === id);
    if (!r) {
      const pk = rs.catalog.find(x => x.id === id && x.pack);
      if (pk) return `<span>法規更新：${esc(pk.ref || '')}</span>`;
      const own = rs.catalog.find(x => x.id === id && x.product), prod = own && rs.products.find(p => p.id === own.product);
      return own ? `<span>${esc(prod.name)}填報手冊 ${esc(own.ref)}</span>` : '<span class="hint">自訂規則</span>';
    }
    const s = r.source;
    if (s.doc === 'tool') return `<span class="hint" title="${esc(s.note || '')}">本工具另外加的</span>`;
    return `<span title="${esc((s.note ? s.note + '；' : '') + (s.program ? `檢核程式說明表 PDF 第 ${s.program} 頁` : ''))}">${SRCDOC[s.doc]} 第 ${s.page} 頁</span>`;
  }
  function renderRules() {
    const q = $('#r-q').value.trim().toLowerCase();
    const by = {};
    for (const i of state.res.issues.concat(state.extra || [])) by[i.ruleId] = (by[i.ruleId] || 0) + 1;
    const cat = activeRules().catalog.concat(fin.catalog, DQ.master.catalog, DQ.anomaly.catalog);
    const st = DQ.ruleStats.count();
    const list = cat.filter(r => !q || [r.id, r.name, r.level, r.ref].join(' ').toLowerCase().includes(q));
    const packN = cat.filter(c => c.pack).length, imported = cat.length - st.total - st.extTotal - packN;
    $('#rules-meta').textContent = `個人壽險共 ${st.total} 條檢查規則：${st.cats.map(c => `${c.name} ${c.n}`).join('、')}${st.ext.map(e => `；${e.name} ${e.n} 條`).join('')}${packN ? `；法規更新 ${packN} 條` : ''}${imported > 0 ? `；另有自訂規則 ${imported} 條` : ''}`;
    DQ.safe($('#rule-table tbody')).innerHTML = list.map(r => `<tr><td class="mono">${esc(r.id)}</td><td>${esc(LB.level(r.level))}</td><td>${esc(r.name)}</td><td>${pageOf(r.id)}</td><td><span class="badge ${r.severity}">${SEV[r.severity]}</span></td><td class="num">${by[r.id] || ''}</td></tr>`).join('');
    DQ.safe($('#layout-table tbody')).innerHTML = rs.layouts.L.fields.map(f => `<tr><td class="num">${f.no}</td><td>${esc(f.name)}</td><td class="num">${f.start}</td><td class="num">${f.start + f.len - 1}</td><td>${f.type === '9' ? '數字' : '英數字'}，${f.len} 個字</td></tr>`).join('');
    DQ.safe($('#chart-table tbody')).innerHTML = fin.chart.map(a => `<tr><td class="mono">${a.code}</td><td class="ind d${a.code.length <= 1 ? 0 : a.code.length <= 2 ? 1 : 2}">${esc(a.name)}</td><td>${a.until ? `<span class="badge warning">${a.until} 起停用，改用 ${a.replacedBy}</span>` : ''}</td></tr>`).join('');
  }
  $('#r-q').addEventListener('input', renderRules);

  // ---------- 分頁 ----------
  // 進階功能 (頁尾)：切換後回到頁首；每個進階頁上方有「回到檢查結果」
  // ---------- 收回與返回 ----------
  // 打開進階頁面、手機上的問題說明、逐筆確認時記一筆瀏覽紀錄：按手機或瀏覽器的返回鍵就關掉，不會離開工具
  const backStack = []; let skipPop = 0;
  function onBack(key, close) {
    if (backStack.some(b => b.key === key)) return;
    backStack.push({ key, close });
    try { history.pushState({ dq: key }, ''); } catch (e) { /* 沙盒環境不支援時，只能用畫面上的按鈕關閉 */ }
  }
  function doneBack(key) {
    const i = backStack.findIndex(b => b.key === key); if (i < 0) return;
    backStack.splice(i, 1); skipPop++;
    try { history.back(); } catch (e) { skipPop--; }
  }
  window.addEventListener('popstate', () => { if (skipPop) { skipPop--; return; } const b = backStack.pop(); if (b) b.close(); });
  function showTab(view) {
    if (view === 'check') doneBack('view'); else onBack('view', () => showTab('check'));
    document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    if (view !== 'check') $('#view-' + view).scrollIntoView({ block: 'start' });
    else if (!document.body.classList.contains('no-data')) $('#view-check').scrollIntoView({ block: 'start' });
  }
  document.querySelectorAll('.view:not(#view-check)').forEach(v => DQ.safe(v).insertAdjacentHTML('afterbegin', '<button class="back" type="button">← 回到檢查結果</button>'));
  document.addEventListener('click', e => { if (e.target.closest('.back')) showTab('check'); });
  $('#btn-ai-close').onclick = () => { $('#ai-box').hidden = true; };
  // 展開的區塊內容較長時，底部加「收起」，不用捲回最上面
  document.addEventListener('toggle', e => {
    const d = e.target;
    if (!(d instanceof HTMLDetailsElement) || !d.open || d.classList.contains('more-menu') || d.querySelector(':scope > .fold')) return;
    if (d.offsetHeight > 240) DQ.safe(d).insertAdjacentHTML('beforeend', '<button type="button" class="fold">收起 ▲</button>');
  }, true);
  document.addEventListener('click', e => {
    const b = e.target.closest('.fold');
    if (b) { const d = b.parentElement, sum = d.querySelector(':scope > summary'); d.open = false; if (sum && sum.getBoundingClientRect().top < 0) sum.scrollIntoView({ block: 'center' }); }
    // 「篩選・下載」選單：點選單外面就收起
    document.querySelectorAll('details.more-menu[open]').forEach(m => { if (!m.contains(e.target)) m.open = false; });
  });
  // Esc：依序收起選單、手機上的說明、進階頁面
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !$('#review').hidden || ($('#ai-preview') && $('#ai-preview').open)) return;
    const m = document.querySelector('details.more-menu[open]');
    if (m) { m.open = false; m.querySelector('summary').focus(); return; }
    if ($('#issue-list').contains($('#detail'))) return closeDetail();
    const v = [...document.querySelectorAll('.view')].find(x => !x.hidden);
    if (v && v.id !== 'view-check') showTab('check');
  });
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.view));
  const hash = (location.hash || '').slice(1);

  // AI 服務：claude.ai 線上版 (開啟者自己的 Claude 帳號)；沒有或完全離線時隱藏 AI 按鈕
  const INTRO0 = INTRO;
  const aiReady = ok => {
    document.body.classList.toggle('no-ai', !ok);
    const was = $('#ai-out').textContent === INTRO;
    INTRO = !ok ? DQ.ai.OFFLINE : INTRO0 + '（使用你自己的 Claude 帳號，第一次使用時會詢問是否允許。）';
    if (was && !$('#ai-box').hidden) $('#ai-out').textContent = INTRO;
  };
  DQ.ai.ready.then(aiReady);
  // 完全離線：不連任何外部網站。打開時另外加一條 CSP (connect-src 'none')，由瀏覽器擋下所有連線；關閉後重新整理頁面才會恢復
  const lockNetwork = () => {
    if (document.querySelector('meta[data-offline]')) return;
    const m = document.createElement('meta'); m.httpEquiv = 'Content-Security-Policy'; m.content = "connect-src 'none'"; m.dataset.offline = '1'; document.head.append(m);
  };
  const offlineNote = () => { $('#offline-note').textContent = DQ.ai.isOffline() ? '完全離線中：AI 已關閉，不讀取線上法規更新，瀏覽器也會擋下所有對外連線。關閉後請重新整理頁面才會恢復連線。' : ''; };
  $('#offline-mode').checked = DQ.ai.isOffline();
  if (DQ.ai.isOffline()) lockNetwork();
  offlineNote();
  $('#offline-mode').onchange = async e => {
    const on = e.target.checked, ok = await DQ.ai.setOffline(on);
    if (on) lockNetwork();
    audit('完全離線', on ? '開啟：不連任何外部網站' : '關閉');
    aiReady(!!ok); offlineNote();
    if (!on && document.querySelector('meta[data-offline]')) $('#offline-note').textContent = '已關閉完全離線。請重新整理頁面，才會恢復 AI 與線上法規更新。';
  };

  // 本機自訂更新 (待主管核可)：AI 轉換的規則、AI 建議的預防檢查都放這裡，主管核可後才會套用
  function addDraftRules(rules, src) {
    let x = state.packs.find(p => p.pack.id === 'local');
    if (!x) { x = { pack: DQ.rulePacks.normalize({ id: 'local', name: '本機自訂更新', issuedAt: new Date().toISOString().slice(0, 10).replace(/-/g, '') }), on: true }; state.packs = state.packs.concat(x); }
    const ids = new Set(rules.map(r => r.id));
    x.pack.rules = x.pack.rules.filter(r => !ids.has(r.id)).concat(rules.map(r => Object.assign({}, r, src ? { src } : {})));
    revoke(x);
    audit('建立更新（待主管核可）', `本機自訂更新加入 ${rules.length} 條規則${src === 'ai' ? '（AI 產生）' : ''}，主管核可後才會套用`);
    DQ.app.setPacks(state.packs.slice());
  }
  // 更新包內容有改動：原本的核可失效，要重新申請
  function revoke(x) { if (x.approvedFile || x.approval) audit('核可失效', `「${x.pack.name}」內容有改動，原本的主管核可失效，需要重新申請`); x.approvedFile = null; x.approval = null; x.verified = false; }
  // 驗證存在這台電腦的「已核可」更新包 (開啟時)；驗證不過的不套用
  const sortKeys = v => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v;
  const canonPack = p => JSON.stringify(sortKeys(DQ.rulePacks.normalize(p)));
  async function verifyApproved() {
    for (const x of state.packs.filter(y => !y.official && y.approvedFile)) {
      const v = await DQ.approval.verify(x.approvedFile, PACK_KEY_PINS);
      // 簽章涵蓋的內容要和這台電腦存的內容相同 (都先整理成標準格式、依鍵名排序後比對，鍵的順序不影響)
      x.verified = v.ok && canonPack(v.pack) === canonPack(x.pack); x.approval = x.verified ? v.approval : null;
    }
  }
  // 舊版存在這台電腦的自訂規則 (直接套用)：改放進本機自訂更新，等主管核可
  try {
    const legacy = JSON.parse(localStorage.getItem('dq-custom-rules') || '[]');
    if (Array.isArray(legacy) && legacy.length) {
      let x = state.packs.find(p => p.pack.id === 'local');
      if (!x) { x = { pack: DQ.rulePacks.normalize({ id: 'local', name: '本機自訂更新' }), on: true }; state.packs.push(x); }
      const ids = new Set(legacy.map(r => r.id));
      x.pack.rules = x.pack.rules.filter(r => !ids.has(r.id)).concat(legacy.map(r => Object.assign({}, r, { src: 'ai' })));
      x.approvedFile = null; x.approval = null; x.verified = false;
      localStorage.setItem('dq-rule-packs', JSON.stringify(state.packs.filter(y => !y.official).map(y => ({ pack: y.pack, on: y.on, imported: y.imported, approvedFile: y.approvedFile || null }))));
      localStorage.removeItem('dq-custom-rules');
      state.customRules = []; state.droppedRules = [];
    }
  } catch (e) { /* ignore */ }

  // 提供給規則匯入分頁使用
  DQ.app = {
    state, run, showTab, select, download, applyFix, rowLabel, onBack, doneBack, audit,
    setPacks(list) {
      state.packs = list;
      try {
        localStorage.setItem('dq-rule-packs', JSON.stringify(list.filter(x => !x.official).map(x => ({ pack: x.pack, on: x.on, imported: x.imported, approvedFile: x.approvedFile || null, impact: x.impact || null }))));
        localStorage.setItem('dq-official-off', JSON.stringify(list.filter(x => x.official && !x.on).map(x => offKey(x.pack))));
      } catch (e) { /* ignore */ }
      if (state.res) run(); else activeRules(); renderVersion();
    },
    loadOfficial,
    activeRules, base: BASE,
    usable, pins: PACK_KEY_PINS, addDraftRules, verifyApproved,
    // 舊介面：自訂規則改為加入「本機自訂更新」(待主管核可)，不再直接套用
    setCustomRules(rules) { addDraftRules(rules, 'ai'); },
  };

  // 手機上清單預設收起 (主要用逐筆確認)，按「看全部清單」展開
  document.querySelector('.more-menu').addEventListener('click', e => { if (e.target.closest('.menu-item')) e.currentTarget.open = false; });
  $('#btn-list').onclick = () => { const on = document.body.classList.toggle('show-list'); $('#btn-list').setAttribute('aria-expanded', on); $('#btn-list').textContent = on ? '收起清單' : '看全部清單'; };
  // 頁尾：各險種規則的版本與條數
  // 法規版本的核實狀態 (rules/versions.js)：沒有向官方來源核實過最新版本的，一律標示「尚未核實最新版本」
  const V = DQ.ruleVersions;
  const versionStatus = () => V.list.map(v => `${v.name}：${V.label(v)}`).join('；');
  function renderVersion() {
    const st = DQ.ruleStats.count(), MANUAL = { cancer: '個人癌症保險填報手冊', accident: '新式傷害保險填報手冊' };
    const on = state.packs.filter(x => x.on);
    $('#rule-version').textContent = `人壽保險業個人壽險填報手冊與檢核規則（2025 填報年度，${st.total} 條）` +
      st.ext.map(e => `、${MANUAL[e.key] || e.name}（${e.version} 年版，${e.n} 條）`).join('') + '。' +
      (on.length ? `另套用法規更新：${on.map(x => x.pack.name + (x.pack.version ? ` 第 ${x.pack.version} 版` : '')).join('、')}。` : '');
    const el = $('#rule-status');
    el.className = 'rule-status' + (V.allVerified() ? ' ok' : ' warn');
    el.textContent = V.allVerified() ? `各險種規則都已向官方來源核實為最新版本。` : `尚未核實最新版本：${V.list.filter(v => V.status(v) !== 'verified').map(v => v.name).join('、')}。工具依下列文件實作，不代表符合最新法規；申報前請向保發中心確認手冊版本。`;
    DQ.safe($('#rule-sources')).innerHTML = V.list.map(v => `<li><b>${esc(v.name)}</b>：<span class="${V.status(v) === 'verified' ? 'ok' : 'warn'}">${esc(V.label(v))}</span><br>依據文件：${esc(v.document)}<br>版本：${esc(v.edition)}；函文：${esc(v.basis)}<br>適用：${esc(v.effective)}<br>最後核實日期：${esc(v.lastVerified || '尚未核實')}；文件資訊記錄於 ${esc(v.documentRecordedAt)}<br>官方來源：<a href="${esc(v.officialSource.url)}" target="_blank" rel="noopener">${esc(v.officialSource.name)}</a>${v.note ? `<br><span class="hint">${esc(v.note)}</span>` : ''}</li>`).join('');
  }
  activeRules(); renderVersion();
  // Excel 讀取元件的實際版本 (執行時檢查，不看說明文字)：未達官方修補版本時照實顯示
  state.xlsxLib = DQ.workbook.libStatus(window.XLSX);
  if (!state.xlsxLib.ok) { $('#lib-note').hidden = false; $('#lib-note').textContent = `Excel 讀取元件目前是 SheetJS ${state.xlsxLib.version}，低於官方修補版本 ${state.xlsxLib.min}，有已知的特製檔案解析風險。工具會在解析前做壓縮檔預檢與原型污染檢查，但不能完全取代更新元件；請只放入來源可信的 Excel 檔，或改用 CSV／文字檔。`; }
  // 開啟時重新驗證「已核可」的更新包，通過的才套用
  verifyApproved().then(() => { if (state.packs.some(x => x.approvedFile)) DQ.app.setPacks(state.packs.slice()); });
  // 送給 AI 之前：顯示實際送出的完整內容 (系統指示＋遮蔽後的資料)，使用者按「送出」才送。每次都要確認，不提供「不再詢問」
  DQ.ai.confirmSend = (text, counts) => new Promise(resolve => {
    const d = $('#ai-preview'), desc = DQ.pii.describe(counts);
    const dest = DQ.ai.providerName() || 'AI';
    $('#ai-preview-note').textContent = `將送到 ${dest}，共 ${text.length.toLocaleString()} 字，下面就是完整的送出內容。${desc ? `送出前已遮蔽：${desc}。` : '沒有偵測到需要遮蔽的個資。'}遮蔽無法保證百分之百完整：不在客戶資料裡、也沒有「姓名：」「被保險人」等標示的姓名可能認不出來，請確認沒有不該送出的資料。`;
    $('#ai-preview-text').textContent = text;
    const done = ok => {
      $('#ai-preview-yes').onclick = $('#ai-preview-no').onclick = d.oncancel = null;
      if (d.open) d.close();
      audit('送出給 AI', ok ? `${text.length.toLocaleString()} 字，使用者確認送出到 ${dest}（結果另外記錄）` : '使用者取消，沒有送出', null, ok ? { payload: text } : null);
      resolve(ok);
    };
    $('#ai-preview-yes').onclick = () => done(true);
    $('#ai-preview-no').onclick = () => done(false);
    d.oncancel = e => { e.preventDefault(); done(false); };
    if (d.showModal) d.showModal(); else resolve(window.confirm('要把遮蔽後的內容送給 AI 嗎？'));
  });
  // 已知個資的上下文：每一次 AI 呼叫 (含規則轉換、退件說明) 都用已放入的客戶資料姓名與證號遮罩，不送出客戶資料本身
  DQ.ai.contextProvider = () => DQ.aiPayload.context(state.res, Object.assign(reconCtx(), { custText: state.files.customers ? state.files.customers.text : '' }));
  // 姓名完全遮蔽 (王○明 → ○○○)：記在這台電腦
  try { DQ.pii.setOptions({ fullName: localStorage.getItem('dq-pii-fullname') === '1' }); } catch (e) { /* ignore */ }
  $('#pii-fullname').checked = DQ.pii.setOptions({}).fullName;
  $('#pii-fullname').onchange = e => { DQ.pii.setOptions({ fullName: e.target.checked }); try { localStorage.setItem('dq-pii-fullname', e.target.checked ? '1' : '0'); } catch (x) { /* ignore */ } audit('AI 遮蔽設定', e.target.checked ? '姓名完全遮蔽' : '姓名保留姓與最後一字'); };
  // 送出後的實際結果 (成功、失敗、逾時) 記在稽核軌跡，不把「已確認送出」當成「成功」
  DQ.ai.onStatus = e => audit('AI 送出結果', `${e.kind}：${e.status}（${e.dest}）`);
  // AI 傳送紀錄：每一次送給 AI 的時間、目的地、字數、狀態與完整內容
  $('#btn-ai-log').onclick = () => {
    const list = DQ.ai.sent, p2 = n => String(n).padStart(2, '0');
    DQ.safe($('#ai-log-list')).innerHTML = list.length ? list.slice().reverse().map(e => `<details class="ai-log-item"><summary><b>${p2(e.at.getHours())}:${p2(e.at.getMinutes())}:${p2(e.at.getSeconds())}</b>　${esc(e.kind)}・${esc(e.dest)}・${e.chars.toLocaleString()} 字・<span class="${e.status === DQ.ai.STATUS.ok ? '' : 'muted'}">${esc(e.status)}</span></summary><pre>${esc(e.payload)}</pre></details>`).join('')
      : '<p class="hint">這次開啟後還沒有送任何內容給 AI。</p>';
    $('#ai-log').showModal();
  };
  $('#ai-log-close').onclick = () => $('#ai-log').close();
  // AI 安全自我測試 (真正的模型)：結果記在畫面與稽核軌跡
  // 首頁的「開始檢核」：還沒放資料時打開選檔視窗；已放資料時重新檢查並捲到結果
  if ($('#btn-start')) $('#btn-start').onclick = () => { if (DETAIL.some(k => state.files[k])) { run(); $('#summary').scrollIntoView({ behavior: 'smooth' }); } else $('#file-book').click(); };
  $('#link-updates').onclick = e => { e.preventDefault(); showTab('updates'); };
  document.addEventListener('click', e => { const a = e.target.closest('[data-goto]'); if (a) { e.preventDefault(); showTab(a.dataset.goto); } });
  // 打開時不載入任何資料：只顯示拖放框
  document.body.classList.add('no-data');
  $('#sample-note').textContent = '';
  if (['check', 'recon', 'decode', 'report', 'rules', 'updates'].includes(hash)) showTab(hash);
})();
