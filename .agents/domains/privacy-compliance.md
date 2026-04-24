# Domain: Privacy Compliance (隱私合規領域知識)

> 由 PROPOSAL_20260422_011 建立，供 `@Consultant` / `@Security` 動態注入。
> 對齊 GDPR Article 17（刪除權）+ 台灣個資法第 11 條。

---

## 一、PII 資料清單定義

本專案視為 PII 的資料類型（與 workspace `PROJECT_CONTEXT` 注入欄位對齊）：

| 類別 | 範例 | 儲存位置 | 保留期 |
|------|------|---------|-------|
| 身份類 | Telegram user_id / chat_id | `data/users.json` | 帳號刪除前永久 |
| 資產類 | 持股、成本、維持率 | `data/positions.json` | 帳號刪除 + 1 年 |
| 行為類 | 通知記錄、點擊記錄 | `data/notifications/` | 90 天滾動 |
| 敏感配置 | strategyWeight 個人偏好 | `data/strategy_user.json` | 帳號刪除前永久 |

## 二、資料保留期（Retention Policy）

- **熱資料**：最近 90 天（即時查詢）
- **溫資料**：90~365 天（歸檔，查詢延遲容忍）
- **冷資料**：> 365 天（壓縮歸檔，僅審計用）
- **TTL 清理**：由專屬排程 `runRetentionCleanup` 執行（屬「系統維運」功能域）

## 三、使用者個資刪除權（Right to Erasure）

依 GDPR Article 17 / 台灣個資法第 11 條，使用者有權要求刪除所有個資。

### 處理 SOP

1. User 下達「刪除我的所有資料」指令 → `@Lead` 辨識為**高風險豁免申請**
2. `@Lead` 升級 User 確認（對齊豁免授權邊界條件一：資料刪除）
3. User 明確確認後，`@Backend` 執行：
   - 刪除 `data/users.json` 對應 user_id 欄位
   - 刪除 `data/positions.json` 對應記錄
   - 歸檔通知記錄為匿名化（保留計數不保留內容）
   - 撤銷 `strategyWeight` 個人配置
4. 產出「資料刪除確認報告」寄送 User

### 禁止

- **絕對禁止** 以「難以追溯」為由拒絕刪除請求
- **絕對禁止** 僅標記「已刪除」而不實際清除

## 四、資料加密政策

- **靜態加密**：敏感欄位（未來若新增支付相關）必須 AES-256 加密
- **傳輸加密**：所有對外 HTTP 呼叫強制 HTTPS（Telegram Bot API 預設）
- **本機**：Oracle VM File-based 依賴作業系統權限（755）+ 禁止 root 擁有

## 五、審計日誌

PII 讀寫操作必須記錄：
- 時間戳
- 操作類型（read / write / delete）
- Agent 身份（@Backend / @Frontend）
- 使用者 ID（不記錄具體欄位值）

記錄位置：`data/audit_log.jsonl`（append-only）
保留期：12 個月

---

## 六、資料外洩通知流程（GDPR Article 33；依 PROPOSAL_20260422_017）

發現資料外洩後必須於 72 小時內完成以下步驟：

| 時間窗 | 執行者 | 動作 |
|-------|-------|------|
| 0~4 小時 | `@Lead` | 確認外洩範圍 + 影響使用者數量 |
| 4~24 小時 | `@Security` | 產出 `SECURITY_REPORT.md` 含外洩類型 / 影響 user_id（雜湊）/ 推測原因 |
| 24~48 小時 | `@Backend` | 通知受影響使用者（Telegram Bot 推送）|
| 48~72 小時 | User | 向主管機關備案（台灣個資法 §12 / GDPR Art. 33）|

### 觸發條件
- `data/audit_log.jsonl` 異常存取偵測
- 外部情資告警（如 API Key 洩漏）
- 使用者主動回報

**違規**：72 小時內未完成 → 視為合規違反，由 @Retro 審計標注。

## 七、資料處理協議（DPA）

| 第三方 | 處理資料 | DPA 狀態 | 處理依據 |
|-------|---------|--------|--------|
| Telegram Bot API | user_id / chat_id / 訊息 | Telegram ToS（視為 DPA）| 服務執行必要 |
| Google Sheets API | strategyWeight 同步 | Google Cloud DPA | User 同意 |
| Google Gemini API | 訊號分析 | Google AI DPA | User 同意 |
| Langfuse | AI 呼叫觀測 | Langfuse DPA（需確認）| 運維必要 |

**新增第三方** → `@Security` SC-09 + SC-11 雙審查；缺 DPA → 禁止啟用。

## 八、跨境資料轉移許可

| 使用者地區 | 合規路徑 |
|----------|--------|
| 台灣境內 | ✅ 預設合規（境內儲存）|
| 歐盟 | 需 SCC（Standard Contractual Clauses）|
| 中國 | 需符合《個人信息保護法》跨境要求 |

⚠️ **當前限制**：僅支援台灣境內用戶；跨境擴展需先完成 SCC 簽署。

## 九、加密現狀與升級路徑

### 當前狀態（2026-04-22）
- **靜態加密**：❌ 未啟用（依賴 OS 權限 755）
- **傳輸加密**：✅ HTTPS 強制
- **備份加密**：❌ 未啟用

### 升級路徑
1. **短期**：`data/users.json` + `data/strategy_user.json` 使用 AES-256-GCM 加密
2. **中期**：所有 `data/*.json` 全面加密
3. **長期**：導入 KMS 集中金鑰管理

**絕對禁止**：支付 / 信用卡相關資料未加密即儲存。
