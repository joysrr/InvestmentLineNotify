---
type: report
status: archived
last_updated: 2026-04-01
tags:
  - archived
  - code-review
wiki_links: []
---

## 階段一審查結果：Entry Points 入口層

---

### ⚠️ 問題清單

#### P0 — 嚴重（可能導致靜默失敗或 crontab 誤判）

**[P0-1] `runDailyCheck` 的 `finally` 區塊中 Langfuse shutdown 未 `await`**

```js
// 現狀 [cite:84]
langfuse
  .shutdownAsync()
  .then(() => {
    logger.info("✅ Langfuse 已關閉");
  })
  .catch((e) => {
    logger.warn(e, "⚠️ Langfuse 關閉失敗");
  });
```

`finally` 不等待 shutdown 完成，process 會在 Langfuse flush 完成前就退出，導致最後一批 trace 可能丟失。其他 runner（`runNewsFetch`、`runOptimizer`）則有正確使用 `await` ，行為不一致。

---

**[P0-2] `runDailyCheck` 缺少 `dotenv/config` import**

`runNewsFetch`、`runWeeklyReport`、`runMonthlyReport`、`runOptimizer` 第一行都有 `import "dotenv/config"` ，但 `runDailyCheck` 沒有 。若 crontab 以 bare `node src/runDailyCheck.mjs` 方式執行（未預先載入 env），所有環境變數將為 `undefined`，導致靜默失敗而非報錯。

---

#### P1 — 中度（邏輯隱患，不會立即當機但有風險）

**[P1-1] `runWeeklyReport` / `runMonthlyReport` 的 AI 失敗未被分離**

`generatePeriodAiSummary()` 若拋錯，會被外層 `try/catch` 捕捉並 `process.exit(1)`，連帶導致**已完成的統計結果也無法發送通知** 。正確行為應是：AI 失敗時降級發送純統計報告，而非整體中斷。

---

**[P1-2] `runOptimizer` 的 Langfuse shutdown 在 `console.log("✅ Langfuse 已關閉")` 之前就離開了**

```js
// 現狀 [cite:88]
langfuse.shutdownAsync().catch(...);
console.log("✅ Langfuse 已關閉"); // ← 此行在 await 之前就執行
```

`shutdownAsync()` 沒有 `await`，log 訊息永遠在 shutdown 完成之前就印出，且行為與 `runNewsFetch` 不一致（後者有 `await`）。

---

**[P1-3] `runWeeklyReport` / `runMonthlyReport` 都缺少 Langfuse shutdown**

兩個 runner 在 `finally` 中完全沒有呼叫 `langfuse.shutdownAsync()`，但兩者都間接呼叫了 `generatePeriodAiSummary()` 這個會產生 Langfuse trace 的函式 ，這些 trace 會在 process 退出時被截斷。

---

#### P2 — 輕度（一致性問題、可讀性）

**[P2-1] 五個 runner 的參數解析方式各自不同**

- `runDailyCheck`：手動 `args.includes()`
- 其他：無參數解析

沒有統一的 CLI 參數解析層，未來新增 runner 容易產生不一致的介面。

**[P2-2] `runDailyCheck` 使用結構化 `logger`，其他 runner 全用 `console.log`**

對外部 log aggregator（如 Oracle VM syslog）而言，格式不一致會造成解析困難 。

**[P2-3] `runMonthlyReport` 的 `reports = allReports.slice(-30)` 語意不直覺**

`loadRecentReports(50)` 取最新 50 份後再 `.slice(-30)` 取最舊的 30 份，其實等同取 index 20~49，但實際需求是「最近一個月約 22 個交易日」，這個計算方式對未來維護者容易誤讀 。

---

### 💡 修正建議彙整

| 編號 | 嚴重度 | 修正動作                                                                           |
| ---- | ------ | ---------------------------------------------------------------------------------- |
| P0-1 | P0     | `runDailyCheck` finally 中 `await langfuse.shutdownAsync()`                        |
| P0-2 | P0     | `runDailyCheck` 第一行補 `import "dotenv/config"`                                  |
| P1-1 | P1     | 週報/月報將 `generatePeriodAiSummary` 包在獨立 try/catch，失敗時降級發送純統計通知 |
| P1-2 | P1     | `runOptimizer` finally 補 `await langfuse.shutdownAsync()`                         |
| P1-3 | P1     | `runWeeklyReport` / `runMonthlyReport` 補 Langfuse shutdown                        |
| P2-1 | P2     | 可考慮統一用 `process.argv` 解析或輕量 CLI 工具                                    |
| P2-2 | P2     | 其他 runner 統一引入 `logger` 取代 `console.log`                                   |
| P2-3 | P2     | `runMonthlyReport` 的 slice 邏輯加上清楚的說明註解                                 |

兩個核心檔案讀取完畢，開始彙整分析。

---

## 階段二審查結果：核心業務邏輯層

---

### ⚠️ 問題清單

#### P0 — 嚴重

**[P0-3] `broadcastDailyReport` 未 `await`，Telegram 發送是否完成完全未被等待**

```js
// dailyCheck.mjs 現狀 [cite:93]
broadcastDailyReport(reportDailyData, newsMessages, isTelegramEnabled);
// ↑ 沒有 await，後面直接繼續執行 logDailyToSheet
```

若 process 在 Telegram 請求完成前退出（例如後續某步驟拋錯），通知將靜默遺失，且錯誤無法被 `try/catch` 捕捉。其他所有非同步呼叫都有正確 `await`，此處是一致性破口。

---

**[P0-4] `history.length < 30` 提早 return 後，Langfuse 不會被正確關閉**

```js
// dailyCheck.mjs [cite:93]
if (history.length < 30) {
  console.log("❌ 資料不足，無法計算指標");
  return "❌ 資料不足"; // ← 直接 return，不走 finally
}
```

`dailyCheck` 是被 `runDailyCheck` 的 `try` 區塊呼叫的，`finally` 在 `runDailyCheck` 層，但 `return` 本身不會觸發 `runDailyCheck` 的 `catch`，因此 `langfuse.shutdownAsync()` 仍然會被呼叫（在 `finally`）。**然而這個 return 沒有任何通知**，用戶不會收到「資料不足」的 Telegram 告警，問題靜默結束。

---

#### P1 — 中度

**[P1-4] `evaluateInvestmentSignal` 中 `ctx.closeArr`、`ctx.ma20Arr`、`ctx.atrArr` 在 `dailyCheck` 未被注入**

```js
// strategyEngine.mjs [cite:94]
ctx = {
  closeArr: data.closeArr ?? [],   // ← dailyCheck 未傳入此欄位
  ma20Arr:  data.ma20Arr  ?? [],   // ← dailyCheck 未傳入此欄位
  atrArr:   data.atrArr   ?? [],   // ← dailyCheck 未傳入此欄位
  ...
}
```

`dailyCheck` 組裝的 `signalData` 物件 傳入了 `rsiArr`、`macdArr`、`kdArr`，但缺少 `closeArr`、`ma20Arr`、`atrArr` 三個序列。這些欄位被 `resolveTrendConfirmation`（MA20 停損判斷）和 `trailingStop`（移動停利）使用。`?? []` 的 fallback 讓程式不崩潰，但 `ma20BreakDays` 永遠計算為 0，**移動停利與 MA20 停損機制實際上是無效的**。

---

**[P1-5] `macroAnalysis` 失敗時的 fallback 結構不完整**

```js
// dailyCheck.mjs [cite:93]
macroAnalysis = await analyzeMacroNewsWithAI(...);
// 若此處拋錯，外層沒有 try/catch，會直接拋到 runDailyCheck 的 catch → process.exit(1)
```

`analyzeMacroNewsWithAI` 呼叫沒有包在 try/catch 內，若 AI API 逾時或錯誤，整個 `dailyCheck` 會中斷，連帶所有已計算完的技術指標、策略訊號都無法送出通知。新聞區塊有保護（ 的 try/catch），但 `analyzeMacroNewsWithAI` 沒有。

---

**[P1-6] `generateScoringMatrix` 的 `ctx.macroSentiment` 可能為 `undefined`**

```js
// strategyEngine.mjs [cite:94]
sentimentScore:
  ctx.macroSentiment?.direction === "BULLISH"
    ? ctx.macroSentiment.bonus || 0
    : ctx.macroSentiment?.direction === "BEARISH"
      ? -(ctx.macroSentiment.penalty || 0)
      : 0,
```

`ctx.macroSentiment` 是從 `resolveMacroSentiment()` 的返回值取得，但 `ctx` 物件建構時 **沒有包含 `macroSentiment` 欄位**（只有 `macroSentiment` 在 `scoringData` 中從 `ctx` 讀取，形成循環依賴），`?.` 防禦讓它靜默為 0，但 sentimentScore 永遠不會反映實際情緒狀態。

---

#### P2 — 輕度

