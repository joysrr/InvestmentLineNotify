## 📌 【AI 管線優化類】任務 4：新聞過濾機制優化（Self-Healing 黑名單）

> **版本：** v1.4（依實際專案結構與確認結果修訂）
> **目標讀者：** AI Agent antigravity
> **前置條件：** 任務 3 已完成，以下項目必須就緒：
> - `data/config/blacklist.json` 已建立，且欄位結構為：`twExcludedSources`、`usExcludedSources`、`titleBlackListPatterns`
> - `data/config/blacklist.json` 的 `titleBlackListPatterns` 為 **regex 字串陣列**，格式例如：`"/Powell Industries/i"`
> - `src/modules/keywordConfig.mjs` 已實作 `loadBlacklist()`，並會讀取 `data/config/blacklist.json`
> - `src/modules/data/archiveManager.mjs` 已實作 `saveNewsLog()`，每日由 `newsFetcher.mjs` 自動產生：
>   - `data/news_logs/passedArticles_TW_YYYY-MM-DD.json`
>   - `data/news_logs/passedArticles_US_YYYY-MM-DD.json`

---

### 🎯 功能目標

打造具備「自我進化能力（Self-Healing）」的新聞濾網機制。系統每日自動審查昨日放行的新聞，揪出漏網農場文，生成新 Regex 規則，通過沙盒驗證後寫入 `data/config/blacklist.json`，隔日透過 `loadBlacklist()` 自動生效。

本版本採用 **方案 A**：維持既有 `blacklist.json` 格式不變，不修改 `keywordConfig.mjs` 的解析方式；AI 新增規則的追蹤、回滾資訊改寫入獨立的 `optimizerHistory.json`。

**量化驗收標準：**

- AI 產出規則通過 Sandbox 驗證率 ≥ 80%
- 黃金清單誤殺率 = **0%**
- `blacklist.json` 規則總數增長速度 < 5 條/週
- 任一日新增規則可被完整回滾（依 `optimizerHistory.json` 還原）

---

### 📁 影響檔案

| 檔案 | 異動類型 | 說明 |
|---|---|---|
| `data/config/blacklist.json` | 修改（持續 append） | 維持既有格式，append regex 字串 |
| `data/config/goldenDataset.json` | 新增 | 黃金標準新聞清單，人工維護，AI 不可寫入 |
| `data/config/optimizerHistory.json` | 新增 | 記錄每次 Optimizer 寫入的規則字串與回滾資訊 |
| `src/modules/ai/prompts.mjs` | 修改 | 新增 `RULE_OPTIMIZER_SCHEMA` 與 `buildOptimizerPrompt()` |
| `src/modules/ai/ruleOptimizerAgent.mjs` | 新增 | Self-Healing AI Agent |
| `src/runOptimizer.mjs` | 新增 | 獨立排程入口 |
| `scripts/rollbackOptimizer.mjs` | 新增 | 依日期回滾當日 AI 新增規則 |
| `.github/workflows/optimizer.yml` | 新增 | Optimizer 專屬排程與執行流程 |

> `src/modules/keywordConfig.mjs`、`src/modules/newsFetcher.mjs`、`src/runDailyCheck.mjs` 原則上不修改；本任務以擴充方式接入既有流程。

---

### 📋 Step 1：建立 goldenDataset.json（人工維護）

黃金清單是沙盒驗證的硬性防線。`ruleOptimizerAgent.mjs` 不得寫入 `goldenDataset.json`。

建議至少 **30 筆**，涵蓋：
- 台股大盤、三大法人、外資、融資融券、景氣燈號、外銷訂單
- 美股指數（S&P 500、Nasdaq、Dow Jones）
- 總經數據（CPI、PCE、GDP、PMI、Payrolls、Jobless Claims）
- 央行政策（Fed、FOMC、Powell、台灣央行）
- 台積電 / TSMC / ADR 相關新聞

範例格式：

