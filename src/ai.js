/*
 * AI 說明：用 Claude 把檢查結果整理成白話重點、解釋單一問題、說明退件通知。
 * 規則引擎負責「找出」問題 (結果固定、可追查)；AI 只負責「說明」。
 * 不需要 API key：只在 claude.ai 線上版使用開啟者自己的 Claude 帳號 (平台的 sample 功能)；
 * 在自己電腦上直接開啟 index.html 時沒有 AI，其他檢查功能照常。
 * 送出內容由 ai-payload.js 組成並遮住姓名、證號、地址；單筆解釋不送整筆資料。
 */
(function (root) {
  'use strict';
  const SYSTEM = `你是台灣壽險業年度申報資料的檢查顧問。使用者會提供檢查工具找到的問題。
請用繁體中文、一般人看得懂的白話回答：少用專有名詞，非用不可時在括號裡用一句話解釋；欄位代號請改說欄位名稱。
只根據提供的資料推論，不要捏造不存在的錯誤；不確定時說明需要人工確認的地方。`;

  // claude.ai 線上版：使用開啟者自己的 Claude 帳號 (第一次使用時會詢問是否允許)
  let platform = null;
  const ready = (async () => {
    try { if (root.claude && root.claude.use) platform = await root.claude.use('sample'); } catch (e) { platform = null; }
    return !!platform;
  })();
  const OFFLINE = 'AI 說明只能在線上版使用；在自己電腦上開啟時無法使用，其他檢查功能不受影響。';

  async function ask(prompt, opts) {
    opts = opts || {};
    if (!platform) throw new Error(OFFLINE);
    try {
      const out = await platform(`${opts.system || SYSTEM}\n\n${prompt}`, { modelTier: opts.tier || 'default' });
      return out.text.trim();
    } catch (e) {
      if (e && e.code === 'not_granted') throw new Error('沒有允許使用 Claude，所以無法產生 AI 說明。');
      if (e && e.code === 'rate_limited') throw new Error('使用太頻繁，請稍等一下再試。');
      throw new Error((e && e.message) || 'AI 暫時無法回應，請稍後再試。');
    }
  }

  const P = () => root.DQ.aiPayload;

  async function summarize(rs, res, recon) {
    const data = P().summaryData(root.DQ, rs, res, recon);
    return ask(`以下是本次法規申報資料的檢核結果 (JSON)，包含個人壽險申報明細檢核、與上游系統控制總數對帳、上年度期末結轉、資產負債表勾稽：
${data}

請用白話寫一份重點整理，依序包含：
1. 整體狀況：一句話說明資料的狀況，以及如果直接送出，被退件的可能性 (高／中／低) 與原因。
2. 問題主要出在哪裡：歸成 3~5 類可能的共同原因 (例如：轉檔時少補了 0、民國年和西元年混用、各系統結帳日不同)，每類說明影響幾筆。分成「要改資料」和「只是結帳日或算法不同、寫說明就好」兩種。
3. 先改什麼：建議的修改順序和理由。
4. 以後怎麼避免：資料產生時可以加的檢查。
每段精簡，用條列，總長度 500 字內。`);
  }

  async function explain(rs, res, issue, recon) {
    const o = P().explainData(rs, res, issue, recon);
    return ask(`請解釋下列檢核錯誤，並提出具體修正方式。
檢核編號：${o.ruleId}（${o.ruleName}，依據：${o.ref}）
問題：${o.message}
欄位值：${o.value}
規則引擎建議：${o.suggestion}
同一檢核編號本次共 ${o.sameRule} 筆。
該筆${o.title}的相關欄位：${o.fields}

請用 3~5 點說明：這條規則在檢查什麼、這筆資料為何不通過、正確值應該怎麼判斷 (若可推得請直接給值)、是否可能是系統性問題。200 字內。`);
  }

  async function decode(text, decoded, res, recon) {
    const o = P().decodeData(text, decoded, res, recon);
    return ask(`主管機關/申報系統的退件訊息如下：
「${o.text}」

規則引擎已依目前資料重新檢核，並把訊息中的代碼、行號與關鍵字對應到具體問題：
${o.brief}

請用繁體中文回答 (300 字內，條列)：
1. 這則退件訊息最可能指的是哪些問題 (說明判斷依據；若是籠統代碼，指出最可能的 1~2 類並說明理由)。
2. 修正步驟與順序 (指出可一次修正多筆的系統性問題)。
3. 重新申報前還應檢查什麼，避免再次被退件。`);
  }

  root.DQ = root.DQ || {};
  // 規則轉換：較高的推理強度，輸出 JSON
  const RULE_SYSTEM = '你是保險業法規申報資料的檢核規則工程師，負責把規則文件精確轉成 JSON 規則。只輸出 JSON。';
  function convertRules(prompt) { return ask(P().ruleDoc(prompt), { system: RULE_SYSTEM, tier: 'complex' }); }

  // AI 產出一律加上標示，畫面與報告共用
  const LABEL = '以下由 AI（Claude）產生，僅供參考；哪些要改，以上方的檢查結果為準';
  root.DQ.ai = { summarize, explain, decode, convertRules, LABEL, OFFLINE, ready, available: () => !!platform };
})(typeof self !== 'undefined' ? self : this);
