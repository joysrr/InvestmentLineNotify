# **Pre-plan Features (待評估與實作功能池)**

## **執行順序總覽**

| 狀態 | 批次 | 項目與核心功能 | 依賴關係 | 說明 |
| :---- | :---- | :---- | :---- | :---- |
| ✅ 已完成 | 第零批 (P0) | ⓪ 外部資料接口擴展 (法人、融資、總經) | 無 | 基礎設施第一優先：確保策略資料維度完整 |
| ✅ 已完成 | 第一批 | ① retry/timeout、② lastBuyDate 快取 | 無 | 基礎設施先行 |
| ✅ 已完成 | 第二批 | ③ Gross Leverage → ④ 計畫A → ⑤ 計畫B → ⑥ 計畫C | 有序 | 核心風控鏈 |
| ✅ 已完成 | 第六批 (P1) | ⑪ Mini App 視覺化 (策略狀態、歷史趨勢、風險儀表) | 第二批完成 | 已先行實作：策略透明化與視覺化監控 |
| ✅ 已完成 | 第三批 | ⑬ 盤後保證金壓力測試與資金解耦 | 第零批、第二批完成 | 生存為先：核心風控防護網建置 |
| ✅ 已完成 | 第四批 | ⑭ 多空訊號衝突解決與評分矩陣重構 | 第零批、第三批完成 | 解決多空訊號衝突與邏輯死鎖 |
| ✅ 已完成 | 第五批 | ⑦ 廢除 BasePrice Phase 2 → ⑧ 資金管控 | ⑭ 完成，與計分矩陣整合 | 停利機制升級與資金調配 |
| \- | 第六批 (P2) | ⑨ 回測計畫 | 第五批完成 | 分析強化與系統狀態驗證工具 |
| \- | 第七批 | ⑩ 生命週期風險預算 → ⑮ 總經與市場狀態辨識 | 第六批完成 | 長期演化與宏觀動態調控 |

## **🚀【第一優先】📌【基礎設施】第零批：外部資料接口擴展與標準化**

### **目標摘要**

依據 `preplan_interface.md` 實作所有關鍵外部介面，為後續的保證金壓測、評分矩陣重構及總經濾網提供必要的資料基礎。

### **實作內容**

*   **個股法人籌碼**：實作 `twseProvider.mjs` -> `fetchStockInstitutionalData(symbol)`，鎖定 0050。
*   **個股信用交易**：實作 `twseProvider.mjs` -> `fetchStockMarginData(symbol)`，鎖定 00675L。
*   **總體經濟與資金成本**：新建 `macroProvider.mjs`，實作央行基準利率與 CPI YoY 抓取，並具備 Forward-fill 邏輯。
*   **系統整合**：更新 `dataSourceConfig.mjs`, `providerRegistry.mjs` 與 `marketData.mjs`。

### **討論狀態**

✅ 已完成 (2026-04-18)

## **📌【P1 高優先/風控強化】戰略資金解耦與盤後保證金壓力測試模組建置**

### **⚠️ 前置依賴說明**

* 需接續已完成的第二批核心風控鏈。  
* 作為後續所有策略重構（含評分矩陣）的底層安全網，必須最先實作（Phase 1 生存為先）。

### **狀態與目標摘要**

* 目前生命週期投資法（長線槓桿配置）與短線交易邏輯高度耦合，且缺乏針對台灣市場股票質押維持率的盤後動態試算機制。  
* **目標：** 建立「戰略資金層」作為總曝險天花板，並導入「T+1 盤後保證金壓力測試」，確保系統在極端市況下不會觸發質押違約或斷頭。

### **動機**

因系統採取質押 0050 借款買入 00675L 之操作，必須針對「質押維持率」（銀行或券商警戒線通常為 130% 或 166%）進行動態試算。若系統執行戰術加碼，一旦遭遇極端跌停（擔保品 0050 跌幅 10%、槓桿部位 00675L 將承受約 20% 跌幅），極易在隔日面臨保證金追繳。必須在盤後系統送出委託單之前，以數學方法驗證該筆交易不會讓帳戶暴露於斷頭風險中。

