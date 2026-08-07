# 排程程式耦合點分析報告

**分析日期**：2026-08-07
**分析對象**：5 個排程 CLI 程式
**目標**：識別外部依賴，規劃依賴注入介面，為測試重構提供基礎

---

## 1. 程式清單與核心邏輯分離度

| 程式           | CLI 入口               | 核心邏輯函數                    | 已分離度 | 行數 (CLI/核心) |
| -------------- | ---------------------- | ------------------------------- | -------- | --------------- |
| Daily Check    | `runDailyCheck.mjs`    | `dailyCheck()` (dailyCheck.mjs) | ✅ 高    | 90 / 291        |
| Monthly Report | `runMonthlyReport.mjs` | `runMonthlyReport()`            | ✅ 高    | ~90 / ~90       |
| Weekly Report  | `runWeeklyReport.mjs`  | `runWeeklyReport()`             | ✅ 高    | 20 / 90         |
| News Fetch     | `runNewsFetch.mjs`     | `runNewsFetch()`                | ✅ 高    | 25 / 100        |
| Optimizer      | `runOptimizer.mjs`     | `main()` (未分離)               | ❌ 低    | 70 / -          |

---

## 2. 依賴關係圖

```
┌─────────────────────────────────────────────────────────────────────┐
│                        5 個排程程式                                    │
├──────────┬──────────┬──────────┬──────────┬──────────┐
│ Daily    │ Monthly  │ Weekly   │ News     │ Optimizer│
│ Check    │ Report   │ Report   │ Fetch    │          │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────┬─────┘
     │          │          │          │          │
     ▼          ▼          ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        共用核心依賴 (External Dependencies)          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  📊 Data Providers (資料存取層)                                      │
│  ├── archiveManager              ← 所有程式                        │
│  │   ├── getLatestReport()        ← Daily, Monthly, Weekly        │
│  │   ├── getLatestMarketData()    ← News, Daily                   │
│  │   ├── saveReport()             ← Daily                          │
│  │   ├── saveValuationGuardState()← Daily                          │
│  │   ├── loadRecentReports()      ← Monthly, Weekly               │
│  │   ├── getStockHistory()        ← Daily (via dataAdapter)       │
│  │   └── listArchiveDates()       ← Daily (via dataAdapter)       │
│  ├── newsPoolManager             ← News, Daily                    │
│  │   ├── updatePool()             ← News                          │
│  │   └── purgeExpiredFromPool()   ← News                          │
│  └── snapshotCrypto              ← Daily                          │
│                                                                     │
│  🧠 Strategy & AI Engine (核心計算層)                                │
│  ├── strategyEngine              ← Daily                          │
│  │   └── getInvestmentSignalAsync()                                │
│  ├── signalContext               ← Daily                          │
│  │   ├── buildSignalContext()     ← Daily                          │
│  │   └── buildDailyRunContext()   ← Daily                          │
│  ├── dailyRunContext             ← Daily                          │
│  ├── aiCoach                     ← Daily, News                    │
│  │   ├── getAiInvestmentAdvice()  ← Daily                          │
│  │   └── generateDailySearchQueries()← News                        │
│  ├── llmJudge                    ← Daily                          │
│  │   ├── shouldRunJudge()         ← Daily                          │
│  │   └── runJudge()               ← Daily                          │
│  ├── periodReportAgent           ← Monthly, Weekly                │
│  │   ├── loadRecentReports()      ← Monthly, Weekly, Optimizer   │
│  │   ├── buildPeriodStats()       ← Monthly, Weekly               │
│  │   ├── generatePeriodAiSummary()← Monthly, Weekly               │
│  │   └── buildSignalAccuracyStats()← Monthly, Weekly              │
│  ├── ruleOptimizerAgent          ← Optimizer                      │
│  │   └── runRuleOptimizer()       ← Optimizer                     │
│  ├── aiClient (Langfuse)         ← 所有程式                       │
│  │   ├── score()                  ← News, Daily, Optimizer        │
│  │   └── shutdownAsync()          ← 所有程式                      │
│  └── strategyLoader              ← Daily (via strategyEngine)    │
│                                                                     │
│  📱 Notifications (通知發送層)                                       │
│  ├── notifier                    ← Daily, Optimizer               │
│  │   ├── broadcastDailyReport()   ← Daily                          │
│  │   └── broadcastOptimizerResult()← Optimizer                    │
│  ├── telegramClient              ← Daily, News, Monthly, Weekly   │
│  │   └── sendTelegramBatch()      ← Daily, Monthly, Weekly, Optimizer│
│  ├── periodReportBuilder         ← Monthly, Weekly                │
│  │   ├── buildPeriodReportMessages()                             │
│  │   └── buildCompactPeriodMessage()                             │
│  └── templates/*                 ← Monthly, Weekly, Daily         │
│                                                                     │
│  ☁️ External Services (外部服務)                                    │
│  ├── Google Sheets API           ← Daily (logDailyToSheet)        │
│  ├── Telegram Bot API            ← 所有程式 (via telegramClient)  │
│  ├── LLM API (OpenAI/Anthropic)  ← Daily, Monthly, Weekly, News  │
│  ├── RSS/News APIs               ← News                           │
│  └── Langfuse                    ← 所有程式                      │
│                                                                     │
│  🗄️ Local Storage (本地儲存)                                        │
│  ├── data/reports/*.json         ← Daily, Monthly, Weekly        │
│  ├── data/market/latest.json     ← Daily, News                   │
│  ├── data/stock_history/         ← Daily (via dataAdapter)       │
│  ├── data/news/pool_*.json       ← News                          │
│  ├── data/config/Strategy*.json  ← Daily, Optimizer              │
│  ├── data/config/blacklist.json  ← Optimizer                     │
│  ├── data/ai_logs/               ← News, Optimizer               │
│  └── data/config/ConfigMeta.json ← Daily (config route)          │
│                                                                     │
│  ⚙️ Config & Utils                                               │
│  ├── envGuard                    ← 所有程式 (assertEnv)           │
│  ├── logger (pino)               ← 所有程式                      │
│  ├── coreUtils (TwDate, stepTimer)← Daily, Monthly, Weekly       │
│  ├── dailyRunContext             ← Daily                          │
│  ├── ilnState                    ← Daily                          │
│  └── valuationGuard              ← Daily                          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 耦合點統計

### 3.1 各程式直接 import 計數

| 程式           | 檔案數 | 核心模組 | 外部服務 | 本地儲存 | 工具函數 |
| -------------- | ------ | -------- | -------- | -------- | -------- |
| Daily Check    | 24     | 12       | 4        | 3        | 6        |
| Monthly Report | 12     | 6        | 3        | 2        | 3        |
| Weekly Report  | 12     | 6        | 3        | 2        | 3        |
| News Fetch     | 11     | 7        | 3        | 2        | 4        |
| Optimizer      | 7      | 2        | 2        | 1        | 3        |

### 3.2 高耦合模組 (被 ≥3 個程式依賴)

| 模組                  | 依賴程式                                | 建議抽介面         |
| --------------------- | --------------------------------------- | ------------------ |
| `archiveManager`      | Daily, Monthly, Weekly, News            | ✅ IDataProvider   |
| `telegramClient`      | Daily, Monthly, Weekly, Optimizer, News | ✅ INotifier       |
| `aiClient (Langfuse)` | 所有                                    | ✅ ITelemetry      |
| `logger`              | 所有                                    | 內建 pino，無需抽  |
| `envGuard`            | 所有                                    | 啟動時單次，無需抽 |
| `aiClient (LLM)`      | Daily, Monthly, Weekly, News            | ✅ IAIProvider     |

### 3.3 單一程式專用模組 (耦合度低，不需抽介面)

| 模組                 | 專用於          | 行動                       |
| -------------------- | --------------- | -------------------------- |
| `strategyEngine`     | Daily           | 保持直接 import (已有測試) |
| `signalContext`      | Daily           | 保持直接 import            |
| `periodReportAgent`  | Monthly, Weekly | 考慮 IReportGenerator      |
| `ruleOptimizerAgent` | Optimizer       | 保持直接 import            |
| `newsPoolManager`    | News            | 考慮 INewsProvider         |
| `ruleOptimizerAgent` | Optimizer       | 保持直接 import            |

---

## 4. 介面設計提案

### 4.1 IDataProvider (資料存取統一介面)

```typescript
// src/interfaces/IDataProvider.mjs
export interface IDataProvider {
  // Reports
  getLatestReport(): Promise<Report | null>;
  getLatestMarketData(): Promise<MarketData | null>;
  saveReport(report: Report): Promise<void>;
  saveValuationGuardState(state: ValuationGuardState): Promise<void>;
  loadRecentReports(limit: number): Promise<Report[]>;
  loadRecentReports(count: number, offset?: number): Promise<Report[]>;

