---
type: plan
status: completed
last_updated: 2026-09-12
progress: 100%
tags:
  - macro
  - regime-detection
  - scoring-matrix
  - strategy
  - risk-management
wiki_links:
  - "[[Strategy Engine]]"
  - "[[Regime Policy]]"
  - "[[Budget Priority Design]]"
---

# 總經與市場狀態進階辨識 (Macro Regime 2.0) 工程計畫

> **目標**: 突破單一固定權重盲點，實作「趨勢 × 波動四象限動態市場狀態機（Regime Engine 2.0）」，動態覆寫評分矩陣因子權重，並整合大盤籌碼過熱阻尼與實質持有成本（Carry Cost）濾網。
> **建立日期**: 2026-09-11  
> **預計時程**: 4 個階段 (分批 TDD 開發與驗證)

---

## 📌 1. 背景動機與核心痛點

### 1.1 現況痛點 (Factor Misalignment & Friction)

1. **左側與右側因子相互抵銷**：目前 `generateScoringMatrix` 同時納入「跌幅 (`priceDrop`)」與「多頭動能 (`ma60Slope`/`bullMomentum`)」。在強烈多頭趨勢盤中，無回檔導致跌幅 0 分；在暴跌盤整時動能又為負分，導致分數鈍化。
2. **缺乏全市場散戶槓桿熱度（Market Margin）**：現僅有 00675L 個股融資，無法觀測全市場散戶瘋狂程度。波段最末端往往是融資大增引發多殺多斷頭的前兆。
3. **無波段獲利空間的利息內耗 (Cost of Carry Drag)**：在低波動或陰跌盤整期，持有 00675L 會受到「每日平衡複利耗損」與「2.0%~2.5% 借貸利息」雙重夾擊。當市場預期波段收益小於持有成本時，應嚴格阻斷戰術性借貸加碼。
4. **狀態頻繁跳動 (Whip-saw / Churning)**：若無狀態切換遲滯區間（Hysteresis），易在多空分界線頻繁切換姿態，產生摩擦成本。

---

## 🏛️ 2. 四象限市場狀態矩陣架構 (Four-Quadrant Regime Engine)

```text
                                  【加權指數 MA60 / MA200 趨勢】
                                 多頭 (Bull)             空頭 (Bear)
                   ┌─────────────────────────────┬─────────────────────────────┐
        低波動     │ [狀態 1: 強趨勢多頭]        │ [狀態 4: 陰跌盤整期]        │
        (Low Vol)  │ • 動能/趨勢權重: 70%        │ • 戰術加碼完全關閉          │
                   │ • 逆勢抄底權重: 10%         │ • 啟動實質持有成本濾網      │
                   │ • 行動: 均線回測/突破加碼   │ • 行動: 僅執行 0050 DCA     │
【波動度 VIX / HV】├─────────────────────────────┼─────────────────────────────┤
        高波動     │ [狀態 2: 劇烈震盪多頭]      │ [狀態 3: 恐慌危機崩跌]      │
        (High Vol) │ • 左側超跌權重: 60%         │ • 觸發 P0 硬阻斷            │
                   │ • 籌碼過熱阻尼器啟動        │ • 啟動維持率階梯防禦        │
                   │ • 行動: 寬幅震盪大跌分批買  │ • 行動: 強制 Sell-only      │
                   └─────────────────────────────┴─────────────────────────────┘
```

---

## 🎯 3. 分階段執行路線圖 (Phased Roadmap)

### Phase 1: 細部量化定義與資料流盤點 (Analysis & Metrics)

- [ ] **1.1 指標量化門檻制定**：
  - 趨勢軸：大盤指數 vs MA60 斜率、MA200 牛熊分界線、近 20 日價格通道。
  - 波動軸：VIX (台指 VIX/美股 VIX) 門檻 (如 20 / 28 / 35)、大盤 20 日歷史波動率 (HV20)。
  - 遲滯防護：進入防守期確認天數 (2 天) vs 解除防守緩衝天數 (5 天)。
- [ ] **1.2 外部資料接口確認 (`twseProvider` & `macroProvider`)**：
  - 盤點全市場大盤融資融券增減比率接口 (`MI_MARGN` 大盤彙總)。
  - 實質借貸資金成本計算式整合（央行基準利率 + 質押/房貸利差 + 正2轉倉隱含成本）。

### Phase 2: 四象限狀態機核心實作 (TDD: `MacroRegimeClassifier`)

- [ ] **2.1 編寫測試套件 (`macroRegimeClassifier.test.mjs`)**：
  - 測試 4 種狀態的切換邏輯。
  - 測試 Hysteresis 遲滯濾網（避免邊界震盪）。
- [ ] **2.2 實作狀態機類別 (`src/modules/strategy/core/macroRegimeClassifier.mjs`)**：
  - 輸出 `regimeQuadrant: 'BULL_TREND' | 'BULL_VOLATILE' | 'BEAR_PANIC' | 'BEAR_CHOPPY'`。
  - 整合現行 `RegimePolicyRule` (保持向下相容性)。

### Phase 3: 動態權重覆寫與評分矩陣串接 (Dynamic Scoring Weights)

- [ ] **3.1 擴充策略設定檔 (`Strategy.default.json`)**：
  - 在 `scoringMatrix` 下新增 `regimeWeightsMapping` 配置。
- [ ] **3.2 重構 `signalGenerator.mjs` / `generateScoringMatrix`**：
  - 依據當前 `regimeQuadrant` 動態載入因子權重與 Cap。
  - 引入散戶籌碼過熱阻尼器（大盤融資過熱時將進攻係數削減 50%）。
  - 串接 `interestCostFilter`，在 `BEAR_CHOPPY` 狀態下直接將非底倉戰術加碼額度設為 0。

### Phase 4: 回測、端到端驗證與視覺化支援

- [ ] **4.1 歷史極端行情回測對比**：
  - 2024/08/05 暴跌回測（驗證高波多頭轉危機的防守反應）。
  - 2023 全年單邊大牛市（驗證強趨勢多頭是否順利吃到動能獲利）。
- [ ] **4.2 Mini App & Telegram 簡報資訊暴露**：
  - `/api/strategy-status` 回傳 `regimeQuadrant` 與當前生效的因子權重組。
  - 在 Mini App 策略專頁以徽章或四象限雷達圖呈現市場狀態。

---

## ⚠️ 4. 風險與技術約束

1. **資料源穩定性**：TWSE 大盤融資融券資料於每日 21:00 左右發布，排程若在 15:30 執行需具備 T-1 日資料 Forward-fill 與時效容錯。
2. **向下相容性**：現有 `RegimePolicyRule` (P0) 的 `CRISIS` / `CAUTIOUS` / `NORMAL` 不得中斷，新四象限狀態機將作為其底層細化提供者。
3. **過度擬合 (Overfitting) 防範**：狀態門檻與動態權重參數以「經濟學實質意義」為導向，禁止針對特定歷史單日做微調。
