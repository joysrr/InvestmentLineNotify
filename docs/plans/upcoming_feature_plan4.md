## 📌 【AI 管線優化類】任務 4：新聞過濾機制優化（Self-Healing 黑名單）

> **版本：** v1.3（整合任務 3 實作確認結果）  
> **目標讀者：** AI Agent antigravity  
> **前置條件：** 任務 3 已完成，以下項目必須就緒：
> - `src/config/blacklist.json` 已建立（seed 初始化完畢，`titlePatterns` 陣列中每筆含 `pattern`、`flags`、`addedBy`、`addedAt` 欄位）
> - `src/config/keywordConfig.mjs` 已實作 `loadBlacklist()`
> - `src/modules/data/archiveManager.mjs` 已實作 `saveNewsLog()`，每日由 `newsFetcher.mjs` 自動產生：
>   - `data/news_logs/passedArticles_TW_YYYY-MM-DD.json`
>   - `data/news_logs/passedArticles_US_YYYY-MM-DD.json`

---

### 🎯 功能目標

打造具備「自我進化能力（Self-Healing）」的新聞濾網機制。系統每日自動審查昨日放行的新聞，揪出漏網農場文，生成新 Regex 規則並通過沙盒驗證後寫入 `blacklist.json`，隔日透過 `loadBlacklist()` 自動生效。

**量化驗收標準：**

- AI 產出規則通過 Sandbox 驗證率 ≥ 80%（低於代表 Prompt 需調整）
- 黃金清單誤殺率 = **0%**（硬性條件，絕對不可破）
- `blacklist.json` 規則總數增長速度 < 5 條/週（過快代表 AI 品質不穩）

---

### 📁 影響檔案

| 檔案 | 異動類型 | 說明 |
|---|---|---|
| `src/config/blacklist.json` | 修改（持續 append） | 任務 3 建立，任務 4 負責 AI 動態寫入 |
| `src/config/goldenDataset.json` | **新增** | 黃金標準新聞清單（人工維護，AI 不可寫入） |
| `src/modules/ai/prompts.mjs` | 修改 | 新增 `RULE_OPTIMIZER_SCHEMA` |
| `src/modules/ai/ruleOptimizerAgent.mjs` | **新增** | Self-Healing AI Agent |
| `src/runOptimizer.mjs` | **新增** | 獨立排程入口（不影響既有 runDailyCheck.mjs） |
| `scripts/rollbackOptimizer.mjs` | **新增** | 緊急回滾工具 |
| `.github/workflows/daily-report.yml` | 修改 | 新增 02:00 台灣時間（UTC 18:00）排程 |

> `keywordConfig.mjs`、`newsFetcher.mjs`、`runDailyCheck.mjs` 由任務 3 完成，任務 4 **不需修改**，直接受益於 `loadBlacklist()` 每次重新讀取 `blacklist.json` 的機制。

---

### 📋 Step 1：建立 goldenDataset.json（人工維護）

黃金清單為沙盒驗證的核心防線。**AI Agent 不得有任何寫入權限**，建議在程式碼層面限制 `ruleOptimizerAgent.mjs` 的 fs 寫入範圍僅限 `blacklist.json`。

建議至少 **30 筆**，涵蓋台股與美股所有核心事件類型：

```json
[
  { "title": "Fed raises interest rates by 25bps in March FOMC meeting",     "source": "Reuters" },
  { "title": "台積電法說會：Q2 營收指引優於預期，外資大幅買超",                "source": "經濟日報" },
  { "title": "CPI data shows inflation cooling, S&P 500 rallies",            "source": "Bloomberg" },
  { "title": "FOMC minutes: Powell signals patience on rate cuts",           "source": "WSJ" },
  { "title": "台股大盤收漲 1.5%，三大法人合計買超 200 億",                    "source": "工商時報" },
  { "title": "Treasury yields surge as jobless claims beat expectations",    "source": "Reuters" },
  { "title": "台積電 ADR 夜盤上漲 3%，外資連續買超",                          "source": "MoneyDJ" },
  { "title": "PCE inflation data release: Fed preferred gauge rises",        "source": "Bloomberg" },
  { "title": "景氣燈號轉黃紅燈，PMI 連三月擴張",                              "source": "中央社" },
  { "title": "ISM manufacturing index beats forecast, dollar index rises",   "source": "MarketWatch" },
  { "title": "外銷訂單年增 8%，半導體接單創新高",                              "source": "工商時報" },
  { "title": "Fed balance sheet reduction accelerates in Q3",                "source": "FT" },
  { "title": "央行理監事會議維持利率不變，新台幣走強",                          "source": "中央社" },
  { "title": "GDP growth beats estimates as consumer spending holds up",     "source": "Bloomberg" },
  { "title": "Nasdaq enters correction territory on recession fears",        "source": "Reuters" }
]
```

