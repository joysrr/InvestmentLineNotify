# 0050 雙向智慧模擬器開發計畫

**狀態：** Active  
**文件類型：** Product / Technical Specification  
**適用專案：** InvestmentLineNotify  
**目標功能：** Mini App 新增 0050 雙向模擬功能  
**版本：** v1.0  
**建立日期：** 2026-08-02

---

## 1. 文件目的

本文件整合目前已確認的 0050 模擬功能、反向推導功能、使用者體驗規格，以及 TDD 開發規劃，作為後續開發、審查與驗收的共同依據。

本文件重點放在：

- 功能邏輯與邊界。
- 指標計算與反推規格。
- 資料一致性與快取隔離。
- 使用者輸入與回饋方式。
- TDD 開發順序與驗收條件。

程式碼範例不列為本文件的固定契約。實際程式碼可依 API、框架、模組版本與現有專案結構演進，但不得違反本文件定義的行為規格。

---

## 2. 背景與目標

目前策略引擎會根據 0050 的市場資料、技術指標、持倉與風險狀態，產生策略分數與行動建議。本功能要將同一套策略計算能力提供給使用者進行「假設情境」分析。

使用者不只是想知道目前策略結果，也希望回答下列問題：

- 如果未來股價是某個數字，策略分數會是多少？
- 如果想讓維持率達到安全門檻，需要什麼股價？
- 如果想讓 RSI 進入超賣或過熱區，價格需要如何變化？
- 若想讓策略總分達到某個目標，股價或市場條件需要如何改變？
- 目前目標是否能在合理價格範圍內達到？

---

## 3. 功能範圍

### 3.1 正向模擬：Price → Score

使用者輸入預估的 0050 價格，系統以目前可取得的市場快取與投資組合資料為基礎，建立隔離的模擬資料，將最新一根 K 棒的股價相關欄位替換後重新執行指標與策略計算。

正向模擬的正式語意為：

> 如果最新一根 K 棒以輸入價格收盤，在其他資料維持不變的前提下，策略引擎會產生什麼結果。

正向模擬應回傳：

- 模擬價格。
- 目前實際價格。
- 價格差額與百分比。
- RSI、KD、MACD、MA、ATR 等可用指標。
- 維持率與槓桿相關結果。
- Portfolio Health。
- Lifecycle Stage。
- 策略總分。
- 策略狀態、目標與建議。
- 資料品質與 fallback 說明。

### 3.2 反向推導：Score / Condition → Price / Conditions

使用者輸入想達到的指標、分數或事件，系統反向計算達成目標所需的股價，或列出仍需發生的條件。

反向推導不承諾預測未來價格，也不代表目標一定會達成。它是「在目前資料與固定假設下的條件分析」。

支援目標類型：

- RSI 目標值。
- 維持率目標值。
- MA20 目標值。
- MA240 偏離目標值。
- 策略總分目標。
- KD 黃金交叉或死叉。
- MACD 黃金交叉或死叉。
- 策略進入特定決策狀態。
- Portfolio Health 回到指定安全區間。

---

## 4. 非功能範圍

以下內容不屬於第一階段功能：

- 多日完整價格路徑預測。
- 自動預測明日實際價格。
- 機器學習或機率型價格預測。
- 自動下單或自動調整持倉。
- 將模擬結果寫回正式投資資料。
- 以模擬結果觸發正式 LINE 通知。
- 透過股價改變 Lifecycle Stage。

若未來要支援多日路徑，應另立版本規格，明確定義成交量、最高價、最低價、交易日與市場事件假設。

---

## 5. 計算模型規格

### 5.1 資料替換原則

模擬計算必須使用原始快取的隔離副本，不得直接修改正式快取。

```text
正式快取
  → 建立深層或結構化副本
  → 替換模擬價格
  → 重新計算指標與策略
  → 回傳結果
  → 丟棄模擬副本
```

至少需要處理：

- `currentPrice`。
- `price0050`。
- `closeArr` 最新值。
- 依模型需要處理 `highArr` 與 `lowArr`。
- 由價格直接衍生的持倉估值與維持率。

不得修改：

- 正式快取中的歷史價格。
- 正式快取中的 `lastSignals`。
- 正式持倉資料。
- 正式策略設定。
- 正式排程狀態。

### 5.2 指標資料要求

現有指標邏輯包含 RSI、MACD、KD、MA20、MA60、MA240、ATR 與斜率等計算。RSI 使用 14 期，MACD 使用 12/26/9，KD 使用 9/3/3；歷史資料不足時，結果必須標記不可用或 fallback，不可假裝為完整計算結果。[cite:26]

資料不足處理規則：

| 指標  | 資料不足時的處理                                |
| ----- | ----------------------------------------------- |
| RSI   | 顯示資料不足或不可用                            |
| KD    | 顯示無法判斷交叉                                |
| MACD  | 顯示歷史資料不足                                |
| MA20  | 不足 20 筆時不可用                              |
| MA60  | 不足 60 筆時不可用                              |
| MA240 | 可依現有邏輯 fallback，但必須顯示 fallback 標籤 |
| ATR   | 不足資料時顯示不可用                            |

### 5.3 Lifecycle Stage

Lifecycle Stage 由年齡、退休年齡或既有生命週期設定決定，與模擬股價無關。

因此：

- 正向模擬不改變 Lifecycle Stage。
- 反向推導不得提供透過股價改變 Lifecycle Stage 的選項。
- UI 必須標示「唯讀」或「不受股價影響」。
- 若價格變化觸發生命週期相關槓桿限制，應顯示該限制如何影響最後策略決策。

---

## 6. 反向推導規格

### 6.1 解析解

下列目標可使用解析或近似解析方式：

| 目標       | 規格                                          |
| ---------- | --------------------------------------------- |
| 維持率     | 依持股數、融資、現金與其他資產線性反推價格    |
| MA20       | 依前 19 筆收盤價與目標平均值反推最新收盤價    |
| MA60       | 依前 59 筆收盤價與目標平均值反推最新收盤價    |
| MA240 偏離 | 先以長期均線估算，再以完整模擬驗證            |
| RSI        | 依 RSI 既有平滑狀態反推，再以實際指標函式驗證 |

所有解析結果都必須再執行一次正向模擬確認，若驗證結果與目標差距超過允許誤差，必須標記為近似或不可達。

### 6.2 掃描與近似解

下列目標通常具有路徑依賴或非線性規則，採價格區間掃描：

- KD 交叉。
- MACD 交叉。
- 策略總分。
- 複合策略狀態。
- Portfolio Health 複合條件。

預設掃描範圍為目前價格的 ±15%，但必須受到產品合理價格上下限保護。掃描結果應回傳：

- 最低達標價格。
- 最高達標價格（若適用）。
- 最接近目標的價格。
- 對應實際分數或指標值。
- 掃描步距。
- 是否為近似結果。
- 在範圍內無法達標時的最近結果。

### 6.3 目標不可達

