/*
 * AI 分析：以 Claude 歸納檢核結果、說明個別問題。
 * 規則引擎負責「找出」問題 (可重現、可稽核)；AI 負責「解讀」：
 * 找出系統性根因、排定修正優先順序、用業務語言解釋。
 * 送出內容由 ai-payload.js 組成並遮罩姓名、證號、地址；單筆解釋不送整筆明細。
 */
(function (root) {
  'use strict';
  const MODEL = 'claude-opus-5-5';
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm';
  let sdk = null;

  async function client(apiKey) {
    if (!sdk) sdk = await import(SDK_URL);
    const Anthropic = sdk.default || sdk.Anthropic;
    return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  }

  const SYSTEM = `你是台灣壽險業「個人壽險年度填報」的資料品質顧問，熟悉保發中心(TII)填報手冊與檢核規則。
使用者會提供規則引擎的檢核結果。請用繁體中文、以壽險公司精算/資訊人員看得懂的方式回答。
只根據提供的資料推論，不要捏造不存在的錯誤；不確定時說明需要人工確認的地方。`;

  // 在 claude.ai 線上頁面中改用平台內建的 Claude (sample)，使用者不需 API key
  let platform = null;
  const ready = (async () => {
    try { if (root.claude && root.claude.use) platform = await root.claude.use('sample'); } catch (e) { platform = null; }
    return !!platform;
  })();

  async function ask(apiKey, prompt, opts) {
    opts = opts || {};
    const system = opts.system || SYSTEM;
    if (platform) {
      const out = await platform(`${system}\n\n${prompt}`, { modelTier: opts.tier || 'default' });
      return out.text.trim();
    }
    if (!apiKey) throw new Error('需要 Anthropic API key');
    const c = await client(apiKey);
    const params = {
      model: MODEL,
      max_tokens: opts.maxTokens || 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: opts.effort || 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: prompt }],
    };
    // 長輸出 (規則轉換) 用串流，避免逾時
    const msg = opts.stream ? await c.beta.messages.stream(params).finalMessage() : await c.beta.messages.create(params);
    if (msg.stop_reason === 'refusal') throw new Error('模型拒絕回應此請求，請調整內容後再試。');
    if (msg.stop_reason === 'max_tokens') throw new Error('回覆超過長度上限，請減少一次轉換的頁數');
    return msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  }

  const P = () => root.DQ.aiPayload;

  async function summarize(apiKey, rs, res, recon) {
    const data = P().summaryData(root.DQ, rs, res, recon);
    return ask(apiKey, `以下是本次法規申報資料的檢核結果 (JSON)，包含個人壽險申報明細檢核、與上游系統控制總數對帳、上年度期末結轉、資產負債表勾稽：
${data}

請產出「檢核結果分析摘要」，依序包含：
1. 整體評估：資料品質一句話結論，以及若直接申報的退件風險 (高/中/低) 與理由。
2. 根本原因：把問題歸成 3~5 類可能的系統性原因 (例如：轉檔程式未補前置 0、日期民國/西元混用、異動鏈結邏輯錯誤、各系統結帳時點或幣別口徑不同、會計科目未隨 IFRS 更新)，每類列出對應的檢核編號與筆數。區分「需修正申報檔」與「屬時間差/定義差、只需在對帳底稿說明」兩種。
3. 修正優先順序：先修哪些、為什麼 (考慮會連帶引發其他錯誤的問題、跨檔問題)。
4. 預防建議：資料產出端可加的控管。
每段精簡，使用條列，總長度 500 字內。`);
  }

  async function explain(apiKey, rs, res, issue, recon) {
    const o = P().explainData(rs, res, issue, recon);
    return ask(apiKey, `請解釋下列檢核錯誤，並提出具體修正方式。
檢核編號：${o.ruleId}（${o.ruleName}，依據：${o.ref}）
問題：${o.message}
欄位值：${o.value}
規則引擎建議：${o.suggestion}
同一檢核編號本次共 ${o.sameRule} 筆。
該筆${o.title}的相關欄位：${o.fields}

請用 3~5 點說明：這條規則在檢查什麼、這筆資料為何不通過、正確值應該怎麼判斷 (若可推得請直接給值)、是否可能是系統性問題。200 字內。`);
  }

  async function decode(apiKey, text, decoded, res, recon) {
    const o = P().decodeData(text, decoded, res, recon);
    return ask(apiKey, `主管機關/申報系統的退件訊息如下：
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
  function convertRules(apiKey, prompt) { return ask(apiKey, P().ruleDoc(prompt), { system: RULE_SYSTEM, tier: 'complex', effort: 'high', maxTokens: 32000, stream: true }); }

  // AI 產出一律加上標示，畫面與報告共用
  const LABEL = 'AI 產出（Claude）・僅供參考，判定以規則引擎結果為準';
  root.DQ.ai = { summarize, explain, decode, convertRules, MODEL, LABEL, NOTICE: '此功能會將內容傳送至 Claude API', ready, usesPlatform: () => !!platform };
})(typeof self !== 'undefined' ? self : this);