---

### 🧠 Step 2：ruleOptimizerAgent.mjs（Self-Healing AI Agent）

#### 輸入來源

讀取昨日由 `newsFetcher.mjs` 產生的兩份 passedArticles 日誌（TW 與 US 分開處理）：

```js
// 取得昨日台灣時間日期字串
function getYesterdayTwDateStr() {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" }).replace(/\//g, "-");
}

// 讀取路徑（分 TW / US 兩檔）
// data/news_logs/passedArticles_TW_YYYY-MM-DD.json
// data/news_logs/passedArticles_US_YYYY-MM-DD.json
```

#### Prompt 規格

**輸出限制（寫入 Prompt）：**

- 輸出格式：JSON array，每個元素為 `{ "pattern": "...", "flags": "i", "reason": "..." }`
- 最多輸出 **5 條**新規則
- 禁止使用過廣泛的通配符作為規則主體：`.*` / `.+` / `\\w+` / `\\d+`（需有具體語意錨點）
- 禁止輸出與現有規則重複的 pattern
- 每條規則需附上 `"reason"`（說明針對哪類農場文）

#### AI 輸出範例格式

```json
[
  {
    "pattern": "\\d+ (stocks?|ETF).{0,20}(to buy|to watch|to own)",
    "flags": "i",
    "reason": "個股推薦農場文特徵：數字+股票+行動詞組合"
  },
  {
    "pattern": "最強.{0,5}(概念股|飆股).{0,10}(布局|卡位|搶先)",
    "flags": "",
    "reason": "中文農場 SEO 特徵標題"
  }
]
```

#### prompts.mjs 新增 RULE_OPTIMIZER_SCHEMA

```js
// 新增至 prompts.mjs
export const RULE_OPTIMIZER_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      pattern: { type: "string" },
      flags:   { type: "string" },
      reason:  { type: "string" },
    },
    required: ["pattern", "flags", "reason"],
  },
  maxItems: 5,
};
```

#### AI 呼叫方式（沿用 aiCoach.mjs 慣例）

```js
import { callGemini } from "./aiClient.mjs";
import { RULE_OPTIMIZER_SCHEMA } from "./prompts.mjs";

const sessionId = process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_WORKFLOW}-${process.env.GITHUB_RUN_ID}`
  : `optimizer-local-${Date.now()}`;

