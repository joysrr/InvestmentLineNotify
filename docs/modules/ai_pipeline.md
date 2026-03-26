# AI 決策管線模組 (AI Pipeline) 架構說明

## 1. 模組職責
`src/modules/ai/` 作為系統的大腦，負責將上游（量化策略引擎、外部數據提供者與新聞收報機）所產出的龐大生資料，轉換為具備金融邏輯的純文字簡報，並透過調用 Google Gemini 模型推演最終的投資操作建議。
此模組不直接抓取原始資料，而是專注於「語意解析」、「多空加權運算」與「擬人化結果輸出」，最終產出乾淨的 Markdown 戰報供 Telegram 推播。

## 2. Agent 職責分配
系統的 AI 決策管線由四個專職的 Agent（角色）串聯而成，於 `aiCoach.mjs` 中依序被喚醒：
1. **新聞關鍵字產生器 (Search Queries Generator)**
   - **用途**：觀察當日的市場波動（如 VIX 指數或大盤位階），動態推演出當前市場最關注的潛在議題，並藉此產出專屬於台灣 (`twQueries`) 與華爾街 (`usQueries`) 的高價值搜尋關鍵字。
2. **雜訊過濾器 (News Filter)**
   - **用途**：扮演頂級量化經理人，負責從大量中英混合的原始新聞中淘金。主動剔除農場文、個股財報與無意義盤後總結，並強制進行「多維度覆蓋檢查（涵蓋總經、地緣政治、資金與半導體）」，最終合併重複報導並萃取出前 15 則最重大的新聞。
3. **總經多空分析師 (Macro Analyst)**
   - **用途**：運用「多重事件加權法 (Vector Weighting)」，針對剛過濾完的重大新聞分別給予 1-5 分的絕對影響力評分。統計並對決出當日的利多與利空總分，最後給出「BULL (多) / BEAR (空) / NEUTRAL (觀望)」的全局判定。
4. **戰報洞察教練 (Investment Coach)**
   - **用途**：管線流程的最後一關。教練會同時查閱：量化引擎風控數據、籌碼位階簡報、總經多空報告與核心新聞。接著嚴格遵循「上下文 + 具體動作 + 預期心態」的格式，給出具備溫度的紀律提醒、下單微調建議與避險警告。

## 3. Prompt Schema 與結構化輸出
### 強制結構化與思考空間設計 (Chain-of-Thought)
為確保 AI 輸出的穩定性與可程式化解析能力，系統全面利用 `@google/genai` 的 `responseSchema` 參數，強制 AI 回傳符合 `Type.OBJECT` 定義的 JSON 結構（詳見 `prompts.mjs`）。
- **隱藏思考區設計**：每個關鍵 Schema（如 `FILTERED_NEWS_SCHEMA` 或 `INVESTMENT_COACH_SCHEMA`）都刻意設計了 `think` 或 `coach_internal_thinking` 欄位，且不限字數。這強迫模型在填寫最終輕量化結論前，必須先在 JSON 的第一層進行完整的邏輯推演（例如盤點事件、自我確認多維度涵蓋），此舉大幅度降低了 AI 產生的幻覺 (Hallucination)。

### 分塊策略與 Token 節約機制
- **資料預處理降維**：`aiDataPreprocessor.mjs` 負責將龐大的陣列物件（如 CNN 指數、台股維持率、匯率波段變化）轉換成 AI 易讀且省 Token 的「條列式純文字簡報」。例如直接將維持率轉換為「極度安全」或「瀕臨斷頭臨界點」，省去 AI 自行閱讀原始數字並理解閾值的 Token 消耗。
- **過濾截斷**：在 `formatMacroAnalysisForCoach` 中，僅傳遞前三大加權分數的事件給最後一關的 Coach，避免底層雜訊干擾頂層決策並達到節約流量的效果。

## 4. 已知限制與防禦機制
- **API 輪詢與 Rate Limit 防護**：為應對 Google Gemini 高頻率調用的限流（429 RATE_LIMIT）或連線不穩（503），`aiClient.mjs` 實作了多金鑰輪詢陣列（`GEMINI_API_KEYS`，藉由傳入不同的 `keyIndex` 切換），同時導入 **Exponential Backoff + Jitter**（指數退避加上隨機延遲）機制作為重試保險絲。
- **Langfuse 軌跡追蹤**：全面整合 Langfuse 監控平台。每一通 Gemini 呼叫都被包裝為一組 Trace 與 Generation，能詳細記錄 Token 用量（包含獨立的 `thoughtsTokenCount` 思考成本）、重試次數與錯誤層級，以便日後回放除錯 AI 的幻覺。
- **JSON 解析防呆**：若 AI 因不明長度截斷未能回傳完整 JSON，程式會捕捉錯誤並提供預設的 Fallback（例如回傳「AI 無法分析今日新聞，請依原始新聞自行判斷」），確保系統的非同步排程不會因單一代理崩潰而全數中斷。
