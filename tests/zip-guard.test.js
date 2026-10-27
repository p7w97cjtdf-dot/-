// ZIP／XLSX 壓縮炸彈與特製目錄：在交給 Excel 元件 (XLSX.read) 之前就拒絕
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const W = require('../src/workbook.js');

const { makeZip } = require('./make-zip.js');
const sample = fs.readFileSync(path.join(__dirname, '..', 'samples', 'excel', '試用資料_含錯誤.xlsx'));

test('正常的 Excel 試用資料都通過預檢', () => {
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'samples', 'excel'))) {
    const z = W.zipStats(fs.readFileSync(path.join(__dirname, '..', 'samples', 'excel', f)));
    assert.ok(z && !z.bad && z.ratio < W.ZIP_LIMITS.maxRatio, `${f}：${JSON.stringify(z)}`);
  }
  assert.strictEqual(W.zipStats(Buffer.from('not a zip')), null, '不是 ZIP (例如舊版 .xls) 回傳 null');
});

test('壓縮炸彈：壓縮後約 48 KB、解開後約 50 MB、壓縮比約 1,026 倍 → 在 XLSX.read 之前拒絕', () => {
  const bomb = makeZip([['[Content_Types].xml', Buffer.from('<Types/>'), 'deflate'], ['xl/worksheets/sheet1.xml', Buffer.alloc(50 * 1048576, 0x20), 'deflate']]);
  const kb = bomb.length / 1024, ratio = 50 * 1048576 / bomb.length;
  assert.ok(kb > 40 && kb < 60, `測試檔約 48 KB：實際 ${kb.toFixed(1)} KB`);
  assert.ok(ratio > 900 && ratio < 1100, `壓縮比約 1,026 倍：實際 ${ratio.toFixed(0)}`);
  assert.match(W.zipProblem(bomb), /壓縮比約 1,0\d\d 倍，超過 100 倍/);
});

test('上限：總大小、單一項目、項目數、壓縮檔大小', () => {
  const rnd = n => require('crypto').randomBytes(n);   // 隨機內容壓不太下來，只測大小上限
  assert.match(W.zipProblem(makeZip([['a.xml', rnd(3 * 1048576), 'store']]), { maxEntry: 2 * 1048576 }), /超過單一項目 2 MB/);
  assert.match(W.zipProblem(makeZip([['a.xml', rnd(1048576), 'store'], ['b.xml', rnd(1048576), 'store'], ['c.xml', rnd(1048576), 'store']]), { maxTotal: 2.5 * 1048576 }), /解開後超過 2\.5 MB/);
  assert.match(W.zipProblem(makeZip([['a', Buffer.from('1')], ['b', Buffer.from('2')], ['c', Buffer.from('3')]]), { maxEntries: 2 }), /內含 3 個項目，超過 2 個/);
  assert.match(W.zipProblem(sample, { maxArchive: 50 * 1024 }), /壓縮檔本身有 0\.1 MB，超過 0 MB|壓縮檔本身有/);
  // 預設值
  assert.deepStrictEqual({ ...W.ZIP_LIMITS }, { maxArchive: 50 * 1048576, maxTotal: 100 * 1048576, maxEntry: 50 * 1048576, maxEntries: 2000, maxRatio: 100, ratioFloor: 1048576 });
});

test('特製目錄：ZIP64、長度與位置對不上、重疊、截斷、加密、重複名稱都拒絕', () => {
  const ok = makeZip([['a.xml', Buffer.from('hello'.repeat(100))], ['b.xml', Buffer.from('world'.repeat(100))]]);
  assert.strictEqual(W.zipProblem(ok), '');
  const e = ok.length - 22, mod = f => { const b = Buffer.from(ok); f(b); return W.zipProblem(b); };
  assert.match(mod(b => b.writeUInt16LE(0xffff, e + 10)), /ZIP64/);
  assert.match(mod(b => b.writeUInt32LE(0xffffffff, e + 16)), /ZIP64/);
  // ZIP64 結尾定位標記
  const loc = Buffer.alloc(20); loc.writeUInt32LE(0x07064b50, 0);
  assert.match(W.zipProblem(Buffer.concat([ok.subarray(0, e), loc, ok.subarray(e)])), /ZIP64|位置或長度對不上/);
  assert.match(mod(b => b.writeUInt32LE(b.readUInt32LE(e + 16) + 1, e + 16)), /位置或長度對不上/);
  assert.match(mod(b => b.writeUInt32LE(b.readUInt32LE(e + 12) - 1, e + 12)), /位置或長度對不上/);
  assert.match(mod(b => b.writeUInt16LE(3, e + 10)), /分割|不完整|對不上/);
  // 第二個項目指向第一個項目的資料 (重疊)
  const cd2 = ok.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]), ok.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02])) + 4);
  assert.match(mod(b => b.writeUInt32LE(0, cd2 + 42)), /重疊|位置對不上|長度超出/);
  assert.match(W.zipProblem(makeZip([['a.xml', Buffer.from('x')]], { flags: 1 })), /密碼/);
  assert.match(W.zipProblem(makeZip([['a.xml', Buffer.from('x')], ['a.xml', Buffer.from('y')]])), /重複/);
  assert.match(mod(b => b.writeUInt32LE(0xffffffff, cd2 + 24)), /ZIP64/);
  // 截斷、目錄後面多了資料
  assert.notStrictEqual(W.zipProblem(ok.subarray(0, ok.length - 5)), '');
  assert.notStrictEqual(W.zipProblem(Buffer.concat([ok, Buffer.from('junk')])), '');
});

test('隨機截斷與亂改位元組：預檢不會丟出例外，只會回傳通過或拒絕原因', () => {
  let seed = 7; const rnd = n => (seed = (seed * 1103515245 + 12345) % 2147483648) % n;
  for (let i = 0; i < 400; i++) {
    const b = Buffer.from(sample.subarray(0, i % 3 === 0 ? 30 + rnd(sample.length - 30) : sample.length));
    for (let k = 0; k < 4; k++) b[rnd(b.length)] = rnd(256);
    const z = W.zipStats(b);
    assert.ok(z === null || typeof z.bad === 'string' || typeof z.total === 'number');
  }
});