**[P2-4] `valuationGuardState` 回寫後不確認是否成功影響後續流程**

```js
// dailyCheck.mjs [cite:93]
} catch (err) {
  console.error(`❌ [dailyCheck] valuationGuardState.json 寫入失敗：${err.message}`);
  // ← 只 log，不做任何降級補救
}
```

寫入失敗時，下次執行仍會讀到舊的 latch 狀態，可能導致策略執行與實際狀態不一致，應至少記錄在 Langfuse 或發送告警。

**[P2-5] `dailyCheck` 使用 `console.log` 而非結構化 `logger`**

整個 `dailyCheck.mjs` 都使用 `console.log`/`console.error`，但 `runDailyCheck.mjs` import 了 `logger`（pino），兩層的 log 格式不一致，影響 VM syslog 解析。

**[P2-6] `priceDropPercent` 在 `signalData` 組裝前已用於多處 log，但並非原始值**

`finalPriceZ2 = currentPriceZ2 || latestClose` 的邏輯使得 `currentPriceZ2` 為 null 時直接退回收盤價，但此後 `signalData.currentPrice = finalPriceZ2` 而 `basePrice` 仍為原始基準價，若兩者相差極大，`priceDropPercent` 計算結果可能不代表今日市場真實狀況（例如昨日收盤價 vs 較舊的基準價）。

---

### 💡 修正建議彙整

| 編號 | 嚴重度 | 修正動作                                                                                          |
| ---- | ------ | ------------------------------------------------------------------------------------------------- |
| P0-3 | P0     | `broadcastDailyReport` 前補 `await`                                                               |
| P0-4 | P0     | `history.length < 30` 提早 return 前補送 Telegram 告警通知                                        |
| P1-4 | P1     | `dailyCheck` 的 `signalData` 補入 `closeArr`、`ma20Arr`、`atrArr`（從 `indicatorsZ2` 取出）       |
| P1-5 | P1     | `analyzeMacroNewsWithAI` 包入 try/catch，失敗時降級使用預設 `macroAnalysis` 結構                  |
| P1-6 | P1     | `ctx` 建構時補入 `macroSentiment` 欄位，或在 `scoringData` 組裝時直接從 `macroSentiment` 變數取值 |
| P2-4 | P2     | `valuationGuardState` 寫入失敗時加入 Langfuse warn event                                          |
| P2-5 | P2     | `dailyCheck.mjs` 引入並使用結構化 `logger`                                                        |
| P2-6 | P2     | 補充 comment 說明 `finalPriceZ2` fallback 的語意邊界                                              |

三個核心檔案讀取完畢，開始分析。

---

## 階段三審查結果：資料提供層（Providers + ArchiveManager）

---

### ⚠️ 問題清單

#### P0 — 嚴重

**[P0-5] `rawMargin`（融資餘額）只有一個 provider，且 KGI / FinMind 擇一後無備援**

```js
// providerRegistry.mjs [cite:100]
marginKgi:     { fetch() { return fetchTwseMarginData(); } },
marginFinMind: { fetch() { return fetchFinMindMarginData(); } },
// ↑ 兩者只擇一啟用（由 dataSourceConfig 控制），被停用的那個完全不被呼叫
```

`rawMargin` 被標記為 `CRITICAL`（staleHours: 48），但若啟用的 provider 失敗，fallback 是「使用 cache」，並無自動切換到備援 provider 的邏輯。`evaluateInvestmentSignal` 中的 `analyzeMarginRisk` 是維持率計算的唯一入口，若 `rawMargin` 長期為 null，維持率會靜默落回初始值而非觸發中斷。

---

**[P0-6] `fetchAllMacroData` 中 `appendPbHistory` 不 `await` 且不處理例外**

```js
// marketData.mjs [cite:99]
if (res?.pb != null && res?.date) {
  archiveManager.appendPbHistory(res.date, res.pb); // ← 無 await，無 catch
}
```

若 `pbHistory.json` 寫入失敗（例如磁碟空間不足），程式完全感知不到。更關鍵的是：由於沒有 `await`，即使後續流程正常，`pbHistory.json` 的實際寫入狀態是不確定的。`valuationGuard` 依賴 `pbRecords` 的歷史序列決定防禦 latch，若序列悄悄中斷，Guard 的觸發閾值計算會出錯。

---

#### P1 — 中度

**[P1-7] `rawFx` 快取保護時間（30 分鐘）遠短於 `SLOT_CRITICALITY` 設定（4 小時），邏輯不一致**

```js
// marketData.mjs [cite:99]
// 判斷邏輯 F：快取保護 30 分鐘
if (cachedData.rawFx && minutesSinceFxUpdate < 30) { ... }

// SLOT_CRITICALITY [cite:99]
rawFx: { level: "IMPORTANT", staleHours: 4 }, // ← 標記 4 小時才 STALE
```

快取命中條件（30 分鐘過期就重抓）與新鮮度告警閾值（4 小時才標 STALE）之間存在 7.5 倍落差。若 Yahoo Provider 在 30 分鐘內持續失敗，每次都會重試但每次都失敗，但 `_stale` 標籤要到 4 小時後才會出現，中間 4 小時的失敗是完全靜默的（只有 warn log）。

---

**[P1-8] `getHistoricalLoan` 取的是「第 N 個日期」的報表，而非「N 天前」的日期**

```js
// archiveManager.mjs [cite:101]
const targetDate = dates[Math.min(daysAgo, dates.length - 1)];
```

`dates` 是所有有報表的日期（排除非交易日），若連假過後有 4 天空洞，`dates[10]` 實際上是「第 11 個有交易的日期」而非「10 個自然日前」。以 `rollingDays: 10` 的預算控管來說，實際對比的可能是 12–15 個自然日前的借貸，導致滾動借貸增量計算偏低，預算管控較寬鬆。

---

**[P1-9] `providerRegistry` 中 `rawInstitutional` 與 `rawStockMargin` 的 ticker 被硬編碼**

```js
// providerRegistry.mjs [cite:100]
stockInstitutionalTwse: {
  async fetch() { return fetchStockInstitutionalData("0050"); } // ← hardcoded
},
stockMarginTwse: {
  async fetch() { return fetchStockMarginData("00675L"); } // ← hardcoded
},
```

若未來增加監控標的（例如 00878、0056），需直接修改 `providerRegistry.mjs`，違反只改 `dataSourceConfig.mjs` 的設計意圖。且 `providerRegistry` 是一個模組層級的常數，無法在 runtime 動態傳入 ticker 參數。

---

**[P1-10] `cleanOldArchives` 使用 `mtime` 而非檔名日期判斷保留期限**

```js
// archiveManager.mjs [cite:101]
const stats = await fs.stat(filePath);
if (now - stats.mtimeMs > msToKeep) {
  await fs.unlink(filePath);
}
```

若 VM 重開、檔案被備份還原、或 git pull 重置了檔案時間，所有歷史報表的 `mtime` 都會更新為今天，導致清理機制完全失效（所有舊檔都不會被刪）。應使用檔名中的日期字串（`YYYY-MM-DD.json`）作為判斷依據。

---

#### P2 — 輕度

**[P2-7] `saveMarketData` 寫入失敗不 throw，呼叫端無從知曉**

```js
// archiveManager.mjs [cite:101]
async saveMarketData(data) {
  await ensureDirectories();
  await fs.writeFile(latestPath, JSON.stringify(data, null, 2));
  await fs.writeFile(historyPath, JSON.stringify(data, null, 2));
  // ← 不 throw，不回傳狀態，不送告警
}
```

如果 `latest.json` 寫入失敗，下一次執行 `getLatestMarketData()` 會拿到舊快取，但沒有任何機制告知系統快取已過期。

**[P2-8] `getHighsSince` 固定取「最近 3 個月」資料，買入若超過 3 個月前則移動停利的 HHV 計算會遺漏早期高點**

```js
// archiveManager.mjs [cite:101]
for (let i = 0; i < 3; i++) { ... } // 只回溯 3 個月
```

若 `lastBuyDate` 是 5 個月前（長期持倉情境），移動停利的最高價追蹤會遺漏買入後前 2 個月的高點，`dynamicAnchor` 計算偏低，停利點保護不足。

**[P2-9] `SLOT_CRITICALITY` 設定物件在 `marketData.mjs` 維護，而非統一在 `dataSourceConfig.mjs`，兩邊的 slot 清單有潛在不同步風險**

若新增 slot 時只更新了 `dataSourceConfig.mjs` 但忘記同步 `SLOT_CRITICALITY`，新 slot 永遠不會接受新鮮度評估，也不會觸發 STALE 告警 。

---

### 各 Provider 單點故障風險評估

