# Langfuse 評分機制整合實作計畫書

## 目標

本計畫目標是替 InvestmentLineNotify 導入一套可持續維護的 Langfuse 評分機制，用於監控 AI pipeline 各階段的輸出品質、比較 prompt 版本差異，並為後續人工評估與 LLM Judge 奠定基礎。[file:47]  
相較於先前將不同評分類型拆成個別功能的規劃，這份計畫改為整合式推進，優先處理會影響整體架構的前置調整，再逐步上線 Rule 類、Human 類與 LLM 類評分。[file:48]

---

## 計畫核心原則

1. **先做最小解耦，再做評分實作。**  
目前 `callGemini`、Langfuse tracing、prompt 取得與 generation 建立是深度綁定的，因此若直接擴充 score，會讓各模組難以在 AI 呼叫完成後正確回寫評分。[file:48]  
本計畫採用最小必要調整：先讓 `callGemini` 回傳 `traceId`，使呼叫方可在外部以統一方式補寫分數，而不需要先全面重構 observability 架構。[file:48]

2. **以 Rule 類評分優先，先建立可穩定產生的量化資料。**  
目前文件中已定義多個 Boolean 與 Numeric score，其中 Rule 類最適合優先導入，因為可由程式穩定計算、成本低、可立即累積趨勢資料。[file:47]

3. **Description 優先於舊規劃細節。**  
若舊規劃文件中的資料流、欄位來源或實作方式與最新 score description 有落差，實作時一律以 `langfuse-score-configs.md` 內的 Description 為準。[file:47][file:48]

4. **分階段上線，避免一次改太多核心流程。**  
由於專案目前已有穩定運作中的新聞抓取、AI 分析與通知流程，因此評分導入應以「不影響主流程成功率」為最高原則，所有 score 回寫應視為觀測層，不可反過來阻斷主流程。[file:48]

---

## 範圍

本計畫涵蓋以下幾類評分與相關支援調整：[file:47]

- Rule 類評分：`Schema_Validation`、`Format_Compliance`、`Keyword_Yield_Rate`、`Dynamic_Keyword_Yield_Rate`、`Diversity_Score`、`Score_Distribution_Spread`。[file:47]
- Human 類評分的落點與資料預留：`Context_Alignment`、`Signal_to_Noise_Ratio`、`Summary_Quality`、`Logic_Consistency`、`Weighting_Rationality`、`Actionability`、`Tone_and_Empathy`。[file:47]
- LLM Judge 類評分的後續擴充機制，包含可調式觸發頻率與非阻塞背景執行模式。[file:47][file:48]

本計畫**不包含**重新設計整套 Langfuse tracing abstraction，也**不將 RuleOptimizer score 納入本次主計畫書**，因為你已另外更新 score 文件與 Langfuse 設定。[file:47]

---

## 架構調整策略

### Phase 0：最小解耦（評分前置任務）

在正式導入任何 score 之前，先完成 `callGemini` 的最小解耦，讓呼叫方能取得 `traceId`。[file:48]  
建議將 `callGemini` 的回傳值由單純字串改為物件，例如：

```js
{
  text,
  traceId
}
```

這樣的改動可以讓 `generateDailySearchQueries`、`filterAndCategorizeAllNewsWithAI`、`analyzeMacroNewsWithAI`、`getAiInvestmentAdvice` 等呼叫方，在 AI 回應完成後，於模組內自行執行 `langfuse.score(...)` 回寫評分。[file:48]  
這個做法的優點是改動範圍可控、責任邊界清楚，也避免把所有 score 邏輯硬塞回 `callGemini` 造成耦合進一步加深。[file:48]

### Phase 0 需要完成的調整

- `callGemini` 回傳 `{ text, traceId }` 而非單一 `text`。[file:48]
- 所有呼叫 `callGemini` 的模組統一改為物件解構方式取值。[file:48]
- 評分失敗不得影響主流程，因此 `langfuse.score(...)` 應包在獨立 `try/catch` 中，失敗僅記錄 warning。[file:48]
- 若某些流程未來會需要綁定 generation 而非 trace，仍先以 `traceId` 作為第一版統一關聯鍵，避免過早複雜化。[file:48]

