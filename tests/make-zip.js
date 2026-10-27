// 測試用：做一個真的 ZIP 檔 (可用一般解壓程式打開)，給壓縮炸彈與特製目錄的測試使用
const zlib = require('zlib');
// entries = [[名稱, 內容 Buffer, 'deflate'|'store']]
function makeZip(entries, opts = {}) {
  const locals = [], cds = [];
  let off = 0;
  for (const [name, body, how] of entries) {
    const n = Buffer.from(name), data = how === 'store' ? body : zlib.deflateRawSync(body, { level: 9 });
    const crc = zlib.crc32(body);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(opts.flags || 0, 6); lh.writeUInt16LE(how === 'store' ? 0 : 8, 8);
    lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(data.length, 18); lh.writeUInt32LE(body.length, 22); lh.writeUInt16LE(n.length, 26);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(opts.flags || 0, 8); ch.writeUInt16LE(how === 'store' ? 0 : 8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(data.length, 20); ch.writeUInt32LE(body.length, 24); ch.writeUInt16LE(n.length, 28); ch.writeUInt32LE(opts.locOverride != null ? opts.locOverride : off, 42);
    locals.push(lh, n, data); cds.push(ch, n);
    off += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(cds), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(off, 16);
  return Buffer.concat([...locals, cd, eocd]);
}
module.exports = { makeZip };