| Slot                   | 等級      | 備援 provider         | 失敗後影響                               |
| ---------------------- | --------- | --------------------- | ---------------------------------------- |
| `rawValuation` (PB/PE) | CRITICAL  | ❌ 無                 | PB 泡沫防護停用，ValuationGuard 無新資料 |
| `rawMargin`            | CRITICAL  | ⚠️ 有切換但無自動備援 | 維持率計算靜默降為 0/預設值              |
| `rawUsMarket` (FRED)   | CRITICAL  | ❌ 無                 | VIX 缺失，panicBypass 無法觸發           |
| `rawFx` (Yahoo)        | IMPORTANT | ❌ 無                 | 匯率顯示為 null，訊號文字缺位            |
| `rawCnn`               | IMPORTANT | ❌ 無                 | sentimentScore 靜默為 0                  |
| `rawInstitutional`     | IMPORTANT | ❌ 無                 | 法人籌碼分數歸零，計分矩陣失準           |
| `rawStockMargin`       | IMPORTANT | ❌ 無                 | 00675L 融資數據缺失                      |
| `rawNdc`               | LOW       | ❌ 無                 | 景氣燈號無法顯示，不影響決策             |

所有 API 層核心檔案讀取完畢，開始整理分析結果。

---

## 階段四審查結果：API 層（Fastify Routes、Schema、Guard）

---

### ⚠️ 問題清單

#### P1 — 中度

**[P1-9] `reports.mjs` 使用了 `join()` 但未 import**

```js
// reports.mjs [cite:105]
const raw = await readFile(
  join(REPORTS_DIR, `${date}.json`), // ← join 未 import
  "utf-8",
);
```

檔案頂端只有 `import { readdir, readFile } from "fs/promises"` 和 `import { resolve, dirname } from "path"`，`join` 從未被引入。這代表所有依賴 `join()` 的路由（`/report/news`、`/reports`、`/report/:date`、`/reports/snapshots`）在執行時都會拋出 `ReferenceError: join is not defined`，並讓所有這些端點回傳 500。由於 `REPORTS_DIR` 已用 `resolve()` 取得絕對路徑，修正方式是直接改用 `resolve(REPORTS_DIR, ...)` 或補上 `import { resolve, dirname, join } from "path"`。

---

**[P1-10] `config.mjs` 的 `GET /api/strategy-config` 部分讀取失敗時不中止，靜默回傳破損物件**

```js
// config.mjs [cite:110]
for (const part of parts) {
  const path = resolve(CONFIG_PARTS_DIR, part.file);
  const text = await readFile(path, "utf-8");  // ← 若任一檔案不存在，整個 handler 拋出錯誤
  data[part.key] = { content: JSON.parse(text), ... };
}
// 外層 catch 回 500，但 _meta 已部分填入 data 中
```

更深層的問題是：若 `_meta` 讀取成功但其中一個 `parts` 檔案不存在，外層 `catch` 會回傳 500，但此時 `data` 物件已包含部分成功的 key。若前端重試邏輯不夠嚴謹，可能拿到 `undefined` key 的設定項目而不知道是部分失敗。建議改為分項 try/catch，缺少的 part 回傳 `{ content: null, error: "file not found" }` 而非整體 500。

---

**[P1-11] `initDataGuard` 驗證成功後未將解析出的 `user` 物件附加到 `request`**

```js
// initDataGuard.mjs [cite:107]
// 驗證通過後直接 return（隱式 undefined = 放行）
// ← 未做 request.telegramUser = JSON.parse(params.get("user"))
```

Telegram initData 中包含 `user` JSON（含 `id`, `username`, `first_name`），但 guard 驗證通過後完全丟棄這份資訊。若未來有任何 route 需要知道「是哪個 Telegram 用戶在請求」（例如 admin 功能判斷、audit log），就必須重新解析一次 header，或者在沒有 guard 附加資訊的情況下無法做用戶識別。這不算即時 bug，但是一個設計缺口。

---

#### P2 — 低度 / 設計觀察

**[P2-12] `contract.mjs` 的 `MARKET_SCHEMA` 和 `REPORT_SCHEMA` 是純文件物件，實際上沒有被任何 route 引用做 validation**

```js
// contract.mjs [cite:109] — 定義了 schema，但未被 reports.mjs / status.mjs import
```

`contract.mjs` 目前的作用是「規格說明文件」而非「執行期 validation」。API 回傳的資料直接來自 JSON 檔案，Fastify 的 response schema validation 機制（`schema: { response: { 200: ... } }`）完全未啟用。這意味著若 `latest.json` 的格式因為某次 provider 更新而改變，API 會直接把破損結構回傳給前端，前端才是發現問題的第一關。

---

**[P2-13] `GET /api/reports` 的 TTL cache key 設計可能在日期更新時失效緩慢**

```js
// reports.mjs [cite:105]
const cacheKey = `loadReports:${limit}:${dates[0] || "empty"}`;
// ↑ dates[0] 是當天最新日期；但 getSortedDates 本身也有 10s TTL cache
```

兩層 cache 疊加：`getSortedDates` 最多 10 秒才刷新，而 `loadReports` 的 key 依賴 `dates[0]`。若當天 `dailyCheck` 在 00:30 生成了新報表，最多要等 10 + 10 = 20 秒才能透過 API 看到最新資料。這對日常使用無感，但若用戶在 cron 執行後立刻查詢（例如透過 Bot 觸發），可能會短暫拿到舊資料。目前沒有 cache invalidation 機制。

---

**[P2-14] `server.mjs` 的 `unhandledRejection` 只 log 不 exit，但 `uncaughtException` 會 exit(1)**

```js
// server.mjs [cite:104]
process.on("uncaughtException",  (err)    => { logger.error(...); process.exit(1); });
process.on("unhandledRejection", (reason) => { logger.error(...); }); // ← 無 exit
```

兩者處理方式不對稱。`uncaughtException` 發生後 Node.js 程序處於不確定狀態，exit(1) 是正確的。但 `unhandledRejection` 同樣可能在非同步鏈中留下半途而廢的狀態，只 log 不 exit 雖然保持 server 存活，但後續行為難以預測。這個選擇有其考量（service 存活優先），但值得記錄為潛在風險點。

---

### 📊 階段四問題總覽

| 編號  | 嚴重度 | 位置                | 問題摘要                                                     |
| ----- | ------ | ------------------- | ------------------------------------------------------------ |
| P1-9  | 🔴 P1  | `reports.mjs`       | `join()` 未 import，所有 report routes 執行期 ReferenceError |
| P1-10 | 🟡 P1  | `config.mjs`        | 部分設定檔缺失時整體 500，無法識別是哪個 part 失敗           |
| P1-11 | 🟡 P1  | `initDataGuard.mjs` | 驗證成功後未附加 `telegramUser` 至 request context           |
| P2-12 | 🔵 P2  | `contract.mjs`      | Schema 定義未被 Fastify response validation 引用             |
| P2-13 | 🔵 P2  | `reports.mjs`       | 雙層 TTL cache 疊加，新報表最多延遲 20 秒可見                |
| P2-14 | 🔵 P2  | `server.mjs`        | `unhandledRejection` 與 `uncaughtException` 處理不對稱       |

所有核心檔案讀取完畢，開始整理分析結果。

---

## 階段五審查結果：新聞系統（RSS、去重、新聞池容量）

---

### ⚠️ 問題清單

#### P1 — 中度

**[P1-15] `loadBlacklist()` 若 `blacklist.json` 不存在，整個新聞採集管線會硬崩（無 fallback）**

```js
// keywordConfig.mjs [cite:121]
export async function loadBlacklist() {
  const raw = await fs.readFile(BLACKLIST_PATH, "utf-8"); // ← 無 try/catch
  const data = JSON.parse(raw);
  ...
}

// newsFetcher.mjs [cite:116]
const blacklist = await loadBlacklist(); // ← 在 getRawNews() 最頂層呼叫
```

`blacklist.json` 是 `data/config/` 下的檔案，若因部署失誤、git 未追蹤或手動刪除而不存在，`fs.readFile` 會拋出 ENOENT，且錯誤直接向上冒泡到 `runNewsFetch()`，導致整個新聞管線中止，不會寫入任何文章進 pool。黑名單缺失不應是 FATAL 等級——降級使用空黑名單讓系統繼續運作才是合理行為。

---

**[P1-16] `prepareNewsForAI` 中每個來源最多允許 100 篇（`sourceCount[source] <= 100`），實際上等同無上限**

```js
// newsFetcher.mjs [cite:116]
const dedupedBySource = titleFiltered.filter((news) => {
  const source = news.source || "unknown";
  sourceCount[source] = (sourceCount[source] || 0) + 1;
  return sourceCount[source] <= 100; // ← 每來源最多 100 篇
});
```

後面的 `maxPerRegion = 20` 才是真正的截斷，這個 100 的限制在實務上從不觸發（總量通常不超過 200 篇）。問題在於：若某個超高頻來源（例如 `unknown` 或 Yahoo Finance）佔據了大量版面，前 20 篇可能全是同一來源，讓 AI 收到的輸入嚴重失去來源多樣性。這個 per-source cap 應調降至 3~5 篇才有實際過濾效果。