當目標超出合理範圍或目前資料無法推導時，不得回傳看似精確的虛構價格。應回傳：

- `reachable: false`。
- 不可達原因。
- 最近可達結果（若能計算）。
- 建議使用者調整的目標範圍。

---

## 7. 使用者輸入與邊界規格

### 7.1 正向價格輸入

- 必須是可解析的正數。
- MVP 建議合理輸入範圍為 50～500 元。
- 低於 50 或高於 500 元時拒絕計算，範圍應允許由設定調整。
- 與目前價格偏離超過 10% 時顯示警告。
- 偏離超過 20% 時顯示「可能代表多日後情境」，但不必直接拒絕。
- 0、負數、空值、NaN、無法解析文字皆拒絕。

### 7.2 反向目標輸入

- RSI 目標限制為 1～99。
- 策略總分必須在策略引擎可表示的實際範圍內。
- 維持率目標必須為正數。
- 事件型目標不要求數值。
- 不支援的目標類型必須在 API 層拒絕。
- 所有錯誤都要回傳可供 UI 直接呈現的訊息。

### 7.3 輸入影響說明

UI 不應只顯示「輸入錯誤」，還應說明輸入會如何影響結果：

- 股價上升通常提高持股估值與維持率，但可能使 RSI、MA 偏離與過熱風險增加。
- 股價下跌通常降低持股估值與維持率，但可能使 RSI 進入超賣區。
- 維持率會受到持股數、融資金額、現金與其他資產影響，不可只看股價。
- RSI、KD、MACD 不只由單一價格決定，也受到歷史價格路徑影響。
- Lifecycle Stage 不會因股價輸入改變。

---

## 8. UX 與回饋規格

### 8.1 模式切換

Mini App 應清楚區分兩種模式：

- **Mode A：股價 → 分數**。
- **Mode B：目標 → 股價／條件**。

兩種模式不可混用同一個輸入欄位，避免使用者誤解輸入意義。

### 8.2 結果呈現

正向模擬至少呈現：

- 模擬價格與目前價格。
- 價格變化百分比。
- 策略狀態與總分。
- 主要指標的今日值、模擬值與變化。
- Portfolio Health。
- Lifecycle Stage 與唯讀標籤。
- 資料完整性與 fallback 說明。

反向推導至少呈現：

- 目標。
- 推導價格或條件。
- 相較目前的變化。
- 計算方式：解析解或掃描近似。
- 是否可達。
- 仍需固定不變的假設。
- 免責與不確定性。

### 8.3 顏色與文字

顏色不能是唯一訊息來源，必須同時提供文字或圖示：

- 綠色：安全、改善或達標。
- 黃色：警戒、偏離過大、fallback 或資料品質有限。
- 紅色：危險、不可達或可能觸發減碼。
- 灰色：中性、唯讀或不適用。

每個主要指標都要有白話解讀，例如：

```text
RSI 29.8：進入超賣區，但不代表必然反彈。
維持率 126.4%：低於安全門檻，需留意價格下跌風險。
策略分數 58：接近買入門檻，但尚未符合完整條件。
```

### 8.4 載入與錯誤狀態

UI 必須區分：

- 計算中。
- 計算成功。
- 輸入錯誤。
- 快取未就緒。
- 歷史資料不足。
- 目標不可達。
- 結果為近似值。
- 伺服器計算失敗。

---

## 9. API 行為契約

建議提供兩個 API：

```text
POST /api/simulate
POST /api/simulate/reverse
```

API 契約重點：

- 輸入驗證必須在計算前完成。
- 不得觸發不必要的即時市場資料請求。
- 以今日快取為基礎。
- 快取未就緒回傳明確的暫時性錯誤。
- 正向與反向結果都應附帶資料時間戳。
- 結果應附帶計算模式與近似標籤。
- 不得將模擬資料寫回正式快取。
- 不得觸發正式通知或交易動作。

建議的狀態語意：

| 狀態 | 意義                               |
| ---- | ---------------------------------- |
| 200  | 計算完成，可能包含可達或不可達結果 |
| 400  | 輸入格式或範圍錯誤                 |
| 409  | 目前資料狀態不允許計算             |
| 503  | 快取或必要資料尚未就緒             |
| 500  | 非預期計算錯誤                     |

---

## 10. TDD 開發模式

開發必須遵循：

```text
RED → GREEN → REFACTOR
```

### 10.1 測試層次

| 測試層次      | 測試內容                                      |
| ------------- | --------------------------------------------- |
| Unit          | 輸入驗證、維持率、MA、RSI、掃描器與結果格式化 |
| Integration   | 正向模擬 API、反向推導 API、快取錯誤處理      |
| Regression    | 原有策略結果不受模擬功能污染                  |
| Performance   | 掃描法於合理時間內完成                        |
| Manual / LIFF | 手機版操作、版面、文字與顏色回饋              |

### 10.2 TDD 執行順序

1. 建立固定市場資料 fixture 與持倉 fixture。
2. 先測試輸入驗證。
3. 測試維持率解析解。
4. 測試 MA20、MA60 與 MA240 偏離。
5. 測試 RSI 反推及帶回驗證。
6. 測試 KD 與 MACD 掃描。
7. 測試策略總分掃描。
8. 測試正向 API。
9. 測試反向 API。
10. 測試快取隔離、錯誤狀態與效能。
11. 進行 Mini App 實機驗收。

### 10.3 必要測試原則

- 反推價格必須帶回正向計算驗證。
- 模擬不得修改原始快取。
- 歷史資料不足不得產生假指標。
- 解析解與掃描解必須標記計算方法。
- 相同輸入與相同快取應產生一致結果。
- 正式策略排程不得因模擬請求而改變狀態。

---

## 11. 開發階段 (更新實際進度)

| 階段    | 內容               | 狀態      | 實際完成度 | 備註                                   |
| ------- | ------------------ | --------- | ---------- | -------------------------------------- |
| Phase A | 基礎模型與正向模擬 | ✅ 完成   | 100%       | API、快取隔離、驗證、Mini App 皆就緒   |
| Phase B | 解析型反向推導     | 🟡 開發中 | 30%        | analyticalSolvers/rsiSolver 存在未接線 |
| Phase C | 近似型反向推導     | 🟡 開發中 | 20%        | scanner/reverseEngine 存在未實作       |
| Phase D | Mini App UX        | ✅ 完成   | 90%        | Mode A/B、結果卡、比較表、警告與說明   |
| Phase E | TDD 與整合驗收     | 🟡 部分   | 50%        | 正向測試通過、反向測試缺失             |
| Phase F | 文件與部署         | ⬜ 待開始 | 0%         | 待 Phase B/C 完成後                    |

預估總工時約 38 小時，實際時間依現有 API 路由、快取模組與 Mini App 結構調整。

---

## 12. 驗收標準

### 正向模擬