  // Market History
  getStockHistory(stockNo: string, monthKey: string): Promise<OHLCV[] | null>;
  listArchiveDates(): Promise<string[]>;

  // News
  updatePool(articles: Article[]): Promise<PoolUpdateResult>;
  purgeExpiredFromPool(): Promise<number>;

  // Config
  getStrategyConfig(): Promise<StrategyConfig>;
  saveStrategyConfig(config: StrategyConfig): Promise<void>;
  getBlacklist(): Promise<BlacklistConfig>;

  // Valuation Guard
  getValuationGuardState(): Promise<ValuationGuardState>;
}
```

### 4.2 INotifier (通知發送統一介面)

```typescript
// src/interfaces/INotifier.mjs
export interface INotifier {
  // Telegram
  sendTelegramBatch(messages: TelegramMessage[]): Promise<void>;
  sendTelegramMessage(
    chatId: string,
    text: string,
    options?: object,
  ): Promise<void>;

  // Daily Report
  broadcastDailyReport(
    data: DailyReportData,
    newsMessages: NewsMessage[],
    enabled: boolean,
  ): Promise<void>;

  // Optimizer
  broadcastOptimizerResult(
    result: OptimizerResult,
    totalRuleCount: number,
  ): Promise<void>;

  // Period Reports
  sendPeriodReport(messages: TelegramMessage[]): Promise<void>;
}
```

### 4.3 IAIProvider (AI/LLM 統一介面)

```typescript
// src/interfaces/IAIProvider.mjs
export interface IAIProvider {
  // Daily
  getInvestmentSignal(signalData: SignalData): Promise<InvestmentResult>;
  getAiInvestmentAdvice(params: AiAdviceParams): Promise<AiAdviceResult>;
  shouldRunJudge(context: JudgeContext): boolean;
  runJudge(traceId: string, advice: object, sessionId: string): Promise<void>;