---

**[P1-17] `runNewsFetch` 中 `purgeExpiredFromPool()` 在 `updatePool()` 之後重複執行，產生雙次歸檔風險**

```js
// runNewsFetch.mjs [cite:120]
const { appended, expired, ... } = await updatePool(articles); // ← 已執行一次 archiveArticles
...
await purgeExpiredFromPool(); // ← 又執行一次 archiveArticles（此時 expired 為 0，但仍多一次 I/O）
```

`updatePool()` 內部已完整執行「殭屍清理 → TTL 過期歸檔 → 截斷 → 寫回」的完整流程。之後立刻再呼叫 `purgeExpiredFromPool()` 是重複操作。雖然第二次執行時 `expired` 陣列會是空的（剛清過），不會造成重複歸檔，但每次執行都多一次完整的 `loadPool + savePool` I/O 往返。更潛在的問題是：若兩個呼叫之間系統時鐘偏移（極端情況），有機率讓剛被視為 active 的文章在第二次 purge 時被歸檔。

---

#### P2 — 低度 / 設計觀察

**[P2-18] `filterNewsByDate` 的 6 小時窗口與 RSS `+when:6h` 查詢參數重複，造成雙重過濾**

```js
// newsFetcher.mjs [cite:116]
// 在 RSS URL 中已加入 +when:6h 時間限制：
return [include, "+when:6h", ...excludeParts].join(" ");

// 又在 prepareNewsForAI 中再次過濾：
const recent = filterNewsByDate(newsList, 6);
```

Google News RSS 的 `+when:6h` 理論上只回傳 6 小時內的文章，`filterNewsByDate` 又做一次 6 小時過濾。雙重過濾在正常情況下無害，但若 Google 回傳了帶有異常過去時間的文章（時區問題、舊新聞重新上架），`filterNewsByDate` 會再過濾一次，有助於品質。但這層邏輯的存在原因和條件應在文件中說明，否則未來維護時可能被誤刪。

---

**[P2-19] `generateDailySearchQueries` 在 `runNewsFetch` 中傳入假市況 `"暫無即時市況"`**

```js
// runNewsFetch.mjs [cite:120]
const { twQueries, usQueries, traceId } = await generateDailySearchQueries({
  marketStatus: "暫無即時市況", // ← 硬編碼假資料
  vix: "N/A",
});
```

`generateDailySearchQueries` 的本意是根據當前市況動態產生搜尋關鍵字，但 `runNewsFetch` 執行時（通常是白天 cron）並不讀取 `latest.json`，而是直接帶入假市況。這意味著「動態關鍵字」實際上只能依賴 AI 的通用知識，而非當天真實的市場狀態（例如 VIX 飆高時 AI 理應增加恐慌相關關鍵字，但這個情境無法觸發）。

---

**[P2-20] `newsConflictGrouper` 的 Jaccard 閾值 0.3 在英文標題上可能過於寬鬆**

```js
// newsConflictGrouper.mjs [cite:118]
const JACCARD_THRESHOLD = 0.3;
// 中文例子效果好（bigram token 集中）
// 英文標題 token 分佈更散，0.3 可能把主題相近但事件不同的文章誤分群
```

例如：`"Fed raises rates amid inflation concerns"` 與 `"Fed pauses rate hikes amid market uncertainty"` 共享 `fed`、`rates`/`rate`、`amid` 等 token，Jaccard 可能超過 0.3，但這是兩個方向相反的事件。中文 bigram 因語意密度高，0.3 是合理門檻；英文應考慮提高至 0.4~0.5，或對 TW/US 分別設定不同閾值。

---

### 📊 階段五問題總覽

| 編號  | 嚴重度 | 位置                      | 問題摘要                                             |
| ----- | ------ | ------------------------- | ---------------------------------------------------- |
| P1-15 | 🔴 P1  | `keywordConfig.mjs`       | `loadBlacklist` 無 try/catch，檔案缺失時管線崩潰     |
| P1-16 | 🟡 P1  | `newsFetcher.mjs`         | per-source cap 100 等同無效，來源多樣性無保障        |
| P1-17 | 🟡 P1  | `runNewsFetch.mjs`        | `updatePool` 後緊接 `purgeExpiredFromPool`，邏輯重複 |
| P2-18 | 🔵 P2  | `newsFetcher.mjs`         | 6 小時雙重過濾未有文件說明，維護風險                 |
| P2-19 | 🔵 P2  | `runNewsFetch.mjs`        | 動態關鍵字生成傳入假市況，context 失效               |
| P2-20 | 🔵 P2  | `newsConflictGrouper.mjs` | 英文 Jaccard 0.3 門檻可能造成跨事件誤分群            |

所有 Bot 層核心檔案讀取完畢，開始整理分析結果。

---

## 階段六審查結果：Bot 層（adminGuard、handler 拆分）

---

### ⚠️ 問題清單

#### P1 — 中度

---

**[P1-21] `adminGuard` 僅比對 `chat.id`，在群組情境下任何群組成員的訊息都能通過**

```js
// adminGuard.mjs [cite:124]
const incomingId = String(ctx.chat?.id ?? "");

if (!allowedChatId || incomingId !== allowedChatId) {
  return; // 靜默忽略
}
```

`TELEGRAM_USER_ID` 在設計文件中的語意是「使用者個人 ID」，但 grammY 的 `ctx.chat.id` 在私聊中等於 `user.id`，在群組中等於「群組 ID」（負數）。若某天將 Bot 加入群組，且群組的 chat_id 恰好與 `TELEGRAM_USER_ID` 相同（幾乎不可能但存在理論風險），群組成員皆可觸發指令。更現實的風險是：若使用者誤將 `TELEGRAM_USER_ID` 填入一個群組的 chat_id（例如複製貼上時取到的是群組 ID），則群組中的任何人都能操作 Bot。建議同時比對 `ctx.from?.id` 確保是「該使用者本人」發送，而非「在任何 chat_id 相符的對話中的任何人」。

---

**[P1-22] `bot.mjs` 的 `/status` 與 `/status_debug` 使用同步 `readFileSync`，在 Long-Polling 事件循環中執行**

```js
// bot.mjs [cite:126]
bot.command("status", async (ctx) => {
  const raw = JSON.parse(readFileSync(latestPath, "utf-8")); // ← 同步 I/O
  ...
});

bot.command("status_debug", async (ctx) => {
  const raw = JSON.parse(readFileSync(latestPath, "utf-8")); // ← 同步 I/O
  ...
});
```

grammY 的 Long-Polling 在單一 Node.js event loop 中處理 update。`readFileSync` 是同步 I/O，執行期間會阻塞整個 event loop，導致其他 pending update（包含 `/daily` 等長時間任務的鎖定訊息回覆）無法被處理。雖然 `latest.json` 通常很小（幾 KB），在正常情況下阻塞時間極短，但這是反模式——應改用 `fs/promises` 的 `readFile` + `await`，維持事件循環非阻塞。

---

**[P1-23] `runnerLock` 的 lock 檔路徑 `data/.bot_lock` 不在 git 追蹤範圍，但 GitHub Actions 也使用同一 lock，存在跨環境衝突盲點**

```js
// runnerLock.mjs [cite:125]
const LOCK_PATH = join(process.cwd(), "data", ".bot_lock");
```

Bot（VM 長駐 process）與 GitHub Actions（一次性 runner）共享同一個 `data/.bot_lock` 檔案，設計意圖是讓兩者互斥。但 GitHub Actions 在另一台 runner 機器上執行時，`data/` 目錄不是同一份，lock 機制完全失效——Bot 在 VM 上 lock 了，GitHub Actions 完全看不到，反之亦然。若已遷移至 Oracle VM crontab 執行排程，兩者確實在同一台機器上，lock 有效；但 lock 的有效性**靜默依賴部署環境**，任何未來的環境變更（如改回 GitHub Actions 排程）都會悄悄破壞互斥保護，沒有任何告警。

---

#### P2 — 低度 / 設計觀察

---

**[P2-24] `bot.mjs` 單檔達 300+ 行，指令 handler 內嵌在主檔中，可測試性為零**

```js
// bot.mjs [cite:126]
// 所有指令 handler 直接內嵌：start、help、status、status_debug、daily、news、weekly、monthly、optimize
// 沒有任何 handler 被匯出為獨立函數
```

`/status` 的格式化邏輯（讀取 latest.json → 組裝 lines 陣列）、`/status_debug` 的 staleness 判斷（diffHours > 48）等邏輯無法在不啟動 Bot 的情況下單元測試。若未來需要調整狀態顯示格式或新增 debug 欄位，修改成本高且容易引入回歸。建議將每個指令的業務邏輯提取至 `src/modules/bot/handlers/` 下的獨立模組。

