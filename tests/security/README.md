# 安全測試 (tests/security)

對應安全測試清單 T01–T08，結果整理在 `docs/security-test-report.md`。

可以在 Node 直接跑的部分 (T02 遮罩格式、T03 更新包驗證、T04 檢核繞過、T05 規則文件標記、T06 CSV 公式、T07 問題上限) 在 `tests/security.test.js`，已併入 `npm test`。

需要瀏覽器的部分用 Playwright 開啟 `index.html` 操作 (測試時所有對外連線都會被攔下並記錄)：

```bash
# 需要 Playwright 與 Chromium：npm i -D playwright && npx playwright install chromium
# 已有 Chromium 時可用 CHROMIUM=/path/to/chromium 指定
node tests/security/t01-network.js   # 外傳驗證：一般檢核、AI 分析、規則更新時的網路請求與送給 AI 的欄位
node tests/security/t02-sent.js      # 個資遮罩：實際送給 AI 的文字裡找不到客戶證號、姓名、地址與手動貼上的個資
node tests/security/t03-packs.js     # 更新包信任：停用規則的測試包、被竄改或格式錯誤的官方包
node tests/security/t05-prompt.js    # AI 提示注入：指令只出現在 <資料> 區塊內、不安全的 AI 回覆會加註提醒
node tests/security/t06-html.js      # HTML 注入：畫面、報告、手機複核、規則預覽、CSV
node tests/security/t07-stress.js    # 檔案壓力測試 (SIZES=1000,20000,100000 可調整張數)
node tests/security/t08-output.js    # 輸出正確性：一鍵修改後下載的檔案重新檢查要和畫面一致
node tests/security/t09-insights.js  # AI 洞見驗證：AI 說的原因與筆數要經工具用原始資料驗證
node tests/security/t10-dify.js     # Dify：AI 改送到 Dify 時只在按按鈕後送出、內容已遮蔽、帶金鑰、只接受 https
```

預設使用 `samples/excel/試用資料_含錯誤.xlsx`；可用 `SAMPLE=` 指定其他檔案。測試產生的暫存檔放在系統暫存資料夾 (`TMPDIR_T=` 可指定)。
所有測試資料都是虛構的。
