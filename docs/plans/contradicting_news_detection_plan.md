# 矛盾新聞偵測與處理計畫

> **狀態：🔄 進行中**  
> **建立日期**：2026-04-08  
> **影響管線**：`filterAndCategorizeAllNewsWithAI` → `analyzeMacroNewsWithAI` → `getAiInvestmentAdvice`

---

## 1. 計畫概述

### 問題定義

目前 AI 管線在處理新聞時，對「同一事件的正反面報導」缺乏辨識能力。以近期以伊衝突為例：

- **A**（較早）：伊朗與美國傳出正在和談中 → 偏多
- **B**（較晚）：伊朗拒絕和談，重申封鎖海峽 → 偏空

發生順序為 A → B，但 AI 在沒有任何矛盾標記的情況下，可能同時把 A 和 B 視為獨立的多空訊號，導致：
1. A（過時資訊）被誤判為多頭訊號，拉高 `bull_score`
2. B（最新立場）雖然也進入分析，但對 A 的影響並未被抵消
3. `macroMarketDirection` 計算結果出現虛假的「多空各半」，掩蓋實際偏空的立場

### 核心目標

讓 AI 能在多空分析中正確辨識「事件已被更新報導覆蓋」，而非把 A 和 B 視為兩個獨立的多空訊號。具體目標：

- 偵測同一事件中方向相反的報導組合
- 時序較新者作為「最新立場」保留，時序較舊者降級為背景參考
- 若時序無法確定，將事件歸入 `neutral_events` 並標注「建議觀望」
- 提供 Langfuse 可觀測指標，量化矛盾事件偵測頻率

### 設計原則

- **不修改 `newsPoolManager` 的存儲邏輯**：矛盾偵測完全在送入 AI 的 Prompt 層與前置 JS 層處理
- **降級安全**：偵測失敗（JS grouping 出錯或 AI 未回傳矛盾標記）不阻斷主流程
- **最小侵入性**：新增欄位與邏輯，不改變現有 schema 的其他部分
- **可觀測性優先**：每次執行留下 Langfuse score，方便後續評估效果與誤判率

---

## 2. 📁 影響範圍

| 檔案 | 函式 / 欄位 | 修改方向 |
|---|---|---|
| `src/modules/ai/prompts.mjs` | `NEWS_FILTER_SYSTEM_PROMPT` | Step 1 加入矛盾事件偵測指令；Step 3 改為時序優先排除規則 |
| `src/modules/ai/prompts.mjs` | `FILTERED_NEWS_SCHEMA → think.event_inventory` | 新增 `has_conflict: boolean`、`conflict_note: string`、`conflict_winner_id: string` 三個欄位 |
| `src/modules/ai/prompts.mjs` | `MACRO_ANALYSIS_SYSTEM_PROMPT` | 新增 `<Contradiction_Handling>` 章節，說明矛盾事件的評分策略 |
| `src/modules/ai/prompts.mjs` | `MACRO_ANALYSIS_SCHEMA → neutral_events` | 補強 `reason` 描述規範，矛盾事件應附說明 |
| `src/modules/ai/aiCoach.mjs` | `filterAndCategorizeAllNewsWithAI` | 讀取矛盾標記，組裝 `conflictSummary`，傳遞給下一層 |
| `src/modules/ai/aiCoach.mjs` | `analyzeMacroNewsWithAI` | 接收 `conflictSummary` 作為前置注解，注入 user prompt |
| `src/modules/ai/aiCoach.mjs` | `filterAndCategorizeAllNewsWithAI` | 新增 Langfuse `Contradiction_Count` score |
| `src/modules/news/newsPoolManager.mjs` 或呼叫端 | `buildNewsUserPrompt` 前置 | 新增 Step 0 JS fuzzy grouping，在 `newsListText` 加入群組標籤 |

---

## 3. ⚙️ 實作步驟（Step-by-Step）

### Step 0：JS 輕量 Fuzzy Grouping（前置標籤）

在 `buildNewsUserPrompt`（或其呼叫端）組裝 `newsListText` 之前，對 `selectedNews` 進行一輪輕量的「疑似同事件」群組標籤。

**目的**：給 AI 一個前置提示，讓它知道哪些新聞「疑似來自同一事件」，提升 AI 矛盾偵測的準確率。  
**特性**：純 JS 字串比對，不呼叫 AI，不影響效能，即使全部標 `no_group` 也不影響 AI 的最終判斷。

#### 演算法設計