async function callOptimizerAI(articleTitles, region) {
  const userPrompt = buildOptimizerPrompt(articleTitles, region);
  try {
    const rawJson = await callGemini("RuleOptimizer", userPrompt, {
      sessionId,
      keyIndex: 2, // 避免與 newsFetcher (0,1) 碰撞
      responseSchema: RULE_OPTIMIZER_SCHEMA,
    });
    return JSON.parse(rawJson); // callGemini 回傳字串，需自行 parse
  } catch (err) {
    console.warn(`[Optimizer] AI 呼叫失敗 (${region}):`, err.message);
    return [];
  }
}
```

---

### 🛡️ Step 3：Sandbox 沙盒驗證（四關卡）

> **關卡執行順序說明：** 依照「成本由低到高」排列——先做純字串比對（便宜），最後才做黃金清單碰撞（最貴）。

#### 關卡 1：語法合法性

```js
function isValidRegex(pattern, flags) {
  try { new RegExp(pattern, flags); return true; }
  catch { return false; }
}
```

#### 關卡 2：廣泛度防護

```js
const OVERBROAD_PATTERNS = [/^\.\*/, /^\.\+/, /^\\w\+/, /^\\d\+/, /^\.\{/];

function isOverbroad(pattern) {
  return OVERBROAD_PATTERNS.some(p => p.test(pattern.trim()));
}
```

#### 關卡 3：重複規則檢查

```js
// ⚠️ 必須傳入 raw JSON 的 titlePatterns 陣列（非 loadBlacklist() 回傳的 RegExp[]）
// 正確做法：直接讀取 blacklist.json 取得 { pattern, flags, addedBy } 原始物件
function isDuplicate(newPattern, existingPatterns) {
  return existingPatterns.some(e => e.pattern === newPattern);
}
```

#### 關卡 4：黃金清單碰撞測試（硬性防線）

```js
import goldenDataset from "../config/goldenDataset.json" assert { type: "json" };

function passesGoldenTest(newRegex) {
  // 新規則不得誤殺任何黃金清單中的標題
  return !goldenDataset.some(item => newRegex.test(item.title));
}
```

#### 完整驗證主流程

```js
// ⚠️ blacklist 參數必須是 fs.readFileSync 讀取的 raw JSON 物件
//    不可使用 loadBlacklist()（該函式已將 titlePatterns 轉為 RegExp 物件，無法比對 .pattern 字串）
function validateAndAppend(aiRules, blacklist) {
  const accepted = [];
  const rejected = [];

  for (const rule of aiRules) {
    // 關卡 1：語法合法性
    if (!isValidRegex(rule.pattern, rule.flags)) {
      rejected.push({ ...rule, rejectReason: "invalid_regex" }); continue;
    }
    // 關卡 2：廣泛度防護
    if (isOverbroad(rule.pattern)) {
      rejected.push({ ...rule, rejectReason: "overbroad" }); continue;
    }
    // 關卡 3：重複規則（先做，成本較低）
    if (isDuplicate(rule.pattern, blacklist.titlePatterns)) {
      rejected.push({ ...rule, rejectReason: "duplicate" }); continue;
    }
    // 關卡 4：黃金清單碰撞（最後做，成本最高）
    const regex = new RegExp(rule.pattern, rule.flags);
    if (!passesGoldenTest(regex)) {
      rejected.push({ ...rule, rejectReason: "golden_dataset_kill" }); continue;
    }
    accepted.push({
      pattern: rule.pattern,
      flags:   rule.flags,
      addedBy: "optimizer",
      addedAt: new Date().toISOString().slice(0, 10),
      reason:  rule.reason,
    });
  }
  return { accepted, rejected };
}
```

---

### 📅 Step 4：獨立排程入口（runOptimizer.mjs）

> **為何獨立設檔，不修改 runDailyCheck.mjs？**  
> `runDailyCheck.mjs` 是面向使用者的即時通知流程，Optimizer 是凌晨維護工作，性質完全不同。  
> 排程邏輯全由 GitHub Actions yml 管理，兩者分開才能獨立控制執行頻率與失敗隔離。

#### runOptimizer.mjs

```js
import { runRuleOptimizer } from "./src/modules/ai/ruleOptimizerAgent.mjs";
import { archiveManager } from "./src/modules/data/archiveManager.mjs";

async function main() {
  console.log("[Optimizer] Starting daily blacklist optimization...");
  
  try {
    const result = await runRuleOptimizer();
    console.log(
      `[Optimizer] TW — Accepted: ${result.tw.accepted.length}, Rejected: ${result.tw.rejected.length}`
    );
    console.log(
      `[Optimizer] US — Accepted: ${result.us.accepted.length}, Rejected: ${result.us.rejected.length}`
    );

    // 寫入 AI 飛行紀錄器（供品質追蹤）
    await archiveManager.saveAiLog({
      type: "RuleOptimizer",
      rawResult: result,
    });
  } catch (err) {
    console.error("[Optimizer] 執行失敗，不影響主要新聞流程:", err.message);
    process.exit(1);
  }
}

main();
```

#### GitHub Actions yml 新增排程

```yaml
# 在現有 on.schedule 區塊新增一條：
# 台灣 02:00 -> UTC 18:00 (Self-Healing 黑名單優化)
- cron: "0 18 * * *"
```

新增對應的 job（或在現有 job 加入條件判斷），執行 `node runOptimizer.mjs`。

---

### 🔄 Step 5：緊急回滾工具（rollbackOptimizer.mjs）

```js
// 用法：node scripts/rollbackOptimizer.mjs --date 2026-03-29
// 效果：移除該日 AI 新增的所有規則，不影響 addedBy: "seed" 的人工規則

import { readFileSync, writeFileSync } from "fs";

const targetDate = process.argv;[1]
if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
  console.error("用法：node scripts/rollbackOptimizer.mjs --date YYYY-MM-DD");
  process.exit(1);
}

