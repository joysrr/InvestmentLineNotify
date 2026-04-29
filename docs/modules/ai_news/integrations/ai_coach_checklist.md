# Investment Coach Prompt 優化 Checklist

本文件用來指導如何透過 Langfuse 的數據與實際輸出內容，系統化優化 Investment Coach（`InvestmentAdvice`）的 Prompt 與整體決策品質。

建議在每次大改 Prompt 前後，都依此 checklist 進行一次完整檢查，並在 Langfuse 建立對應的 Dashboard 或 Saved Filter，方便長期追蹤。

---

## 1. 觀測入口：在 Langfuse 要看哪裡？

在 Langfuse UI 中，先建立以下條件的 Saved Filter：

- **Trace name:** `InvestmentAdvice`
- **Tags:** `feature:InvestmentAdvice`，可加上 `needs-human-review` 聚焦人工驗證樣本

之後所有教練輸出都能透過這個過濾條件集中查看，並搭配 Scores 區塊觀察：

- `Schema_Validation`
- `Format_Compliance`
- `Risk_Coverage`
- `Confidence_Field_Present`（AI 是否回傳 `confidence` / `confidence_level` 欄位；持續為 0 代表 Prompt 模板未要求此欄位）
- `Thinking_Depth`（`coach_internal_thinking` 推理深度估算 0~1；字數、數字量化、因果推理、反向思考各佔 0.2~0.4）
- `Actionability`
- `Tone_and_Empathy`
- （未來人工 / LLM）`Context_Alignment`

> 對應程式：`getAiInvestmentAdvice`（`src/modules/ai/aiCoach.mjs`）、`callAI`（`src/modules/ai/aiClient.mjs`）、`runJudge`（`src/modules/ai/llmJudge.mjs`）。

---

## 2. Step 1：先確認「格式健康度」

**要看什麼？**

1. 在 Langfuse 的 trace 詳細頁，檢查：
   - `Schema_Validation` 是否為 1（True）。
   - `Format_Compliance` 是否為 1（True）。
   - `Confidence_Field_Present` 是否為 1（True）。
2. 在 Output 區塊，確認是否有完整 JSON 結構，而不是 undefined 或純文字。

**判讀方式**

- `Schema_Validation = 0`：代表 JSON parse 失敗，或欄位缺失到無法套用 schema。
- `Format_Compliance = 0`：代表雖然能 parse 成 JSON，但某些關鍵欄位缺失，例如：
  - 沒有 summary / short_summary。
  - 沒有 action_items 或只有空陣列。
  - 沒有 mindset_advice 或為空字串。
- `Confidence_Field_Present = 0`：代表 AI 輸出中缺少 `confidence` 或 `confidence_level` 欄位，或值無效。持續為 0 時，應回到 `InvestmentAdvice` Prompt 確認是否有要求此欄位，並補充對應的 schema 說明。

**若常出現 0，Prompt 要怎麼調？**

在 Langfuse Prompt 管理後台，打開 `InvestmentAdvice` 的 System Prompt，確認以下事項：

- 明確列出必填欄位（對應 `INVESTMENT_COACH_SCHEMA`）：
  - 例如：`short_summary`、`action_items`、`key_risks`、`mindset_advice`、`confidence_level` 等。
- 提供完整 JSON 範例，且標示「這是唯一合法輸出格式」。
- 明確禁止回傳 free-text：
  - 例如加上「嚴禁輸出 markdown 或自然語言段落，務必只回傳單一 JSON 物件」。

調整完後，觀察後續 1–2 週的 `Schema_Validation` / `Format_Compliance` / `Confidence_Field_Present` 是否趨近 1。

---

## 3. Step 2：檢查 Thinking_Depth（推理深度是否充足）

**要看什麼？**

1. 在 Langfuse 的 Scores 區塊：
   - `Thinking_Depth`（由程式自動評分，0~1）。
2. 在 Output JSON 中的 `coach_internal_thinking` 欄位：
   - 是否有足夠的字數（≥87 字）。
   - 是否包含量化數字（例如 RSI 值、VIX 數值、比例）。
   - 是否有因果推理（因為…所以…、若…則…）。
   - 是否有反向思考（反方論點、潛在風險評估）。

**計分規則**

| 條件                                                             | 配分 |
| ---------------------------------------------------------------- | ---- |
| `coach_internal_thinking` 字數 ≥ 87 字                           | +0.4 |
| 含數字量化（正則 `/\d+\.?\d*[%點倍元]/` 匹配）                   | +0.2 |
| 含因果推理（「因為」「所以」「因此」「若」「如果」「當」）       | +0.2 |
| 含反向思考（「但」「然而」「不過」「另一方面」「風險」「注意」） | +0.2 |