### **設計規格**

* **StrategicLayer 類別：** 負責依據生命週期設定，輸出當前帳戶的「絕對最高部位上限（如：本金的 150%）」。  
* **MarginSimulator 類別：** 插入於送出委託指令前。擷取當日盤後結算部位，模擬「若明日大盤下跌 10%，導致 0050 擔保品市值縮水 10%、00675L 市值縮水 20%」的情境，計算壓力測試後的質押維持率。若維持率低於安全水位（如 130% 或 166%），則該筆買進訊號將被系統強制捨棄或自動縮減部位。

### **建議方向（分階段）**

1. **Phase 1（資金天花板）**：於 PortfolioManager 中新增戰略槓桿上限的硬性參數，切斷交易策略隨意調用保證金的權限。  
2. **Phase 2（壓力測試實作）**：實作 MarginSimulator，寫入台灣股市質押維持率的計算公式（擔保品 0050 市值 / 借貸總額）。  
3. **Phase 3（風控攔截）**：結合例外處理機制（Exception Handling），當壓力測試未通過時，記錄日誌並阻斷 ExecutionManagement 發送 API 訂單。

### **影響範圍**

* src/modules/strategy/portfolioManager.mjs（新增資金天花板邏輯）  
* src/modules/strategy/riskManager.mjs（新增壓力測試模組）  
* src/modules/execution/executionManagement.mjs（新增下單前的風控攔截節點）

### **難度**

⭐⭐ 中

### **討論狀態**

⚪ 待確認

## **📌【策略重構】多空訊號衝突解決與評分矩陣（Scoring Matrix）重構**

### **⚠️ 前置依賴說明**

* 必須在【P1 高優先/風控強化】戰略資金解耦與盤後保證金壓力測試模組建置完成後才可進行。

### **狀態與目標摘要**

* **狀態：** 系統現行採用的左側交易與右側交易指標在盤後結算時容易產生訊號分歧（例如 RSI 超賣但外資大賣），導致布林邏輯（If/Else）陷入死鎖或多空互相抵銷。  
* **目標：** 廢除互斥的判斷式，導入「多因子權重投票（Multi-factor Voting）」機制，並實作「訊號與執行脫鉤」，所有訊號以大盤/0050為判斷基準，並將結果轉化為 00675L 的戰術撥款權重。

### **動機**

在實務量化交易中，指標之間的不一致代表市場進入震盪或結構轉換的資訊。此外，由於 00675L 具備每日重新平衡之耗損特性，直接使用其進行技術與估值指標運算易產生失真。因此，指標運算必須 100% 綁定大盤或 0050；而訊號的輸出結果則是獨立用於決定「借多少錢去買 00675L（戰術資金進出）」。

### **設計規格**

* **ScoringEngine 類別：** 取代傳統的條件判斷。每個指標賦予特定分數與權重（例如：大盤左側技術面 RSI < 30 給予 +2 分；0050 右側籌碼面外資連續三天買超給予 +3 分；融資餘額暴增給予 -2 分）。  
* **Threshold Execution：** 設定進場閾值（如總分 > +4 增加 00675L 戰術撥款權重，< -4 則啟動 00675L 戰術部位結清與還款）。

### **建議方向（分階段）**

1. **Phase 1（邏輯拔除）**：移除 SignalGenerator 中處理左右側訊號互斥的 if/elif/else 區塊。  
2. **Phase 2（指標標準化與脫鉤）**：建立指標標準化模組，將所有指標運算綁定至 0050/大盤，並將輸出轉換為 -1 到 1 之間的值。  
3. **Phase 3（加權總和）**：實作加權總和（Weighted Sum）演算法，並將總分傳遞給 PortfolioManager 以決定 00675L 的資金分配比例（分數越高，部位越大）。

### **影響範圍**

* src/modules/strategy/signalGenerator.mjs（全面重構為數值輸出，綁定 0050 資料源）  
* src/modules/strategy/strategyEngine.mjs（新增評分加權與閾值判斷邏輯）

### **難度**