---

**[P2-25] `withRunner` 的成功回覆訊息為固定文字 `執行完成`，無法傳遞 runner 的結果摘要**

```js
// bot.mjs [cite:126]
async function withRunner(ctx, runnerName, fn) {
  ...
  await fn();
  await ctx.reply(`✅ <b>${runnerName}</b> 執行完成。`, { parse_mode: "HTML" });
  // fn() 的回傳值被完全丟棄
}
```

`runNewsFetch()` 回傳 `{ appended, total }`，`dailyCheck()` 執行後可知分析結果，但這些結果都被丟棄，使用者只收到「執行完成」。對於手動觸發排程的使用情境，能看到摘要結果（例如「新增 12 篇，pool 總量 47 篇」）比空白的完成訊息更有價值，也能快速確認執行是否有效。

---

**[P2-26] `bot.catch` 只 `console.error`，不向使用者回覆任何訊息**

```js
// bot.mjs [cite:126]
bot.catch((err) => {
  const ctx = err.ctx;
  console.error(`[Bot] ❌ 處理 update ${ctx.update.update_id} 時發生錯誤：`);
  console.error(err.error);
  // ← 沒有 ctx.reply(...)
});
```

grammY 的 `bot.catch` 是最後一道防線，捕捉所有 middleware 與 handler 未處理的例外。若 `adminGuard` 本身拋出例外（例如 `ctx.chat` 為 null），或是 `withRunner` 之外的指令 handler 拋錯，使用者不會收到任何回應，只能看到 VM log。建議在 `bot.catch` 中加入 `ctx.reply(...)` 提示使用者發生非預期錯誤，方便即時察覺。

---

### 📊 階段六問題總覽

| 編號  | 嚴重度 | 位置             | 問題摘要                                                           |
| ----- | ------ | ---------------- | ------------------------------------------------------------------ |
| P1-21 | 🟡 P1  | `adminGuard.mjs` | 僅比對 `chat.id`，未驗證 `from.id`，群組誤用有洩漏風險             |
| P1-22 | 🟡 P1  | `bot.mjs`        | `/status`、`/status_debug` 使用同步 `readFileSync` 阻塞 event loop |
| P1-23 | 🔴 P1  | `runnerLock.mjs` | lock 機制有效性靜默依賴部署環境，跨環境衝突無告警                  |
| P2-24 | 🔵 P2  | `bot.mjs`        | 指令 handler 全部內嵌主檔，可測試性為零                            |
| P2-25 | 🔵 P2  | `bot.mjs`        | `withRunner` 丟棄 runner 回傳值，使用者看不到執行摘要              |
| P2-26 | 🔵 P2  | `bot.mjs`        | `bot.catch` 無向使用者回覆，錯誤無聲靜默                           |

---

## 階段七審查結果：前端 Mini App（API 錯誤處理、loading/error 狀態）

### ⚠️ 問題清單

#### P1 — 中度

---

**[P1-27] `apiFetch` 的 retry 邏輯在 `initData` 為空且達到 `maxRetries` 次後，仍會嘗試送出請求（`attempt === maxRetries` 時繞過 continue）**

```js
// api/index.js [cite:131]
for (let attempt = 0; attempt <= maxRetries; attempt++) {
  const initData = window.Telegram?.WebApp?.initData || (import.meta.env.DEV ? "dev-bypass" : "");

  if (!initData && attempt < maxRetries) {
    await delay(retryDelay);
    continue; // ← 只有 attempt < maxRetries 時才 skip
  }
  // ↑ 當 attempt === maxRetries 時，即使 initData 仍是空字串，也會繼續往下執行 fetch
  // 結果：最後一次 retry 以空字串 initData 送出請求 → 後端 initDataGuard 必然 403
```

這個 403 會被當作正常的 `lastError` 向上拋出，進而觸發前端的 `error` 狀態顯示。使用者看到「載入失敗」的錯誤，但其實根本原因是 Telegram SDK 就是沒有準備好，不應發出請求。正確行為是：若全部 retry 後 `initData` 仍為空，應拋出「Telegram SDK 未就緒」的明確錯誤，而非送出一個注定失敗的請求。

---

**[P1-28] `DashboardView` 的 `loadAll` 在 `onMounted` 直接執行，未等待 `waitReady()` 完成**

```js
// DashboardView.vue [cite:136]
import { useTelegram } from "../composables/useTelegram.js";
// ...
onMounted(loadAll); // ← 直接執行，沒有 await waitReady()

// 正確寫法應為：
onMounted(async () => {
  await waitReady();
  await loadAll();
});
```

`waitReady()` 定義在 `useTelegram.js` 中，專為解決 Telegram SDK 初始化的異步問題，但 `DashboardView` 在 `onMounted` 時直接呼叫 `loadAll()`，並未等待 SDK 就緒。這意味著 `apiFetch` 的 retry 機制是補救這個遺漏的後備方案，而非第一道防線。對照 `ReportsView.vue` 等其他 view 是否也有同樣問題，需要一致性修正。

---

**[P1-29] `apiFetch` 的 retry 間隔固定為 800ms，且每次失敗都重試，`HTTP 4xx` 客戶端錯誤不應重試**

```js
// api/index.js [cite:131]
if (!res.ok) {
  throw new Error(`API ${path} failed: ${res.status}`);
}
// ...
} catch (err) {
  lastError = err;
  if (attempt < maxRetries) await delay(retryDelay); // ← 無論 400/403/404/500 一律重試
}
```

HTTP 403（`initDataGuard` 拒絕）、404（端點不存在）、400（bad request）都是客戶端錯誤，重試不會改變結果，只是浪費 3 × 800ms = 2.4 秒後才顯示錯誤畫面。只有 5xx 或網路錯誤（`fetch` 本身 reject）才應該重試。目前的設計讓每次 403 都等完整 3 次 retry 才顯示錯誤，使用者體驗明顯延遲。

---

#### P2 — 低度 / 設計觀察

---

**[P2-30] `DashboardView` 的 `topNews` 排序只依 `age_band` 字串順序，忽略實際發布時間**

```js
// DashboardView.vue [cite:136]
const order = { fresh: 0, recent: 1, old: 2 };
topNews.value = [...list]
  .sort((a, b) => (order[a.age_band] ?? 2) - (order[b.age_band] ?? 2))
  .slice(0, 3);
```

同屬 `fresh` 的文章之間沒有次排序，最終顯示哪 3 篇取決於 API 回傳順序，可能導致相同 `age_band` 下的新舊文章順序不穩定。建議加入 `publishedAt` 作為 tiebreaker：`|| new Date(b.publishedAt) - new Date(a.publishedAt)`。

---

**[P2-31] `vixLevel` 從 `latestReport.marketState.sentiment.vix` 讀取，`status` 快取也有 `rawUsMarket.vix`，兩個來源可能不一致**

```js
// DashboardView.vue [cite:136]
// VIX 卡片顯示數值：來自 status（即時快取）
const snapValue = status?.data?.rawUsMarket?.vix ?? "—";

// VIX 等級判斷：來自 latestReport（昨日報告）
const vixLevel = computed(() => {
  const v = latestReport.value?.marketState?.sentiment?.vix;
  ...
});
```

VIX 數值顯示用的是 `status.data.rawUsMarket.vix`（今日快取），但 VIX 的顏色等級判斷（card-danger / card-warn / card-ok）卻用 `latestReport.marketState.sentiment.vix`（昨日報告）。若今日 VIX 大幅變動（如從 18 跳到 35），數值顯示會更新，但卡片顏色仍是昨日水平的判斷，產生「看起來危險的數字 + 綠色背景」的矛盾視覺。

---

**[P2-32] `usePortfolioSnapshots` 的錯誤訊息為固定中文字串，無法區分不同錯誤類型**

```js
// usePortfolioSnapshots.js [cite:135]
} catch (e) {
  error.value = '無法載入帳戶快照，請稍後再試'
  // ← 拋棄 e 的所有資訊（狀態碼、網路逾時 vs 403 vs 500）
}
```

`error.value` 是固定字串，導致 AccountView 和 ChartView 永遠顯示相同的錯誤訊息，無法區分「網路斷線」、「加密金鑰未設定（API 特定業務錯誤）」與「伺服器異常」。建議至少傳遞 HTTP status code 供 UI 層差異化顯示。

---

### 📊 階段七問題總覽

