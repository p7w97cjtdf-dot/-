// 開啟後的啟動工作 (原本寫在 index.html 的內嵌程式；移到檔案裡，CSP 才能禁止內嵌程式)
// 1. 讀取官方法規更新包  2. 註冊離線用的 service worker (只在 https 或本機)
window.DQ && DQ.app && DQ.app.loadOfficial();
try { if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* 沙盒環境不支援離線功能 */ }