  // News
  generateDailySearchQueries(
    params: SearchQueryParams,
  ): Promise<SearchQueriesResult>;

  // Period Reports
  generatePeriodAiSummary(
    stats: PeriodStats,
    reports: Report[],
    period: string,
    sessionId: string,
  ): Promise<AiSummaryResult>;

  // Optimizer
  runRuleOptimizer(): Promise<OptimizerResult>;

  // Langfuse
  score(payload: LangfuseScorePayload): Promise<void>;
  shutdownAsync(): Promise<void>;
}
```

### 4.4 INewsProvider (新聞專用)

```typescript
// src/interfaces/INewsProvider.mjs
export interface INewsProvider {
  getRawNews(
    queries: SearchQueries,
  ): Promise<{ articles: Article[]; metrics: NewsMetrics }>;
  updatePool(articles: Article[]): Promise<PoolUpdateResult>;
  generateSearchQueries(
    params: SearchQueryParams,
  ): Promise<SearchQueriesResult>;
}
```

### 4.5 IReportGenerator (週/月報專用)

```typescript
// src/interfaces/IReportGenerator.mjs
export interface IReportGenerator {
  loadRecentReports(limit: number): Promise<Report[]>;
  buildPeriodStats(
    reports: Report[],
    period: "weekly" | "monthly",
  ): PeriodStats;
  buildSignalAccuracyStats(
    reports: Report[],
    allReports: Report[],
    period: string,
  ): AccuracyStats;
  generateAiSummary(
    stats: PeriodStats,
    reports: Report[],
    periodLabel: string,
    sessionId: string,
  ): Promise<string | null>;
  buildMessages(
    stats: PeriodStats,
    aiSummary: string | null,
    period: string,
    accuracyStats?: AccuracyStats,
    webAppUrl?: string,
  ): TelegramMessage[];
}
```

---

## 5. Mock 工廠設計

### 5.1 目錄結構

```
src/test/mocks/
├── index.mjs                    # 統一導出
├── mockDataProvider.mjs         # IDataProvider 實作
├── mockNotifier.mjs             # INotifier 實作
├── mockAIProvider.mjs           # IAIProvider 實作
├── mockNewsProvider.mjs         # INewsProvider 實作
├── mockReportGenerator.mjs      # IReportGenerator 實作
└── factories/
    ├── createMockReport.mjs
    ├── createMockMarketData.mjs
    └── createMockSignalData.mjs
```

### 5.2 Factory Function 模式範例

```javascript
// src/test/mocks/mockDataProvider.mjs
import { vi } from "vitest";

