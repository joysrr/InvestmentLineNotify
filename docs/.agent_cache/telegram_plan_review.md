# Agent Task Cache — Telegram Integration Plan Review

**Task Started**: 2026-04-06  
**Status**: IN PROGRESS  
**Current Step**: Step 2 — Format fix done, analysis in progress

---

## 任務清單

- [x] Step 1: 讀取 docs/plans/telegram_intergration_plan.md
- [x] Step 2: 讀取 docs/architecture.md 與 docs/modules/ 系統文件
- [x] Step 3: 識別格式問題
- [ ] Step 4: 修正格式並 push 文件
- [ ] Step 5: 補充計劃缺漏分析 push 至文件

---

## 識別的格式問題

原始文件的格式問題如下（對照原始碼）：

1. **項目二標題缺少 Markdown `##` 前綴**
   - 原文：`項目二：視覺化投資儀表板 (Telegram Mini App 整合)`（與 `### 8. 潛在挑戰與防禦機制` 後未換行分隔）
   - 修正：應為 `## 項目二：視覺化投資儀表板 (Telegram Mini App 整合)`

2. **項目二的子標題缺少 `###` 前綴**
   - `1. 目標`、`2. 效益分析報告`... 等都未有 `###` 前綴

3. **項目三標題缺少 Markdown `##` 前綴**
   - 原文：`項目三：進階 AI 教練與社群化 (語音/遊戲/變現)`
   - 修正：應為 `## 項目三：進階 AI 教練與社群化 (語音/遊戲/變現)`

4. **項目三子標題同樣缺少 `###` 前綴**

5. **附錄標題缺少 `##` 前綴**
   - 原文：`附錄：免費基礎設施與雲端服務推薦清單`
   - 修正：應為 `## 附錄：免費基礎設施與雲端服務推薦清單`

6. **附錄子項目（1.後端主機等）缺少 `###` 前綴**

7. **項目二/三/附錄的條列符號 `•` 應統一改為 `-`（Markdown 標準）**

8. **部分 code block 語言標識錯誤**：```` ``` text ```` 應改為 ```` ```text ````（去除空格）

---

## 系統現狀分析（供計劃補充用）

### 現有架構關鍵點
- Entry: GitHub Actions / Cron CLI（無長駐進程）
- Notification: `telegramClient.mjs` + `telegramHtmlBuilder.mjs`（單向推播）
- AI: `aiCoach.mjs`, `llmJudge.mjs`, `periodReportAgent.mjs`
- Storage: file-based (`data/` JSON) + Google Sheets
- 已有兩個 Telegram Bot Token: `TELEGRAM_LOG_API_TOKEN`（log 頻道）, 主頻道 token
- 已有 Runner 分流架構，各 runner 可獨立封裝為 Bot command

### 計劃補充缺漏（初步識別）
1. 現有雙 token 機制（log channel vs main channel）在 Bot 架構下的路由策略未提及
2. GitHub Actions 與 Bot daemon 的共存策略（原排程是否保留？）
3. 白名單機制已提及，但未說明與現有 `TELEGRAM_LOG_API_TOKEN` 的整合
4. 項目一資料流未提及 `runWeeklyReport` / `runMonthlyReport` 是否也要透過 Bot 指令觸發
5. 項目二 Mini App API 需要考量 `data/` file-based 架構的讀取安全性（並發問題）
6. 項目三提到資料庫遷移，但未說明 Google Sheets 的同步策略（Google Sheets 目前是持倉成本來源）

---

## 下一步
- push 修正後的 telegram_intergration_plan.md
- 在文件尾部追加「計劃補充說明」章節