```js
// src/modules/news/newsConflictGrouper.mjs（新增工具模組）

/**
 * 使用 Jaccard 相似度對新聞標題做輕量分群
 * 相似度閾值 0.25（可調整），輸出群組 ID 供 AI 參考
 */
export function assignConflictGroups(newsList) {
  // Step 1: 標題正規化 - 去除數字、機構名、標點，提取主詞片段
  const normalize = (title) =>
    title
      .toLowerCase()
      .replace(/[\d\s\-–—:：「」《》【】（）(),.，。！？!?]/g, ' ')
      .replace(/\b(reuters|bloomberg|afp|cnn|bbc|ap|nyt|ft|wsj)\b/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1);

  // Step 2: Jaccard 相似度計算
  const jaccard = (setA, setB) => {
    const a = new Set(setA);
    const b = new Set(setB);
    const intersection = [...a].filter(x => b.has(x)).length;
    const union = new Set([...a, ...b]).size;
    return union === 0 ? 0 : intersection / union;
  };

  const THRESHOLD = 0.25;
  const tokenized = newsList.map(n => normalize(n.title || ''));
  const groupIds = new Array(newsList.length).fill(null);
  let groupCounter = 1;

  // Step 3: 簡單貪婪分群 - O(n²) 對 60 篇新聞 < 1ms
  for (let i = 0; i < tokenized.length; i++) {
    if (groupIds[i] !== null) continue;
    let foundGroup = null;

    for (let j = 0; j < i; j++) {
      if (jaccard(tokenized[i], tokenized[j]) >= THRESHOLD) {
        foundGroup = groupIds[j];
        break;
      }
    }

    if (foundGroup !== null) {
      groupIds[i] = foundGroup;
    } else {
      // 看看後面有沒有跟我相似的（至少要有一個才成群）
      let hasPair = false;
      for (let k = i + 1; k < tokenized.length; k++) {
        if (jaccard(tokenized[i], tokenized[k]) >= THRESHOLD) {
          hasPair = true;
          break;
        }
      }
      groupIds[i] = hasPair ? `G${groupCounter++}` : 'no_group';
    }
  }

  // Step 4: 將群組標籤注入 newsListText 的每一行
  return newsList.map((news, idx) => ({
    ...news,
    _conflictGroup: groupIds[idx],
  }));
}
```

#### 整合到 newsListText 組裝

```js
// 在 buildNewsUserPrompt 呼叫前
import { assignConflictGroups } from '../news/newsConflictGrouper.mjs';

const taggedNews = assignConflictGroups(selectedNews);

// 組裝時在每行加上群組標籤
const newsListText = taggedNews
  .map((n, i) =>
    `[${i + 1}][${n._conflictGroup}] ${n.pubDate} | ${n.source} | ${n.title}`
  )
  .join('\n');
```

**輸出範例**：
```
[1][G1] 2026-04-07T08:00Z | Reuters | 伊朗與美國傳出正在和談中
[2][G1] 2026-04-07T14:30Z | AFP | 伊朗拒絕和談，重申封鎖海峽
[3][no_group] 2026-04-07T09:00Z | Bloomberg | 聯準會官員暗示暫停升息
```

AI 看到 `[G1]` 標籤時，即可知道 `[1]` 和 `[2]` 是同一事件的不同報導，提升矛盾偵測準確率。

---

### Step 1：更新 `NEWS_FILTER_SYSTEM_PROMPT`

在 `<Thinking_Process>` 的 Step 1「事件盤點」中，加入矛盾偵測指令：

```
【新增指令 - 矛盾事件偵測】
若新聞清單中，帶有相同群組標籤（例如 [G1]）的兩則新聞，
其內容方向相反（例如：A=和談進行中 vs B=拒絕和談），請在 event_inventory 中標記：
  - has_conflict: true
  - conflict_note: 簡述矛盾點及哪則較新（50字內），例如「和談 vs 拒談，[2] pubDate 較新代表最新立場」
  - conflict_winner_id: 較新那則的編號，例如 "2"

即使沒有相同群組標籤，若你判斷兩則新聞明顯描述同一事件且方向相反，也請同樣標記。
```

在 Step 3「排除規則」補一條時序優先原則：

```
【新增 - 時序優先原則】
若矛盾事件中的兩則新聞只能保留一則（同一事件僅保留代表性報導），
請保留 pubDate 較新者；較舊者標記為 excluded，reason 填 "outdated_by_newer"。
若兩則 pubDate 相差不足 2 小時（難以判斷時序先後），兩則皆保留，
並在 event_inventory 標記 has_conflict: true、conflict_note 說明「時序接近，建議觀望」。
```