⭐⭐⭐ 高

### **討論狀態**

✅ 已完成 (2026-04-18)

## **📌【P1 高優先】廢除 BasePrice，改採 ATR/MA20 動態移動停利**

### **⚠️ 前置依賴說明**

* MA20 與 ATR(14) 指標計算已由**計畫 B 節三-B**（indicators.mjs 擴充）統一實作，本計畫**不另行建立**。  
* 本計畫的 Phase 2 實作（切換至 ma20 模式）需在**計畫 B 節三-B 完成**後才可進行，以確保 calcMA20()、calcATR() 已存在於 indicators.mjs。  
* 前置依賴順序：**計畫 A → 計畫 B（含節三-B）→ 本計畫 Phase 2 → 績效分析與回測計畫 Phase 1 → 本計畫 Phase 3**

### **狀態與目標摘要**

* 停利條件建立在 priceUpPercent >= sell.minUpPercentToSell(80%)，錨點為外部 BasePrice.txt，尚未有明文的更新規則。  
* BasePrice 長期不更新將導致停利條件數年無法被觸發；過於頻繁更新則停利過度敏感。  
* BasePrice 是靜態人工設定，無法自動對應技術結構。

### **動機**

以 MA20 月線（約 20 個交易日均價）或前一波低點 + ATR 倍數作為動態停利錨點，能自動追蹤趨勢結構，比靜態 BasePrice 更符合「跟隨強勢、在弱勢時離場」的動態停利精神。

### **設計規格**

動態停利錨點 = MA20 × (1 - stopLossBuffer) OR 前波低點 + ATR × multiplier

* 新增 sell.anchorType = basePrice | ma20 | atr（Strategy.json 可設定）  
* 新增 sell.atrMultiplier（預設 2.0）  
* ma20 模式：連續 2 日收盤跌破 MA20 × 緩衝係數時觸發停利訊號  
* 過渡期保留 BasePrice 作為 fallback（anchorType = basePrice 時行為與現在相同）  
* **停利啟動條件：** 該批買入的部位，必須滿足 **「帳面未實現獲利 > X%（例如 10%）」** 或 **「股價在買入後，首次向上突破站穩 MA20」** 之後，移動停利（Trailing Stop）的監控機制才會正式被 Active（啟動）。  
  * 在此條件滿足前，系統處於「左側建倉熬過陣痛期」，不應被右側的短均線破位給洗出場。  
* 當一般移動停利（MA20/ATR）觸發時，系統應『完全清空』當前的戰術加碼部位（Tactical Allocation），將 00675L 的曝險降回常態底倉（Baseline DCA）水位

### **建議方向（分階段）**

1. ~~**Phase 1（過渡）**：在 sell 中新增 anchorType 欄位，預設 basePrice 維持現狀。~~  
2. **Phase 2（切換）**：切換至 ma20 模式，移除 BasePrice.txt 依賴，改從 TWSE API 即時計算。  
3. **Phase 3（驗證）**：回測不同 anchor 模式的停利時機與後續回撤，調整參數。

### **影響範圍**

* src/modules/providers/basePriceProvider.mjs（保留作 fallback）  
* src/modules/strategy/strategyEngine.mjs（停利 anchor 邏輯分支）  
* Strategy.json（新增 sell.anchorType、sell.atrMultiplier）  
* 日報顯示「當前停利錨點來源與數值」

### **難度**

⭐⭐⭐ 高（需回測與長期觀察）

### **討論狀態**

✅ 已完成 (2026-04-18)

## **📌【績效分析】績效分析與回測計畫**

### **狀態**

⚪ 待實作｜難度：⭐⭐⭐ 高

### **目標摘要**

建立完整的策略回測基礎架構，並依三個階段逐步加入訊號類型維度與總經情緒維度，實現從「知道訊號結果」到「理解訊號品質」的分析能力升級。 **整合說明：** 原「策略訊號回測與績效統計」、「訊號類型分類與月報統計」、「MacroSentiment 交互與回測驗證（回測維度部分）」三份計畫因共用 archiveManager 歷史快照讀取 API，合併為本計畫統一實作。archiveManager 擴充節次僅在 Phase 1 出現，Phase 2 與 Phase 3 直接沿用，不另行重複擴充。