```json
[
  { "title": "Fed raises interest rates by 25bps in March FOMC meeting", "source": "Reuters" },
  { "title": "台積電法說會：Q2 營收指引優於預期，外資大幅買超", "source": "經濟日報" },
  { "title": "景氣燈號轉黃紅燈，PMI 連三月擴張", "source": "中央社" }
]
```

---

### 🧠 Step 2：ruleOptimizerAgent.mjs（Self-Healing AI Agent）

#### 輸入來源

讀取昨日由 `newsFetcher.mjs` 產生的兩份 passedArticles 日誌（TW / US 分開處理）：

- `data/news_logs/passedArticles_TW_YYYY-MM-DD.json`
- `data/news_logs/passedArticles_US_YYYY-MM-DD.json`

#### passedArticles 實際使用欄位

每筆文章至少使用以下欄位：
- `title`
- `source`
- `sourceUrl`
- `pubDate`

其中 `title` 可能包含 ` - 來源名稱` 後綴，因此送入 AI 前要先做標題清洗：

```js
function normalizeTitle(title) {
  return title.replace(/\s*-\s*[^-]{2,40}$/, "").trim();
}
```

#### Prompt 設計原則

- System prompt 由 **Langfuse 管理**
- `responseSchema`、prompt builder、前後處理維持在 `prompts.mjs`
- Prompt 語言採用 **繁體中文**，方便中文維護與除錯
- AI 仍可輸出英文 regex pattern，這不受 prompt 語言限制

#### prompts.mjs 新增 RULE_OPTIMIZER_SCHEMA

`RuleOptimizer` 比照既有結構化輸出設計，使用 `responseSchema` 限制輸出格式，避免模型輸出非 JSON、缺欄位或欄位型別錯誤。

```js
export const RULE_OPTIMIZER_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      pattern: { type: "string" },
      flags: { type: "string" },
      reason: { type: "string" }
    },
    required: ["pattern", "flags", "reason"]
  },
  maxItems: 5
};
```

#### AI 呼叫方式

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
      keyIndex: 2,
      responseMimeType: "application/json",
      responseSchema: RULE_OPTIMIZER_SCHEMA,
    });

    return JSON.parse(rawJson || "[]");
  } catch (err) {
    console.warn(`[Optimizer] AI 呼叫失敗 (${region}):`, err.message);
    return [];
  }
}
```

---

### 🈶 Prompt 語言策略

#### 結論

本任務採用 **繁體中文 system prompt + 繁體中文 user prompt**，不強制改用英文。

#### 設計原則

- Prompt 主體使用繁體中文，方便中文維護者閱讀、調整與除錯
- 保留必要英文技術術語，例如：`regex`、`flags`、`JSON array`、`golden dataset`
- `reason` 欄位固定以繁體中文輸出，利於人工審查與 rollback 判讀
- regex pattern 本身可同時涵蓋中英文，不受 prompt 語言限制

#### 補充判斷

英文 prompt 只有在以下情況才考慮改用：
- 未來主要優化對象轉向美股英文新聞
- 維護者改為英文為主的團隊
- 實測發現英文 prompt 在規則穩定性上顯著優於中文 prompt

在目前架構下，優先影響品質的是：
1. 黃金清單完整度
2. Schema 約束程度
3. Overbroad 規則限制
4. 重複規則檢查
而不是 prompt 使用中文或英文本身

---

### 🧾 Langfuse System Prompt（繁體中文）

Prompt 名稱：`RuleOptimizer`

建議 config：

```json
{
  "responseMimeType": "application/json",
  "temperature": 0.2,
  "maxOutputTokens": 1024
}
```

System Prompt：

```text
你是一個金融新聞黑名單優化代理（Rule Optimizer）。
你的任務是分析一批「已通過現有新聞過濾器」的新聞標題，找出其中應該被擋下但漏網的低品質新聞、農場文、SEO 點擊誘餌或與台股／美股主題無關的內容，並產生新的 regex 規則。

## 你的目標
產生精準、可維護、可驗證的 regex 規則，協助系統阻擋低品質新聞，同時絕對不能誤傷重要財經新聞。

