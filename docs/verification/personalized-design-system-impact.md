---
type: architecture-analysis
status: active
last_updated: 2026-11-01
tags:
  - personalized-design
  - system-architecture
  - design-constraints
  - scalability-analysis
---

# 個人化設計對系統架構的影響分析

## 文檔目標

分析系統中所有個人化設計決策如何影響架構選擇、技術實作、可擴展性，以及若要擴展至其他場景需要改動的範圍。

---

## 🔍 個人化設計盤點（完整版）

### 第一層：投資策略層

| 設計                        | 個人化程度 | 文檔位置                                                                  |
| --------------------------- | ---------- | ------------------------------------------------------------------------- |
| 0050/00675L/00740B 資產選擇 | ⭐⭐⭐⭐⭐ | [personalized-design-inventory.md](./personalized-design-inventory.md) §1 |
| P0/P1 資金配置              | ⭐⭐⭐⭐⭐ | [personalized-design-inventory.md](./personalized-design-inventory.md) §2 |
| 生命週期策略                | ⭐⭐⭐⭐☆  | [personalized-design-inventory.md](./personalized-design-inventory.md) §3 |
| 風險偏好參數                | ⭐⭐⭐⭐⭐ | [personalized-design-inventory.md](./personalized-design-inventory.md) §4 |

### 第二層：系統設計層 ⚠️ 本文檔重點

| 設計               | 個人化程度 | 影響範圍      | 擴展難度 |
| ------------------ | ---------- | ------------- | -------- |
| **單用戶架構**     | ⭐⭐⭐⭐⭐ | 全系統        | 🔴 高    |
| **台灣市場專屬**   | ⭐⭐⭐⭐⭐ | Data Provider | 🟠 中    |
| **時區與作息時間** | ⭐⭐⭐☆☆   | 排程、通知    | 🟢 低    |
| **通知渠道偏好**   | ⭐⭐⭐⭐☆  | 通知模組      | 🟢 低    |
| **資料持久化方式** | ⭐⭐⭐⭐☆  | 儲存層        | 🟠 中    |
| **語言與格式**     | ⭐⭐⭐☆☆   | UI/報告       | 🟢 低    |

---

## 1. 單用戶架構 🎯

### 1.1 設計決策

**核心假設**：

```javascript
// 整個系統只服務一個人：Han
const USER = "Han (joysrr)";
const TELEGRAM_USER_ID = process.env.TELEGRAM_USER_ID; // 唯一管理員
```

---

### 1.2 架構影響

#### A. 無需多租戶隔離

**資料層設計**：

```javascript
// src/modules/portfolio/reportPortfolioSnapshot.mjs
// ❌ 沒有 userId 欄位
// ❌ 沒有資料隔離機制
{
  "date": "2026-11-01",
  "portfolio": {
    "netAsset": 5000000,
    "value0050": 3000000,
    "value00675L": 1000000
  }
}
```

**若改為多用戶系統**：

```javascript
// ✅ 需要加入 userId
{
  "userId": "han",
  "date": "2026-11-01",
  "portfolio": { ... }
}

// ✅ 所有查詢需加 WHERE userId = ?
// ✅ 所有檔案路徑需分層：data/reports/{userId}/2026-11-01.json
```

**影響範圍**：

- 📁 **檔案儲存**：`data/reports/` 需改為 `data/reports/{userId}/`
- 🔍 **查詢邏輯**：所有 `getLatestReport()` 需改為 `getLatestReport(userId)`
- 🛡️ **權限控制**：需新增 Row-Level Security
- 📊 **API 路由**：所有 API 需驗證 userId

**改動成本**：🔴 **高（約 50-100 處改動）**

---

#### B. 全域單例設計

**當前實作**：

```javascript
// src/modules/bot/middleware/adminGuard.mjs
export function isAdmin(ctx) {
  const allowedUserId = process.env.TELEGRAM_USER_ID;
  return ctx.from?.id?.toString() === allowedUserId;
}

// ❌ 硬編碼單一管理員
// ❌ 沒有角色系統（admin/viewer/editor）
```

**若改為多用戶系統**：