- [ ] 可輸入預估價格並完成模擬。
- [ ] 目前價格、模擬價格與變化百分比正確。
- [ ] 主要技術指標依模擬資料重新計算。
- [ ] 維持率會依模擬價格更新。
- [ ] Lifecycle Stage 不因價格改變。
- [ ] 正式快取不被污染。
- [ ] 輸入錯誤與快取未就緒有明確回饋。

### 反向推導

- [ ] RSI、維持率與 MA 可回傳反推結果或不可達原因。
- [ ] KD/MACD 交叉可在設定範圍掃描。
- [ ] 策略總分可回傳最接近目標的結果。
- [ ] 反推結果帶回正向模擬後符合允許誤差。
- [ ] 解析解、近似解與資料 fallback 有明確標籤。
- [ ] 目標不可達時不回傳虛假精確價格。

### UX

- [ ] Mode A 與 Mode B 清楚區隔。
- [ ] 結果同時包含數字、狀態與白話解讀。
- [ ] 顏色有文字或圖示輔助。
- [ ] 手機版可操作。
- [ ] 載入、成功、警告、錯誤與不可達狀態完整。
- [ ] 免責聲明清楚指出模擬不是預測或投資建議。

---

## 13. 風險與決策紀錄

### 風險：單一價格不足以描述未來

RSI、KD、MACD 等指標會受歷史價格路徑影響。系統必須把結果定義為單一最新收盤情境，而不是完整未來預測。

### 風險：反向結果可能被誤認為保證

所有反推結果必須標示「條件分析」、「估算」或「近似」，並說明其他市場資料假設不變。

### 風險：掃描範圍造成假性不可達

如果目標在 ±15% 內不可達，不代表理論上永遠不可達。UI 應說明這是「目前掃描範圍內不可達」。

### 風險：fallback 被誤解

MA240 使用替代值時，必須在結果中顯示資料品質標籤，不能以一般 MA240 顯示。

### 決策：先做規格，再固定程式碼

由於模組與版本可能演進，本文件固定的是輸入、輸出、計算語意、資料隔離與驗收條件，不固定具體程式碼實作。

---

## 14. 後續版本方向

- 多日價格路徑模擬。
- 多情境比較，例如 -10%、-5%、目前、+5%、+10%。
- 儲存使用者模擬歷史。
- 反推多條件最佳化，例如同時滿足維持率與策略分數。
- 顯示不同條件組合的 Pareto 結果。
- 以真實歷史資料進行回測驗證。
- 讓使用者調整掃描範圍與步距。

---

## 15. 文件維護規則

- 每次策略計算邏輯有語意變更時更新本文件。
- 純程式碼重構不必更新本文件。
- API 輸入輸出語意變更時必須更新版本與驗收標準。
- 新增反向目標時，必須同時補上可達性、精確度、UI 回饋與測試規格。
- 完成功能後將狀態由 `Active` 更新為適當狀態，並在變更紀錄留下日期與摘要。

---

## 16. 關鍵實作細節補充 (新增章節)

### 16.1 完整資料流程圖

```
使用者輸入 (股價/目標)
        ↓
    API 輸入驗證
        ↓
取得最新戰報 (archiveManager.getLatestReport)
        ↓
取得策略設定 (fetchStrategyConfig - 含快取)
        ↓
建構模擬輸入資料 (dataAdapter.buildSimulationInput)
        ↓
    ┌─────┴─────┐
    │           │
正向模擬      反向推導
 (Forward)    (Reverse)
    │           │
    └─────┬─────┘
          ↓
    格式化回應 (含資料品質標籤、計算模式、時間戳)
          ↓
      回傳 JSON
```

### 16.2 模擬輸入資料結構 (SimulationInput)

模擬引擎接收的完整資料物件，需與 `evaluateInvestmentSignal` 相容：

```typescript
interface SimulationInput {
  // === 價格欄位 (會被模擬價格取代) ===
  currentPrice: number; // 00675L/Z2 現價
  price0050: number; // 0050 現價 (主要模擬目標)
  basePrice: number; // 00675L 基準價

  // === 價格序列 (需重新計算指標用) ===
  closeArr: number[]; // 00675L 收盤價序列 (舊→新)
  highArr: number[]; // 00675L 最高價序列
  lowArr: number[]; // 00675L 最低價序列
  closeArr0050?: number[]; // 0050 收盤價序列 (若需獨立計算 0050 指標)

  // === 預計算指標陣列 (將重新計算或增量更新) ===
  ma20Arr: number[];
  ma60Arr: number[];
  ma240Arr: number[];
  ma60SlopeArr: number[];
  macdArr: { MACD: number; signal: number; histogram: number }[];
  kdArr: { k: number; d: number }[];
  rsiArr: number[];
  atrArr: number[];
  vixArr: number[];

  // === 投資組合 (不變) ===
  portfolio: {
    qty0050: number; // 0050 持股數
    qtyZ2: number; // 00675L 持股數
    cash: number; // 現金
    totalLoan: number; // 融資總額
    lastBuyDate: string; // 最後買入日期 (YYYY-MM-DD)
  };

  // === 市場環境 (不變) ===
  VIX: number;
  macroMarketDirection: "BULL" | "BEAR" | "NEUTRAL";
  indicators0050: object; // 0050 技術指標快照

  // === 原始資料 (不變) ===
  rawValuation: object; // 估值資料 (PB, PE 等)
  rawUsMarket: object; // 美股資料 (含 VIX)
  rawCnn: object; // CNN Fear & Greed
  rawMargin: object; // 融資融券資料
  rawFx: object; // 匯率資料

  // === 歷史記錄 (不變) ===
  pbRecords: Array<{ date: string; pb: number }>; // PB 歷史
  pbRecordsObjects: object[]; // PB 詳細物件
  valuationGuardState: object; // 估值防護狀態
  institutionalNet: number; // 法人淨買超
  institutionalHistory: number[]; // 法人歷史

  // === 模擬日期 ===
  date: string; // YYYY-MM-DD
}
```

**資料來源對應表**：

| SimulationInput 欄位               | 來源                                                    | 備註                                       |
| ---------------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| currentPrice, price0050, basePrice | latestReport.marketState                                | 正向模擬時替換 price0050                   |
| closeArr, highArr, lowArr          | 由股價歷史重建                                          | 需從 `archiveManager.getStockHistory` 取得 |
| ma20Arr...atrArr                   | 由 `calculateIndicators(history)` 重新計算              | **完整重算而非增量更新** (見 16.3)         |
| portfolio                          | latestReport.signals.portfolio / latestReport.portfolio | 不變                                       |
| VIX, macroMarketDirection          | latestReport.marketState                                | 不變                                       |
| rawValuation...rawFx               | latestReport.marketState.raw\*                          | 不變                                       |
| pbRecords...institutionalHistory   | latestReport 多處                                       | 不變                                       |

### 16.3 指標重新計算策略：完整重算 (Full Recompute)

**決策**：採用**完整重算**，而非增量更新預計算陣列。

**理由**：