## 輸出要求
1. 只輸出 JSON array
2. 每個元素格式必須為：
   {
     "pattern": "regex pattern",
     "flags": "i 或 空字串",
     "reason": "規則說明"
   }
3. 最多輸出 5 條規則
4. 不可輸出 markdown、註解、額外說明文字
5. 若沒有適合的新規則，輸出 []

## 規則設計限制
1. pattern 必須有具體語意錨點，不可只有模糊通配
2. 不可把 `.*`、`.+`、`\w+`、`\d+` 當成規則主體
3. 不可輸出與既有規則語意明顯重複的 pattern
4. 優先產生可重複利用的結構型規則，不要只為單一標題硬寫過度客製規則
5. reason 請用繁體中文，簡潔說明這條規則要擋的內容型態

## 應優先識別的低品質內容
- 個股推薦、選股清單、買進建議、價格預測
- 明顯 SEO 標題，例如「最強概念股」「飆股卡位」「這原因」「必看」「懶人包」等
- 與台股／美股無關的他國區域市場新聞
- 重複模板化內容農場
- 標題中混入奇怪品牌字、站名、非正規財經名詞的內容
- 不屬於核心財經主題的泛內容

## 不可誤殺的新聞類型
- 總經數據：CPI、PCE、GDP、PMI、Payrolls、Jobless Claims
- 央行政策：Fed、FOMC、Powell、央行、理監事會
- 主要指數：S&P 500、Nasdaq、Dow Jones、台股、大盤
- 台積電 / TSMC / ADR 相關新聞
- 資金流與籌碼：外資、三大法人、Treasury yields、dollar index
- 台灣出口、外銷訂單、景氣燈號等重要總經新聞