---

## 分階段實作規劃

## Phase 1：Rule 類基礎評分先上線

此階段目標是先建立最容易自動化、最能立即反映 pipeline 健康度的分數。[file:47]

### 1. Schema_Validation

此分數用於檢查 AI 輸出是否符合預期 schema，且可被正常解析，屬於所有 prompts 都適用的基礎分數。[file:47]  
建議做法是：由各呼叫方在拿到 AI 回傳後、完成 JSON parse 與必要欄位驗證後再打分，而不是放在 `callGemini` 內部統一處理。[file:47]  
原因是目前各 prompt 的 schema 與解析邏輯分散在不同模組，若強行集中在 `callGemini`，反而會讓共用層知道太多業務規則。[file:48]

### 2. Keyword_Yield_Rate

此分數用於評估所有搜尋關鍵字（靜態 + 動態）的整體有效率，計算方式是「過濾後至少有 1 篇新聞的 query 數 / 成功執行的 query 總數」，並需排除 RSS 例外錯誤。[file:47]  
建議在 `generateDailySearchQueries` 取得 AI 生成結果後，於 `newsFetcher` 或查詢執行匯總處計算，再綁回 Search Queries Generator 對應 trace。[file:47][file:48]  
comment 應一併記錄 base 與 dynamic 各自的 valid/total 明細，方便之後在 Langfuse 直接比對 prompt 版本差異。[file:47]

### 3. Dynamic_Keyword_Yield_Rate

此分數專門評估 AI 動態生成關鍵字的有效率，是 prompt 優化的重要核心指標。[file:47]  
計算方式是「動態關鍵字中過濾後至少有 1 篇新聞的 query 數 / 動態關鍵字成功執行數」，並建議將連續 3 日低於 0.4 作為人工檢查門檻。[file:47]  
此分數應與 `Keyword_Yield_Rate` 同步上線，兩者一起看才不會被 base query 掩蓋真實 AI 效果。[file:47]

### 4. Diversity_Score

此分數用於評估最終保留新聞是否有做到多維度覆蓋，原始描述建議依據 think 結構中的 `dimension_check` 計算。[file:47]  
由於目前系統尚未定義維度白名單，因此本計畫需補入一份**標準維度白名單設計**，並以 Description 為主。[file:47]  
建議第一版先定義固定白名單，例如：`總經`、`地緣政治`、`資金流向`、`半導體`、`台股大盤`、`美股/全球市場`，實作時只統計白名單中的維度，忽略 LLM 自創標籤，以降低幻覺污染。[file:47][file:48]  
分數計算建議為：

```text
Diversity_Score = 實際覆蓋到的不重複白名單維度數 / 白名單總維度數
```

### 5. Score_Distribution_Spread

此分數用於檢查 Macro Analyst 的新聞影響力分數是否有合理分布，避免所有新聞都被打成相近分數。[file:47]  
你目前的影響力評分量表為 1~5，其中 5 分代表系統性拐點，1 分代表短期雜訊，因此可採用標準差正規化方式作為第一版實作。[file:47]  
建議公式如下：

```text
spread = stdDev(all_impact_scores) / 2
```

其中分母 2 是根據 1~5 分制的最大理論離散程度做簡化正規化，使最終結果落在約 0~1 的可比較區間。[file:47]  
若新聞分數全部集中在 3 分附近，代表分布不健康，`Score_Distribution_Spread` 會偏低；若分數能反映事件嚴重程度差異，則此值應相對較高。[file:47]

---

## Phase 2：Rule 類延伸與人工評估落點預留

此階段先不全面自動化 Human 類 score，而是完成資料留存與標記點設計，讓人工抽查能順利進行。[file:47]

### 1. Format_Compliance

此分數屬於 Investment Coach 的格式檢查，需確認輸出是否包含指定必要區塊，例如上下文、具體動作、預期心態等。[file:47]  
若目前 Investment Coach 的輸出格式已經穩定，建議在 coach 輸出 parse 完後直接打 Boolean 分數。[file:47]