- RSI/KD/MACD/ATR 使用 Wilder 平滑，具有路徑依賴性，增量更新不準確
- MA240 fallback 邏輯需重新評估
- 正確性優先於效能；模擬請求頻率低，可接受 50-100ms 計算時間

**實作流程**：

```javascript
// dataAdapter.mjs 核心邏輯
async function buildSimulationInput(
  latestReport,
  simulatedPrice0050,
  simulatedPriceZ2 = null,
) {
  // 1. 深層複製最新戰報 (避免污染快取)
  const simData = JSON.parse(JSON.stringify(latestReport));

  // 2. 取得股價歷史資料 (用於重建完整 OHLCV 序列)
  const history0050 = await fetchRequiredHistory("0050", requiredMonths);
  const historyZ2 = await fetchRequiredHistory("00675L", requiredMonths);

  // 3. 替換最新一根 K 棒的收盤價 (以及高低價)
  const lastIdx = historyZ2.length - 1;
  historyZ2[lastIdx].close = simulatedPriceZ2 ?? simData.currentPrice;
  historyZ2[lastIdx].high = Math.max(
    historyZ2[lastIdx].high,
    simulatedPriceZ2 ?? simData.currentPrice,
  );
  historyZ2[lastIdx].low = Math.min(
    historyZ2[lastIdx].low,
    simulatedPriceZ2 ?? simData.currentPrice,
  );

  // 同理處理 0050 歷史
  history0050[lastIdx].close = simulatedPrice0050;
  history0050[lastIdx].high = Math.max(
    history0050[lastIdx].high,
    simulatedPrice0050,
  );
  history0050[lastIdx].low = Math.min(
    history0050[lastIdx].low,
    simulatedPrice0050,
  );

  // 4. 完整重新計算所有指標
  const indicatorsZ2 = calculateIndicators(historyZ2);
  const indicators0050 = calculateIndicators(history0050);

  // 5. 組裝 SimulationInput
  return {
    ...simData,
    currentPrice: simulatedPriceZ2 ?? simData.currentPrice,
    price0050: simulatedPrice0050,
    closeArr: indicatorsZ2.closes,
    highArr: indicatorsZ2.highs,
    lowArr: indicatorsZ2.lows,
    ma20Arr: indicatorsZ2.ma20Arr,
    ma60Arr: indicatorsZ2.ma60Arr,
    ma240Arr: indicatorsZ2.ma240Arr,
    ma60SlopeArr: indicatorsZ2.ma60Slope,
    macdArr: indicatorsZ2.macdArr,
    kdArr: indicatorsZ2.kdArr,
    rsiArr: indicatorsZ2.rsiArr,
    atrArr: indicatorsZ2.atrArr,
    // ... 其他欄位保持不變
  };
}
```

**所需歷史資料月數**：

- RSI(14): 至少 14+1 = 15 筆 → 1 個月
- KD(9,3,3): 至少 9+3+3 = 15 筆 → 1 個月
- MACD(12,26,9): 至少 26+9 = 35 筆 → 2 個月
- MA20: 20 筆 → 1 個月
- MA60: 60 筆 → 3 個月
- MA240: 240 筆 → 12 個月
- ATR(14): 14+1 = 15 筆 → 1 個月

**建議**：一次抓取最近 **13 個月** 歷史資料，確保所有指標皆可計算。

### 16.4 反向推導 - 解析解實作細節

#### 16.4.1 維持率反推 (線性解析解)

```javascript
// maintenanceRatio = netAsset / totalLoan * 100
// netAsset = qty0050 * price0050 + qtyZ2 * priceZ2 + cash - totalLoan
// 假設 priceZ2 固定 (或按比例變動)
function solvePriceForMaintenanceRatio(
  targetRatio,
  portfolio,
  priceZ2,
  fixedZ2Ratio = false,
) {
  const { qty0050, qtyZ2, cash, totalLoan } = portfolio;
  const targetNetAsset = (targetRatio / 100) * totalLoan;

  if (fixedZ2Ratio) {
    // priceZ2 隨 price0050 同比例變動
    const priceRatio = priceZ2 / portfolio.price0050; // 原始比例
    // targetNetAsset = qty0050*p + qtyZ2*(p*ratio) + cash - totalLoan
    // p = (targetNetAsset - cash + totalLoan) / (qty0050 + qtyZ2*ratio)
  } else {
    // priceZ2 固定
    // p = (targetNetAsset - qtyZ2*priceZ2 - cash + totalLoan) / qty0050
  }
}
```

#### 16.4.2 MA20/MA60 反推 (線性解析解)

```javascript
// MA20 = sum(closeArr[-20:]) / 20
// targetMA20 = (sum(closeArr[-20:-1]) + newClose) / 20
// newClose = targetMA20 * 20 - sum(closeArr[-20:-1])
function solvePriceForMA(targetMA, closeArr, period) {
  const sumPrev = closeArr.slice(-period, -1).reduce((a, b) => a + b, 0);
  return targetMA * period - sumPrev;
}
```

#### 16.4.3 MA240 偏離反推

```javascript
// bias240 = (price - ma240) / ma240 * 100
// 先估算 ma240 (若資料不足用 fallback)，再解價格
// price = ma240 * (1 + targetBias/100)
// 需再正向模擬驗證，因 ma240 可能受新價格影響
```

#### 16.4.4 RSI 反推 (數值解 - 二分搜尋)

RSI 使用 Wilder 平滑，無閉式解析解，採二分搜尋：

```javascript
function solvePriceForRSI(targetRSI, history, tolerance = 0.5, maxIter = 50) {
  // RSI 範圍 0-100，目標需在 1-99
  // 搜尋範圍：目前價格 ±30% (可配置)
  let low = currentPrice * 0.7;
  let high = currentPrice * 1.3;

  for (let i = 0; i < maxIter; i++) {
    const mid = (low + high) / 2;
    const testHistory = replaceLastClose(history, mid);
    const rsi = calculateRSI(testHistory, 14).at(-1);

    if (Math.abs(rsi - targetRSI) < tolerance) return mid;
    if (rsi < targetRSI) low = mid;
    else high = mid;
  }
  return null; // 未收斂
}
```

### 16.5 掃描器規格 (Scanner)

適用於：KD 交叉、MACD 交叉、策略總分、複合條件

```javascript
const SCAN_CONFIG = {
  rangePct: 0.15,        // ±15% 掃描範圍 (可由設定覆蓋)
  stepPct: 0.005,        // 0.5% 步距 = 每側 30 步，共 60 次模擬
  maxIterations: 200,    // 安全上限
  tolerance: 0.01,       // 1% 容忍度 (用於「最接近目標」判定)
  earlyStop: true,       // 找到完全符合時提前結束
};

// 掃描結果結構
interface ScanResult {
  target: any;
  reachable: boolean;
  method: 'scan';
  results: {
    minPrice: number | null;        // 最低達標價格
    maxPrice: number | null;        // 最高達標價格 (若適用)
    closestPrice: number;           // 最接近目標的價格
    achievedValue: number;          // 該價格下的實際指標/分數
  };
  scanDetails: {
    range: [number, number];
    step: number;
    iterations: number;
    durationMs: number;
  };
  assumptions: string[];
}
```