### **Phase 1：backtest 基礎架構（前置依賴：無）**

#### **動機**

strategyEngine.mjs 目前依據 RSI、KD、MACD、VIX、MA240、macroMarketDirection 計算買賣訊號，但系統內無法驗證歷史上「訊號 = 買進」時，後續 N 天的實際報酬率為何，也無法得知哪個指標對最終決策貢獻最大。目前 archiveManager 已存 signals 快照，資料基礎存在，缺的是分析邏輯。

#### **建議方向**

新增獨立 runner src/runBacktest.mjs，讀取 data/archives/ 歷史快照 + Google Sheet 歷史價格，計算每次訊號後的 5/10/20 日報酬率，輸出 CSV 或 Telegram 月報附件。可與現有 runMonthlyReport.mjs 整合（月報時一併輸出回測摘要）。

#### **工作節次**

| 節 | 工作內容 | 涉及檔案 |
| :---- | :---- | :---- |
| 節一 | archiveManager.mjs 新增 getArchiveRecords(dateRange) / listArchiveDates() 歷史快照讀取 API（Phase 2 / 3 沿用此介面，不另行擴充） | archiveManager.mjs |
| 節二 | 新增 backtestEngine.mjs，實作訊號後 5/10/20 日報酬率計算邏輯 | backtestEngine.mjs（新增） |
| 節三 | 新增 runBacktest.mjs runner，串接 archiveManager 快照讀取與 backtestEngine 計算，輸出 CSV | runBacktest.mjs（新增） |
| 節四 | storage.mjs 新增 Google Sheet 歷史收盤價讀取方法 | storage.mjs |
| 節五 | runMonthlyReport.mjs 整合：月報時一併觸發回測摘要輸出 | runMonthlyReport.mjs |

### **Phase 2：signalCategory 維度分析（依賴 Phase 1 完成 + 資金管控強化計畫 Phase 1 完成）**

#### **動機**

現有週報、月報已統計買進訊號次數與報酬，但尚未標示訊號類型。使用者只能看到 aggregate 績效，無法得知哪一種訊號（恐慌、一般大跌、常態進場）效果最好，無法作為調整各檔位權重與門檻的依據。

#### **建議方向**

* 在每日 signals 快照中加入 signalCategory 欄位（baseline、deep_drop、panic、take_profit、rebalance 等）。  
* 在 periodReportAgent.mjs 統計邏輯中，針對每一類訊號計算觸發次數、平均報酬率與勝率。  
* 月報新增「各類訊號績效概覽」一節。

#### **工作節次**

| 節 | 工作內容 | 涉及檔案 |
| :---- | :---- | :---- |
| 節一 | strategyEngine.mjs 決策輸出新增 signalCategory 欄位 | strategyEngine.mjs |
| 節二 | backtestEngine.mjs 新增依 signalCategory 分組的報酬率統計方法（沿用 Phase 1 建立的介面） | backtestEngine.mjs |
| 節三 | periodReportAgent.mjs 月報新增「各類訊號績效概覽」統計區段 | periodReportAgent.mjs |
| 節四 | Telegram 月報模板新增分類績效表格 | telegramHtmlBuilder.mjs |

### **Phase 3：MacroSentiment 回測維度（依賴 Phase 1 完成；與 Phase 2 無依賴，可平行進行）**

#### **動機**

VIX 情緒短路機制已完成，但尚未驗證「有 sentimentScore + 冷卻延長」vs「僅 sentimentScore」vs「僅冷卻延長」三種模式在 BEARISH 區間內的實際績效差異，無法以資料驅動方式判斷是否需要調整冷卻延長邏輯。

#### **建議方向**

* 在 backtestEngine.mjs 內加入 macroSentiment 維度回測：  
  * 比較三種模式的平均進場次數、勝率與最大回撤。  
  * 觀察 BEARISH 區間內的績效表現。  