### 2. Human 評估對應欄位預留

以下分數雖然暫時不一定要自動化，但計畫中應先預留 trace 關聯能力與抽查流程：[file:47]

- `Context_Alignment`。[file:47]
- `Signal_to_Noise_Ratio`。[file:47]
- `Summary_Quality`。[file:47]
- `Logic_Consistency`。[file:47]
- `Weighting_Rationality`。[file:47]
- `Actionability`。[file:47]
- `Tone_and_Empathy`。[file:47]

建議第一版不要急著把全部變成 LLM Judge，而是先讓關鍵 trace 能被人工快速回看，例如保留必要 input、output、score comment 與日期上下文，這樣後續不論人工評估或 judge prompt 都能重用同一套資料。[file:47][file:48]

---

## Phase 3：LLM Judge 評分上線

此階段才導入成本較高、流程較複雜的 Judge 類評分，避免在基礎 score 尚未穩定前過早增加系統負擔。[file:47][file:48]

### 首波建議對象

首波建議先只上線與 Investment Coach 最直接相關的兩個分數：[file:47][file:48]

- `Actionability`。[file:47]
- `Tone_and_Empathy`。[file:47]

這兩項在先前規劃中就已被視為適合透過 LLM-as-a-Judge 評估，且對最終使用者感受最直接。[file:48]

### 觸發策略

考量目前系統不是高頻即時服務，而是週期性批次執行，若採固定 20% 隨機抽樣，樣本累積速度可能太慢。[file:48]  
因此建議第一版改成**可配置策略**，預設採「每週固定一天執行」，並保留環境變數切換能力。[file:48]

建議配置概念如下：

```env
LLM_JUDGE_MODE=weekly
LLM_JUDGE_WEEKDAY=1
LLM_JUDGE_SAMPLE_RATE=0.2
```

行為建議如下：

- `weekly`：僅在指定星期執行 Judge。[file:48]
- `random`：依 `LLM_JUDGE_SAMPLE_RATE` 抽樣。[file:48]
- `always`：每天都跑，適合短期驗證 prompt 品質。[file:48]

### 執行原則

Judge 任務應視為背景評估流程，不應阻塞主通知與主決策流程。[file:48]  
可沿用先前規劃思路，以背景 Promise 佇列收集任務，最後在程式結尾以 `Promise.allSettled(...)` 等待完成，避免主流程一結束就遺失評分。[file:48]

---

## 實作順序建議

依照目前價值密度、實作成本與對 prompt 優化的幫助程度，建議順序如下：[file:47]

1. `Schema_Validation`。[file:47]
2. `Keyword_Yield_Rate`。[file:47]
3. `Dynamic_Keyword_Yield_Rate`。[file:47]
4. `Diversity_Score`。[file:47]
5. `Score_Distribution_Spread`。[file:47]
6. `Format_Compliance`。[file:47]
7. `Signal_to_Noise_Ratio`（先保留人工評估入口）。[file:47]
8. `Logic_Consistency`（先保留人工或半自動版本）。[file:47]
9. `Actionability`（LLM Judge）。[file:47]
10. `Tone_and_Empathy`（LLM Judge）。[file:47]

這個排序的核心理由是：先把**可持續累積、可程式自動化、對 prompt 優化最直接**的指標做起來，再進入成本較高的 Judge 機制。[file:47][file:48]

---

## 評分維護策略

## Rule 類

由程式自動回寫，避免人工成本：[file:47]

- `Schema_Validation`。[file:47]
- `Format_Compliance`。[file:47]
- `Keyword_Yield_Rate`。[file:47]
- `Dynamic_Keyword_Yield_Rate`。[file:47]
- `Diversity_Score`。[file:47]
- `Score_Distribution_Spread`。[file:47]

## Human 類

適合人工抽查，建立黃金標準：[file:47]

