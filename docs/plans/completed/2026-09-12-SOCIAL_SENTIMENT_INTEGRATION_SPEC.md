---
type: plan
status: completed
last_updated: 2026-09-12
progress: 100%
tags:
  - plan
  - social-sentiment
  - macro-battle
  - ptt
  - bluesky
  - divergence
  - miniapp
wiki_links:
  - "[[Macro Battle View]]"
  - "[[Market Snapshot]]"
  - "[[Regime Policy]]"
  - "[[Signal Generator]]"
last_verified: "2026-11-11"
related_code:
  - src/modules/sentiment/
related_docs:
  - docs/modules/strategy/sentiment.md
summary: "Social sentiment integration specification"
---

# 社群情緒與散戶背離整合計畫 (Social Sentiment & Macro Battle Integration Spec)

## 一、 計畫背景與目標

將獨立運作的社群情緒採集模組（`social-sentiment-optimizer`，包含 PTT 股版、Bluesky 雙軌抓取、3D/7D MA 均線、頂底背離判定）與主力資產管理系統 `InvestmentLineNotify` 進行深度整合。

- **後端策略層**：將社群情緒均線（3D/7D MA）與散戶背離訊號（`BEARISH_DIVERGENCE` / `HIGH_TO_COLD`）納入風控阻尼與情緒濾網。
- **Mini App 呈現層**：聚焦於「⚖️ 多空對決 (`MacroBattleView`)」頁面，呈現機構總經 vs. 散戶社群對壘、情緒均線指標卡與 2~3 筆焦點社群貼文；首頁 L3 抽屜則提供精簡背離警示與跳轉導流。

---

## 二、 總體架構與整合原則

1. **鬆耦合 Provider 架構**：
   - `social-sentiment-optimizer` 由排程定期輸出定格檔案 `data/sentiment/social_sentiment_daily.json`。
   - `InvestmentLineNotify` 透過擴充之 `SocialSentimentProvider` 讀取並注入報告快照，保證兩套系統進程獨立、容錯隔離。
2. **單一價格真實來源 (Single Source of Truth)**：
   - 移除社群模組中獨立價格抓取的維護負擔，統一由 `InvestmentLineNotify` 的歷史價格為基準比對背離。
3. **三層金字塔 UX 原則延續**：
   - 首頁維持高資訊密度與簡潔度，僅在 L3 抽屜顯示警示徽章。
   - 深度輿情與貼文脈絡完整收納於「多空對決 (`MacroBattleView`)」。

---

## 三、 四階段開發藍圖 (TDD 驅動)

### 🔹 Phase 1: 資料契約定義與 Provider 讀取適配 (Data Contract & Provider)

- [ ] 定義 `SocialSentimentContract` 結構（分數、3D/7D 均線、背離狀態、焦點話題貼文清單）。
- [ ] TDD 實作 `src/modules/data/socialSentimentProvider.mjs`。
- [ ] 支援容錯降級（當 JSON 缺失或格式不全時，回傳 safe-fallback，不阻斷主流程）。
- [ ] 單元測試驗證契約解析與容錯處理。

### 🔹 Phase 2: 策略引擎融合與風控阻尼增強 (Strategy & Signal Engine)

- [x] 更新 `signalGenerator.mjs`：將社群情緒分數正規化到 `factorPool.sentiment (-1~1)`，支援 `extraData.socialSentiment` 與向後相容 `extraData.sentimentScore`。
- [x] 更新 `macroRegimeClassifier.mjs`：散戶融資過熱阻尼器升級為「融資增幅 + 社群情緒頂背離」雙重確認，dampingMultiplier 由 0.5 進一步下調為 0.25，並納入 `reason`。
- [x] 單元測試驗證多空情境下的權重計算與阻尼調節（`socialSentimentIntegration.test.mjs` 6/6 pass）。

### 🔹 Phase 3: Mini App「多空對決」專區與首頁抽屜串接 (UI/UX Implementation)

- [x] TDD 建立 `webapp/src/components/macro/SocialSentimentCard.vue`：
  - 3D/7D 情緒儀表與多空 cross 標籤。
  - 頂/底背離高亮預警條。
  - 精選 2~3 則 PTT/Bluesky 焦點貼文列表（附原站連結）。
- [x] 整合至 `MacroBattleView.vue`（置於多空積分長條下方）。
- [x] 首頁 `MarketDetailDrawer.vue` 新增情緒快照指標行與點擊導流跳轉。
- [x] 前端 Vitest 單元測試與 RWD 手機版型測試。

### 🔹 Phase 4: 排程聯動、回測驗證與端到端驗證 (Pipeline & E2E Verification)

- [x] 排程時序檢驗：確保社群數據定格產出與主報表排程無 race condition（社群資料由現有 `han-investment-news-collector` cron 產出，不額外新增排程）。
- [x] 建立 `daily_snapshot.py` 產生 `social_sentiment_daily.json`，格式符合 `SocialSentimentProvider` 契約。
- [x] 更新 `han-investment-news-collector.sh` 整合 Step 2 產生每日情緒快照。
- [x] 歷史數據回測驗證（`news_history.jsonl` 8 天情況，score=57.0, ma3=57.3, ma7=58.1）。
- [x] 全套單元與整合測試驗證（Python 17/17 pass，Webapp 395/395 pass）。
- [ ] 歸檔計畫文件至 `docs/plans/completed/`。