* 考慮增加上限條件研究：  
  * 例如在估值低於某 PB 或 PE 閾值時，關閉冷卻延長效果但保留分數扣分。  
  * 或在連續 N 天 BEARISH 卻持續大跌時，強制允許恐慌加碼通道。

#### **工作節次**

| 節 | 工作內容 | 涉及檔案 |
| :---- | :---- | :---- |
| 節一 | backtestEngine.mjs 新增 runSentimentModeComparison() 方法，比較三種模式績效 | backtestEngine.mjs |
| 節二 | runBacktest.mjs 新增 --mode sentiment 參數，觸發 macroSentiment 維度回測 | runBacktest.mjs |
| 節三 | 回測結果輸出至 CSV，格式與 Phase 1 一致 | runBacktest.mjs |

### **討論狀態**

⚪ 待確認

## **📌【策略演化】生命週期風險預算與槓桿曲線**

### **狀態與目標摘要**

* 目前策略 implicitly 假設使用者風險承受度固定，未顯式納入「年齡 / 投資年限 / 距離目標年」等生命週期參數。  
* allocation 槓桿檔位主要依 weightScore 決定，與投資年齡無關。

### **動機**

生命週期投資法通常會在投資早期容忍較高風險與槓桿，接近目標年份時逐步降低風險曝險。現有設計在工程上已具備彈性，但缺少這個 explicit 維度。

### **建議方向**

* 引入「生命週期投資法（Lifecycle Investing）」的數學模型參數，定義生命週期 Profile：  
  * **距退休 > 15 年（早期累積期）：** 解鎖最高 2.0x 槓桿權限（允許策略在低點全開）。  
  * **距退休 5 ~ 15 年（中期平衡期）：** 槓桿天花板隨時間線性遞減，上限壓縮至 1.2x ~ 1.5x。  
  * **距退休 < 5 年（後期保守期）：** 進入「只出不進 (Sell-only Mode)」。禁止任何「新增」的 00675L 買進與質押撥款，但既有帳上部位不強制認賠（避免熊市谷底硬著陸）。既有部位將套用更緊縮的「ATR / MA20 移動停利線」，在右側反彈波段逐步獲利了結，實現平滑去槓桿化 (Smooth Deleveraging)。 當投資人進入『後期保守期（Sell-only Mode）』時，系統將『強制 Bypass（略過）』移動停利的啟動門檻（Activation Cushion）。無論當下部位是否獲利，MA20/ATR 停利防線皆無條件立即生效。  
* 生命週期參數來源：  
  * 初期可先在.env 或 Google Sheet 設定「目標年份」「出生年份」等，後續再考慮在 Mini App 做 UI 調整。  
* 策略引擎整合：  
  * 在 fetchStrategyConfig() 或 evaluateInvestmentSignal() 中讀取當前 profile，動態選用上述對應的 leverage 上限與參數。

### **影響範圍**

* Strategy.json（新增 lifecycleProfiles 區段）  
* src/modules/strategy/riskManagement.mjs  
* webapp Mini App 未來可新增生命週期設定頁面

### **難度**

⭐⭐⭐ 高（牽涉策略設計與 UX）

### **與 Override Hierarchy 的整合規範**

📋 **生命週期 Phase 在 buildDecision() 中的定位為 Priority 1.5（介於維持率危機與 Gross Leverage 天花板之間）。** **作用範圍說明：**

* 生命週期後期保守期（lifecyclePhase === 'conservative'）是一個**全局旗標**，作用於以下兩個層層面：  
  1. **禁止新增**：禁止所有新增 00675L 買進與新增質押借款（等同永久套用 Gross Leverage 主動擴張上限邏輯，但不以 grossLeverage 數值為觸發條件）。  
  2. **Activation Cushion 強制 Bypass**：MA20/ATR 移動停利的「啟動門檻（Activation Cushion）」無條件略過，停利防線立即生效（詳見下方說明）。  
* **不干預現有部位的停利執行**：後期保守期不強制清算，現有部位依 MA20/ATR 停利線自然出場（平滑去槓桿化）。  
* **Priority 2 Gross Leverage 天花板仍正常運作**：後期保守期不取代 Gross Leverage 監控，兩者並行。