---

### Step 2：更新 `FILTERED_NEWS_SCHEMA`

在 `think.event_inventory.items` 的每個事件物件中，新增三個欄位：

```js
// 在現有欄位後新增
has_conflict: {
  type: Type.BOOLEAN,
  description: "此事件是否有方向相反的矛盾報導（例如：一則偏多、一則偏空）",
  nullable: true,
},
conflict_note: {
  type: Type.STRING,
  description: "若 has_conflict=true，說明矛盾點及哪則代表最新立場（50字內）",
  nullable: true,
},
conflict_winner_id: {
  type: Type.STRING,
  description: "若 has_conflict=true，代表最新立場的新聞編號（對應輸入清單的 [N]）",
  nullable: true,
},
```

> 三個欄位均設 `nullable: true`，確保非矛盾事件不需填寫，不增加 token 負擔。

---

### Step 3：更新 `MACRO_ANALYSIS_SYSTEM_PROMPT`

在 `<Analysis_Framework>` 後新增 `<Contradiction_Handling>` 章節：

```
<Contradiction_Handling>
若 <News_Context> 中包含前置注解 [⚠️ 矛盾新聞偵測]，請依以下規則處理：

1. **時序明確者**：以 pubDate 最新的報導為準，作為此事件的實際立場進行評分。
   較舊的報導納入背景參考，不作為獨立評分事件，不重複計入 bull_events 或 bear_events。

2. **時序接近或不明者**（前置注解標記「建議觀望」）：
   將此事件歸入 neutral_events，reason 欄位說明：
   「矛盾報導，時序接近，建議觀望（[事件名稱]：[矛盾摘要]）」
   不強制選邊站，避免誤導多空評分。

3. **無前置注解**：若你在分析過程中自行識別出矛盾報導，同樣依上述規則處理，
   並在 `conclusion.short_summary` 中提及「本次分析存在矛盾事件，已依時序處理」。
</Contradiction_Handling>
```

---

### Step 4：更新 `aiCoach.mjs` 串接邏輯

#### 4-A：`filterAndCategorizeAllNewsWithAI` 讀取矛盾標記

```js
// 在 aiResult 解析後、return 之前
const conflictEvents = (aiResult?.think?.event_inventory ?? [])
  .filter(e => e.has_conflict === true);

let conflictSummary = '';
if (conflictEvents.length > 0) {
  const lines = conflictEvents.map(
    e => `⚠️ [矛盾] ${e.event_name}：${e.conflict_note ?? '矛盾報導，建議觀望'}`
  );
  conflictSummary = lines.join('\n');
  console.log('[矛盾新聞偵測]\n' + conflictSummary);
}

// 將 conflictSummary 加入 return 物件，供下一步使用
return {
  ...existingReturnFields,
  conflictSummary,
};
```

#### 4-B：`analyzeMacroNewsWithAI` 注入矛盾前置注解

```js
// 在組裝 user prompt 時，若 conflictSummary 非空，在新聞清單前加入前置注解
const conflictHeader = conflictSummary
  ? `[⚠️ 矛盾新聞偵測 - 請依 Contradiction_Handling 規則處理以下事件]\n${conflictSummary}\n\n`
  : '';

const userPrompt = `${conflictHeader}<News_Context>\n${newsListText}\n</News_Context>`;
```

---

### Step 5：Langfuse `Contradiction_Count` Score 整合

在 `filterAndCategorizeAllNewsWithAI` 的現有 `safeLangfuseScore` 呼叫中，新增 `Contradiction_Count` 分數：

```js
// 現有 score 呼叫後補一行
await safeLangfuseScore(traceId, 'Contradiction_Count', conflictEvents.length, {
  comment: conflictEvents.length > 0
    ? conflictEvents.map(e => e.event_name).join(', ')
    : 'no conflicts detected',
});
```

**Langfuse Dashboard 用途**：
- 追蹤每次 `runDailyCheck` 偵測到幾組矛盾事件
- 長期觀察問題頻率（平均每天偵測到幾組）
- 評估 Step 0 JS grouping 的提示效益（對比有無 grouping 標籤的偵測率）
- 若 `Contradiction_Count` 持續為 0，代表 Prompt 或 Grouping 可能需要調整

---

## 4. ⚠️ 潛在挑戰與防禦機制