**效能預估**：

- 單次正向模擬：~50-100ms (含指標重算)
- 60 次掃描：~3-6 秒
- **優化**：可並行化批次模擬，或降低步距至 1% (30 次，~1.5-3 秒)

### 16.6 模組架構規劃

```
src/modules/simulator/
├── index.mjs                 # 統一匯出
├── types.mjs                 # JSDoc 型別定義
├── validator.mjs             # 輸入驗證 (價格範圍、目標類型、必填欄位)
├── dataAdapter.mjs           # latestReport + 價格 → SimulationInput
├── forwardSimulator.mjs      # 正向模擬主流程
├── reverseEngine.mjs         # 反向推導主流程
├── analyticalSolvers.mjs     # 解析解 (維持率、MA、MA240偏離)
├── rsiSolver.mjs             # RSI 數值反推 (二分搜尋)
├── scanner.mjs               # 區間掃描器 (KD、MACD、分數、複合)
├── responseFormatter.mjs     # 統一回應格式、資料品質標籤
└── constants.mjs             # 共用常數 (掃描範圍、容忍度、價格邊界)
```

### 16.7 API 契約補充

#### POST /api/simulate (正向)

```json
// Request
{
  "price0050": 180.5,           // 必填：預估 0050 價格
  "priceZ2": 120.0              // 選填：預估 00675L 價格，缺省按同比例
}

// Response (200)
{
  "simulatedPrice0050": 180.5,
  "simulatedPriceZ2": 120.0,
  "currentPrice0050": 175.0,
  "currentPriceZ2": 116.5,
  "priceDiff0050": 5.5,
  "priceDiffPct0050": 3.14,
  "indicators": {
    "rsi": 58.3,
    "kd": {"k": 62.1, "d": 58.4},
    "macd": {"MACD": 0.45, "signal": 0.32, "histogram": 0.13},
    "ma20": 172.3,
    "ma60": 168.9,
    "ma240": 155.2,
    "bias240": 16.3,
    "atr": 2.1
  },
  "maintenanceMargin": 142.5,
  "portfolioHealth": {...},
  "lifecycleStage": "累積期",
  "strategyScore": 65,
  "strategyStatus": "觀望",
  "strategyTarget": "🔹 0050 DCA",
  "strategySuggestion": "維持觀望",
  "dataQuality": {
    "rsi": "ok",
    "kd": "ok",
    "macd": "ok",
    "ma20": "ok",
    "ma60": "ok",
    "ma240": "fallback_used",
    "atr": "ok"
  },
  "calculationMode": "forward",
  "timestamp": "2026-08-02T10:30:00.000Z",
  "dataAsOf": "2026-08-01"
}
```

#### POST /api/simulate/reverse (反向)

```json
// Request
{
  "target": {
    "type": "maintenanceRatio",
    "value": 150
  }
  // 或
  // "target": { "type": "rsi", "value": 30 }
  // "target": { "type": "ma20", "value": 180 }
  // "target": { "type": "kdCross", "direction": "golden" }
  // "target": { "type": "macdCross", "direction": "dead" }
  // "target": { "type": "strategyScore", "value": 70 }
  // "target": { "type": "portfolioHealth", "status": "green" }
}

// Response (200) - 解析解
{
  "target": {"type": "maintenanceRatio", "value": 150},
  "reachable": true,
  "method": "analytical",
  "results": {
    "price0050": 182.3,
    "priceZ2": 121.1,
    "achievedValue": 150.0
  },
  "assumptions": ["priceZ2 固定", "持倉不變", "融資不變"],
  "disclaimer": "此為條件分析，非價格預測或投資建議...",
  "calculationMode": "reverse",
  "timestamp": "2026-08-02T10:30:00.000Z",
  "dataAsOf": "2026-08-01"
}

// Response (200) - 掃描解
{
  "target": {"type": "kdCross", "direction": "golden"},
  "reachable": true,
  "method": "scan",
  "results": {
    "minPrice0050": 178.5,
    "maxPrice0050": 185.2,
    "closestPrice0050": 181.0,
    "achievedValue": "golden_cross"
  },
  "scanDetails": {
    "range": [148.75, 201.25],
    "step": 0.5,
    "iterations": 42,
    "durationMs": 2100
  },
  "assumptions": ["價格區間 ±15%", "其他指標不變", "僅掃描收盤價"],
  "disclaimer": "...",
  "calculationMode": "reverse",
  "timestamp": "...",
  "dataAsOf": "..."
}

// Response (200) - 不可達
{
  "target": {"type": "rsi", "value": 5},
  "reachable": false,
  "method": "analytical",
  "reason": "目標 RSI 5 超出合理範圍，目前資料下最低可達 RSI ≈ 18 (價格跌至 50 元)",
  "closestResult": {
    "price0050": 50.0,
    "achievedRSI": 18.2
  },
  "suggestedRange": {"min": 15, "max": 85},
  "disclaimer": "...",
  "calculationMode": "reverse",
  "timestamp": "...",
  "dataAsOf": "..."
}
```

#### 狀態碼語意

| 狀態碼 | 意義                     | 回應範例                                                                    |
| ------ | ------------------------ | --------------------------------------------------------------------------- |
| 200    | 計算完成 (含可達/不可達) | 上述回應                                                                    |
| 400    | 輸入格式/範圍錯誤        | `{"error": "Bad Request", "message": "price0050 必須在 50-500 之間"}`       |
| 409    | 資料狀態不允許計算       | `{"error": "Conflict", "message": "最新戰報資料不完整，無法模擬"}`          |
| 503    | 快取/必要資料未就緒      | `{"error": "Service Unavailable", "message": "策略設定載入中，請稍後再試"}` |
| 500    | 非預期計算錯誤           | `{"error": "Internal Server Error", "message": "伺服器內部錯誤"}`           |

### 16.8 Mini App 整合規格

#### 新增路由

```javascript
// webapp/src/router/index.js
{
  path: '/simulator',
  name: 'Simulator',
  component: () => import('@/views/SimulatorView.vue'),
  meta: { requiresAuth: true }
}
```

#### 元件結構

```
webapp/src/views/SimulatorView.vue          # 主視圖，Mode A/B 切換
webapp/src/components/simulator/
├── SimulatorModeSelector.vue               # Mode A/B 切換器
├── ForwardPanel.vue                        # 正向模擬面板
│   ├── PriceInput.vue                      # 價格輸入 (含警告)
│   └── ForwardResultCard.vue               # 結果卡片
├── ReversePanel.vue                        # 反向推導面板
│   ├── TargetSelector.vue                  # 目標類型選擇器
│   ├── TargetInput.vue                     # 目標數值輸入
│   └── ReverseResultCard.vue               # 結果卡片
├── Common/
│   ├── IndicatorComparisonTable.vue        # 指標比較表 (實際 vs 模擬)
│   ├── DataQualityBadges.vue               # 資料品質標籤
│   └── DisclaimerBanner.vue                # 免責聲明
└── LoadingSkeleton.vue                     # 載入狀態
```