**判讀方式**

- **分數長期 < 0.4**：代表 `coach_internal_thinking` 字數不足或推理過於空洞，建議在 Prompt 中強調「必須展示完整思考過程」。
- **分數介於 0.4–0.6**：有字數但推理不夠深，可在 Prompt 中要求「須包含數字引用與因果推理」。
- **分數 ≥ 0.8**：推理深度良好，持續監測避免退化即可。

**Prompt 要怎麼調？**

在 System Prompt 中加入明確要求：

- 要求 `coach_internal_thinking` **至少 100 字**，明確展示思考過程。
- 要求推理中**必須引用數值**（例如 RSI、VIX、PE/PB、成交量倍率等）。
- 要求**表達因果關係**：「因為 X 指標顯示 Y，所以判斷 Z」。
- 要求**提出反面論點**：「雖然多頭訊號明顯，但需注意...」。

---

## 4. Step 3：檢查 Actionability（建議是否具體可執行）

**要看什麼？**

1. 在 Langfuse 的 Scores 區塊：
   - `Actionability`（由 LLM Judge 或人工評分）。
2. 在 Output JSON 中的 `action_items` 欄位：
   - 是否每條都有明確動作，例如：
     - 「今日減碼 00675L 10% 部位」。
     - 「若大盤跌破 X 點，停止加碼。」
   - 避免只有「注意風險」、「適度調整」這種空泛敘述。

**判讀方式**

- **分數長期落在 0.4–0.6 以下**：代表教練多數時候只講道理、不給具體操作。
- **個別 trace 分數極低（接近 0）**：代表該次輸出幾乎沒有行動價值，可優先當作錯誤樣本分析。

**Prompt 要怎麼調？**

在 System Prompt 中加入明確要求：

- 要求輸出中 **必須** 包含一組「可直接執行或觀察的 action_items 清單」，例如：
  - 指定調整比例（增加/減少多少％部位）。
  - 指定條件（什麼價位/時間點/指標變化時做什麼動作）。
- 指出最低 action 條數：
  - 例如「至少提供 2–3 條具體操作建議」。
- 強調 **不得只給抽象提醒**：
  - 例如「避免只說『留意風險』、『注意情緒』，必須說明『怎麼做』。」

調整後，觀察 Actionability 的平均分數是否往 0.7–0.8 以上拉升，同時配合人工抽查避免過度激進。

---

## 5. Step 4：檢查 Tone_and_Empathy（語氣是否健康、不 FOMO）

**要看什麼？**

1. `Tone_and_Empathy` 分數（由 LLM Judge 或人工評分）。
2. 低分樣本的輸出內容：
   - 是否存在以下情況：
     - 語氣過度絕對：「一定要」、「錯過會後悔」、「必賺」等。
     - 過度恐嚇或充滿 FUD：只放大風險、不給平衡視角。
     - 對虧損或焦慮的使用者缺乏安撫與結構化引導。

**Prompt 要怎麼調？**

在 System Prompt 中加入語氣約束：

- 強調「紀律 + 穩定 + 支持性」的教練口吻：
  - 例如：
    - 避免使用絕對化字眼（例如「一定」、「必然」）。
    - 以「建議」、「可以考慮」、「若你承受度許可」等字眼取代命令式。
- 要求在建議前先簡短處理情緒：
  - 例如：
    - 承認市場的不確定性。
    - 提醒使用者「聚焦可控的部分」，而不是盯著短期波動。

觀察 Tone_and_Empathy 的平均分數是否穩定在中高區間，並用實際訊息感受是否符合你個人的教練風格。

---

## 6. Step 5：檢查 Risk_Coverage（風險提醒是否足夠）

**要看什麼？**

1. `Risk_Coverage` 分數：
   - 目前設計為 `min(1, key_risks.length / 3)`，代表：
     - 有 1 條風險 → 約 0.33。
     - 有 2 條風險 → 約 0.67。
     - 有 ≥3 條風險 → 1。
2. Output JSON 的 `key_risks` 內容：
   - 是否有涵蓋不同面向（市場、個股、槓桿、心理等）。

**判讀方式**

- 長期平均 < 0.7：代表多數建議只有 1–2 條風險提醒，偏少。
- 個別 trace 為 0：通常是完全漏寫 `key_risks`，可視為格式缺陷或 Prompt 說明不足。

**Prompt 要怎麼調？**

在 System Prompt 中：

- 明確要求「至少列出 3 條風險」，若真的沒有也需說明原因。
- 指出風險必須涵蓋不同層次：
  - 市場風險（系統性風險）。
  - 策略風險（槓桿、集中度）。
  - 心理或行為偏誤風險（例如追高殺低）。