| 挑戰 | 防禦策略 |
|---|---|
| AI 誤判「觀點不同」為「矛盾」（例如：樂觀分析 vs 悲觀分析） | `conflict_note` 要求 AI 說明矛盾點；透過 Langfuse 長期觀察誤判率，必要時調整 Threshold 或 Prompt 措辭 |
| 兩則矛盾新聞 pubDate 差距僅幾分鐘（時序難以判定） | 歸入 `neutral_events`，標注「建議觀望」，不強制選邊 |
| JS fuzzy grouping 誤將不相關新聞歸為同組 | `[G_]` 標籤僅為「AI 參考提示」，AI 仍有最終判斷權；誤分群不會強制 AI 判定為矛盾 |
| `has_conflict` 欄位增加 token 消耗 | 三個欄位均 `nullable`，非矛盾事件 AI 回傳 `null`，預估每次增加 ~150–200 token，可接受 |
| Langfuse score 呼叫失敗（`safeLangfuseScore` 本身已有 try/catch） | 不影響主流程，僅記錄 warning log |
| 舊版 Langfuse Prompt（線上版）未同步更新 | 計畫完成後需手動在 Langfuse → Prompts 同步更新 `FilterAndCategorizeNews` 的 system prompt |

---

## 5. 🔁 資料流設計

```
新聞池（newsPoolManager）
  ↓ loadPoolWithFallback()
  ↓ selectNewsForAi()（依 age_band 優先）
  ↓ selectedNews[]（原始新聞清單）

[Step 0 - 新增] JS Fuzzy Grouping（newsConflictGrouper.mjs）
  → assignConflictGroups(selectedNews)
  → 輸出帶有 _conflictGroup 標籤的 taggedNews[]
  → 組裝 newsListText 時加入 [G_] 或 [no_group] 標籤
  → 耗時 < 1ms（60 篇新聞 O(n²) Jaccard）

filterAndCategorizeAllNewsWithAI（AI Step 1）
  → NEWS_FILTER_SYSTEM_PROMPT（更新版：加入矛盾偵測指令 + 時序優先排除）
  → FILTERED_NEWS_SCHEMA（新增 has_conflict / conflict_note / conflict_winner_id）
  → 回傳：
      - news[]（保留最新立場，過時者 excluded）
      - think.event_inventory[]（含矛盾標記）

[新增] conflictSummary 組裝
  → 讀取 think.event_inventory.filter(e => e.has_conflict)
  → 組裝前置注解字串（每行一個矛盾事件）
  → console.log 輸出
  → Langfuse Contradiction_Count score
  → 傳遞給 analyzeMacroNewsWithAI

analyzeMacroNewsWithAI（AI Step 2）
  → MACRO_ANALYSIS_SYSTEM_PROMPT（新增 <Contradiction_Handling>）
  → user prompt 前置注入 conflictSummary（若有）
  → 矛盾事件（時序明確）→ 以最新報導評分，舊報導不計
  → 矛盾事件（時序接近）→ 歸入 neutral_events，標注「建議觀望」
  → 非矛盾事件 → 正常 bull/bear 評分

getAiInvestmentAdvice（AI Step 3）
  → 輸入不變
  → 但 macroTextForCoach 已正確處理矛盾事件，Coach 不會誤接收矛盾訊號
```

---

## 6. 完成後需更新的文件

| 文件 | 更新內容 |
|---|---|
| `docs/architecture.md` | 在 AI Pipeline 說明中補「矛盾偵測層（Contradiction Detection）：Step 0 JS Grouping + AI Schema 標記」 |
| `docs/modules/entry_and_notifications.md` | 在新聞過濾層說明補一行「支援矛盾事件偵測（Jaccard 預分群 + AI 標記 + Langfuse 追蹤）」 |
| `docs/plans/preplan_features.md` | 確認狀態已標記 🔄 進行中（✅ 已完成） |

---

## 7. 驗收 Checklist

- [ ] `newsConflictGrouper.mjs` 建立，單元測試通過（以伊衝突測試案例）
- [ ] 測試案例：A（和談）+ B（拒談）→ `[G1]` 標籤正確分配
- [ ] `FILTERED_NEWS_SCHEMA` 新欄位不破壞現有 JSON parse
- [ ] 以本地測試資料執行 `filterAndCategorizeAllNewsWithAI`，確認 `has_conflict: true` 正確回傳
- [ ] `conflictSummary` 正確輸出到 console
- [ ] `analyzeMacroNewsWithAI` 收到 `conflictSummary` 後，矛盾事件正確歸入 `neutral_events`
- [ ] Langfuse 中 `Contradiction_Count` score 出現於對應 trace
- [ ] 原有多空評分邏輯在無矛盾事件時行為不變（regression 測試）
- [ ] Langfuse 線上 Prompt 同步更新