export function createMockDataProvider(overrides = {}) {
  return {
    getLatestReport: vi
      .fn()
      .mockResolvedValue(overrides.latestReport ?? createMockReport()),
    getLatestMarketData: vi
      .fn()
      .mockResolvedValue(overrides.marketData ?? createMockMarketData()),
    saveReport: vi.fn().mockResolvedValue(undefined),
    saveValuationGuardState: vi.fn().mockResolvedValue(undefined),
    loadRecentReports: vi
      .fn()
      .mockResolvedValue(overrides.reports ?? [createMockReport()]),
    getStockHistory: vi.fn().mockResolvedValue(overrides.history ?? []),
    listArchiveDates: vi.fn().mockResolvedValue(["2026-08-01", "2026-08-02"]),
    updatePool: vi.fn().mockResolvedValue({ appended: 5, total: 100 }),
    purgeExpiredFromPool: vi.fn().mockResolvedValue(2),
    getStrategyConfig: vi
      .fn()
      .mockResolvedValue({ version: "2.0", defense: {} }),
    saveStrategyConfig: vi.fn().mockResolvedValue(undefined),
    getBlacklist: vi.fn().mockResolvedValue({ titleBlackListPatterns: [] }),
    getValuationGuardState: vi.fn().mockResolvedValue({ defenseLatch: false }),
    ...overrides,
  };
}
```

---

## 6. 重構遷移計畫

### 6.1 檔案遷移對照表

| 原路徑                     | 新路徑                              | 說明              |
| -------------------------- | ----------------------------------- | ----------------- |
| `src/dailyCheck.mjs`       | `src/scheduler/dailyCheck.mjs`      | 核心邏輯          |
| `src/runDailyCheck.mjs`    | `src/runDailyCheck.mjs`             | CLI 入口 (薄包裝) |
| `src/runMonthlyReport.mjs` | `src/runMonthlyReport.mjs`          | CLI 入口 (已分離) |
| `src/runWeeklyReport.mjs`  | `src/runWeeklyReport.mjs`           | CLI 入口 (已分離) |
| `src/runNewsFetch.mjs`     | `src/runNewsFetch.mjs`              | CLI 入口 (已分離) |
| `src/runOptimizer.mjs`     | `src/scheduler/optimizer.mjs`       | 新建核心邏輯      |
| `src/runOptimizer.mjs`     | `src/runOptimizer.mjs`              | CLI 入口 (薄包裝) |
| (新建)                     | `src/scheduler/dailyCheckLogic.mjs` | 純邏輯提取        |
| (新建)                     | `src/interfaces/*.mjs`              | 介面定義          |
| (新建)                     | `src/test/mocks/*.mjs`              | Mock 工廠         |

### 6.2 遷移順序 (依賴最少優先)

1. **News Fetch** → 最少依賴，先建立 Mock 基礎設施
2. **Optimizer** → 依賴少，邏輯獨立
3. **Weekly/Monthly Report** → 共用 periodReportAgent
4. **Daily Check** → 最複雜，最後處理

---

## 7. 風險與緩解

| 風險                            | 影響             | 緩解策略                                                           |
| ------------------------------- | ---------------- | ------------------------------------------------------------------ |
| `dailyCheck.mjs` 291 行邏輯過長 | 重構易出錯       | 先寫特徵測試，再逐步提取                                           |
| `archiveManager` 方法過多       | 介面過大         | 分拆為 `IReportRepository`、`IMarketRepository`、`INewsRepository` |
| `langfuse` 所有程式都用         | 關閉時機複雜     | 統一由 CLI 入口管理生命週期，核心邏輯不依賴                        |
| `dotenv/config` 多處重複        | 環境變數載入時機 | 統一在 CLI 入口載入，核心邏輯不 import                             |
| `logger` 全域上下文             | 並行測試干擾     | Mock logger 或使用 `vi.mock` 隔離                                  |

---

## 8. 下一步行動

1. **建立介面定義** (`src/interfaces/`)
2. **建立 Mock 工廠** (`src/test/mocks/`)
3. **遷移 News Fetch** (最簡單，驗證架構)
4. **遷移 Optimizer** (提取核心邏輯)
5. **遷移 Weekly/Monthly Report**
6. **遷移 Daily Check** (最複雜，分步提取)
7. **撰寫特徵測試 + 單元測試**
8. **執行覆蓋率檢查**

---

_文件版本：v1.0_
_分析完成：2026-08-07_