#### 狀態管理 (Pinia 或 Composable)

```javascript
// webapp/src/composables/useSimulator.js
export function useSimulator() {
  const mode = ref('forward');  // 'forward' | 'reverse'
  const forwardInput = ref({ price0050: null, priceZ2: null });
  const reverseInput = ref({ targetType: 'maintenanceRatio', targetValue: null });
  const result = ref(null);
  const loading = ref(false);
  const error = ref(null);

  async function runForward() { ... }
  async function runReverse() { ... }

  return { mode, forwardInput, reverseInput, result, loading, error, runForward, runReverse };
}
```

### 16.9 單元測試規格 (TDD 順序)

依計畫 10.2 順序，每項皆需**先寫測試再實作**：

| #   | 測試檔案                     | 測試重點                            | 驗收條件                             |
| --- | ---------------------------- | ----------------------------------- | ------------------------------------ |
| 1   | `validator.test.mjs`         | 價格範圍、目標類型、必填欄位        | 400 錯誤訊息可直接給 UI 顯示         |
| 2   | `dataAdapter.test.mjs`       | latestReport → SimulationInput 轉換 | 深層複製不污染原始快取；指標重算正確 |
| 3   | `analyticalSolvers.test.mjs` | 維持率、MA20、MA60、MA240偏離       | 解析解帶回正向驗證誤差 < 0.01%       |
| 4   | `rsiSolver.test.mjs`         | RSI 二分搜尋反推                    | 收斂誤差 < 0.5 RSI 點；標記近似      |
| 5   | `scanner.test.mjs`           | KD/MACD/分數掃描                    | 回傳正確區間、步距、迭代次數         |
| 6   | `forwardSimulator.test.mjs`  | 完整正向流程                        | 所有輸出欄位正確、資料品質標籤正確   |
| 7   | `reverseEngine.test.mjs`     | 完整反向流程 (解析+掃描)            | 正確路由到解析/掃描；不可達處理正確  |
| 8   | `simulateRoute.test.mjs`     | API 整合測試                        | 400/409/503/500 錯誤情境覆蓋         |
| 9   | `integration.test.mjs`       | 快取隔離、並發、效能                | 原始快取未被修改；< 2000ms 完成掃描  |

**測試 Fixtures** (共用)：

```javascript
// test/fixtures/simulator.mjs
export const mockLatestReport = {/* 完整戰報結構 */};
export const mockStrategyConfig = {/* 策略設定 */};
export const mockPortfolio = {
  qty0050: 10000,
  qtyZ2: 5000,
  cash: 50000,
  totalLoan: 800000,
  lastBuyDate: "2026-01-15",
};
export const mockHistory0050 = [/* 13個月 OHLCV */];
export const mockHistoryZ2 = [/* 13個月 OHLCV */];
```

### 16.10 效能預算與優化

| 操作            | 目標時間 | 優化手段                 |
| --------------- | -------- | ------------------------ |
| 正向模擬 (單次) | < 100ms  | 指標計算純 JS，無 I/O    |
| 反向解析解      | < 50ms   | 純數學運算               |
| 反向掃描 (60步) | < 3000ms | 可考慮 Worker 或分批回應 |
| 股價歷史讀取    | < 200ms  | 記憶體快取 (TTL 5 分鐘)  |
| 策略設定讀取    | < 50ms   | 已有快取機制             |

**快取策略**：

- 股價歷史資料：記憶體 Map + 5 分鐘 TTL
- 策略設定：沿用現有 `fetchStrategyConfig` 快取
- 最新戰報：每次請求讀取 (檔案系統快取通常 < 10ms)

### 16.11 風險與對策補充

| 風險                 | 影響                 | 對策                                                 |
| -------------------- | -------------------- | ---------------------------------------------------- |
| 股價歷史檔案遺漏月份 | 指標計算失敗/不準    | `dataAdapter` 檢查月份完整性，缺月回傳 409           |
| 0050 股票分割未調整  | 模擬價格基準不一致   | 確認 `archiveManager` 存檔時已調整；模擬輸入需同基準 |
| 使用者輸入極端價格   | 掃描超時、數值溢位   | 輸入驗證限制 50-500；掃描上限 200 次                 |
| 並發模擬請求衝突     | 記憶體壓力           | 無共享可變狀態，天然安全；Rate Limit 保護            |
| RSI 二分搜尋不收斂   | 回傳 null 視為不可達 | 設定 maxIter=50，寬容度 0.5；記錄日誌供除錯          |

### 16.12 決策項確認結果 (Decisions Confirmed)