const filePath = "src/config/blacklist.json";
const data     = JSON.parse(readFileSync(filePath, "utf-8"));

const before = data.titlePatterns.length;
data.titlePatterns = data.titlePatterns.filter(
  r => !(r.addedBy === "optimizer" && r.addedAt === targetDate)
);

data.lastUpdated = new Date().toISOString();
writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
console.log(`[Rollback] Removed ${before - data.titlePatterns.length} rules added on ${targetDate}`);
```

---

### 🔁 完整資料流

```
每日台灣 02:00 觸發（GitHub Actions UTC 18:00）
node runOptimizer.mjs
  ↓ 讀取昨日 passedArticles 日誌（分 TW / US 兩檔）
  data/news_logs/passedArticles_TW_YYYY-MM-DD.json
  data/news_logs/passedArticles_US_YYYY-MM-DD.json
  ↓ 直接讀取 src/config/blacklist.json raw JSON（非 loadBlacklist()）
  ↓ ruleOptimizerAgent（AI 審查，TW / US 分別呼叫，keyIndex: 2）
callGemini("RuleOptimizer", prompt, { responseSchema: RULE_OPTIMIZER_SCHEMA })
JSON.parse(rawJson) → { pattern, flags, reason }[]（≤ 5 條）
  ↓ Sandbox 驗證（四關卡，依成本由低到高）
  關卡 1：isValidRegex — 語法合法？
  關卡 2：isOverbroad — 是否過於廣泛？
  關卡 3：isDuplicate — 是否重複現有規則？（字串比對 raw JSON）
  關卡 4：passesGoldenTest — 是否誤殺黃金新聞？（硬性條件）
  ↓ 全部通過 → append 進 blacklist.json（addedBy: "optimizer"）
  部分失敗 → rejected 原因記錄至 archiveManager.saveAiLog({ type: "RuleOptimizer" })
  ↓ Git Auto Commit（[skip ci]）將更新後的 blacklist.json 推上 repo
  ↓ 隔日 newsFetcher 啟動時 loadBlacklist() 自動讀取最新版本
  ↓ 更強的防護罩自動生效（零停機，無需重啟服務）
```

---

### 📝 開發注意事項

1. **任務 3 的前置項目必須就緒**（見頁首前置條件），缺少任何一項本任務無法開發。

2. **`ruleOptimizerAgent.mjs` 讀取 `blacklist.json` 必須用 raw JSON**，不可透過 `loadBlacklist()`。  
   原因：`loadBlacklist()` 已將 `titlePatterns` 轉為 `RegExp[]`，`isDuplicate` 需要比對 `.pattern` 字串，raw JSON 才有此欄位。

3. **`goldenDataset.json` 只能人工維護**，AI Agent 不得有任何寫入權限；建議用 `Object.freeze()` 或 lint rule 強制保護。

4. **`addedBy` 欄位是回滾的安全閥**，`"seed"` 規則永遠不受 rollback 影響。

5. **`runOptimizer.mjs` 獨立於 `runDailyCheck.mjs`**，Optimizer 執行失敗不影響當日使用者通知流程，兩者 process 互不干擾。

6. **`callGemini` 使用 `keyIndex: 2`**，避免與 `newsFetcher.mjs` 的 keyIndex 0（SearchQueries）和 keyIndex 1（FilterNews）碰撞。

7. **`optimizerLog` 透過 `archiveManager.saveAiLog({ type: "RuleOptimizer" })` 寫入**，路徑為 `data/ai_logs/latest_RuleOptimizer.json`，`rejectReason` 是 Prompt 品質的唯一診斷依據：
   - `golden_dataset_kill` 比例高 → Prompt 需補充更多黃金清單標題為負樣本
   - `overbroad` 比例高 → 加強禁止通配符的說明與反例
   - `invalid_regex` 出現 → AI 輸出格式異常，需檢查 JSON Schema 設定

8. **`blacklist.json` 需加入 Git 版控**，每次 AI append 都應是一筆可追蹤的 commit（由 GitHub Actions 的 `git-auto-commit-action` 自動處理），出問題時可用 `git diff` 直接定位。

9. **新規則生效不需重啟服務**，因 `loadBlacklist()` 在每次 `newsFetcher.mjs` 啟動時重新讀取，隔日排程自然載入最新版本。