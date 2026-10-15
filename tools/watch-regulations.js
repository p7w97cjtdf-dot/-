#!/usr/bin/env node
// 法規來源監看：抓取 rules/updates/sources.json 列出的網頁，只比對含關鍵字的段落，
// 和上次記錄 (rules/updates/watch-state.json) 比較，有新增段落時輸出報告 (給 GitHub Actions 開待辦單)。
// 不會自動修改任何檢查規則：規則仍需法遵確認後，以規則更新包發布。
// 用法：node tools/watch-regulations.js [--report report.md]
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const SOURCES = path.join(ROOT, 'rules', 'updates', 'sources.json');
const STATE = path.join(ROOT, 'rules', 'updates', 'watch-state.json');

// 網頁轉成一段一段的文字
function textLines(html) {
  return String(html)
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d|td|dd|dt|a)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .split('\n').map(l => l.replace(/\s+/g, ' ').trim()).filter(l => l.length >= 4 && l.length <= 400);
}
// 含關鍵字的段落 (去重、保留順序)
function extract(html, keywords) {
  const seen = new Set(), out = [];
  for (const l of textLines(html)) if ((!keywords || !keywords.length || keywords.some(k => l.includes(k))) && !seen.has(l)) { seen.add(l); out.push(l); }
  return out.slice(0, 2000);
}
// 網頁中的連結 (文字 → 網址)
function links(html, base) {
  const out = [];
  for (const m of String(html).matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const text = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    try { out.push({ text, url: new URL(m[1].replace(/&amp;/g, '&'), base).href }); } catch (e) { /* 無效網址 */ }
  }
  return out;
}
const diff = (prev, cur) => ({ added: cur.filter(l => !prev.includes(l)), removed: prev.filter(l => !cur.includes(l)) });

async function fetchText(url, opts) {
  opts = opts || {};
  if (url.startsWith('file:')) return fs.readFileSync(new URL(url), 'utf8');
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 30000);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (regulation-watch; filing validation assistant)', 'Accept-Language': 'zh-TW' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } catch (e) {
    // Node 抓不到時 (例如網站憑證鏈不完整) 改用 curl 再試一次，並保留原因方便調整設定
    const why = e.cause ? `${e.message} (${e.cause.code || e.cause.message})` : e.message;
    // insecureTLS：只用在憑證鏈設定不完整的公開網站；只讀取公開文字，內容仍需人工確認
    try { return require('child_process').execFileSync('curl', ['-sSL', '--max-time', '30', '-A', 'Mozilla/5.0 (regulation-watch)'].concat(opts.insecureTLS ? ['-k'] : [], [url]), { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }); }
    catch (e2) { throw new Error(`${why}；curl：${String(e2.stderr || e2.message).trim().split('\n').pop()}`); }
  } finally { clearTimeout(t); }
}
// 一個來源：主頁面，加上 follow 指定的連結 (例如首頁上的「最新法令函釋」)，合併成一份段落清單
// 「本網頁將自動轉址」這類中繼頁：找出真正的網址 (meta refresh、location 轉址或頁面上唯一的連結)
function redirectTarget(html, base) {
  const m = /http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"'>\s]+)/i.exec(html) || /location(?:\.href)?\s*=\s*["']([^"']+)["']/i.exec(html);
  if (m) { try { return new URL(m[1].replace(/&amp;/g, '&'), base).href; } catch (e) { /* ignore */ } }
  return null;
}
async function sourceLines(s, info) {
  const opts = { insecureTLS: s.insecureTLS };
  const html = await fetchText(s.url, opts);
  let lines = extract(html, s.keywords);
  for (const label of s.follow || []) {
    const hit = links(html, s.url).find(l => l.text.includes(label));
    if (!hit) { lines.push(`(找不到「${label}」連結)`); continue; }
    try {
      let url = hit.url, page = await fetchText(url, opts);
      const next = /自動轉址|redirect/i.test(page) && redirectTarget(page, url);
      if (next && next !== s.url) { url = next; page = await fetchText(url, opts); }
      info.followed[label] = url;
      lines = lines.concat(extract(page, s.keywords).map(l => `[${label}] ${l}`));
    } catch (e) { lines.push(`(「${label}」${hit.url} 讀取失敗：${e.message})`); }
  }
  return [...new Set(lines)];
}

async function main(argv) {
  const cfg = JSON.parse(fs.readFileSync(process.env.WATCH_SOURCES || SOURCES, 'utf8'));
  const statePath = process.env.WATCH_STATE || STATE;
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8') || '{}') : {};
  const now = new Date().toISOString();
  const changes = [], failures = [], baseline = [];
  for (const s of cfg.sources) {
    const prev = state[s.id] || {};
    try {
      const info = { followed: {} };
      const lines = await sourceLines(s, info);
      if (!lines.length) throw new Error('找不到含關鍵字的內容 (網頁改版或需要登入)');
      if (!prev.lines) baseline.push(s);
      else { const d = diff(prev.lines, lines); if (d.added.length || d.removed.length) changes.push({ s, d }); }
      state[s.id] = { name: s.name, url: s.url, checkedAt: now, changedAt: !prev.lines || changes.some(c => c.s === s) ? now : prev.changedAt, failures: 0, followed: info.followed, lines };
    } catch (e) {
      failures.push({ s, error: e.message });
      state[s.id] = Object.assign({}, prev, { name: s.name, url: s.url, checkedAt: now, failures: (prev.failures || 0) + 1, lastError: e.message });
    }
  }
  fs.writeFileSync(statePath, JSON.stringify(state, null, 1) + '\n');

  const md = [];
  if (changes.length) {
    md.push('監看的法規來源有更動，請法遵確認是否影響申報格式或檢核規則。', '');
    for (const { s, d } of changes) {
      md.push(`### ${s.name}`, s.url, '');
      if (d.added.length) md.push('**新增或修改的段落**', ...d.added.slice(0, 40).map(l => `- ${l}`), d.added.length > 40 ? `- …另有 ${d.added.length - 40} 段` : '', '');
      if (d.removed.length) md.push(`**不再出現的段落**：${d.removed.length} 段`, '');
    }
    md.push('### 處理步驟', '- [ ] 閱讀原文，判斷是否影響申報格式或檢核規則',
      '- [ ] 若有影響：在檢核工具的「法規更新」頁新增檢查、新增欄位或停用不適用的檢查，試跑後下載更新包',
      '- [ ] 更新包放到 `rules/updates/`、加進 `rules/updates/index.json`，經覆核後併入 main：所有人打開工具時會自動套用',
      '- [ ] 若沒有影響：在此說明原因後關閉');
  }
  const summary = [`檢查 ${cfg.sources.length} 個來源：${changes.length} 個有更動、${baseline.length} 個第一次記錄、${failures.length} 個連不上。`,
    ...failures.map(f => `- 連不上：${f.s.name}（${f.s.url}）：${f.error}；已連續 ${state[f.s.id].failures} 次`)].join('\n');
  const i = argv.indexOf('--report');
  if (i > 0) fs.writeFileSync(argv[i + 1], changes.length ? md.join('\n') + '\n\n' + summary + '\n' : '');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n' + (changes.length ? '\n' + md.join('\n') + '\n' : ''));
  console.log(summary);
  return { changes, failures, baseline };
}

if (require.main === module) main(process.argv).catch(e => { console.error(e); process.exit(1); });
module.exports = { textLines, extract, links, diff, main };