| 編號 | 決策項目 | 選項 | 確認結果 | 狀態 |
| ------ | -------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------------------------------------------- | --------- |
| D1 | 價格輸入模式 | A: 僅 0050，Z2 按同比例<br>B: 0050+Z2 獨立<br>C: 僅 0050，Z2 固定 | **A** - 僅輸入 0050，00675L 按同比例變動 | ✅ 已確認 |
| D2 | 指標重算方式 | A: 完整重算 (含抓歷史)<br>B: 增量更新預計算陣列 | **A** - 完整重算：抓 13 月 OHLCV 重跑 calculateIndicators() | ✅ 已確認 |
| D3 | 掃描步距 | A: 0.1% (300步)<br>B: 0.5% (60步)<br>C: 1% (30步) | **B** - 0.5% 步距 (±15% = 60 步，約 3-6 秒) | ✅ 已確認 |
| D4 | 掃描上限 | A: 100 次<br>B: 200 次<br>C: 500 次 | **B** - 200 次上限 (約 10-20 秒) | ✅ 已確認 |
| D5 | RSI 反推演算法 | A: 二分搜尋<br>B: 牛頓法<br>C: 查表插值 | **A** - 二分搜尋 (穩健、50 次內收斂、誤差 <0.5 RSI 點) | ✅ 已確認 |
| D6 | 歷史資料快取 | A: 每請求讀取<br>B: 記憶體 5min TTL<br>C: 啟動預載 | **B** - 記憶體 Map + 5 分鐘 TTL | ✅ 已確認 |
| D7 | 模擬 API 認證 | A: 同現有 API (initData)<br>B: 公開無認證<br>C: API Key | **A** - 同現有 API，要求 Telegram initData 驗證 | ✅ 已確認 |
| D8 | 回應時間戳 | A: 僅 dataAsOf<br>B: 僅 timestamp<br>C: 兩者皆含 | **C** - 同時回傳 dataAsOf (資料基準日) + timestamp (計算時間) | ✅ 已確認 |
| DEC-01 | priceZ2 預設聯動行為 | A: 當前比例聯動<br>B: 固定歷史平均比例<br>C: 固定 1:0.5 理論槓桿比 | **A** - `priceZ2 = price0050 * (currentZ2/current0050)` 使用即時最新比例 | ✅ 已確認 |
| DEC-02 | high/low 最後一根 K 棒處理 | A: max/min 夾住模擬價<br>B: 高低價同比例調整<br>C: 僅替換 close | **A** - `high = max(原high, 模擬價)`, `low = min(原low, 模擬價)` 保證 OHLC 不變量 | ✅ 已確認 |
| DEC-03 | 0050 歷史資料必要性 | A: 必填完整重算<br>B: 選填動態決定<br>C: 不支援用 00675L 代理 | **A** - 必填，抓 13 月 OHLCV 完整跑 calculateIndicators()，確保策略引擎相容 | ✅ 已確認 |
| DEC-04 | 反向目標類型擴充設計 | A: 字串聯盟 + 註冊表<br>B: 獨立 API 端點<br>C: GraphQL 風格 | **A** - `SolverRegistry` 映射處理器，開放封閉原則，新增目標僅需註冊一行 | ✅ 已確認 |
| DEC-05 | 歷史缺月處理策略 | A: 嚴格模式 409<br>B: 寬鬆向前填補<br>C: 部分可用動態判斷 | **A** - 任一必要月份缺失即回傳 409 `歷史資料不完整，無法模擬`，強迫資料管線修補 | ✅ 已確認 |
| DEC-06 | MA240 Fallback 分級 | A: 分級 (MA240→MA60→MA20→null)<br>B: 單一 MA60 代理<br>C: 無 fallback 直接不可用 | **A** - ≥240筆正常、60-239筆用 MA60、20-59筆用 MA20、<20筆回 null + 品質標籤 | ✅ 已確認 |
| DEC-07 | 指標計算函式來源 | A: 復用現有模組<br>B: 複製獨立演進<br>C: 參數化注入 | **A** - 直接 import 策略引擎同一套 `calculateIndicators`，單一真實來源，保證一致性 | ✅ 已確認 |
| DEC-08 | 維持率反推 Z2 價格假設 | A: 同比例聯動<br>B: Z2 價格固定<br>C: 使用者可選 | **A** - `fixedZ2Ratio=true`，與正向模擬一致，保證正向/反向可逆性 | ✅ 已確認 |
| DEC-09 | MA20/MA60 目標輸入格式 | A: 絕對值輸入<br>B: 相對偏離輸入<br>C: 兩者皆支援自動偵測 | **A** - `target: {type: 'ma20', value: 180}` 直接輸入目標均線價格，UI 層輔助顯示偏離% | ✅ 已確認 |
| DEC-10 | MA240 偏離驗證次數 | A: 單次驗證<br>B: 迭代修正最多 3 次<br>C: 無驗證直接回傳 | **A** - 估算→正向模擬一次→誤差<0.1%回傳，否則標記近似；MA240 權重 1/240 影響極小 | ✅ 已確認 |
| DEC-11 | RSI 二分搜尋初始範圍 | A: 固定 ±30%<br>B: 動態依 ATR 計算<br>C: 指數級擴展 | **A** - `low=current*0.7, high=current*1.3`，覆蓋 99% 合理 RSI 目標，極端即判不可達 | ✅ 已確認 |
| DEC-12 | 掃描方向 | A: 雙邊掃描 ±15%<br>B: 目標導向單邊<br>C: 自適應雙邊 | **A** - 固定 60 步雙邊覆蓋，3 秒可接受，KD/MACD 交叉方向不固定無法硬編碼單邊 | ✅ 已確認 |
| DEC-13 | 掃描步距類型 | A: 線性相對步距 0.5%<br>B: 對數步距<br>C: 自適應步距 | **A** - `stepPct: 0.005` 本質即相對步距，具對數特性，無需額外邏輯 | ✅ 已確認 |
| DEC-14 | 完全符合判定條件 | A: 精確匹配教科書定義<br>B: 容忍度匹配<br>C: 區間連續匹配 | **A** - KD 金叉 `k>d && prevK<=prevD`，MACD `hist>0 && prevHist<=0`，分數 `score>=target` | ✅ 已確認 |
| DEC-15 | Portfolio Health 邏輯 | A: AND 邏輯<br>B: 加權分數<br>C: 使用者可選 | **A** - 所有子條件同時滿足才算達標，符合「安全區間」語意，寧嚴勿鬆 | ✅ 已確認 |
| DEC-16 | 指標回應完整度 | A: 完整回傳 8 指標 + quality 標籤<br>B: 僅回傳可用指標<br>C: 分層核心/延伸 | **A** - 固定回傳 rsi/kd/macd/ma20/ma60/ma240/bias240/atr，缺資料者 `quality: 'insufficient_data'` | ✅ 已確認 |
| DEC-17 | 錯誤訊息格式 | A: 繁中結構化 {error, message, code, field}<br>B: 純英文<br>C: 僅 HTTP status | **A** - 前端可直接顯示 message、依 code 客製化、field 高亮輸入框 | ✅ 已確認 |
| DEC-18 | 409 Conflict 觸發條件 | A: 明確列舉 4 類<br>B: 統一資料未就緒<br>C: 併入 503 | **A** - 1)戰報過期 2)缺月 3)持倉異常 4)設定載入失敗，細分 code 便於前端差別化處理 | ✅ 已確認 |
| DEC-19 | 價格偏離警告分級 | A: 三級 (≤10%無/10-20%黃/>20%紅)<br>B: 僅記錄不回傳<br>C: >20% 硬拒 | **A** - 回應含 `warnings: string[]`，前端視覺化黃/紅標籤，不阻擋用戶 | ✅ 已確認 |
| DEC-20 | 不可達時最近結果計算 | A: 掃描過程記錄最接近者<br>B: 事後二次搜尋<br>C: 解析估算 | **A** - 掃描器內部維護 `bestDiff/bestPrice/bestValue`，零額外成本、經實際模擬驗證 | ✅ 已確認 |
| DEC-21 | 速率限制策略 | A: 復用現有 API rate limit<br>B: 模擬器專用更嚴格<br>C: 無限制靠無狀態 | **A** - 延用現有中介軟體 (30 req/min per user)，上線後監控 CPU 再決定是否拆分 | ✅ 已確認 |
| DEC-22 | 模組檔案拆分粒度 | A: 9 檔按職責細分<br>B: 合併 5 檔<br>C: 合併 3 檔 | **A** - validator/dataAdapter/forwardSimulator/reverseEngine/analyticalSolvers/rsiSolver/scanner/responseFormatter/constants | ✅ 已確認 |
| DEC-23 | 常數檔範圍 | A: 僅純常數字面量<br>B: 含設定預設值<br>C: 含衍生計算 | **A** - 僅 export `const` 字面量，衍生值在使用處計算，保證常數檔純粹可安全 mock | ✅ 已確認 |
| DEC-24 | Mode A/B 狀態保持 | A: 獨立狀態切換不保留<br>B: 共用價格欄位<br>C: 切換時轉換保留 | **A** - 符合規格 §8.1 禁止混用，兩模式語義完全不同，獨立表單最清晰 | ✅ 已確認 |
| DEC-25 | 白話解讀生成策略 | A: 後端生成前端直呈<br>B: 前端根據數值生成<br>C: 混合 | **A** - API 回應含 `interpretations` 物件，業務邏輯集中、多端一致、300 bytes 增量可忽略 | ✅ 已確認 |
| DEC-26 | 測試 Fixtures 來源 | A: 真實資料抽樣 + 手工極端案例<br>B: 完全手工構造<br>C: 程式化隨機生成 | **A** - 核心 fixtures 用真實資料保證指標內部一致性，邊界測試手工構造，雙管齊下 | ✅ 已確認 |
| DEC-27 | 整合測試方式 | A: 直接呼叫路由 handler<br>B: 啟動測試 Server<br>C: Supertest 對 dev server | **A** - `await handler(mockReq, mockRes)` 快、隔離度高、易並行；中介軟體各自獨立單測 | ✅ 已確認 |
| DEC-28 | 快取失效策略 | A: TTL + mtime 雙重檢查<br>B: 僅 TTL<br>C: 檔案監聽 | **A** - `if (expired                                                                                                         |           | fs.stat.mtime > cached.mtime) delete`，檔案更新即時生效，TTL 為備援 | ✅ 已確認 |
| DEC-29 | 掃描並行化策略 | A: 串行 (3-6 秒可接受)<br>B: Promise.all 分批並行<br>C: Worker Threads | **A** - Node 單執行緒 CPU 密集無並行效益、反而增記憶體壓力；3 秒用戶可接受 | ✅ 已確認 |
| DEC-30 | 股票分割調整確認 | A: 依賴 archiveManager 已調整 + 開發期驗證腳本<br>B: 模擬器讀取時再調整<br>C: 版本標記欄位 | **A** - 記憶體確認分割還原已處理，開發期撰寫驗證腳本確認 2025-06 前後價格連續性 | ✅ 已確認 |
| DEC-31 | 融資利息處理 | A: 單日模擬忽略利息<br>B: 估算日利息扣減<br>C: 使用者可輸入利率 | **A** - 符合「單日情境」定義，日息影響 <0.02%，assumptions 註明「未含融資利息成本」 | ✅ 已確認 |
| DEC-32 | 模擬結果快取/去重 | A: 不快取，每次計算<br>B: 短期快取 30 秒<br>C: 用戶端去重 | **A** - 頻率低、計算快、無副作用、去重複雜度>收益；rate limit 已防濫用 | ✅ 已確認 |
| DEC-33 | 開發環境繞過 initData | A: NODE_ENV=dev 時繞過<br>B: 專用 header 繞過<br>C: Mock Telegram WebApp | **A** - `if (process.env.NODE_ENV==='dev') return next()`，標準做法、零業務碼入侵 | ✅ 已確認 |
| DEC-34 | API 版本控制策略 | A: URL 版本前綴 /api/v1/<br>B: Header 版本<br>C: 無版本向後相容 | **A** - `/api/v1/simulate`、`/api/v1/simulate/reverse`，業界標準、最低認知負荷 | ✅ 已確認 |

