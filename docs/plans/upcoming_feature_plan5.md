## 📌 【系統巡檢與測試類】任務 5：關鍵字搜尋良率計算（Keyword Yield Rate）

> **版本：** v1.1（含 Langfuse 整合細節）  
> **目標讀者：** AI Agent antigravity

---

### 🎯 功能目標

建立 Search Queries Generator 的量化指標，分別計算整體管線健康度與 AI 動態關鍵字品質，透過 Langfuse Score 追蹤趨勢，作為 Prompt 優化的數據依據。

**量化驗收標準：**

- `Keyword_Yield_Rate`（整體）每日寫入 Langfuse，無缺漏
- `Dynamic_Keyword_Yield_Rate`（AI 專屬）當動態關鍵字存在時必定寫入
- RSS 例外錯誤正確排除分母，不污染數據
- 連續 3 日 `Dynamic_Keyword_Yield_Rate` < 0.4 時觸發 `console.warn` 警告

---

### 📁 影響檔案

| 檔案 | 異動類型 | 說明 |
|---|---|---|
| `src/modules/ai/aiCoach.mjs` | **修改** | `callGemini` 回傳格式改為 `{ text, traceId }`（Breaking Change） |
| `src/modules/newsFetcher.mjs` | **修改** | 接收 `traceId`、計算良率、呼叫 `langfuse.score()` |
| **所有呼叫 `callGemini` 的檔案** | **修改** | 解構取值方式從 `const text` 改為 `const { text, traceId }` |

> ⚠️ `callGemini` 回傳格式變更為 Breaking Change，開發前需先清查所有呼叫點，統一修改後再實作良率邏輯，避免執行期錯誤。

---

### 📐 Score 定義

本任務實作以下兩個 Langfuse Score（均屬 Rule 類，由程式自動回寫）：

#### Keyword_Yield_Rate

| 欄位 | 值 |
|---|---|
| **Name** | `Keyword_Yield_Rate` |
| **Data Type** | `Numeric` |
| **Range** | `0 ~ 1` |
| **對象** | Search Queries Generator（靜態 + 動態全部） |
| **說明** | 整體管線健康度指標。計算所有 query（base + dynamic）過濾後 ≥ 1 篇新聞的比例。RSS 例外錯誤的 query 排除分母，不計入計算。`comment` 欄位需同時記錄 base 與 dynamic 各自的明細。 |

#### Dynamic_Keyword_Yield_Rate

| 欄位 | 值 |
|---|---|
| **Name** | `Dynamic_Keyword_Yield_Rate` |
| **Data Type** | `Numeric` |
| **Range** | `0 ~ 1` |
| **對象** | Search Queries Generator（AI 動態關鍵字專屬） |
| **說明** | AI Prompt 品質的主要監控指標。僅計算 AI 動態生成關鍵字的有效率，完全排除靜態 base 的影響，避免 base 的穩定數值稀釋 AI 表現的訊號。連續 3 日低於 0.4 需觸發警告。 |

**為何需要兩個 Score 而非合一：**

| 情境 | Base 良率 | Dynamic 良率 | 合併良率 | 問題 |
|---|---|---|---|---|
| AI 正常 | 94% | 88% | 93% | 正確反映 |
| AI 極差 | 94% | 13% | 80% | 看起來還好，實際 AI 已失效 |

Base 佔約 82% 分母，合併計算會完全掩蓋 AI 的品質訊號。

---

### ⚙️ Step 1：修改 callGemini 回傳格式（aiCoach.mjs）

`traceId` 需傳遞給 `newsFetcher.mjs` 才能呼叫 `langfuse.score()`。

```js
// aiCoach.mjs — callGemini 函式最後的 return 修改
// ❌ 原本
return text;

// ✅ 修改後
return { text, traceId: trace.id };
```

**所有呼叫 callGemini 的地方需同步更新：**

```js
// ❌ 原本
const result = await callGemini(promptName, userPrompt, options);

// ✅ 修改後
const { text: result, traceId } = await callGemini(promptName, userPrompt, options);

// 若原本直接使用回傳值（不需要 traceId 的呼叫點）
const { text: result } = await callGemini(promptName, userPrompt, options);
```

---

### ⚙️ Step 2：在 newsFetcher.mjs 建立計數器

在 `generateDailySearchQueries` 產出關鍵字後、批次呼叫 RSS 前，建立以下計數器：

```js
import { langfuse } from "./ai/aiCoach.mjs";

// 計數器初始化
const counter = {
  base: { total: 0, valid: 0 },       // 靜態 base 關鍵字
  dynamic: { total: 0, valid: 0 },    // AI 動態關鍵字
  excluded: 0,                         // RSS 例外錯誤排除數
};
```

**有效判定標準：** 經 `prepareNewsForAI` 過濾後 **≥ 1 篇**（不是 RSS 原始回傳數），因為這才真正反映關鍵字的有效性。

```
RSS 回傳 8 篇 → 黑名單過濾後剩 0 篇 → 此 Query 判定為「無效」
RSS 回傳 0 篇                        → 此 Query 判定為「無效」
RSS 拋出例外錯誤                      → 此 Query 排除分母（excluded++）
```

---

### ⚙️ Step 3：getRawNews 計數邏輯

在 `getRawNews` 批次處理每個 query 時，加入計數：