## 設計原則
- 寧可少產，也不要產生高風險規則
- 若無法確認是否安全，請不要輸出該規則
- 規則必須可被程式直接編譯成 RegExp
```

---

### 🛡️ Step 3：Sandbox 沙盒驗證（四關卡）

#### 關卡 1：語法合法性

```js
function isValidRegex(pattern, flags) {
  try {
    new RegExp(pattern, flags);
    return true;
  } catch {
    return false;
  }
}
```

#### 關卡 2：廣泛度防護

```js
const OVERBROAD_PATTERNS = [/^\.\*/, /^\.\+/, /^\\w\+/, /^\\d\+/, /^\.\{/];

function isOverbroad(pattern) {
  return OVERBROAD_PATTERNS.some((p) => p.test(pattern.trim()));
}
```

#### 關卡 3：重複規則檢查（字串格式）

由於 `titleBlackListPatterns` 是字串陣列，因此需先把 AI 輸出轉成 canonical string 再比對：

```js
function toRegexLiteral(pattern, flags = "") {
  return `/${pattern}/${flags}`;
}

function isDuplicate(pattern, flags, existingPatterns) {
  const candidate = toRegexLiteral(pattern, flags);
  return existingPatterns.includes(candidate);
}
```

#### 關卡 4：黃金清單碰撞測試

```js
import goldenDataset from "../../data/config/goldenDataset.json" assert { type: "json" };

function passesGoldenTest(newRegex) {
  return !goldenDataset.some((item) => newRegex.test(item.title));
}
```

#### 驗證與寫入主流程

```js
function validateAndPrepare(aiRules, blacklist) {
  const accepted = [];
  const rejected = [];

  for (const rule of aiRules) {
    if (!isValidRegex(rule.pattern, rule.flags)) {
      rejected.push({ ...rule, rejectReason: "invalid_regex" });
      continue;
    }

    if (isOverbroad(rule.pattern)) {
      rejected.push({ ...rule, rejectReason: "overbroad" });
      continue;
    }

    if (isDuplicate(rule.pattern, rule.flags, blacklist.titleBlackListPatterns)) {
      rejected.push({ ...rule, rejectReason: "duplicate" });
      continue;
    }

    const regex = new RegExp(rule.pattern, rule.flags);
    if (!passesGoldenTest(regex)) {
      rejected.push({ ...rule, rejectReason: "golden_dataset_kill" });
      continue;
    }

    accepted.push({
      regexLiteral: `/${rule.pattern}/${rule.flags}`,
      reason: rule.reason,
    });
  }

  return { accepted, rejected };
}
```

---

### 🧷 Step 4：optimizerHistory.json（方案 A 的回滾中樞）

#### 設計目的

因 `blacklist.json` 維持字串陣列，無法直接在每條規則上保存 `addedBy` / `addedAt`。因此新增 `optimizerHistory.json` 做為 **寫入紀錄與回滾依據**。

#### 建議格式

```json
{
  "lastUpdated": "2026-04-01T18:00:00.000Z",
  "history": [
    {
      "date": "2026-04-02",
      "region": "TW",
      "addedRules": [
        {
          "regexLiteral": "/最強.{0,5}(概念股|飆股).{0,10}(布局|卡位|搶先)/",
          "reason": "中文農場 SEO 特徵標題"
        }
      ],
      "rejectedRules": [
        {
          "pattern": "GDP.*",
          "flags": "i",
          "reason": "過度廣泛",
          "rejectReason": "golden_dataset_kill"
        }
      ],
      "savedAt": "2026-04-01T18:00:10.000Z"
    }
  ]
}
```

#### 寫入原則

- 每日每區（TW / US）各寫一筆 history record
- `addedRules` 記錄實際 append 到 `blacklist.json` 的字串規則
- `rejectedRules` 記錄被拒絕原因，方便後續調整 prompt
- `lastUpdated` 供觀察最後一次成功寫入時間

---

### 📅 Step 5：獨立排程入口（src/runOptimizer.mjs）

`runOptimizer.mjs` 統一放在 `src/`，與 `runDailyCheck.mjs` 同層；兩者職責分離。

```js
import { runRuleOptimizer } from "./modules/ai/ruleOptimizerAgent.mjs";
import { archiveManager } from "./modules/data/archiveManager.mjs";

async function main() {
  console.log("[Optimizer] Starting daily blacklist optimization...");

  try {
    const result = await runRuleOptimizer();

    console.log(`[Optimizer] TW — Accepted: ${result.tw.accepted.length}, Rejected: ${result.tw.rejected.length}`);
    console.log(`[Optimizer] US — Accepted: ${result.us.accepted.length}, Rejected: ${result.us.rejected.length}`);

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

---

### 🤖 Step 6：GitHub Actions 採用獨立 workflow 檔案

為避免與既有通知流程混在同一個 workflow 中，本任務改採 **獨立 workflow 檔案**：

- 既有通知流程維持：`.github/workflows/line_notify.yml`
- Optimizer 新增專屬流程：`.github/workflows/optimizer.yml`

#### optimizer.yml

```yaml
name: Rule Optimizer Scheduler

on:
  schedule:
    # 台灣 02:00 -> UTC 18:00
    - cron: "0 18 * * *"
  workflow_dispatch:

jobs:
  optimizer:
    runs-on: ubuntu-latest

    permissions:
      contents: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Run Rule Optimizer
        env:
          GEMINI_MODEL: ${{ secrets.GEMINI_MODEL }}
          GEMINI_API_KEY1: ${{ secrets.GEMINI_API_KEY1 }}
          GEMINI_API_KEY2: ${{ secrets.GEMINI_API_KEY2 }}
          GEMINI_API_KEY3: ${{ secrets.GEMINI_API_KEY3 }}
          LANGFUSE_SECRET_KEY: ${{ secrets.LANGFUSE_SECRET_KEY }}
          LANGFUSE_PUBLIC_KEY: ${{ secrets.LANGFUSE_PUBLIC_KEY }}
          LANGFUSE_BASE_URL: ${{ secrets.LANGFUSE_BASE_URL }}
          TZ: "Asia/Taipei"
        run: node src/runOptimizer.mjs

      - name: Commit and Push Data Changes
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "🤖 chore(blacklist): optimizer auto-update [skip ci]"
          commit_user_name: "github-actions[bot]"
          commit_user_email: "github-actions[bot]@users.noreply.github.com"
```

---

### 🔄 Step 7：緊急回滾工具（rollbackOptimizer.mjs）

#### 用法

```bash
node scripts/rollbackOptimizer.mjs --date 2026-04-02
```

#### 邏輯

1. 讀取 `data/config/optimizerHistory.json`
2. 找出指定日期的所有 `addedRules.regexLiteral`
3. 從 `data/config/blacklist.json` 的 `titleBlackListPatterns` 中移除相同字串
4. 將該日期的 history record 標記為 `rolledBack: true`
5. 寫回兩個檔案

#### 範例骨架

```js
import { readFileSync, writeFileSync } from "fs";

const BLACKLIST_PATH = "data/config/blacklist.json";
const HISTORY_PATH = "data/config/optimizerHistory.json";

// 解析 --date 參數後略

const blacklist = JSON.parse(readFileSync(BLACKLIST_PATH, "utf-8"));
const history = JSON.parse(readFileSync(HISTORY_PATH, "utf-8"));

const records = history.history.filter((r) => r.date === targetDate && !r.rolledBack);
const toRemove = new Set(records.flatMap((r) => r.addedRules.map((x) => x.regexLiteral)));

blacklist.titleBlackListPatterns = blacklist.titleBlackListPatterns.filter((x) => !toRemove.has(x));

history.history = history.history.map((r) =>
  r.date === targetDate ? { ...r, rolledBack: true, rolledBackAt: new Date().toISOString() } : r
);

writeFileSync(BLACKLIST_PATH, JSON.stringify(blacklist, null, 2));
writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
```

---

### 🔁 完整資料流

```text
每日台灣 02:00 觸發（GitHub Actions UTC 18:00）
line_notify.yml 的 optimizer job
  ↓
node src/runOptimizer.mjs
  ↓
讀取昨日 passedArticles 日誌（TW / US 分開）
  ↓
抽取 articles[].title，去除 title 中的來源尾碼
  ↓
讀取 data/config/blacklist.json raw JSON（非 loadBlacklist()）
  ↓
呼叫 RuleOptimizer（keyIndex: 2）
  ↓
取得 [{ pattern, flags, reason }] 最多 5 條
  ↓
Sandbox 驗證：invalid_regex → overbroad → duplicate → golden_dataset_kill
  ↓
accepted 規則轉成 /pattern/flags 字串後 append 到 blacklist.json
  ↓
同步寫入 optimizerHistory.json
  ↓
archiveManager.saveAiLog({ type: "RuleOptimizer" })
  ↓
Git auto commit 推上 repo
  ↓
隔日 newsFetcher 啟動時 loadBlacklist() 自動讀取最新規則
```

---

### 🔑 API Key 使用策略

目前規劃：
- `keyIndex: 0` → SearchQueries
- `keyIndex: 1` → FilterNews
- `keyIndex: 2` → RuleOptimizer

在目前三組 key 架構下可行，且因 Optimizer 使用獨立 job 與獨立排程，實務上已可大幅降低碰撞風險。

只有在以下情況才考慮擴增第 4 組 key：
- 未來新增更多 AI 任務
- 常態性手動觸發 optimizer
- 出現明顯 rate limit / quota 壓力
- 想將 TW / US Optimizer 再拆成不同 key

---

### 📝 開發注意事項

1. 本任務 **不修改** `keywordConfig.mjs` 的 regex 解析方式。
2. `blacklist.json` 保持字串陣列格式，避免 breaking change。
3. 回滾安全閥改由 `optimizerHistory.json` 提供，而不是寫在 blacklist item 上。
4. `RuleOptimizer` 的 system prompt 由 Langfuse 維護；若 prompt 有改動，需同步保留版本註記。
5. 若 `golden_dataset_kill` 比例偏高，優先補強 prompt 與 golden dataset，而不是放寬驗證條件。
6. 新規則生效不需重啟服務，因 `loadBlacklist()` 在 `newsFetcher.mjs` 每次啟動時會重新讀取檔案。
7. `reason` 欄位是人工審核與 rollback 判讀的重要依據，請保留可讀性。