**與其他優先層的交互：**

| 情境 | 行為 |
| :---- | :---- |
| 後期保守期 + 維持率危機（Priority 1） | Priority 1 優先，強制降槓邏輯接管 |
| 後期保守期 + Gross Leverage 超限（Priority 2） | 兩者並行，均禁止新增，Gross Leverage 強制砍倉邏輯仍可觸發 |
| 後期保守期 + 極端恐慌破冰（Priority 3） | **後期保守期不被恐慌破冰 Bypass**：恐慌破冰僅 Bypass 計畫 B/C 估值防禦，不解除生命週期禁止新增槓桿的限制 |

### **Activation Cushion 覆蓋行為規範**

📋 **「廢除 BasePrice」計畫的停利啟動條件（Activation Cushion）在生命週期後期保守期下的覆蓋規則：** **一般情況（非後期保守期）：** 移動停利啟動條件（擇一滿足）： → 帳面未實現獲利 > sell.activationProfitPct（例如 10%） → 股價在買入後首次向上突破站穩 MA20 條件未滿足前：系統處於「左側建倉陣痛期」，MA20/ATR 停利不監控  
**後期保守期（lifecyclePhase === 'conservative'）：** 強制 Bypass Activation Cushion： → 無論當下部位是否獲利，MA20/ATR 停利防線無條件立即生效 → 不等待 10% 獲利門檻，不等待首次站穩 MA20 → Telegram 通知標示「🔒 生命週期保守期：停利啟動門檻已略過，MA20/ATR 防線即時生效」  
**設計哲學：** 後期保守期的目標是「平滑去槓桿化」而非「立即清倉」。 Bypass Activation Cushion 確保任何反彈波段都能被停利機制捕捉， 而非等待獲利門檻才開始守備，避免在熊市中永遠等不到啟動條件而錯失出場時機。

### **Strategy.json 新增欄位（補充）**

"lifecycle": { "enabled": true, "targetRetirementYear": 2053, "birthYear": 1993, "phases": }

### **討論狀態**

⚪ 待確認

## **📌【策略演化】總經與市場狀態辨識（Regime Detection）動態過濾器**

### **⚠️ 前置依賴說明**

* 需在【策略重構】多空訊號衝突解決與評分矩陣（Scoring Matrix）重構完成後，作為權重的動態調整擴充。

### **狀態與目標摘要**

* **狀態：** 目前系統將相同的交易邏輯套用於所有的市場狀態中，缺乏對總體經濟波動與大盤位階的感知能力。  
* **目標：** 建立市場狀態過濾器（Regime Filter），依據總體經濟環境與盤後大盤數據，動態調整「評分矩陣」中的各因子權重。

### **動機**

2026 年台灣面臨特殊環境：受惠 AI 帶動，全年 GDP 成長率預估高達 7.22%，屬強烈多頭趨勢；但同時中東戰事推升油價，通膨年增率逼近 2% 的警戒線。在多頭突破的高波動狀態下，應調高右側趨勢的權重；若通膨數據引發市場緊縮疑慮進入區間震盪，則應調高左側均值回歸的權重。 此外，因系統使用質押借貸，真實的「資金持有成本」（如台灣目前基準利率維持在 2.0% 加上質押利差）必須納入考量。當判定市場進入低波動盤整期，且 00675L 預期波段報酬率低於利息成本時，應主動結清戰術性 00675L 以避免無謂耗損。

### **設計規格**

* **MacroDataHandler 類別：** 盤後抓取大盤波動率（如 VIX 或歷史波動率）、大盤融資增減比率，以及定期匯入的總經數據（CPI、經濟成長率、央行利率）。  
* **RegimeClassifier 類別：** 將市場劃分為不同狀態（如：高波動作多、低波動震盪、系統性風險）。依據狀態動態覆寫 ScoringEngine 的權重配置，並將「借貸利息成本」設為基礎門檻值，當戰術期望值小於利息時發出戰術清倉還款訊號。