```js
for (const entry of allQueries) {
  const isBase = baseQuerySet.has(entry.keyword); // 判斷是靜態還是動態

  try {
    const rawItems = await fetchRssFeed(buildRssUrl(entry, excludes));
    const validItems = prepareNewsForAI(rawItems); // 過濾後的結果

    const isValid = validItems.length >= 1;

    if (isBase) {
      counter.base.total++;
      if (isValid) counter.base.valid++;
    } else {
      counter.dynamic.total++;
      if (isValid) counter.dynamic.valid++;
    }
  } catch (error) {
    // RSS 例外錯誤（rate limit、網路超時）：排除分母
    counter.excluded++;
    console.warn(`[YieldRate] Query excluded due to error: ${entry.keyword} — ${error.message}`);
  }
}
```

---

### ⚙️ Step 4：計算良率並寫入 Langfuse Score

```js
async function recordYieldRateScore(counter, traceId) {
  const totalAll  = counter.base.total + counter.dynamic.total;
  const validAll  = counter.base.valid + counter.dynamic.valid;

  // 若全部 query 均失敗（totalAll === 0），跳過打分，避免分母為零
  if (totalAll === 0) {
    console.warn("[YieldRate] All queries failed or excluded, skipping score.");
    return;
  }

  // Score 1：整體管線健康度
  await langfuse.score({
    traceId,
    name:    "Keyword_Yield_Rate",
    value:    validAll / totalAll,
    comment: `base: ${counter.base.valid}/${counter.base.total} | ` +
             `dynamic: ${counter.dynamic.valid}/${counter.dynamic.total} | ` +
             `excluded: ${counter.excluded}`,
  });

  // Score 2：AI 動態關鍵字品質（僅在有動態關鍵字時打分）
  if (counter.dynamic.total > 0) {
    await langfuse.score({
      traceId,
      name:    "Dynamic_Keyword_Yield_Rate",
      value:    counter.dynamic.valid / counter.dynamic.total,
      comment: `dynamic valid: ${counter.dynamic.valid} / total: ${counter.dynamic.total}`,
    });
  }
}
```

---

### ⚙️ Step 5：連續低良率警告機制

```js
// 維護最近 3 日的 Dynamic_Keyword_Yield_Rate 歷史紀錄
// 使用輕量 in-memory 陣列，不需額外儲存

const recentDynamicYields = []; // 最多保留 3 筆
const DYNAMIC_YIELD_WARN_THRESHOLD  = 0.4;
const DYNAMIC_YIELD_WARN_DAYS       = 3;

function checkYieldRateAlert(dynamicYield) {
  recentDynamicYields.push(dynamicYield);
  if (recentDynamicYields.length > DYNAMIC_YIELD_WARN_DAYS) {
    recentDynamicYields.shift(); // 保持最近 3 筆
  }

  if (
    recentDynamicYields.length === DYNAMIC_YIELD_WARN_DAYS &&
    recentDynamicYields.every(v => v < DYNAMIC_YIELD_WARN_THRESHOLD)
  ) {
    console.warn(
      `[YieldRate] ⚠️ Dynamic_Keyword_Yield_Rate 連續 ${DYNAMIC_YIELD_WARN_DAYS} 日低於 ` +
      `${DYNAMIC_YIELD_WARN_THRESHOLD}，請檢查 Search Queries Generator Prompt 品質。` +
      `
最近紀錄：${recentDynamicYields.map(v => (v * 100).toFixed(1) + "%").join(" → ")}`
    );
  }
}
```

---

### 🔁 完整資料流

```
generateDailySearchQueries（AI）
  回傳：{ text: KeywordEntry[], traceId }
  ↓
mergeKeywords（base ∪ dynamic）
  標記每個 entry 的來源：isBase = true / false
  ↓
buildRssUrl（含 excludeKeywords）
  批次呼叫 Google News RSS，每批 5 組，間隔 300ms
  ↓
每個 Query 結果判定：
  成功 + 過濾後 ≥ 1 篇 → valid++（對應 base 或 dynamic）
  成功 + 過濾後 = 0 篇 → total++ 但 valid 不加
  拋出例外               → excluded++（排除分母）
  ↓
recordYieldRateScore(counter, traceId)
  totalAll === 0 → 跳過打分
  totalAll > 0   → 寫入 Keyword_Yield_Rate
  dynamic.total > 0 → 額外寫入 Dynamic_Keyword_Yield_Rate
  ↓
checkYieldRateAlert(dynamicYield)
  連續 3 日 < 0.4 → console.warn 觸發警告
  ↓
Langfuse Dashboard 即時可見趨勢圖
```

---

### 📝 開發注意事項（給 antigravity）

1. **`callGemini` 的 Breaking Change 必須優先處理**，建議開發前先用全域搜尋找出所有 `await callGemini(` 的呼叫點，逐一確認是否需要 `traceId`，統一改完再開始實作計數邏輯。

2. **`traceId` 來自 `generateDailySearchQueries` 的呼叫**，不是 `getRawNews` 本身的 trace，語意上代表「這批關鍵字是這次 AI 決策產生的，其良率就是這次決策的品質評分」。

3. **`langfuse` 已在 `aiCoach.mjs` 以 singleton export**，`newsFetcher.mjs` 直接 import 即可，不需重新初始化。

4. **`isBase` 判斷建議用 `Set` 預先建立**，避免每個 query 都做陣列遍歷：
   ```js
   const baseQuerySet = new Set([
     ...baseTwQueries.map(e => e.keyword),
     ...baseUsQueries.map(e => e.keyword),
   ]);
   ```

5. **`recentDynamicYields` 為 in-memory 陣列**，服務重啟後歸零屬預期行為，不需持久化。若要跨日追蹤可改寫入 `logs/yieldRateHistory.json`，但非必要。

6. **`langfuse.score()` 為非同步呼叫**，使用 `await` 確保寫入完成後再繼續，避免程序結束前 Langfuse SDK 尚未 flush。