| 編號  | 嚴重度 | 位置                       | 問題摘要                                                            |
| ----- | ------ | -------------------------- | ------------------------------------------------------------------- |
| P1-27 | 🟡 P1  | `api/index.js`             | 最後一次 retry 無論 `initData` 是否就緒都強制送出                   |
| P1-28 | 🟡 P1  | `DashboardView.vue`        | `onMounted` 未 `await waitReady()`，SDK 尚未初始化即發請求          |
| P1-29 | 🟡 P1  | `api/index.js`             | 4xx 客戶端錯誤不應重試，現行設計浪費 2.4 秒才顯示錯誤               |
| P2-30 | 🔵 P2  | `DashboardView.vue`        | `topNews` 同 `age_band` 內排序不穩定，缺少 `publishedAt` tiebreaker |
| P2-31 | 🔵 P2  | `DashboardView.vue`        | VIX 數值來源（`status`）與等級判斷來源（`latestReport`）不一致      |
| P2-32 | 🔵 P2  | `usePortfolioSnapshots.js` | 固定錯誤訊息無法區分錯誤類型                                        |

三條流的程式碼全部讀取完畢，開始端對端追蹤分析。

---

## 階段八：資料流端對端審查

---

### 流 A：市場資料 → Dashboard

**資料路徑**：`fetchStatus()` + `fetchReports(5)` → `DashboardView` → VIX / PB / GL / 景氣燈號 / 決策卡 / 評分雷達

**追蹤圖**：

```
/api/status  ──→ status.data.rawUsMarket.vix          (快照卡數值顯示)
/api/reports ──→ latestReport.marketState.sentiment.vix (快照卡顏色判斷)  ← ⚠️ 兩個來源
             ──→ latestReport.signals.weightDetails     (雷達圖 / 評分列表)
             ──→ latestReport.ai                        (AI 教練四個區塊)
```

**⚠️ 問題**

**[A-1] VIX 數值顯示與顏色判斷來自不同時間點的資料（延續 P2-31，端對端確認為實際問題）**

```
snap-value 顯示：status.data.rawUsMarket.vix       ← 今日 /api/status 快取
vixLevel 顏色：  latestReport.marketState.sentiment.vix  ← 昨日報告
```

兩個 API 各自呼叫，時間差最多 24 小時。VIX 在恐慌事件中可以單日 +15 點（如 2024/08/05 當日從 16 → 65），此時 Dashboard 會出現「數值顯示 38（危險），背景卻是綠色（平穩）」的矛盾。

**修正方向**：`vixLevel` 的 `v` 改讀 `status?.data?.rawUsMarket?.vix`，與數值顯示來源一致。

---

**[A-2] `fetchReports(5)` 只取 5 筆，但 sort 後 `sorted[0]` 假設最新在前，若某日報告補發或重跑時序可能不正確**

```js
const sorted = [...list].sort((a, b) =>
  String(b.date ?? "").localeCompare(String(a.date ?? "")),
);
latestReport.value = sorted[0] ?? null;
```

`date` 欄位為 `YYYY-MM-DD` 字串，`localeCompare` 排序在此格式下等同正確。但若同一天產生兩份報告（手動補跑或修補），兩者 `date` 相同，則 `sorted[0]` 取哪份是不確定的，沒有 `createdAt` 等次排序欄位保證。

---

### 流 B：Snapshot → Chart

**資料路徑**：`fetchSnapshots()` / `fetchSnapshotsWeekly()` / `fetchSnapshotsMonthly()` → `ChartView` → ECharts LineChart

**追蹤圖**：

```
/api/reports/snapshots         → { snapshots: [], hasEncryption: bool }
/api/reports/snapshots/weekly  → [] 或 { snapshots: [] }   ← ⚠️ 格式不一致
/api/reports/snapshots/monthly → [] 或 { snapshots: [] }   ← ⚠️ 格式不一致
          ↓
    ChartView load()
          ↓
    dataPoints (ASC 排序)
          ↓
    chartOption computed → ECharts
```

**⚠️ 問題**

**[B-1] `hasEncryption` 只在 `daily` 粒度時由 API 正確回傳，切換到 `weekly`/`monthly` 後該狀態不更新**

```js
// daily：
hasEncryption.value = res.hasEncryption ?? true  ← 正確設定

// weekly（Array 格式）：
if (Array.isArray(res)) {
  raw = [...]
  // ← hasEncryption 完全不更新，保持前一次的值
}
```

場景：使用者先開啟 ChartView 時是 `daily`（`hasEncryption=false`，顯示「快照功能未啟用」），切換到 `weekly`，`weekly` API 回傳空陣列（正常行為：尚無週粒度資料），但 `hasEncryption` 仍是 `false`，於是繼續顯示「🔐 快照功能未啟用」，而正確畫面應是「📫 尚無快照資料」。兩個空態 UI 意義完全不同，使用者會誤以為系統設定問題。

**[B-2] `xLabel()` 在 `weekly` 粒度時優先使用 `pt.period`，但 `period` 欄位在 API 中並非保證存在**

```js
function xLabel(pt) {
  if (granularity.value === "weekly")
    return pt.period ?? (pt.endDate ?? "").slice(5); // 'period' 欄位存在嗎？
}
```

讀取 API routes 中 `/api/reports/snapshots/weekly` 的回傳結構，資料是由後端 aggregation 計算出來的週粒度快照，不一定包含 `period` 欄位。若 `period` 為 `undefined`，fallback 是 `endDate.slice(5)` 顯示 `MM-DD`，月份粒度也有同樣問題。X 軸標籤在多數情況正常，但有潛在的 `undefined.slice()` 風險（若 `endDate` 也不存在）。

**[B-3] `chartOption` computed 的 `series0` 包含 `null` 值（`getValue(p)` 回傳 `pt[metric] ?? null`），ECharts LineChart 在遇到 `null` 時預設連接相鄰點，可能導致圖線跨越空缺點**

```js
const series0 = pts.map((p) => getValue(p));
// getValue 可能回傳 null → ECharts 預設 connectNulls: false
// 但沒有明確設定，行為依賴 ECharts 版本預設值
```

若某幾天的快照資料遺失（例如系統未執行），折線圖會在缺口處斷開或異常連接，應明確設定 `connectNulls: false` 並考慮以 `-` 標示空值。

---

### 流 C：新聞 → NewsView

**資料路徑**：

```
精選報告 tab：fetchReportNews() → /api/report/news → reportNews.tw / reportNews.us
新聞池 tab： fetchNews()       → /api/news        → articles[]
```

**追蹤圖**：

```
onMounted → loadReport()           (精選報告，預設 tab)
switchTab('pool') → loadPool()     (延遲載入，首次切換才觸發)
       ↓
reportLoaded / poolLoaded          (防止重複載入)
       ↓
formatDate(pubDate) → 顯示時間
openArticle(url)   → useTelegram.openLink()
```

**⚠️ 問題**

**[C-1] `NewsView` 的 `poolLoaded` / `reportLoaded` flag 在請求失敗後不設為 `true`，導致切換 tab 無法重試**

```js
async function loadPool() {
  try {
    // ...
    poolLoaded.value = true; // ← 只有成功才設為 true
  } catch (e) {
    poolError.value = e.message;
    // poolLoaded 維持 false
  }
}

function switchTab(tab) {
  if (tab === "pool" && !poolLoaded.value) loadPool(); // ← 每次切換都會重打
}
```

表面上看「失敗後切換回去可以重試」，但實際使用情境是：使用者在「精選報告」tab 切換到「新聞池」，發生網路錯誤，點重試，接著切去「精選報告」再切回「新聞池」，**又觸發一次 `loadPool()`**，若網路尚未恢復，會產生一個新的重疊請求。有 retry 按鈕，也有 tab 切換觸發的隱式 retry，兩個機制沒有互斥。

**[C-2] `formatDate(pubDate)` 在 `pubDate` 為 `undefined` 或 `null` 時，`new Date(undefined)` 回傳 `Invalid Date`，但 catch 只捕捉例外，不捕捉 NaN/Invalid**

```js
function formatDate(pubDate) {
  try {
    return new Date(pubDate).toLocaleString('zh-TW', {...})
  } catch {
    return pubDate  // ← new Date(undefined) 不 throw，回傳 "Invalid Date" 字串
  }
}
```

`new Date(undefined).toLocaleString()` 不會拋出例外，它回傳字串 `"Invalid Date"`，會直接顯示在 UI 上。此問題在「精選報告」tab 的 `item.pubDate` 欄位為 null 時（API 資料不完整）最容易觸發。

**[C-3] 新聞池（`/api/news`）與精選報告（`/api/report/news`）是兩個不同端點，資料結構差異大，但共用同一組 `news-card` CSS，`news-card @click` 分別用 `article.url` 和 `item.link || item.url`，欄位名稱不一致**

```html
<!-- 精選報告 news-card -->
@click="openArticle(item.link || item.url)" ← link 優先，url 備援

<!-- 新聞池 news-card -->
@click="openArticle(article.url)" ← 只用 url
```

若精選報告的資料只有 `url` 沒有 `link` 是正常的，但代表兩個資料來源的 URL 欄位名稱在後端就不統一（一個叫 `link`，一個叫 `url`）。這是 API 設計層面的輕度不一致，但在前端維護時容易造成混淆。

