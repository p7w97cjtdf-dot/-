#!/bin/sh
# 打包可部署的工具 (Vercel、GitHub Pages、或直接解壓縮雙擊 index.html)，只放執行需要的檔案。
# 不含：試用資料 (samples/)、測試、開發工具、設計稿、GitHub 自動化、法規監看紀錄、開發說明 (README、docs/*.md、docs/index.html 介紹頁、rules/source 說明；工具裡的連結指向 GitHub)、法規監看設定與示範更新包。
#   sh tools/build-zip.sh [輸出檔]   預設 dist/filing-validation-assistant.zip (以目前的 commit 為準)
set -e
cd "$(dirname "$0")/.."
ROOT="$(pwd)"
OUT="$(pwd)/${1:-dist/filing-validation-assistant.zip}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive HEAD | tar -x -C "$TMP"
cd "$TMP"
rm -rf samples tests tools design-system .github .claude README.md package.json .gitignore .vercelignore rules/updates/watch-state.json src/mock-ext.js docs/*.md docs/index.html rules/source rules/updates/sources.json rules/updates/example-2026-format-change.json
mkdir -p "$(dirname "$OUT")" && rm -f "$OUT"
# 有安裝 zopfli (pip install zopfli) 時壓得更小；沒有就用 zip -9
if python3 -c "import zopfli.zlib" 2>/dev/null; then python3 "$ROOT/tools/zip-zopfli.py" "$OUT" .; else zip -qr9 "$OUT" .; fi
echo "已輸出 $OUT ($(($(wc -c < "$OUT") / 1024)) KB)"
