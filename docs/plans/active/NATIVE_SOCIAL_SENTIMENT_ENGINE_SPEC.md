---
type: plan
status: active
last_updated: 2026-09-12
progress: 66%
tags:
  - plan
  - sentiment-migration
  - nodejs-esm
  - ptt
  - bsky
  - bot
wiki_links:
  - "[[Regime Policy]]"
  - "[[Signal Generator]]"
  - "[[Macro Battle View]]"
---

# 社群情緒模組原生物生化計畫 (Native Social Sentiment Engine Spec)

## 一、 計畫背景與目標

將原本以 Python 實作於外部專案 `social-sentiment-optimizer` 的社群情緒爬取與指標計算邏輯，**100% 移植為 InvestmentLineNotify 原生 Node.js (`.mjs`) 模組**：

- **終結跨語言依賴**：完全移除對 `python3`、外部路徑、`child_process.execFile` 的依賴。
- **單一自給自足系統**：所有情緒抓取、3D/7D 均線運算、頂底背離判定均在專案內部原生完成。
- **毫秒級 Telegram Bot 回應**：`/sentiment` 手動觸發直接在 Node.js 事件循環內完成，快速且具備精準錯誤回報。

---

## 二、 環境變數需求清單 (部署環境待配置)

移植後，專案運行需要的環境變數如下（請在專案完成後加入 VM 的 `.env`）：

| 變數名稱            | 必要性                 | 說明                     | 範例 / 預設值                        |
| ------------------- | ---------------------- | ------------------------ | ------------------------------------ |
| `BSKY_HANDLE`       | 選用 (若無則跳過 Bsky) | Bluesky 帳號識別碼       | `huskylaun520.bsky.social`           |
| `BSKY_APP_PASSWORD` | 選用                   | Bluesky 應用程式專用密碼 | `xxxx-xxxx-xxxx-xxxx`                |
| `PTT_ENABLED`       | 選用                   | 是否啟用 PTT 爬蟲        | 預設 `true` (PTT 公開爬取，不需金鑰) |

> 註：PTT 股版爬取為公開 HTML 解析（帶 over18 cookie），完全**不需任何 API Key**；僅 Bluesky 社群需要 App Password。若未配置 Bluesky 金鑰，系統將以 PTT 單軌運行，不阻斷運作。

---

## 三、 三階段 TDD 開發規劃

### 🔹 Phase 1: 原生情緒指標與背離計算引擎 (`src/modules/sentiment/sentimentEngine.mjs`)

- [x] 定義計算契約與介面（接收歷史 records + 價格 records）。
- [x] TDD 實作 3D / 7D 移動平均 (MA) 計算。
- [x] TDD 實作頂背離（`BEARISH_DIVERGENCE`）與底背離（`BULLISH_DIVERGENCE`）演算法。
- [x] TDD 實作每日定格 JSON (`social_sentiment_daily.json`) 產生器。
- [x] 單元測試驗證計算準確性（對齊原 Python 運算規則，7/7 pass）。

### 🔹 Phase 2: 原生 PTT & Bluesky 爬蟲適配器 (`src/modules/sentiment/crawlers/`)

- [x] TDD 實作 `pttCrawler.mjs`：純 JS 解析 PTT 股版最新文章列表與多空標籤。
- [x] TDD 實作 `bskyCrawler.mjs`：呼叫 Bluesky ATProto REST API 抓取社群關鍵字貼文。
- [x] TDD 實作 `socialScoreCalculator.mjs`：多空關鍵字計分器。
- [x] TDD 實作彙整器 `socialCollector.mjs`：整合雙軌貼文、計分並寫入本專案的 `data/sentiment/news_history.jsonl`。
- [x] 單元測試與整合測試全數通過（6/6 pass，Phase 1+2 累計 13/13 pass）。

### 🔹 Phase 3: Bot 指令 `/sentiment` 重構與端到端驗證

- [ ] 重構 `src/runSocialSentimentFetch.mjs`，完全改調用原生 `socialCollector` + `sentimentEngine`。
- [ ] 移除 `child_process` 與外部路徑依賴。
- [ ] 驗證 Telegram Bot `/sentiment` 觸發後的定格產出與 Telegram 訊息反饋。
- [ ] 執行全套測試驗證（無 regression）。
- [ ] 更新 Wiki 索引並封存計畫文件至 `docs/plans/completed/`。