---

### 📊 階段八問題總覽

| 編號 | 流  | 嚴重度 | 問題摘要                                                                                 |
| ---- | --- | ------ | ---------------------------------------------------------------------------------------- |
| A-1  | 流A | 🟡 P1  | VIX 顏色判斷用昨日報告，數值顯示用今日快取，兩者可能矛盾                                 |
| A-2  | 流A | 🔵 P2  | 同日兩份報告時 `sorted[0]` 結果不確定，缺乏 `createdAt` 次排序                           |
| B-1  | 流B | 🟡 P1  | 切換 weekly/monthly 粒度時 `hasEncryption` 不更新，空態 UI 顯示錯誤訊息                  |
| B-2  | 流B | 🔵 P2  | `xLabel()` 中 `pt.period` 欄位不保證存在，若 `endDate` 也缺失有 `undefined.slice()` 風險 |
| B-3  | 流B | 🔵 P2  | `series0` 含 `null` 但未明確設定 `connectNulls`，折線缺口行為依賴 ECharts 預設值         |
| C-1  | 流C | 🟡 P1  | `poolLoaded` 失敗後維持 `false`，切換 tab 會產生重疊的隱式 retry 請求                    |
| C-2  | 流C | 🔵 P2  | `formatDate(undefined)` 不 throw，直接顯示 `"Invalid Date"` 字串                         |
| C-3  | 流C | 🔵 P2  | 精選報告用 `item.link\|\|item.url`，新聞池用 `article.url`，後端 URL 欄位名稱不統一      |

所有後端路由與資料結構讀取完畢，開始逐端點進行 contract 比對。

---

### 📊 階段九：API 對接正確性稽核報告

逐一比對後端回傳欄位 vs 前端實際使用欄位。

---

### 端點一：`GET /api/status` → `DashboardView`

**後端回傳**：直接透傳 `data/market/latest.json` 完整內容

**前端使用欄位**（`DashboardView`）：

| 前端取用路徑                     | 對應後端欄位           | 狀態                           |
| -------------------------------- | ---------------------- | ------------------------------ |
| `status?.data?.rawUsMarket?.vix` | `data.rawUsMarket.vix` | ⚠️ **有疑慮**                  |
| `status?.updatedAt`              | `updatedAt`            | ✅ 需確認 latest.json 有此欄位 |

> **問題 S-1（關鍵）**：後端 `status.mjs` 直接把 `latest.json` 整包送出，前端讀 `status?.data?.rawUsMarket?.vix`，中間多一層 `.data`。
>
> - 若 `latest.json` 的根結構是 `{ data: { rawUsMarket: {...} }, updatedAt: "..." }` → ✅ 正確
> - 若 `latest.json` 的根結構是 `{ rawUsMarket: {...}, updatedAt: "..." }` → ❌ **`status.data` 會是 `undefined`，所有快照卡數值顯示 `"—"`**
>
> 需要確認 `latest.json` 的實際結構。

---

### 端點二：`GET /api/reports?limit=5` → `DashboardView`

**後端回傳**：`Array<{ date, ...報告 JSON }>` DESC 順序

**前端取用欄位**（`DashboardView`）：

| 前端取用路徑                                                         | 後端對應欄位                                         | 狀態                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------ |
| `latestReport.date`                                                  | `date`（後端注入）                                   | ✅ 正確                                                |
| `latestReport.signals?.status`                                       | `signals.status`                                     | ✅                                                     |
| `latestReport.signals?.suggestion`                                   | `signals.suggestion`                                 | ✅                                                     |
| `latestReport.signals?.score`                                        | `signals.score`                                      | ✅                                                     |
| `latestReport.signals?.target`                                       | `signals.target`                                     | ✅                                                     |
| `latestReport.signals?.grossLeverage`                                | `signals.grossLeverage`                              | ✅                                                     |
| `latestReport.signals?.priceChangePercent`                           | `signals.priceChangePercent`                         | ✅                                                     |
| `latestReport.signals?.priceChangePercentText`                       | `signals.priceChangePercentText`                     | ✅                                                     |
| `latestReport.signals?.weightScore`                                  | `signals.weightScore`                                | ✅                                                     |
| `latestReport.signals?.weightDetails`                                | `signals.weightDetails`                              | ✅                                                     |
| `latestReport.signals?.marketStatus`                                 | `signals.marketStatus`                               | ⚠️ **欄位名稱待確認**（`statusEmoji` computed 讀此欄） |
| `latestReport.signals?.maintenanceRisk?.level`                       | `signals.maintenanceRisk.level`                      | ✅                                                     |
| `latestReport.signals?.panicBypassActive`                            | `signals.panicBypassActive`                          | ✅                                                     |
| `latestReport.signals?.valuationGuardResult`                         | `signals.valuationGuardResult`                       | ✅                                                     |
| `latestReport.signals?.valuationMomentumResult`                      | `signals.valuationMomentumResult`                    | ✅                                                     |
| `latestReport.marketState?.sentiment?.vix`                           | `marketState.sentiment.vix`                          | ✅                                                     |
| `atestReport.value?.signals?.valuationGuardResult?.currentPR`        | `signals.valuationGuardResult.currentPR`             | ✅                                                     |
| `latestReport.marketState?.economy?.ndcLight`                        | `marketState.economy.ndcLight`                       | ✅                                                     |
| `latestReport.strategySnapshot?.indicator?.buy?.minWeightScoreToBuy` | `strategySnapshot.indicator.buy.minWeightScoreToBuy` | ✅                                                     |
| `latestReport.ai?.risk_warnings`                                     | `ai.risk_warnings`                                   | ✅ snake_case 確認                                     |
| `latestReport.ai?.action_items`                                      | `ai.action_items`                                    | ✅                                                     |
| `latestReport.ai?.mindset_advice`                                    | `ai.mindset_advice`                                  | ✅                                                     |
| `latestReport.ai?.coach_internal_thinking`                           | `ai.coach_internal_thinking`                         | ✅                                                     |
| `latestReport.signals?.status` (lightEmoji 讀 `rawNdc`)              | **`status?.data?.rawNdc?.light`**                    | ⚠️ **問題**                                            |

> **問題 S-2（重要）**：`lightEmoji` computed 邏輯讀的是 `latestReport.marketState.economy.ndcLight`，但 Dashboard template 的「景氣燈號」卡片 `snap-sub` 顯示的是 `status?.data?.rawNdc?.light` 。兩個路徑取用不同來源。若 `latest.json` 沒有 `.data.rawNdc.light`（同 S-1 疑慮），則該卡片 sub 文字顯示 `"—"`。

---

### 端點三：`GET /api/reports/snapshots` → `ChartView`

**後端回傳**：`{ snapshots: Array<normaliseSnapshot 輸出>, hasEncryption: boolean }`

**`normaliseSnapshot` 輸出欄位** ：

```
date, qty0050, qtyZ2, totalLoan, cash,
avgCost0050, avgCostZ2, price0050, priceZ2,
lastBuyDate, netValueCost, netValueMarket
```

**前端取用欄位**（`ChartView`）：

| 前端取用            | 後端欄位         | 狀態 |
| ------------------- | ---------------- | ---- |
| `res.snapshots`     | `snapshots`      | ✅   |
| `res.hasEncryption` | `hasEncryption`  | ✅   |
| `pt.date`           | `date`           | ✅   |
| `pt.netValueMarket` | `netValueMarket` | ✅   |
| `pt.qty0050`        | `qty0050`        | ✅   |
| `pt.qtyZ2`          | `qtyZ2`          | ✅   |
| `pt.totalLoan`      | `totalLoan`      | ✅   |
| `pt.price0050`      | `price0050`      | ✅   |
| `pt.priceZ2`        | `priceZ2`        | ✅   |

✅ daily snapshots 端點對接**完全正確**，無欄位誤用。

---

### 端點四：`GET /api/reports/snapshots/weekly` 與 `/monthly` → `ChartView`

**後端回傳**：`Array<{ period, startDate, endDate, tradingDays, ...normaliseSnapshot欄位 }>`

**前端取用**（`ChartView`）：

| 前端取用                                            | 後端欄位                              | 狀態                 |
| --------------------------------------------------- | ------------------------------------- | -------------------- |
| `pt.period`                                         | `period`（ISO week key 或 `YYYY-MM`） | ✅ **有此欄位**      |
| `pt.endDate`                                        | `endDate`                             | ✅                   |
| `pt.startDate`                                      | `startDate`                           | ✅                   |
| tooltip `pt.startDate – pt.endDate`                 | 兩欄均存在                            | ✅                   |
| `xLabel` weekly: `pt.period ?? pt.endDate.slice(5)` | `period` 確認存在                     | ✅ fallback 不會觸發 |

> **修正前次疑慮 B-2**：`period` 欄位**確實存在**於 `aggregateSnapshotsByWeek` 的輸出中 ，B-2 問題降級。但 `endDate` 不存在的情況（群組為空）仍是邊界風險。