### **建議方向（分階段）**

1. **Phase 1（資料流擴充）**：擴充 DataFeedHandler，加入擷取大盤歷史波動率與全市場融資券餘額的功能。  
2. **Phase 2（狀態劃分）**：實作基礎的狀態劃分邏輯（如波動率大於過去 60 天平均值的 1.5 倍視為高波動環境）。  
3. **Phase 3（權重串接與利息濾網）**：將狀態辨識結果串接至評分矩陣。例如偵測到「籌碼過熱（融資暴增）」狀態時，自動將右側突破訊號的權重減半；若處於盤整且預期報酬無法覆蓋 2.0% 基準利率與利差，則觸發戰術降槓桿。

### **影響範圍**

* src/modules/data/dataFeedHandler.mjs（新增大盤與總經資料流）  
* src/modules/strategy/strategyEngine.mjs（新增狀態分類器與權重動態調整模組）

### **難度**

⭐⭐⭐ 高

### **討論狀態**

✅ 已完成 (2026-04-18)

## **✅【已完成】📌【前端體驗】Mini App 策略狀態與解釋視覺化**

### **狀態與目標摘要**

* 現有 Mini App 已提供市場雷達、資產淨值曲線、報告列表與新聞池。  
* 尚未有專門頁面集中展示「當前策略評分構成」、「所在分數檔位」與「冷卻期狀態」。

### **動機**

在手機上快速理解「今天為何建議加碼／觀望／停利」，對實際使用體驗非常重要，也方便 debug 策略行為。

### **建議方向**

* 新增「策略狀態」區塊（可放在 Dashboard 或 Account 頁）：  
  * 顯示 weightScore 以及構成（跌幅分數、RSI 分數、MACD 分數、KD 分數、情緒分數）。  
  * 顯示目前對應的 allocation 檔位與目標槓桿比例。  
  * 顯示冷卻期剩餘交易日與 lastBuyDate 摘要。  
* UI / UX：  
  * 可以用簡單的條形圖或小型雷達圖呈現各因子分數。  
  * 點擊後顯示詳細文案，對應 daily report 的文字說明。

### **影響範圍**

* webapp/src/views/DashboardView.vue 或 AccountView.vue  
* /api/status 或 /api/reports 若尚未回傳 weightDetails，需後端擴充。

### **難度**

⭐⭐ 中

### **討論狀態**

⚪ 待確認

## **📌【資金管控強化】Baseline/Tactical 雙層架構與撥款上限控制**

### **狀態**

⚪ 待實作｜難度：⭐⭐⭐ 高

### **目標摘要**

將日常 DCA 底倉與戰術性加碼拆分為兩條明確路徑，並在此基礎上實作單日／區間撥款上限與額度排擠防護，確保極端行情下的大幅加碼不會中斷長期紀律定時定額。 **整合說明：** 原「Baseline DCA 與戰術加碼雙層架構」與「單日/區間撥款上限控制」兩份計畫因強耦合關係合併為本計畫。signalType 欄位（Phase 1）是撥款上限 Budget Priority 邏輯（Phase 2）的前置依賴，兩者應合入同一 PR 分節執行，避免中間不完整狀態上線。

### **Phase 1：Baseline/Tactical 拆分（signalType 欄位建立）**

#### **動機**

目前「底倉 DCA」與「顯著修正或恐慌時的戰術加碼」共同由同一分數機制與 allocation 表驅動，使用者無法分辨當日建議是「持續佈局」還是「特殊戰術」，也無法分別調整兩者的風控參數。 此雙層架構也釐清了「清倉」的定義：針對戰術加碼（Tactical 00675L），若趨勢不如預期或利息耗損過大，系統會果斷清倉並還款；但對於生命週期所設定的底倉槓桿（Baseline 00675L），則堅守長期持有原則，僅受 MA20/ATR 停利與維持率斷頭防禦管轄。

#### **建議方向**

* 策略層拆分：  
  * 新增 baselineAllocation 與 tacticalAllocation 概念，baseline 只受輕度技術與估值因素影響；tactical 則要求更嚴格的大跌／恐慌條件。  
  * 在 evaluateInvestmentSignal 結果中明確標示 signalType = baseline | tactical_drop | tactical_panic。  
