/*
 * AI 分析：以 Claude 歸納檢核結果、說明個別問題。
 * 規則引擎負責「找出」問題 (可重現、可稽核)；AI 負責「解讀」：
 * 找出系統性根因、排定修正優先順序、用業務語言解釋。
 * 送出內容只有檢核摘要與問題清單 (不含證件號碼等個資)。
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

  async function ask(apiKey, prompt) {
    if (platform) {
      const out = await platform(`${SYSTEM}\n\n${prompt}`, { modelTier: 'default' });
      return out.text.trim();
    }
    if (!apiKey) throw new Error('需要 Anthropic API key');
    const c = await client(apiKey);
    const msg = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'medium' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    });
    if (msg.stop_reason === 'refusal') throw new Error('模型拒絕回應此請求，請調整內容後再試。');
    return msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  }

  function compact(rs, res) {
    const report = root.DQ.report;
    const tops = report.topRules(rs, res, 25).map(t => ({
      檢核編號: t.ruleId, 項目: t.name, 嚴重度: t.severity === 'error' ? '錯誤' : '警告', 次數: t.count,
      範例: t.sample.message, 建議: t.sample.suggestion,
    }));
    const samples = res.issues.slice(0, 80).map(i => ({
      檔: i.file === 'L' ? '承保' : '給付', 行: i.line, 保單: (i.policy || '').trim(), 編號: i.ruleId,
      欄位: report.fieldLabel(rs, i), 值: String(i.value).trim(), 問題: i.message,
    }));
    return { 規則集: rs.name, 摘要: res.summary, 最常見錯誤: tops, 問題樣本: samples };
  }

  function compactRecon(r) {
    if (!r) return null;
    const o = {};
    if (r.ctl) o.上游控制總數對帳 = { 摘要: r.ctl.summary, 差異: r.ctl.rows.filter(x => x.status && x.status !== '一致').map(x => ({ 系統: x.source, 項目: x.name, 期間: x.period, 差異筆數: x.diff && x.diff.cnt, 差異金額: x.diff && x.diff.amt / 100, 判定: x.status, 說明: x.explain })) };
    if (r.roll) o.期初期末結轉 = { 期初: r.roll.movement.open, 上年度期末: r.roll.movement.priorClose, 問題: r.roll.issues.map(i => ({ 編號: i.ruleId, 保單: i.policy, 問題: i.message })) };
    if (r.stmt) o.資產負債表勾稽 = { 平衡: r.stmt.summary.balanced, 問題: r.stmt.issues.map(i => ({ 編號: i.ruleId, 科目: i.code, 根因: i.chainRole || '', 問題: i.message, 說明: i.explain || '' })) };
    return o;
  }

  async function summarize(apiKey, rs, res, recon) {
    const data = JSON.stringify(Object.assign(compact(rs, res), { 對帳與勾稽: compactRecon(recon) }));
    return ask(apiKey, `以下是本次法規申報資料的檢核結果 (JSON)，包含個人壽險申報明細檢核、與上游系統控制總數對帳、上年度期末結轉、資產負債表勾稽：
${data}

請產出「檢核結果分析摘要」，依序包含：
1. 整體評估：資料品質一句話結論，以及若直接申報的退件風險 (高/中/低) 與理由。
2. 根本原因：把問題歸成 3~5 類可能的系統性原因 (例如：轉檔程式未補前置 0、日期民國/西元混用、異動鏈結邏輯錯誤、各系統結帳時點或幣別口徑不同、會計科目未隨 IFRS 更新)，每類列出對應的檢核編號與筆數。區分「需修正申報檔」與「屬時間差/定義差、只需在對帳底稿說明」兩種。
3. 修正優先順序：先修哪些、為什麼 (考慮會連帶引發其他錯誤的問題、跨檔問題)。
4. 預防建議：資料產出端可加的控管。
每段精簡，使用條列，總長度 500 字內。`);
  }

  async function explain(apiKey, rs, res, issue) {
    const lay = rs.layouts[issue.file];
    const rec = (res.data[issue.file] || []).find(r => r._line === issue.line);
    const fields = rec && rec._raw.length === lay.recordLength
      ? lay.fields.filter(f => f.key !== 'idNo').map(f => `${f.no}.${f.name}=${rec[f.key].trim()}`).join('；') : '(長度不符，無法拆欄)';
    const sameRule = res.issues.filter(i => i.ruleId === issue.ruleId).length;
    return ask(apiKey, `請解釋下列檢核錯誤，並提出具體修正方式。
檢核編號：${issue.ruleId}（${issue.ruleName || ''}，依據：${issue.ref || ''}）
問題：${issue.message}
欄位值：${String(issue.value).trim()}
規則引擎建議：${issue.suggestion}
同一檢核編號本次共 ${sameRule} 筆。
該筆${lay.title}資料各欄：${fields}

請用 3~5 點說明：這條規則在檢查什麼、這筆資料為何不通過、正確值應該怎麼判斷 (若可推得請直接給值)、是否可能是系統性問題。200 字內。`);
  }

  async function decode(apiKey, text, decoded) {
    const brief = decoded.findings.map(f => ({ 線索: f.clue, 類型: f.kind, 說明: f.explain,
      定位結果: f.groups.slice(0, 8).map(g => ({ 編號: g.ruleId, 項目: g.name, 筆數: g.items.length,
        範例: g.items.slice(0, 3).map(i => ({ 位置: `${i.file}${i.line ? ' 第' + i.line + '行/列' : ''}`, 保單或科目: (i.policy || i.code || '').trim(), 值: String(i.value).trim(), 問題: i.message, 建議: i.suggestion })) })) }));
    return ask(apiKey, `主管機關/申報系統的退件訊息如下：
「${text}」

規則引擎已依目前資料重新檢核，並把訊息中的代碼、行號與關鍵字對應到具體問題：
${JSON.stringify(brief)}

請用繁體中文回答 (300 字內，條列)：
1. 這則退件訊息最可能指的是哪些問題 (說明判斷依據；若是籠統代碼，指出最可能的 1~2 類並說明理由)。
2. 修正步驟與順序 (指出可一次修正多筆的系統性問題)。
3. 重新申報前還應檢查什麼，避免再次被退件。`);
  }

  root.DQ = root.DQ || {};
  root.DQ.ai = { summarize, explain, decode, MODEL, ready, usesPlatform: () => !!platform };
})(typeof self !== 'undefined' ? self : this);
