#!/bin/sh
# 打包可部署的工具 (Vercel、GitHub Pages、或直接解壓縮雙擊 index.html)，只放執行需要的檔案。
# 不含：試用資料 (samples/)、測試、開發工具、設計稿、GitHub 自動化、法規監看紀錄。
#   sh tools/build-zip.sh [輸出檔]   預設 dist/filing-validation-assistant.zip (以目前的 commit 為準)
set -e
cd "$(dirname "$0")/.."
OUT="$(pwd)/${1:-dist/filing-validation-assistant.zip}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
git archive HEAD | tar -x -C "$TMP"
cd "$TMP"
rm -rf samples tests tools design-system .github .claude rules/updates/watch-state.json src/mock-ext.js
mkdir -p "$(dirname "$OUT")" && rm -f "$OUT"
zip -qr9 "$OUT" .
echo "已輸出 $OUT ($(($(wc -c < "$OUT") / 1024)) KB)"