* 報告區分：  
  * 在 Telegram 報告文案中以標題或 emoji 區分兩者（例如「🌱 常態布局」vs「⚡ 戰術加碼」）。

#### **工作節次**

| 節 | 工作內容 | 涉及檔案 |
| :---- | :---- | :---- |
| 節一 | Strategy.json 新增 baseline / tactical 配置區段 | Strategy.json |
| 節二 | evaluateInvestmentSignal() 輸出新增 signalType 欄位（baseline | tactical_drop |
| 節三 | Telegram 通知模板依 signalType 區分顯示文案（🌱 / ⚡） | telegramHtmlBuilder.mjs |
| 節四 | 周/月報統計邏輯分開統計 baseline 與 tactical 的觸發次數 | periodReportAgent.mjs |

### **Phase 2：撥款上限與 Budget Priority（依賴 Phase 1 完成）**

#### **前置依賴**

⚠️ **Phase 2 必須在 Phase 1 完成後才可進行。** signalType 欄位（baseline | tactical_drop | tactical_panic）必須已存在於 strategyEngine.mjs 的決策輸出中，「額度排擠防護（Budget Priority）」中「先扣除 Baseline 預算、剩餘分配 Tactical」的邏輯才可正確實作。

#### **動機**

即使策略在邏輯上判斷「值得加碼」，仍有必要從資金管理角度限制一次性槓桿拉升的幅度。在極端行情下，多個訊號同時達標時仍有可能短期內大額放大槓桿；且大幅戰術加碼不應排擠 Baseline 的長期定額預算。

#### **建議方向**

* 新增風控參數（依整體帳戶淨值連動，規模化擴張）：  
  * trading.maxDailyLoanIncreasePct：單日最大新增借款佔**當前帳戶淨值**的百分比（例如 5% 或 10%）。  
  * trading.maxRollingLoanIncreasePct：近 10 日淨新增借款（Net Loan Increase），計算公式為近 10 日總借款 - 近 10 日總還款，結果以 Math.max(0, NetLoan) 底部截斷（Floor at Zero）。系統在區間內有執行「停利/再平衡還款」時，戰術彈藥庫額度自動釋放（重置），不會發生無謂的額度死鎖。  
* 額度排擠防護 (Budget Priority)：  
  * 系統先從每日上限中扣除 Baseline DCA 所需預算，剩餘額度才分配給 Tactical 模組執行。  
  * 若雙層需求加總超出上限，先滿足 Baseline，再由 Tactical 將剩餘額度打滿。  
* 月報簡單列出「本月加碼資金節奏」摘要，幫助調整參數。

#### **工作節次**

| 節 | 工作內容 | 涉及檔案 |
| :---- | :---- | :---- |
| 節一 | Strategy.json 新增 trading.maxDailyLoanIncreasePct 與 trading.maxRollingLoanIncreasePct 參數 | Strategy.json |
| 節二 | strategyEngine.mjs 新增 resolveBudgetLimit() 函式，計算當日可用撥款上限（含 Rolling 計算與底部截斷） | strategyEngine.mjs |
| 節三 | buildDecision() 整合 Budget Priority：先扣 Baseline 預算，剩餘分配 Tactical | strategyEngine.mjs |
| 節四 | storage.mjs 新增近 10 日借款/還款紀錄讀取方法，供 Rolling 計算使用 | storage.mjs |
| 節五 | 月報新增「本月加碼資金節奏」摘要區段 | periodReportAgent.mjs |

### **整合影響範圍**

* Strategy.json  
* src/modules/strategy/strategyEngine.mjs  
* src/modules/storage.mjs  
* src/modules/ai/periodReportAgent.mjs  
* Notifications 模板（telegramHtmlBuilder.mjs）

### **討論狀態**

⚪ 待確認

#### **引用的著作**

1\. Taiwan Interest Rate - Trading Economics, https://tradingeconomics.com/taiwan/interest-rate