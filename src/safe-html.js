/*
 * 安全的 HTML 寫入 (防 XSS)：畫面上所有要寫入 HTML 結構的地方都經過這裡，不直接寫 innerHTML / insertAdjacentHTML / outerHTML。
 *  - 變數內容 (檔案資料、更新包、AI 回覆) 在組 HTML 時已先用 esc() 跳脫；寫入前再用 DOMPurify.sanitize() 過濾一次
 *    (拿掉 <script>、onerror= 之類的事件屬性、javascript: 網址等)，即使哪一處漏了跳脫，也不會執行
 *  - 純文字 (例如 AI 回答的內文) 請直接用 textContent，不要組成 HTML
 *  - DOMPurify 沒有載入時不寫入 HTML，改成顯示純文字 (fail closed)
 * 用法：DQ.safe(元素).innerHTML = html；DQ.safe(元素).insertAdjacentHTML('beforeend', html)；DQ.safe.doc(整份報告 HTML)
 * vendor/purify.min.js：DOMPurify 3.2.6 (Apache-2.0 / MPL-2.0)
 */
(function (root) {
  'use strict';
  const P = () => root.DOMPurify && root.DOMPurify.isSupported ? root.DOMPurify : null;
  // 工具自己的 HTML 會用到的屬性；網址只允許 https、mailto、頁內 #、相對路徑
  const CFG = { ADD_ATTR: ['target'], ALLOWED_URI_REGEXP: /^(?:(?:https|mailto):|#|[^a-z]|[a-z0-9+.-]+(?:[^a-z0-9+.\-:]|$))/i };
  // 表格裡的片段 (<tr>…) 要放回表格的位置過濾，否則會被當成一般內容把 <tr> <td> 拿掉
  const WRAP = { TBODY: ['<table><tbody>', '</tbody></table>'], THEAD: ['<table><thead>', '</thead></table>'], TFOOT: ['<table><tfoot>', '</tfoot></table>'], TR: ['<table><tbody><tr>', '</tr></tbody></table>'], TABLE: ['<table>', '</table>'] };
  function clean(html, el) {
    html = String(html == null ? '' : html);
    const w = el && WRAP[el.tagName];
    if (!w) return P().sanitize(html, CFG);
    const out = P().sanitize(w[0] + html + w[1], CFG), a = out.indexOf(w[0]), b = out.lastIndexOf(w[1]);
    return a === 0 && b >= 0 ? out.slice(w[0].length, b) : '';
  }
  // 外部連結一律加 rel="noopener"
  let hooked = false;
  const hook = () => {
    if (hooked || !P()) return; hooked = true;
    P().addHook('afterSanitizeAttributes', n => { if (n.tagName === 'A' && n.getAttribute('target')) n.setAttribute('rel', 'noopener noreferrer'); });
  };
  function safe(el) {
    return {
      set innerHTML(html) { if (!P()) { el.textContent = String(html == null ? '' : html).replace(/<[^>]*>/g, ''); return; } hook(); el.innerHTML = clean(html, el); },
      get innerHTML() { return el.innerHTML; },
      set outerHTML(html) { if (!P()) return; hook(); el.outerHTML = clean(html, el.parentElement); },
      insertAdjacentHTML(pos, html) { if (!P()) { el.insertAdjacentText(pos, String(html == null ? '' : html).replace(/<[^>]*>/g, '')); return; } hook(); el.insertAdjacentHTML(pos, clean(html, /^(afterbegin|beforeend)$/i.test(pos) ? el : el.parentElement)); },
    };
  }
  // 整份 HTML 文件 (檢查報告)：保留 <head> 的字元編碼與樣式
  safe.doc = html => {
    if (!P()) return '<!doctype html><meta charset="utf-8"><p>無法安全顯示報告 (HTML 過濾元件沒有載入)。</p>';
    hook();
    const out = P().sanitize(String(html), Object.assign({}, CFG, { WHOLE_DOCUMENT: true, ADD_TAGS: ['meta', 'style'], ADD_ATTR: ['target', 'charset', 'content', 'name'] }));
    return /^\s*<!doctype/i.test(html) ? '<!doctype html>\n' + out : out;
  };
  safe.clean = html => P() ? (hook(), clean(html)) : '';
  safe.ready = () => !!P();
  root.DQ = root.DQ || {};
  root.DQ.safe = safe;
})(typeof self !== 'undefined' ? self : this);