---

### 端點五：`GET /api/news` → `NewsView` / `DashboardView`

**後端回傳**：直接透傳 `pool_filtered_active.json` 內容（應為陣列）

**前端取用欄位**：

| 取用位置                       | 欄位                                                                                                                                        | 狀態 |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| `DashboardView` `topNews` list | `article.age_band`, `article.source`, `article._region`, `article.title`, `article.url`                                                     | ✅   |
| `NewsView` 新聞池              | `article.id`, `article.url`, `article.age_band`, `article._region`, `article.source`, `article.pubDate`, `article.title`, `article.summary` | ✅   |

> **問題 N-1（輕度）**：`/api/news` 後端**直接透傳 JSON 檔案**，若 `pool_filtered_active.json` 的根結構是 `{ articles: [...] }` 而非純陣列 `[...]`，則前端的 `Array.isArray(data)` 檢查會失敗，走 `data?.articles ?? []` 備援。`DashboardView` 的 `loadAll` 中 的備援路徑為 `nRes.value?.articles ?? []`，有防護。但 `NewsView` 的 `loadPool` 直接使用同樣的雙路徑判斷 ，也有防護。**關鍵是後端的 JSON 結構必須確保一致**。

---

### 端點六：`GET /api/report/news` → `NewsView`（精選報告 tab）

**後端回傳**：`{ tw: [...], us: [...], generatedAt: string | null }`

新聞項目結構（來自 `report.news`）：**`{ source, pubDate, title, summary, link, url }`**

**前端取用**（`NewsView` 精選報告）：

| 前端取用                  | 後端欄位       | 狀態            |
| ------------------------- | -------------- | --------------- |
| `data.tw`                 | `tw`           | ✅              |
| `data.us`                 | `us`           | ✅              |
| `data.generatedAt`        | `generatedAt`  | ✅              |
| `item.source`             | `source`       | ✅              |
| `item.pubDate`            | `pubDate`      | ✅              |
| `item.title`              | `title`        | ✅              |
| `item.summary`            | `summary`      | ✅              |
| `item.link \|\| item.url` | `link` / `url` | ⚠️ **問題 N-2** |

> **問題 N-2（確認 C-3 根因）**：後端 `report.news` 的項目包含 `link` 欄位（RSS feed 典型命名），也可能有 `url`。前端 `item.link || item.url` 的處理方式正確，但**新聞池的項目只有 `url`**（`pool_filtered_active.json` 用 `url`），導致精選報告與新聞池的 URL 欄位命名不統一，兩個資料來源的 link 欄位名稱在後端就不一致，屬於 API contract 設計問題。

---

### 🔴 確認為真實對接錯誤的問題

| 編號    | 端點               | 嚴重度      | 問題                                                                                                                            |
| ------- | ------------------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **S-1** | `/api/status`      | 🔴 **嚴重** | 前端讀 `status.data.rawUsMarket.vix`，但後端直接透傳 `latest.json`，**若 JSON 根層無 `.data` 包裝層，所有快照卡永遠顯示 `"—"`** |
| **S-2** | `/api/status`      | 🟡 P1       | 景氣燈號卡 sub 文字讀 `status.data.rawNdc.light`，與 S-1 同樣依賴 `.data` 包裝層是否存在                                        |
| **N-2** | `/api/report/news` | 🔵 P2       | 精選報告用 `item.link\|\|item.url`，新聞池只有 `url`，後端兩個資料來源 URL 欄位命名不統一                                       |

---

### ⚠️ 需要確認的關鍵問題

**S-1 是最高優先級問題**，需要立即確認 `data/market/latest.json` 的實際根層結構：

```json
// 情況 A（前端期望的格式）— 有 .data 包裝：
{ "data": { "rawUsMarket": { "vix": 18 }, "rawNdc": { "light": "綠燈" } }, "updatedAt": "..." }

// 情況 B（可能實際的格式）— 無包裝層，直接平鋪：
{ "rawUsMarket": { "vix": 18 }, "rawNdc": { "light": "綠燈" }, "updatedAt": "..." }
```

### 後續審查結果-`/api/status` × `DashboardView` 完整對接稽核

#### 🟢 `latest.json` 根層結構確認

```json
{
  "_meta": { ... },   // ← 後端透傳整包
  "data": { ... }     // ← .data 包裝層確實存在
}
```

後端 `status.mjs` 直接透傳整個 JSON，前端讀 `status?.data?.xxx`，**路徑完全吻合**。S-1 已解除。

---

#### 完整欄位比對表

| 前端讀取路徑                               | `latest.json` 實際欄位 | 型別       | 狀態                             |
| ------------------------------------------ | ---------------------- | ---------- | -------------------------------- |
| `status?.data?.rawUsMarket?.vix`           | `"19.31"`              | **string** | ⚠️ **BUG-1：型別不符**           |
| `status?.data?.rawNdc?.light`              | `"紅燈 (過熱)"`        | string     | ✅                               |
| `status?.updatedAt`                        | **不存在**             | —          | 🔴 **BUG-2：欄位缺失**           |
| `latestReport.marketState?.sentiment?.vix` | 來自 report，非 status | —          | ✅（不同來源，需對 report 確認） |

---

#### 🔴 BUG-1：VIX 顯示值為字串，但 `vixLevel` 比較邏輯用數字

**位置**：`DashboardView.vue` `vixLevel` computed

```js
// 前端讀取
const v = latestReport.value?.marketState?.sentiment?.vix;
// ↑ 這是從 report 讀，暫無問題

// 但快照卡顯示的 VIX 數值來自 status
status?.data?.rawUsMarket?.vix; // → 值為 "19.31"（字串）
```

`latest.json` 中 `rawUsMarket.vix` 的值是 **`"19.31"`（字串型別）**，快照卡直接顯示沒有問題（顯示 `"19.31"`）。但若未來 `vixLevel` 改為讀 `status.data.rawUsMarket.vix` 做判斷時，會產生 `"19.31" >= 30` 為 `false` 的靜默錯誤。

目前 `vixLevel` 讀的是 `latestReport.marketState.sentiment.vix`（來自 report），與 `status.data.rawUsMarket.vix` 是**兩個不同來源**：

| 來源     | 路徑                                     | 用途                    |
| -------- | ---------------------------------------- | ----------------------- |
| `status` | `status.data.rawUsMarket.vix`            | 快照卡**顯示值**        |
| `report` | `latestReport.marketState.sentiment.vix` | 快照卡**顏色/等級邏輯** |

這代表 **VIX 顯示值與顏色判斷邏輯讀的是不同來源**，若兩者不同步就會出現「顯示 19.31 卻標示為警戒色」的矛盾。

---

#### 🔴 BUG-2：`status?.updatedAt` 欄位不存在

**位置**：`DashboardView.vue` 最底部

```html
<p v-if="status?.updatedAt" class="update-time">
  資料更新：{{ formatUpdatedAt(status.updatedAt) }}
</p>
```

`latest.json` 的根層只有 `_meta` 與 `data`，**完全沒有 `updatedAt` 欄位**。

正確路徑應為：

```js
status?._meta?.lastRun; // → "2026-04-26T05:24:00.077Z" ✅
```

目前因為 `v-if="status?.updatedAt"` 永遠為 `false`，所以**「資料更新時間」永遠不顯示**，是靜默失敗而非報錯。

---

#### ⚠️ 其他觀察

| 項目                                                        | 說明                                    | 建議                             |
| ----------------------------------------------------------- | --------------------------------------- | -------------------------------- |
| `status?.data?.rawNdc?.light` (snap-sub 文字)               | 值為 `"紅燈 (過熱)"` ✅ 正確對接        | 無問題                           |
| `lightEmoji` 讀 `latestReport.marketState.economy.ndcLight` | 是 report 欄位，非 status               | 需另行確認 report 結構中有此欄位 |
| `status.data.rawUsMarket.vix` 型別為 string                 | 顯示沒問題，但數值計算需 `parseFloat()` | 建議後端統一輸出 number          |

---

#### 修復建議

**BUG-2 修正（一行，立即可修）**：

```html
<!-- 修改前 -->
<p v-if="status?.updatedAt" class="update-time">
  資料更新：{{ formatUpdatedAt(status.updatedAt) }}
</p>

<!-- 修改後 -->
<p v-if="status?._meta?.lastRun" class="update-time">
  資料更新：{{ formatUpdatedAt(status._meta.lastRun) }}
</p>
```

**BUG-1 VIX 雙來源問題（建議同步）**：

```js
// vixLevel 建議統一改為讀 status 來源，避免兩者不同步
const vixLevel = computed(() => {
  const v = parseFloat(status.value?.data?.rawUsMarket?.vix); // 加 parseFloat
  // ... 比較邏輯不變
});
```