> 以上 34 項決策 (D1-D8 + DEC-01~34) 於 2026-08-02 完整確認，將作為後續開發的固定規格。

---

## 17. 開發檢核清單 (Definition of Done)

### Phase A: 基礎模型與正向模擬

- [ ] `validator.mjs` 完成並測試通過
- [ ] `dataAdapter.mjs` 完成 (含歷史抓取、指標重算) 並測試通過
- [ ] `forwardSimulator.mjs` 完成並測試通過
- [ ] `POST /api/simulate` 路由註冊、驗證、錯誤處理
- [ ] 單元測試覆蓋率 > 90% (validator, dataAdapter, forwardSimulator)

### Phase B: 解析型反向推導

- [ ] `analyticalSolvers.mjs` (維持率、MA20、MA60、MA240偏離) 完成並測試
- [ ] `rsiSolver.mjs` (二分搜尋) 完成並測試
- [ ] `reverseEngine.mjs` 整合解析解路由
- [ ] `POST /api/simulate/reverse` 解析解端點完成
- [ ] 反推結果帶回正向驗證誤差 < 容忍度

### Phase C: 近似型反向推導

- [ ] `scanner.mjs` 通用掃描器完成
- [ ] KD 交叉、MACD 交叉、策略分數掃描實作
- [ ] 複合條件掃描 (Portfolio Health) 實作
- [ ] 反向 API 整合掃描路由
- [ ] 掃描效能 < 3 秒 (60 步)

### Phase D: Mini App UX

- [ ] Vue Router 新增 `/simulator` 路由
- [ ] `SimulatorView.vue` 主視圖完成
- [ ] Mode A/B 切換、輸入面板、結果卡片完成
- [ ] 指標比較表、資料品質標籤、免責聲明
- [ ] 載入/成功/錯誤/不可達/近似 狀態完整
- [ ] 手機版 (LIFF) 實機驗收

### Phase E: TDD 與整合驗收

- [ ] 所有單元測試通過 (`npm run test`)
- [ ] 整合測試通過 (API 端到端)
- [ ] 回歸測試：原有策略結果未受影響
- [ ] 效能測試通過
- [ ] LIFF 手機版操作驗收

### Phase F: 文件與部署

- [ ] README 更新 (模擬器使用說明)
- [ ] API 文件更新 (Swagger/OpenAPI)
- [ ] 變更紀錄 (CHANGELOG)
- [ ] 部署驗證 (staging → production)

---

## 18. 變更紀錄

| 版本 | 日期       | 變更摘要                                                                                                                                                                      | 作者             |
| ---- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- |
| v1.0 | 2026-08-02 | 初版：功能範圍、計算規格、TDD 規劃                                                                                                                                            | -                |
| v1.1 | 2026-08-02 | **補充章節 16-18**：完整資料結構、模組架構、API 契約、指標重算策略、解析解細節、掃描器規格、Mini App 整合、測試規格、效能預算、風險對策、決策項、驗收清單                     | Grilling Session |
| v1.2 | 2026-08-02 | **確認 D1-D8 八項關鍵決策**：價格輸入模式、指標重算、掃描參數、RSI 反推演算法、歷史快取、API 認證、回應時間戳                                                                 | 問答確認         |
| v1.3 | 2026-08-02 | **完整確認 34 項決策 (D1-D8 + DEC-01~34)**：資料結構、指標重算、解析參數、掃描器、API契約、錯誤處理、模組架構、UX、測試、效能、風險、部署全面落地，規劃文件凍結為開發基準規格 | 全決策確認       |
