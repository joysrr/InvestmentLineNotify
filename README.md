# 00675L 槓桿 ETF 投資決策系統 (InvestmentLineNotify)

## 1. 專案簡介
本專案為一套專為「生命週期投資法」打造的自動化 AI 投資決策管線，主核心環繞於原型 ETF (0050) 與槓桿 ETF (00675L) 的資金配置。系統能每日定時自動抓取市場報價、技術指標、籌碼與總體經濟數據，並交由多重 AI 代理進行深度分析，最終產出具備行動指引與紀律提醒的戰報推播。

## 2. 核心特色
- **無資料庫設計 (Serverless-like)**：完全捨棄關聯式資料庫，高度利用本地 `data/` 資料夾作檔案型快取與歷史留存，並將每日戰報狀態雙向同步至 Google Sheets，降低維護成本與限流風險。
- **多階段 AI 分析管線**：系統內建新聞過濾器、總經多空分析師與投資教練等多個 AI 角色。透過 `@google/genai` 強制結構化輸出與提供專屬的「思考推演空間」，大幅降低大語言模型產生幻覺的情形。
- **動態量化風控機制**：整合維持率斷頭算式、冷卻期限制、極端恐慌破冰與各項技術指標過熱閥值。訊號產生後不僅供人類參考，也自動傳入 AI 作為嚴格的決策上下文本。
- **模組化分塊推播**：串接通訊軟體 (Telegram/Line)，自動將龐大的戰報切割成包含內聯按鈕與「隱藏敏感帳戶數字 (Spoiler)」的精美 HTML 訊息板塊推送。

## 3. 目錄結構與記憶庫指南

### 📂 專案核心結構
- `src/`：所有的業務邏輯原始碼。
  - `modules/providers/`：第三方報價與外部 API 的抓取中樞。
  - `modules/strategy/`：量化指標 (RSI/MACD/KD) 計算與評分風控引擎。
  - `modules/ai/`：提示詞 (Prompt) 集中管理與 Gemini 決策管線。
  - `modules/notifications/`：推播內容的 HTML 排版建構與傳輸層。
  - `utils/`：基礎工具如時間轉換 (`TwDate`) 與逾時防護 (`fetchWithTimeout`)。
- `data/`：本地端的檔案庫，負責存放被快取的市場狀態、個股歷史與每日 AI 飛行決策日誌。
- `docs/`：系統架構文件的存放區。

### 🤖 給 AI 代理的提示 (Note for AI Agents)
如果你是正在維護此專案的 AI 代理，**請不要在此 README 中尋找程式碼細節**。
本專案具備完善的模組化與架構說明，當你需要理解系統設計或進行重構時，請優先查閱以下索引文件：
- **全域架構**：`docs/architecture.md` (包含系統資料流的 Mermaid 架構圖)。
- **底層設施與快取**：`docs/modules/core_infrastructure.md`
- **量化策略與風控計分**：`docs/modules/market_strategy.md`
- **AI 大腦與 Prompt 管線**：`docs/modules/ai_pipeline.md`
- **排程入口與通知管道**：`docs/modules/entry_and_notifications.md`

## 4. 快速啟動 (Quick Start)

### 環境需求
- Node.js (支援 ESM 模組的最新版本)
- 安裝套件：
  ```bash
  npm install
  ```

### 必備環境變數
請在根目錄建立 `.env` 檔案並設定好所有的 Google Gemini API Key、Google Sheets 認證資訊與 Telegram Bot Token 等（請詳見系統的 `prompts.mjs` 或 `dailyCheck.mjs` 中的相關引用）。

### 觸發排程與手動測試
你可以使用以下指令執行當日的投資檢查與推播：
```bash
node src/runDailyCheck.mjs
```

**自訂執行參數**：
排程腳本支援透過參數來開啟/關閉部分功能（適合在開發時節省 API 呼叫）：
```bash
# 關閉 Telegram 實際推播 / 關閉 AI 耗費 Token 的建議產生
node src/runDailyCheck.mjs --telegram=false --aiAdvisor=false
```
