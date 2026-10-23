# 第三方元件

工具讀取 Excel、PDF、Word 用的程式庫放在這裡，和工具同一個網站提供，不從外部網站即時載入：
外部網站若被竄改，惡意程式碼就能讀到放進工具的申報資料 (安全測試 T01)。

| 檔案 | 程式庫 | 授權 |
|---|---|---|
| `xlsx.core.min.js` | SheetJS 0.18.5 (不含舊版 .xls 的字碼表，檔案小一半) | Apache-2.0（`LICENSE-sheetjs.txt`） |
| `pdf.min.js`、`pdf.worker.min.js` | PDF.js 3.11.174（npm `pdfjs-dist`） | Apache-2.0（`LICENSE-pdfjs.txt`） |
| `mammoth.browser.min.js` | mammoth 1.6.0 | BSD-2-Clause（`LICENSE-mammoth.txt`） |

claude.ai 線上版是單一檔案，打包時把這些元件直接內嵌進去 (tools/build-artifact.js)，同樣不從外部網站載入。