- `Context_Alignment`。[file:47]
- `Signal_to_Noise_Ratio`。[file:47]
- `Summary_Quality`。[file:47]
- `Logic_Consistency`。[file:47]
- `Weighting_Rationality`。[file:47]
- `Actionability`。[file:47]
- `Tone_and_Empathy`。[file:47]

## LLM 類

後續可建立 Judge Prompt 自動評估：[file:47]

- `Context_Alignment`。[file:47]
- `Signal_to_Noise_Ratio`。[file:47]
- `Summary_Quality`。[file:47]
- `Logic_Consistency`。[file:47]
- `Weighting_Rationality`。[file:47]
- `Actionability`。[file:47]
- `Tone_and_Empathy`。[file:47]

---

## 建議修改的模組範圍

依照目前規劃內容與你現有架構，預期會影響以下模組：[file:48]

- `src/modules/ai/aiClient.mjs`：調整 `callGemini` 回傳值，提供 `traceId`。[file:48]
- `src/modules/ai/aiCoach.mjs`：Search Queries Generator、News Filter、Macro Analyst、Investment Coach 各流程在 parse/驗證後打分。[file:48]
- `src/modules/newsFetcher.mjs`：配合 query 執行結果統計 `Keyword_Yield_Rate` 與 `Dynamic_Keyword_Yield_Rate`。[file:48]
- Langfuse prompt / score config：確認各 score 已建立，且命名與 `langfuse-score-configs.md` 一致。[file:47]

若後續你希望把維度白名單從程式常數提升成設定檔，也可再評估是否新增例如 `data/config/news-dimensions.json` 之類的配置檔，讓 prompt 與 rule 使用同一份詞彙表。[file:47]

---

## 風險與注意事項

1. **不要把 score 寫入失敗視為主流程錯誤。**  
Langfuse score 失敗時應記錄 warning，但不得中斷每日分析與通知流程。[file:48]

2. **先避免把 schema 驗證抽象成共用框架。**  
目前各 prompt 的結構差異大，第一版以各呼叫方自行驗證再打分最務實。[file:47][file:48]

3. **維度白名單要先固定，否則 Diversity_Score 會飄。**  
若沒有標準白名單，LLM 自創分類會讓長期趨勢失真。[file:47][file:48]

4. **Judge 任務需要嚴格控制頻率與 timeout。**  
Judge 只是一層評估，不應拖累主流程，尤其目前系統是定期批次作業。[file:48]

5. **先累積資料，再做 prompt 版本比較。**  
評分系統的價值在於趨勢，而不是單次分數，因此第一版重點應放在穩定產生資料，而不是追求所有 score 一次到位。[file:47]

---

## 驗收標準

### Phase 0 驗收
- `callGemini` 成功回傳 `traceId`。[file:48]
- 既有所有 AI 呼叫流程在改用新回傳格式後仍可正常運作。[file:48]

### Phase 1 驗收
- `Schema_Validation`、`Keyword_Yield_Rate`、`Dynamic_Keyword_Yield_Rate`、`Diversity_Score`、`Score_Distribution_Spread` 可穩定寫入 Langfuse。[file:47]
- 評分失敗不影響主流程完成。[file:48]
- Langfuse 上可按日期查看 score 趨勢，並可用於 prompt 版本比較。[file:47]

### Phase 2 驗收
- `Format_Compliance` 可自動寫入。[file:47]
- Human 類分數已有明確對應 trace 與抽查入口。[file:47]

### Phase 3 驗收
- `Actionability` 與 `Tone_and_Empathy` 可依設定頻率執行 Judge。[file:47][file:48]
- Judge 流程採背景任務執行，不阻塞主流程。[file:48]

---

## 結論

此計畫採取「**先最小解耦、再上 Rule 類評分、最後導入 LLM Judge**」的策略，能在不大幅擾動既有專案的前提下，逐步把 Langfuse 評分機制落地。[file:47][file:48]  
第一版最重要的並不是把所有分數一次做完，而是先打通 `traceId -> score` 的回寫能力，讓後續所有評分類型都能沿用同一套模式擴充。[file:48]