/*
 * 離線使用：第一次開啟後把工具的檔案存在裝置上，之後沒有網路也能檢查。
 * 一律先試網路 (拿到最新版)，網路不通時才用裝置上的版本。申報資料本身不會被存下來。
 */
const CACHE = 'dq-v16';
const CORE = ['./', './index.html', './src/app.css', './manifest.webmanifest', './vendor/xlsx.core.min.js', './icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // 只快取工具本身 (含 vendor 的讀檔元件) 與字型
  if (url.origin !== location.origin && !/^fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) return;
  e.respondWith(fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