---

## 7. Step 6：檢查 Context_Alignment（建議是否跟當天情境對得上）

**要看什麼？**

Context_Alignment 目前建議由人工評分，未來可再加 LLM Judge：

1. 在 Langfuse 對單一日的 pipeline 做對照：
   - `MacroAnalysis` 的結果：
     - `total_bull_score` / `total_bear_score` 是否呈現多頭或空頭傾向。
   - `NewsFilter` 的關鍵摘要與重大事件清單。
   - `InvestmentAdvice` 的整體建議方向（偏多、偏空、保守/積極）。
2. 人工在 `Context_Alignment` score 上給 1–5 分，並在 comment 中簡要記錄原因。

**常見問題模式**

- 宏觀與新聞極度偏空，但教練仍建議積極加碼。
- 宏觀明顯轉多，但教練沒有任何「由空翻多」的語氣或行為建議。

**Prompt 要怎麼調？**

在 System Prompt 中加入：

- 要求教練在給出建議時，**必須顯式參考** macro 分析與重大新聞事件：
  - 例如在輸出中加入「根據本日宏觀分析與新聞事件 X/Y/Z，因此建議...」。
- 若你之後在 schema 中加上「引用事件 ID」欄位，也可以要求教練寫入，方便事後交叉驗證。

---

## 8. Step 7：觀察長期趨勢而不是單點

**要看什麼？**

在 Langfuse Dashboard 中建立折線圖或時間序列卡片，追蹤以下 score 的 rolling average：

- `Actionability`
- `Tone_and_Empathy`
- `Risk_Coverage`
- `Format_Compliance`
- `Confidence_Field_Present`
- `Thinking_Depth`

**使用方式**

- 每次對 `InvestmentAdvice` Prompt 做重大修改後：
  - 記錄修改日期與版本。
  - 觀察後續 1–2 週這些指標是否：
    - 明顯上升（代表改動有效）。
    - 產生 trade-off（例如 Actionability 上升但 Tone_and_Empathy 降低）。
- 若看到明顯惡化，優先回頭檢查：
  - Prompt 是否過度 push 使用者進出場。
  - 是否忽略了某些風險維度。
  - `Thinking_Depth` 是否因為壓縮 token 而退化。

---

## 9. Step 8：人工 Review 流程（善用 Human Review metadata）

**程式端已做的事**

- `callAI` 在建立 trace 時，會依 `HUMAN_REVIEW_CONFIG` 寫入：
  - `metadata.human_review`：包含建議評哪幾個 score、review_notes 指引。
  - 若 `human_review: true`，會自動加上 `needs-human-review` tag。

**你可以怎麼使用？**

1. 在 Langfuse 建立 Saved Filter：
   - 條件：`name = InvestmentAdvice` 且 `tag = needs-human-review`。
2. 每週挑固定時間（例如週末）：
   - 從這個 filter 中抽 5–10 筆 trace 進行人工評分。
   - 依 `review_notes`（在 metadata 內）逐項檢查 Actionability / Tone / Context / Thinking_Depth 等維度。
3. 將人工分數寫回 Langfuse：
   - 在 Scores 區塊手動新增或編輯各項 Human 類分數。
4. 若發現 LLM Judge 與人工分數長期偏差：
   - 回頭優化 `llmJudge.mjs` 對應的 Judge Prompt，使自動評分更貼近你的標準。

---

## 10. 建議的日常使用節奏

1. **日常監控**：
   - 間隔 2–3 天，開 Langfuse Dashboard 看上述幾個核心 score 的趨勢線。
   - 若某項 score 急速惡化（例如 Actionability、Format_Compliance、Thinking_Depth），優先檢查最近是否對 Prompt 或模型做過改動。

2. **每週人工 QA**：
   - 從 `needs-human-review` + `InvestmentAdvice` 裡抽樣，針對 Context_Alignment、Actionability、Tone 給人工分數。

3. **Prompt 大改前後**：
   - 將這份 checklist 當成 release checklist：改前記錄一組 baseline，改後一週再對照一次。
   - 若改動沒有帶來明顯改善，或造成其他分數下降，可以考慮部分 rollback 或微調。

---

## 11. 小結

這份 checklist 的目標不是「一次就把 Investment Coach 調到完美」，而是：

- 幫你把「直覺 QA」變成「可重複的流程」。
- 把 Langfuse 裡的 trace + scores 變成你調 Prompt 的儀表板，而不只是 log viewer。

後續如果你新增新的欄位（例如更多風險分類、心理狀態標籤），可以比照本文件的結構，為這些欄位設計對應的 Rule / Human / LLM score，持續演進這套教練系統。