```javascript
// ✅ 需要用戶資料庫
const userDb = {
  123456: { role: "admin", userId: "han" },
  789012: { role: "viewer", userId: "amy" },
};

export function getUser(telegramId) {
  return userDb[telegramId];
}
```

**影響範圍**：

- 🔐 **認證**：需新增用戶註冊/登入
- 👥 **授權**：需新增角色系統（RBAC）
- 🗄️ **儲存**：需新增用戶表

**改動成本**：🔴 **高（需新增認證系統）**

---

#### C. 無資料庫設計

**當前實作**：

```javascript
// src/utils/archiveManager.mjs
const REPORTS_DIR = resolve(__dirname, "../../data/reports");

export function getLatestReport() {
  const files = fs.readdirSync(REPORTS_DIR); // 直接讀檔案系統
  const sorted = files.filter((f) => /\d{4}-\d{2}-\d{2}\.json/.test(f)).sort();
  return sorted[sorted.length - 1];
}
```

**優點**：

- ✅ **極簡架構**：無需 MySQL/PostgreSQL
- ✅ **備份簡單**：直接複製 `data/` 資料夾
- ✅ **除錯容易**：直接開啟 JSON 檔案查看

**限制**：

- ❌ **無法多用戶**：檔案系統無行級權限
- ❌ **無法併發寫入**：多個 process 同時寫入會覆蓋
- ❌ **查詢效率低**：需全檔掃描（但單用戶資料量小，影響不大）

**若改為多用戶系統**：

```sql
-- 需要資料庫
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  date DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX idx_reports_user_date ON reports(user_id, date DESC);
```

**改動成本**：🔴 **高（需引入 ORM + 遷移現有資料）**

---

### 1.3 優勢與劣勢分析

| 面向       | 單用戶優勢              | 多用戶劣勢      |
| ---------- | ----------------------- | --------------- |
| **複雜度** | ✅ 極簡架構，易維護     | ❌ 無法擴展     |
| **效能**   | ✅ 無需權限檢查，速度快 | ❌ 無法水平擴展 |
| **成本**   | ✅ 無需資料庫授權費     | ❌ 無法商業化   |
| **安全性** | ✅ 無多租戶資料洩漏風險 | ❌ 無用戶隔離   |

**結論**：當前架構完美契合「Han 個人使用」需求，但**完全不適合**擴展為多用戶 SaaS 服務。

---

## 2. 台灣市場專屬 🇹🇼

### 2.1 設計決策

**核心假設**：

```javascript
// 系統只投資台灣市場
const MARKET = "Taiwan Stock Exchange (TWSE)";
const ASSETS = ["0050.TW", "00675L.TW", "00740B.TW"];
```

---

### 2.2 架構影響

#### A. TWSE Provider 深度耦合

**當前實作**：

```javascript
// src/modules/providers/twseProvider.mjs

/**
 * 取得台股收盤價（從 TWSE 官方 API）
 */
export async function fetchTwseClosingPrice(stockCode, date) {
  const rocDate = isoDateToROC(date, false); // "2026-11-01" → "11511"
  const url = `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?date=${rocDate}...`;
  // ...
}

/**
 * 判斷是否為台股交易日
 */
export async function getTwseHolidays(year) {
  // 台灣證交所公告假日
  const url = `https://www.twse.com.tw/holidaySchedule/holidaySchedule?queryYear=${year}`;
  // ...
}
```

**台灣市場特殊性**：

1. **民國紀年**：`isoDateToROC()` 轉換（2026 → 115 年）
2. **交易日曆**：台灣假日（春節、端午、中秋、國慶）
3. **報價延遲**：T+1 日才有完整收盤價
4. **語言**：zh-TW, zh-Hant

---

#### B. 若擴展至其他市場

**情境 1：新增美股（S&P 500）**

```javascript
// ❌ 當前架構無法支援
// 需要：
// 1. 新增 nasdaqProvider.mjs
// 2. 改寫所有 "TWSE 假日" 邏輯 → 通用 "交易日曆"
// 3. 支援多時區（美東 vs 台北）
```

**情境 2：新增港股（恆生指數）**

```javascript
// ❌ 當前架構無法支援
// 需要：
// 1. 新增 hkexProvider.mjs
// 2. 處理港幣 vs 台幣匯率
// 3. 不同交易日曆（香港假日 ≠ 台灣假日）
```

---

#### C. 重構方案：Market Abstraction

**抽象化設計**：

```javascript
// src/modules/market/marketProvider.mjs

