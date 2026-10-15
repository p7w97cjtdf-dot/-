// 法規來源監看：只比對含關鍵字的段落；第一次只記錄，之後有新增段落才回報
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const W = require('../tools/watch-regulations.js');

test('網頁轉文字並只留含關鍵字的段落', () => {
  const html = '<html><script>var x="填報"</script><ul><li>115年1月5日 修正個人壽險填報手冊</li><li>瀏覽人數 1234</li><li>其他新聞</li></ul></html>';
  assert.deepStrictEqual(W.extract(html, ['填報']), ['115年1月5日 修正個人壽險填報手冊']);
});

test('第一次記錄、內容沒變不回報、有新公告才回報', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-'));
  const page = path.join(dir, 'page.html'), src = path.join(dir, 'sources.json'), st = path.join(dir, 'state.json');
  fs.writeFileSync(src, JSON.stringify({ sources: [{ id: 'a', name: '測試來源', url: 'file://' + page, keywords: ['填報'] }, { id: 'b', name: '壞掉的來源', url: 'file://' + path.join(dir, 'missing.html'), keywords: ['填報'] }] }));
  Object.assign(process.env, { WATCH_SOURCES: src, WATCH_STATE: st });
  const report = path.join(dir, 'report.md');
  fs.writeFileSync(page, '<p>114年 填報手冊</p><p>瀏覽 1</p>');
  let r = await W.main(['', '', '--report', report]);
  assert.strictEqual(r.baseline.length, 1); assert.strictEqual(r.changes.length, 0); assert.strictEqual(r.failures.length, 1);
  assert.strictEqual(fs.readFileSync(report, 'utf8'), '');
  fs.writeFileSync(page, '<p>114年 填報手冊</p><p>瀏覽 999</p>');
  r = await W.main(['', '', '--report', report]);
  assert.strictEqual(r.changes.length, 0, '關鍵字以外的變動不回報');
  fs.writeFileSync(page, '<p>114年 填報手冊</p><p>115年1月5日 新增填報欄位：數位投保註記</p>');
  r = await W.main(['', '', '--report', report]);
  assert.strictEqual(r.changes.length, 1);
  const md = fs.readFileSync(report, 'utf8');
  assert.ok(md.includes('數位投保註記') && md.includes('處理步驟') && md.includes('壞掉的來源'));
  assert.strictEqual(JSON.parse(fs.readFileSync(st, 'utf8')).b.failures, 3);
  delete process.env.WATCH_SOURCES; delete process.env.WATCH_STATE;
});

test('follow：沿著首頁上的連結監看下一層的公告清單', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'watch-'));
  fs.writeFileSync(path.join(dir, 'home.html'), '<a href="list.html">最新法令函釋</a><p>選單</p>');
  fs.writeFileSync(path.join(dir, 'list.html'), '<li>115年1月5日 金管保壽字第 1150001 號令 修正填報規定</li>');
  const src = path.join(dir, 's.json'), st = path.join(dir, 'st.json');
  fs.writeFileSync(src, JSON.stringify({ sources: [{ id: 'x', name: 'x', url: 'file://' + path.join(dir, 'home.html'), keywords: ['令'], follow: ['最新法令函釋'] }] }));
  Object.assign(process.env, { WATCH_SOURCES: src, WATCH_STATE: st });
  await W.main(['', '']);
  const lines = JSON.parse(fs.readFileSync(st, 'utf8')).x.lines;
  assert.ok(lines.some(l => l.startsWith('[最新法令函釋]') && l.includes('1150001')), lines.join('|'));
  delete process.env.WATCH_SOURCES; delete process.env.WATCH_STATE;
});
