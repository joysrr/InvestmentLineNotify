## 📌 【AI 管線優化類】任務 4：新聞過濾機制優化（Self-Healing 黑名單）

> **版本：** v1.2（整合任務 3 架構）  
> **目標讀者：** AI Agent antigravity  
> **前置條件：** 任務 3 已完成，以下項目必須就緒：
> - `src/config/blacklist.json` 已建立（seed 初始化完畢）
> - `src/config/keywordConfig.mjs` 已實作 `loadBlacklist()`
> - `logs/passedArticles-YYYY-MM-DD.json` 每日由 `newsFetcher.mjs` 自動產生

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
| `src/modules/ai/ruleOptimizerAgent.mjs` | **新增** | Self-Healing AI Agent |
| `src/runDailyCheck.mjs` | 修改 | 掛載 Optimizer 排程（每日 02:00） |
| `scripts/rollbackOptimizer.mjs` | **新增** | 緊急回滾工具 |

> `keywordConfig.mjs` 與 `newsFetcher.mjs` 由任務 3 完成，任務 4 **不需修改**，直接受益於 `loadBlacklist()` 每次重新讀取 `blacklist.json` 的機制。

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

#### Prompt 規格

**輸入：** 讀取 `logs/passedArticles-YYYY-MM-DD.json`（由任務 3 的 `newsFetcher.mjs` 每日產生）

**輸出限制（寫入 Prompt）：**

- 輸出格式：JSON array，每個元素為 `{ "pattern": "...", "flags": "i", "reason": "..." }`
- 最多輸出 **5 條**新規則
- 禁止使用過廣泛的通配符作為規則主體：`.*` / `.+` / `\w+` / `\d+`（需有具體語意錨點）
- 禁止輸出與現有規則重複的 pattern
- 每條規則需附上 `"reason"`（說明針對哪類農場文）

#### AI 輸出範例格式

```json
[
  {
    "pattern": "\d+ (stocks?|ETF).{0,20}(to buy|to watch|to own)",
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

---

### 🛡️ Step 3：Sandbox 沙盒驗證（四關卡）

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

#### 關卡 3：黃金清單碰撞測試（硬性防線）

```js
import goldenDataset from "../config/goldenDataset.json" assert { type: "json" };

function passesGoldenTest(newRegex) {
  // 新規則不得誤殺任何黃金清單中的標題
  return !goldenDataset.some(item => newRegex.test(item.title));
}
```

#### 關卡 4：重複規則檢查

```js
function isDuplicate(newPattern, existingPatterns) {
  return existingPatterns.some(e => e.pattern === newPattern);
}
```

#### 完整驗證主流程

```js
function validateAndAppend(aiRules, blacklist) {
  const accepted = [];
  const rejected = [];

  for (const rule of aiRules) {
    if (!isValidRegex(rule.pattern, rule.flags)) {
      rejected.push({ ...rule, rejectReason: "invalid_regex" }); continue;
    }
    if (isOverbroad(rule.pattern)) {
      rejected.push({ ...rule, rejectReason: "overbroad" }); continue;
    }
    if (isDuplicate(rule.pattern, blacklist.titlePatterns)) {
      rejected.push({ ...rule, rejectReason: "duplicate" }); continue;
    }
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

### 📅 Step 4：排程掛載（runDailyCheck.mjs）

**執行時機：** 每日台灣時間 **02:00**（市場收盤後、隔日開盤前）

```js
import { runRuleOptimizer } from "./modules/ai/ruleOptimizerAgent.mjs";

async function dailyMaintenance() {
  console.log("[Optimizer] Starting daily blacklist optimization...");
  const result = await runRuleOptimizer();
  console.log(
    `[Optimizer] Accepted: ${result.accepted.length}, ` +
    `Rejected: ${result.rejected.length}`
  );
  // 將完整 result 寫入 logs/optimizerLog-YYYY-MM-DD.json 供品質追蹤
}
```

---

### 🔄 Step 5：緊急回滾工具（rollbackOptimizer.mjs）

```js
// 用法：node scripts/rollbackOptimizer.mjs --date 2026-03-29
// 效果：移除該日 AI 新增的所有規則，不影響 seed 人工規則

import { readFileSync, writeFileSync } from "fs";

const targetDate = process.argv[3];
const filePath   = "src/config/blacklist.json";
const data       = JSON.parse(readFileSync(filePath, "utf-8"));

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
每日 02:00 觸發 dailyMaintenance()
  ↓
讀取 logs/passedArticles-YYYY-MM-DD.json（由任務 3 產生）
  ↓
ruleOptimizerAgent（AI 審查）
  Prompt：揪出農場文，輸出 ≤5 條 Regex 規則（JSON）
  ↓
Sandbox 驗證（四關卡）
  關卡 1：isValidRegex       — 語法合法？
  關卡 2：isOverbroad        — 是否過於廣泛？
  關卡 3：isDuplicate        — 是否重複現有規則？
  關卡 4：passesGoldenTest   — 是否誤殺黃金新聞？（硬性條件）
  ↓
全部通過 → append 進 blacklist.json（addedBy: "optimizer"）
部分失敗 → rejected 原因記錄至 logs/optimizerLog-YYYY-MM-DD.json
  ↓
隔日 newsFetcher 啟動時 loadBlacklist() 自動讀取最新版本
  ↓
更強的防護罩自動生效（零停機，無需重啟服務）
```

---

### 📝 開發注意事項（給 antigravity）

1. **任務 3 的三個前置項目必須就緒**（見頁首前置條件），缺少任何一項本任務無法開發。

2. **`goldenDataset.json` 只能人工維護**，AI Agent 不得有任何寫入權限；建議用 `Object.freeze()` 或 lint rule 強制保護。

3. **`addedBy` 欄位是回滾的安全閥**，`"seed"` 規則永遠不受 rollback 影響。

4. **`optimizerLog.json` 的 `rejectReason` 是 Prompt 品質的唯一診斷依據：**
   - `golden_dataset_kill` 比例高 → Prompt 需補充更多黃金清單標題為負樣本
   - `overbroad` 比例高 → 加強禁止通配符的說明與反例
   - `invalid_regex` 出現 → AI 輸出格式異常，需檢查 JSON 輸出規範

5. **`blacklist.json` 需加入 Git 版控**，每次 AI append 都應是一筆可追蹤的 commit，出問題時可用 `git diff` 直接定位。

6. **新規則生效不需重啟服務**，因任務 3 的 `loadBlacklist()` 是在每次 `newsFetcher.mjs` 啟動時重新讀取，隔日排程自然載入最新版本。