export class MarketProvider {
  constructor(market) {
    this.market = market; // "TWSE" | "NASDAQ" | "HKEX"
  }

  async getClosingPrice(symbol, date) {
    // 委派給對應 provider
  }

  async getTradingCalendar(year) {
    // 委派給對應 provider
  }

  getTimeZone() {
    // "Asia/Taipei" | "America/New_York" | "Asia/Hong_Kong"
  }
}

// 使用範例
const twseProvider = new MarketProvider("TWSE");
const nasdaqProvider = new MarketProvider("NASDAQ");
```

**改動成本**：🟠 **中（約 20-30 處改動）**

---

### 2.3 資產代碼硬編碼

**當前實作**：

```javascript
// src/scheduler/dailyCheckTheoreticalAdapter.mjs
const prices = await getHistoricalPrices("0050.TW", 126);
const z2Prices = await getHistoricalPrices("00675L.TW", 126);

// ❌ 硬編碼 "0050.TW" 和 "00675L.TW"
// ❌ 若 Han 改投資其他 ETF（如 0056），需改代碼
```

**改進方案**：

```javascript
// ✅ 從配置讀取
const userAssets = {
  core: "0050.TW", // 核心資產
  satellite: "00675L.TW", // 衛星資產
  anchor: "00740B.TW", // 錨定資產
};

const prices = await getHistoricalPrices(userAssets.core, 126);
```

**改動成本**：🟢 **低（僅需新增配置層）**

---

## 3. 時區與作息時間 ⏰

### 3.1 設計決策

**核心假設**：

```javascript
// Han 的時區與作息
const TIMEZONE = "Asia/Taipei"; // UTC+8
const AWAKE_HOURS = [7, 22]; // 07:00 - 22:00
```

---

### 3.2 架構影響

#### A. 排程設計

**新聞抓取排程**：

```javascript
// docs/modules/ai_news/news_fetcher.md
排程時間：07:00, 10:00, 13:00, 16:00, 19:00, 22:00（台灣時間）
限制：僅在清醒時段執行
```

**設計原因**：

1. **避免深夜通知**：Han 不想半夜被吵醒
2. **新聞時效性**：白天市場活躍，新聞更重要
3. **API 成本控制**：減少無效時段的 API 呼叫

**系統實作**：

```javascript
// Hermes Agent cron 表達式
const newsSchedule = "0 7,10,13,16,19,22 * * *"; // 每 3 小時（白天）

// ⚠️ 硬編碼台灣時區
// 若系統部署在 AWS us-east-1（UTC-5），cron 會錯位
```

**時區陷阱**：

```javascript
// 情境：系統部署在 AWS Oregon (UTC-8)
// cron: "0 7 * * *" → 台灣 23:00 執行（錯誤！）

// 解決方案 1：使用 UTC 時間
const newsSchedule = "0 23,2,5,8,11,14 * * *"; // UTC 時間
// 23:00 UTC = 07:00 台北

// 解決方案 2：使用 TZ 環境變數
process.env.TZ = "Asia/Taipei";
```

**當前風險**：🟠 **中（若換主機時區會錯位）**

---

#### B. 日期格式

**系統中的時間表示**：

```javascript
// 1. ISO 8601（儲存）
"2026-11-01T13:29:59.272Z"; // UTC

// 2. 台灣本地時間（顯示）
new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
// "2026/11/1 下午9:29:59"

// 3. YYYY-MM-DD（檔案名稱）
("2026-11-01.json"); // 台北日期，非 UTC 日期
```

**一致性問題**：

```javascript
// 情境：台北時間 2026-11-01 00:30（UTC 2026-10-31 16:30）
// 問題：應該寫入 2026-11-01.json 還是 2026-10-31.json？

