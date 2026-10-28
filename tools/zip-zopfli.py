# 用 zopfli 壓縮 (標準 ZIP / Deflate 格式，任何解壓縮程式都能開；只是壓得比 zip -9 小約 5%)
#   python3 tools/zip-zopfli.py 輸出檔 [來源資料夾]   需要 pip install zopfli；build-zip.sh 會在有安裝時自動使用
import os, sys, zipfile, zlib
import zopfli.zlib as zz

out, src = os.path.abspath(sys.argv[1]), sys.argv[2] if len(sys.argv) > 2 else '.'
os.chdir(src)
if os.path.exists(out): os.remove(out)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for d, dirs, files in os.walk('.'):
        dirs.sort()
        for f in sorted(files):
            p = os.path.relpath(os.path.join(d, f))
            data = open(p, 'rb').read()
            comp = zz.compress(data)[2:-4]  # zlib 格式去掉表頭與檢查碼 = 原始 Deflate
            if zlib.decompress(comp, -15) != data: sys.exit(f'壓縮結果不一致：{p}')
            zi = zipfile.ZipInfo.from_file(p, p)
            zi.compress_type, zi.CRC, zi.file_size, zi.compress_size = zipfile.ZIP_DEFLATED, zlib.crc32(data), len(data), len(comp)
            zi.header_offset = z.fp.tell(); z._writecheck(zi); z._didModify = True
            z.fp.write(zi.FileHeader(False)); z.fp.write(comp)
            z.filelist.append(zi); z.NameToInfo[zi.filename] = zi; z.start_dir = z.fp.tell()
with zipfile.ZipFile(out) as z:
    bad = z.testzip()
    if bad: sys.exit(f'壓縮檔檢查失敗：{bad}')
