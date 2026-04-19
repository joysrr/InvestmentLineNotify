# RULE_UPDATE_PROPOSAL (2026-04-19)

**發起人**: @Retro (Agile Retro Master)
**目標**: 針對 2026-04 全系統體檢 (SYSTEM_AUDIT_202604.md) 中發現的盲點，提出針對 `.agents/` 規則與技術棧手冊的具體防呆進化提案。

## 根因分析 (Root Cause Analysis)
本次系統體檢曝露了三大盲點：
1. **API 超時與網路錯誤癱瘓 (Fetch Timeout & Retry)**：開發者在實作 AI 連線時使用原生 `fetch` 卻忘記加上 Timeout，且 Retry 機制漏接底層 `ECONNRESET` 錯誤。**根本原因**是 `.agents/tech-stacks/nodejs-esm-backend.md` 僅要求「處理 Error」，卻沒有明確「禁用無 Timeout 的原生 Fetch」。
2. **Telegram API 安全性破口 (initData Replay Attack)**：Telegram 驗證邏輯漏掉了 `auth_date`。**根本原因**是 `@Architect` 與 `@Backend` 缺少對於 Telegram Mini App 資安層面的硬性規範查核表。
3. **並發寫入衝突 (TOCTOU Race Condition)**：File-based 鎖定使用 `existsSync` 導致競態條件。**根本原因**是 `.agents/tech-stacks/file-based-storage.md` 雖然提及了防寫衝突，但沒有給出具體的「禁止寫法」清單。

---

## 提案 1: 嚴格網路請求與超時防護 (針對 Backend Tech Stack)
**建議修改對象**：`.agents/tech-stacks/nodejs-esm-backend.md`
**修改動機**：斷絕原生 fetch 造成的永久 Pending 資源耗盡問題。

**建議新增的 Rule 原文**：
```markdown
## 網路連線與防錯誤 (Network & Error Handling)
1. **全面禁用無 Timeout 原生 Fetch**：
   - 專案內所有外部 API 呼叫，**絕對禁止**直接使用原生的 `await fetch(url)`。
   - 必須統一使用專案封裝的 `fetchWithTimeout`，或強制配置 `AbortController`，並綁定最高不超過 30 秒的逾期限制。
2. **重試機制 (Retry Mechanism)**：
   - 任何外部資料拉取的 Retry 邏輯，必須將 Node.js 底層網路異常 (如 `ETIMEDOUT`, `ECONNRESET`, `fetch failed`) 納入可重試白名單，不可因非 HTTP 特定的錯誤代碼就放棄重試。
3. **並發防護 (Concurrency)**：
   - 使用 `Promise.all` 時，必須評估是否允許單點失敗。如果允許部分成功，強制改用 `Promise.allSettled()` 以阻斷骨牌效應。
```

---

## 提案 2: File-based 原子鎖防呆 (針對 Storage Tech Stack)
**建議修改對象**：`.agents/tech-stacks/file-based-storage.md`
**修改動機**：讓開發者徹底明白什麼才是真正的 Atomic Operation，根治 TOCTOU (Time-of-Check to Time-of-Use) 漏洞。

**建議新增的 Rule 原文**：
```markdown
## 防寫衝突與原子性操作 (Atomic Write & Race Condition)
1. **禁用 existsSync 鎖**：
   - 實作 Mutex Lock (互斥鎖) 時，**絕對禁止**使用 `fs.existsSync` 檢查後再接著 `fs.writeFileSync` 的非同步分段寫法 (此為 TOCTOU 漏洞)。
   - **唯一正確作法**：使用 `fs.openSync(path, 'wx')` 依賴作業系統層級的 Write Exclusive 原語。若檔案存在會直接拋出 `EEXIST` 例外，藉此判定是否搶鎖成功。
```

---

## 提案 3: 強化 Telegram 授權驗證規範 (針對 Architect & Backend Rules)
**建議修改對象**：`.agents/tech-stacks/telegram-mini-app.md`
**修改動機**：防堵 HMAC-SHA256 簽章遭攔截後的重放攻擊 (Replay Attack)。

**建議新增的 Rule 原文**：
```markdown
## 資安與身分驗證 (Security & Auth)
1. **initData 雙重驗證鐵律**：
   - 當後端實作 `initData` 驗證時，除了驗證 HMAC-SHA256 (`hash`) 確保資料不可篡改外，**必須**同時解析並檢驗被加密的 `auth_date` (Unix Timestamp)。
   - 若 `auth_date` 超過伺服器當前時間 24 小時 (86400秒)，請立即拒絕授權 (丟出 HTTP 401 錯誤)，徹底防範舊 Token 遭竊取後的重放攻擊 (Replay Attack)。
```

---

**@TechLead 請注意**：
上述建議是以純文字提案呈現。若您 (User) 審查後同意這些進化方向，請手動更新 `.agents/` 底下的相關文件，讓知識庫持續進化，避免下一次開發新功能時重蹈覆轍！