// 當前實作：使用台北日期
const taipeiDate = new Date()
  .toLocaleDateString("zh-TW", {
    timeZone: "Asia/Taipei",
  })
  .replace(/\//g, "-"); // "2026-11-01"
```

**若擴展至其他時區用戶**：

```javascript
// 需要記錄用戶時區
const userProfile = {
  userId: "han",
  timezone: "Asia/Taipei", // ← 新增欄位
};

// 所有日期計算需基於用戶時區
const userDate = new Date().toLocaleDateString("zh-TW", {
  timeZone: userProfile.timezone,
});
```

**改動成本**：🟢 **低（加入配置即可）**

---

## 4. 通知渠道偏好 📢

### 4.1 設計決策

**Han 的通知偏好**：

1. **Telegram Bot**（主要）：即時通知、互動命令
2. **Gmail**（次要）：新聞簡報、長文閱讀
3. **Mini App**（被動）：資料查詢、歷史回顧

---

### 4.2 架構影響

#### A. 通知模組設計

**當前架構**：

```javascript
// src/modules/notifications/notifier.mjs

export async function sendDailyReport(report) {
  // 1. 總是發送到 Telegram
  await sendTelegram(formatTelegramHTML(report));

  // 2. ❌ 沒有 "用戶偏好" 配置
  // 3. ❌ 沒有 "勿擾模式" (Do Not Disturb)
  // 4. ❌ 沒有 "通知優先級" (Critical vs Info)
}
```

**若改為可配置系統**：

```javascript
// ✅ 用戶偏好配置
const userNotificationPrefs = {
  userId: "han",
  channels: {
    telegram: {
      enabled: true,
      chatId: "7943633192",
      quietHours: [23, 7], // 23:00 - 07:00 靜音
    },
    gmail: {
      enabled: true,
      address: "han@example.com",
      subjectPrefix: "📈", // 固定主旨前綴
    },
    lineNotify: {
      enabled: false, // Han 不使用 LINE Notify
    },
  },
};

export async function sendNotification(report, priority = "info") {
  for (const [channel, config] of Object.entries(
    userNotificationPrefs.channels,
  )) {
    if (!config.enabled) continue;

    // 檢查勿擾模式
    if (isInQuietHours(config.quietHours)) {
      if (priority !== "critical") continue; // 僅緊急通知突破靜音
    }

    await sendToChannel(channel, report, config);
  }
}
```

**改動成本**：🟢 **低（僅需新增配置層）**

---

#### B. Gmail 主旨固定規則

**Han 的需求**：

> Gmail 郵件主旨須完全固定（如「📈 投資新聞簡報」）以利會話群組（Thread）自動歸檔

**當前實作**：

```javascript
// ⚠️ 尚未實作 Gmail 發送
// 預期設計：
const gmailSubject = "📈 投資新聞簡報"; // 固定不變

// ❌ 若改為動態主旨（如加入日期），會破壞 Gmail Thread
// ❌ 錯誤範例：`📈 投資新聞簡報 - ${date}` → 每日新 Thread
```

**設計原因**：

- Gmail 的 Thread 判定依賴主旨相似度
- 固定主旨 → 所有郵件歸入同一 Thread → 易於查閱

**系統影響**：

- ✅ **正面**：用戶體驗優秀
- ⚠️ **限制**：無法從主旨分辨日期（需從內文）

---

## 5. 資料持久化方式 💾

### 5.1 設計決策

**當前架構**：

```
data/
├── reports/                    # 每日報告（單用戶）
│   ├── 2026-11-01.json
│   ├── 2026-10-31.json
│   └── ...
├── news/                       # 新聞快取
│   └── 2026-11-01.jsonl
└── sentiment/                  # 社群情緒
    └── 2026-11-01.json
```

**特性**：

- ✅ **檔案系統**：無需資料庫
- ✅ **JSON 格式**：人類可讀
- ✅ **日期分檔**：易於備份與歸檔

---

### 5.2 架構影響

#### A. 無資料庫優勢

| 優勢         | 說明                       |
| ------------ | -------------------------- |
| **部署簡單** | 無需安裝 MySQL/PostgreSQL  |
| **備份簡單** | `rsync data/` 即可         |
| **除錯容易** | 直接開啟 JSON 查看         |
| **版本控制** | 可納入 git（若資料不敏感） |
| **成本低**   | 無資料庫授權費             |

---

#### B. 無資料庫劣勢

| 劣勢           | 說明               | 影響                |
| -------------- | ------------------ | ------------------- |
| **無 ACID**    | 併發寫入會覆蓋     | 🟠 單用戶無影響     |
| **查詢效率低** | 需全檔掃描         | 🟢 資料量小無影響   |
| **無索引**     | 無法快速查找       | 🟠 需自行實作       |
| **無關聯查詢** | 無 JOIN            | 🟢 單用戶無複雜查詢 |
| **無權限控制** | 檔案系統無行級權限 | 🔴 多用戶致命問題   |

---

#### C. 若改為資料庫架構

**資料庫選型**：

```javascript
// 選項 1: SQLite（輕量級）
// ✅ 無需獨立服務
// ✅ 支援 SQL 查詢
// ❌ 仍無法多用戶

// 選項 2: PostgreSQL（企業級）
// ✅ 完整 ACID
// ✅ 支援 JSONB（保留 JSON 靈活性）
// ✅ Row-Level Security（多租戶隔離）
// ❌ 需獨立服務與維護

// 選項 3: Supabase（託管 PostgreSQL）
// ✅ 免維護
// ✅ 內建認證與權限
// ❌ 月費成本
```

**改動成本**：🔴 **高（需重寫所有資料層）**

---

## 6. 語言與格式 🌐

### 6.1 設計決策

**當前設定**：

```javascript
// 1. 日期格式
new Date().toLocaleDateString("zh-TW"); // "2026/11/1"

// 2. 數字格式
(50000).toLocaleString("zh-TW"); // "50,000"

// 3. 貨幣格式
`$${amount.toLocaleString("zh-TW")}`; // "$50,000"（新台幣）
```

---

### 6.2 架構影響

#### A. i18n 缺失

**當前實作**：

```javascript
// ❌ 硬編碼中文字串
const message = "維持率過低，建議補充保證金";

// ❌ 無國際化框架（i18n）
// ❌ 無法切換語言
```

**若改為多語系支援**：

```javascript
// ✅ 使用 i18n 框架
import i18n from "i18next";

const message = i18n.t("margin.warning.low_maintenance", {
  current: 135,
  required: 160,
});

// zh-TW: "維持率過低（135%），建議補充至 160%"
// en-US: "Maintenance ratio too low (135%), suggest topping up to 160%"
```

**改動成本**：🟠 **中（約 200+ 處字串需提取）**

---

#### B. 台幣專屬

**當前實作**：

```javascript
// ❌ 硬編碼 "元" 和 "$" 符號
const budgetText = `剩餘預算：$${amount.toLocaleString("zh-TW")} 元`;

// ❌ 無匯率轉換
// ❌ 無多幣種支援
```

**若支援多幣種**：

```javascript
// ✅ 使用 Intl.NumberFormat
const formatter = new Intl.NumberFormat(userLocale, {
  style: "currency",
  currency: userCurrency, // "TWD" | "USD" | "HKD"
});

formatter.format(50000);
// "NT$50,000" (zh-TW, TWD)
// "$50,000" (en-US, USD)
// "HK$50,000" (zh-HK, HKD)
```

**改動成本**：🟢 **低（僅需配置層）**

---

## 7. 系統架構影響總覽 🏗️

### 7.1 影響層級分析

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: 投資策略層（個人化 ⭐⭐⭐⭐⭐）                        │
├─────────────────────────────────────────────────────────────┤
│ • 0050/00675L/00740B                                        │
│ • P0/P1 資金配置                                            │
│ • 生命週期策略                                               │
│ • 風險偏好參數                                               │
│                                                             │
│ 影響：strategyEngine.mjs, lifecycleEngine.mjs              │
│ 擴展難度：🟢 低（抽象化參數即可）                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: 業務邏輯層（個人化 ⭐⭐⭐⭐☆）                        │
├─────────────────────────────────────────────────────────────┤
│ • 單用戶假設（無多租戶）                                     │
│ • 台灣市場專屬（TWSE Provider）                              │
│ • 時區與作息（Asia/Taipei, 07:00-22:00）                    │
│                                                             │
│ 影響：所有業務邏輯模組                                       │
│ 擴展難度：🟠 中（需重構抽象層）                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: 基礎設施層（個人化 ⭐⭐⭐⭐⭐）                        │
├─────────────────────────────────────────────────────────────┤
│ • 檔案系統儲存（無資料庫）                                   │
│ • 單例模式（全域狀態）                                       │
│ • 硬編碼路徑（data/reports/）                                │
│                                                             │
│ 影響：整個系統架構                                           │
│ 擴展難度：🔴 高（需重新設計）                                │
└─────────────────────────────────────────────────────────────┘
```

---

### 7.2 擴展性評估矩陣

| 擴展場景                    | Layer 1 改動     | Layer 2 改動    | Layer 3 改動 | 總難度 |
| --------------------------- | ---------------- | --------------- | ------------ | ------ |
| **新增資產（如 0056）**     | 🟢 配置化        | 🟢 無需改動     | 🟢 無需改動  | 🟢 易  |
| **新增市場（如美股）**      | 🟠 新增 Provider | 🟠 抽象化市場層 | 🟢 無需改動  | 🟠 中  |
| **新增用戶（多租戶）**      | 🟢 無需改動      | 🔴 加入 userId  | 🔴 改資料庫  | 🔴 難  |
| **新增通知渠道（如 LINE）** | 🟢 無需改動      | 🟢 實作 Adapter | 🟢 無需改動  | 🟢 易  |
| **新增語言（英文）**        | 🟢 無需改動      | 🟠 提取字串     | 🟢 無需改動  | 🟠 中  |

---

### 7.3 架構優勢總結

**當前架構（單用戶）的核心優勢**：

1. **極簡主義** ⭐⭐⭐⭐⭐
   - 無資料庫、無認證、無多租戶
   - 代碼量少，易維護
   - 部署成本低

2. **快速迭代** ⭐⭐⭐⭐⭐
   - 直接改 JSON 即可測試
   - 無需資料庫遷移
   - 回滾簡單（複製舊檔案）

3. **透明度高** ⭐⭐⭐⭐⭐
   - 所有資料可直接查看
   - 無黑盒系統
   - 易於除錯

4. **零依賴** ⭐⭐⭐⭐☆
   - 無需外部服務（Redis/PostgreSQL）
   - 降低單點故障風險

---

### 7.4 架構劣勢總結

**當前架構（單用戶）的核心劣勢**：

1. **無法商業化** 🔴
   - 完全不支援多用戶
   - 需重寫 50%+ 代碼才能擴展

2. **無法水平擴展** 🔴
   - 檔案系統無法跨機器
   - 無法負載均衡

3. **資料一致性弱** 🟠
   - 無 ACID 保證
   - 併發寫入會覆蓋（但單用戶無影響）

4. **查詢效率低** 🟠
   - 需全檔掃描
   - 無索引（但資料量小無影響）

---

## 8. 若要擴展：改動成本評估 💰

### 8.1 場景 A：新增第二位用戶（Amy）

**需求**：

- Amy 也想使用此系統
- 投資標的：0050 + 0056（不同於 Han）
- 風險偏好：保守型（不同於 Han）

**改動範圍**：

| 層級       | 改動項目                              | 工作量（小時） |
| ---------- | ------------------------------------- | -------------- |
| **資料層** | 改檔案結構為 `data/reports/{userId}/` | 2-3            |
| **資料層** | 所有讀寫加入 `userId` 參數            | 10-15          |
| **業務層** | 新增用戶配置檔 `users/{userId}.json`  | 2-3            |
| **業務層** | 策略引擎支援多用戶參數                | 5-8            |
| **認證層** | 新增 Telegram 用戶映射表              | 3-5            |
| **通知層** | 支援多 chatId                         | 2-3            |
| **測試**   | 改寫所有單元測試（加入 userId）       | 15-20          |
| **總計**   |                                       | **39-57 小時** |

**結論**：🟠 **中度改動（約 1-2 週開發時間）**

---

### 8.2 場景 B：擴展至美股市場

**需求**：

- Han 想投資 S&P 500 (SPY)
- 需要美股行情與交易日曆

**改動範圍**：

| 層級            | 改動項目                    | 工作量（小時） |
| --------------- | --------------------------- | -------------- |
| **Provider 層** | 新增 `nasdaqProvider.mjs`   | 5-8            |
| **業務層**      | 抽象化 `marketProvider.mjs` | 8-12           |
| **業務層**      | 改寫所有 TWSE 硬編碼        | 10-15          |
| **策略層**      | 支援多市場時區              | 5-8            |
| **測試**        | 新增美股測試案例            | 8-12           |
| **總計**        |                             | **36-55 小時** |

**結論**：🟠 **中度改動（約 1-2 週開發時間）**

---

### 8.3 場景 C：改為多租戶 SaaS

**需求**：

- 開放給 100+ 用戶使用
- 需要認證、權限、付費機制

**改動範圍**：

| 層級         | 改動項目                      | 工作量（小時）   |
| ------------ | ----------------------------- | ---------------- |
| **基礎設施** | 引入 PostgreSQL + ORM         | 15-20            |
| **基礎設施** | 資料庫 schema 設計與遷移      | 20-30            |
| **認證層**   | 用戶註冊/登入系統             | 30-40            |
| **認證層**   | JWT + Session 管理            | 10-15            |
| **權限層**   | RBAC（角色權限）              | 20-30            |
| **權限層**   | Row-Level Security            | 15-20            |
| **資料層**   | 改寫所有資料存取（加 userId） | 40-60            |
| **API 層**   | 加入認證中間件                | 10-15            |
| **付費層**   | 整合 Stripe/PayPal            | 30-40            |
| **測試**     | 全面改寫測試                  | 60-80            |
| **DevOps**   | CI/CD + 容器化                | 20-30            |
| **總計**     |                               | **270-380 小時** |

**結論**：🔴 **重大改動（約 2-3 個月開發時間，需 2-3 人團隊）**

---

## 9. 設計決策回顧 🎯

### 9.1 為何選擇單用戶架構？

**Han 的回答（USER.md 記憶）**：

> 產出品質永遠大於執行效率。這是我個人投資系統，不急上線，改完再一次部署。

**設計原則**：

1. **簡單優於複雜**（Simple > Complex）
2. **可用優於完美**（Working > Perfect）
3. **專注優於泛用**（Focused > Generic）

**驗證**：

- ✅ 系統已穩定運作 3+ 個月
- ✅ 無多用戶需求
- ✅ 維護成本極低

---

### 9.2 這些個人化設計是否合理？

| 設計             | 合理性評估 | 理由                       |
| ---------------- | ---------- | -------------------------- |
| **單用戶架構**   | ⭐⭐⭐⭐⭐ | 完美契合需求，極簡主義典範 |
| **台灣市場專屬** | ⭐⭐⭐⭐⭐ | Han 只投資台股，無需多市場 |
| **檔案系統儲存** | ⭐⭐⭐⭐☆  | 資料量小，簡單可靠         |
| **時區硬編碼**   | ⭐⭐⭐☆☆   | 可改進（加入配置）         |
| **語言硬編碼**   | ⭐⭐⭐☆☆   | 可改進（i18n）             |

**總體評估**：⭐⭐⭐⭐☆（4.4/5）

**結論**：

> 這些個人化設計**完全合理**，是「針對具體用戶（Han）而非假想用戶（Everyone）」的典範。

---

## 10. 關鍵洞察 💡

### 10.1 單用戶架構的哲學

**YAGNI 原則**（You Aren't Gonna Need It）：

```
❌ 錯誤思維：「未來可能需要多用戶，所以現在就設計多租戶架構」
✅ 正確思維：「當前只有 Han 使用，先做最簡單的架構」
```

**過度工程陷阱**：

```
// ❌ 過度設計
class UserRepository {
  async findById(userId) { /* 複雜查詢 */ }
  async findByEmail(email) { /* 索引優化 */ }
  async findWithRelations(userId, relations) { /* N+1 解決 */ }
}

// ✅ 當前設計
const report = JSON.parse(fs.readFileSync("data/reports/2026-11-01.json"));
```

---

### 10.2 個人化設計的價值

**核心價值**：

1. **極致優化**：針對 Han 的投資習慣微調每個參數
2. **零妥協**：無需照顧其他用戶，不做無用功
3. **快速迭代**：改動成本低，試錯代價小

**若改為通用系統**：

```javascript
// ❌ 通用系統需要妥協
const maxLeverage = user.riskProfile === "aggressive" ? 2.0 : 1.5;

// ✅ Han 專屬系統可以精確調校
const maxLeverage =
  lifecycle === "EARLY" ? 2.0 : lifecycle === "LATE" ? 1.5 : 1.0;
```

---

### 10.3 何時該重構？

**重構時機判定**：

| 情境                   | 是否重構？ | 理由                                  |
| ---------------------- | ---------- | ------------------------------------- |
| **Han 新增第二個帳戶** | ❌ 否      | 複製一份系統即可                      |
| **Han 邀請配偶使用**   | ✅ 是      | 需多用戶支援                          |
| **Han 想開放給朋友**   | ✅ 是      | 需認證與權限                          |
| **Han 想商業化**       | ✅ 是      | 需完整多租戶                          |
| **Han 新增美股投資**   | 🟠 視情況  | 可先 hard-code，若超過 3 市場再抽象化 |

---

## 11. 結論 📝

### 11.1 個人化設計對系統架構的影響總結

**核心發現**：

1. **Layer 1（投資策略）**：⭐⭐⭐⭐⭐ 完美客製化
   - 影響：策略引擎參數
   - 擴展難度：🟢 低
   - 改動成本：配置化即可

2. **Layer 2（業務邏輯）**：⭐⭐⭐⭐☆ 高度客製化
   - 影響：市場 Provider、時區、通知
   - 擴展難度：🟠 中
   - 改動成本：1-2 週

3. **Layer 3（基礎設施）**：⭐⭐⭐⭐⭐ 極致簡化
   - 影響：整個系統架構
   - 擴展難度：🔴 高
   - 改動成本：2-3 個月

---

### 11.2 最終評價

**系統個人化程度**：⭐⭐⭐⭐⭐ (5/5)

**架構合理性**：⭐⭐⭐⭐⭐ (5/5)

**可維護性**：⭐⭐⭐⭐⭐ (5/5)

**可擴展性**：⭐⭐☆☆☆ (2/5)

**總體評估**：

> 這是一個**完美契合單用戶場景**的系統，展現了「針對具體問題設計具體解決方案」的工程智慧。
>
> 當前架構的最大優勢是**簡單可靠**，最大劣勢是**無法擴展**。
>
> 若未來需要擴展至多用戶，建議**重寫而非重構**（Rewrite > Refactor），因為架構假設已根本改變。

---

**盤點者**: Kiro (Hermes Agent)  
**盤點時間**: 2026-11-01  
**用戶確認**: 待 Han 檢視

---

## 附錄 A：個人化設計清單（完整版）

### 投資策略層（9 項）

1. 0050 核心資產
2. 00675L 衛星資產
3. 00740B 錨定資產
4. P0-1 固定 DCA（3 萬/月）
5. P0-2 增貸 DCA（6 萬/10 天）
6. P1 條件加碼
7. 生命週期 4 階段
8. 最大槓桿 2.0x
9. 目標退休年齡 55 歲

### 系統設計層（12 項）

10. 單用戶架構
11. TWSE Provider
12. 台灣交易日曆
13. ROC 日期格式
14. Asia/Taipei 時區
15. 清醒時段排程（07:00-22:00）
16. Telegram Bot 主通知
17. Gmail 固定主旨
18. Mini App 資料查詢
19. 檔案系統儲存
20. JSON 格式
21. zh-TW 語言

### 硬編碼參數層（30 項）

22-51. 詳見 [hardcoded-parameters-inventory.md](./hardcoded-parameters-inventory.md)

**總計**：**51 個個人化設計決策**
