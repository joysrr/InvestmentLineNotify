# E2E 測試指南 - Playwright

> **版本**：v1.0  
> **更新日期**：2026-08-08  
> **適用對象**：前端開發、QA

---

## 1. 環境與架構

### 測試工具鏈

| 工具                | 版本     | 用途           |
| ------------------- | -------- | -------------- |
| @playwright/test    | ^1.40+   | E2E 測試框架   |
| playwright-chromium | 內建     | 無頭瀏覽器     |
| vite dev server     | 自動啟動 | 前端開發伺服器 |
| Fastify API server  | 自動啟動 | 後端 API       |

### 專案結構

```
webapp/
├── playwright.config.js          # Playwright 設定
├── src/
│   └── test/
│       └── e2e/
│           ├── telegram-mock.js  # Telegram WebApp Mock
│           └── simulator.spec.js # SimulatorView 測試 (10 tests)
└── test-results/                 # 截圖、trace、報告輸出目錄
```

---

## 2. 核心設定檔解析

### playwright.config.js 關鍵設定

```javascript
export default defineConfig({
  testDir: "./src/test/e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0, // CI 環境重試 2 次
  workers: process.env.CI ? 1 : 2, // CI 單執行緒避免衝突
  reporter: "html",

  use: {
    baseURL: "http://localhost:5173", // Vite dev server
    trace: "on-first-retry", // 失敗時錄製 trace
    screenshot: "only-on-failure", // 失敗截圖
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "npm run dev", // 啟動 Vite
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### webServer 關鍵點

- **自動啟動**：測試前自動 `npm run dev` (前端) + API server
- **reuseExistingServer**：本地開發時復用現有 dev server (加速)
- **CI 環境**：獨立啟動，確保隔離

---

## 3. Telegram WebApp Mock 策略

### 為什麼需要 Mock？

Telegram Mini App 在瀏覽器無法直接運行，缺少 `window.Telegram.WebApp` 物件。

### telegram-mock.js 實作

```javascript
// webapp/src/test/e2e/telegram-mock.js
Object.defineProperty(window, "Telegram", {
  value: {
    WebApp: {
      initData: "query_id=...&user=...", // 模擬驗證資料
      initDataUnsafe: { user: { id: 123456, first_name: "Test" } },
      ready: () => {},
      expand: () => {},
      close: () => {},
      // ... 其他必要方法
    },
  },
  writable: true,
});
```

### 注入方式

在 `playwright.config.js`：

```javascript
use: {
  baseURL: 'http://localhost:5173',
  // 在每個測試前注入 mock
  storageState: { cookies: [], origins: [] },
},
```

實際注入在測試檔案 `beforeEach`：

```javascript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // 這裡注入 telegram-mock.js 內容
  });
  await page.goto("#/simulator");
  await page.waitForSelector(".simulator-view", { timeout: 10000 });
});
```

---

## 4. API Mock 策略

### 為什麼 Mock API？

- 測試不依賴真實後端
- 控制回應資料驗證邊界情況
- 測試速度快、穩定

### 模式：page.route()

```javascript
test.beforeEach(async ({ page }) => {
  // Mock 正向模擬 API
  await page.route('**/api/v1/simulate', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        simulatedPrice0050: 180,
        simulatedPriceZ2: 280,
        strategyScore: 65,
        strategyStatus: '觀望 (策略分數不足)',
        // ... 完整回應結構
        dataQuality: { ma240: 'OK', rsi: 'OK', ... },
        disclaimer: '此為條件分析，非價格預測亦非投資建議。'
      })
    });
  });

  // Mock 反向推導 API
  await page.route('**/api/v1/simulate/reverse', async route => { ... });

  // Mock 報表 API
  await page.route('**/api/reports*', async route => { ... });
});
```

### Mock 資料原則

| 原則            | 說明                                                 |
| --------------- | ---------------------------------------------------- |
| **符合 Schema** | 回應必須通過 `simulate-forward-response.schema.json` |
| **覆蓋邊界**    | 包含 warnings、dataQuality 不同狀態                  |
| **時間戳真實**  | `timestamp: new Date().toISOString()`                |

---

## 5. 撰寫測試最佳實踐

### 選擇器優先級

```javascript
// ✅ 最好：data-testid (穩定、語意化)
await page.locator('[data-testid="simulate-btn"]').click();

// ✅ 好：角色 + 文字 (可讀性高)
await page.locator('button:has-text("執行模擬")').click();

// ✅ 好：label 關聯 input
await page.locator('label:has-text("0050 預估價格") ~ input').fill("180");

// ❌ 避免：CSS class (易變動)
await page.locator(".btn-primary").click();

// ❌ 避免：純文字 (多語系、重複)
await page.locator("text=MA240").toBeVisible(); // 會匹配到多個元素
```

### 等待策略

```javascript
// ✅ 好：等待特定元素出現 (自動重試、有超時)
await expect(page.locator('.score-label:has-text("策略分數")')).toBeVisible({
  timeout: 10000,
});

// ✅ 好：等待網路請求完成
await page.waitForResponse("**/api/v1/simulate");

// ❌ 避免：硬性等待
await page.waitForTimeout(3000); // 不穩定、慢
```

### 測試結構範本

```javascript
import { test, expect } from '@playwright/test';

test.describe('SimulatorView - 正向模擬', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock API
    await page.route('**/api/v1/simulate', ...);
    await page.route('**/api/reports*', ...);

    // 2. 導航
    await page.goto('#/simulator');
    await page.waitForSelector('.simulator-view', { timeout: 10000 });
  });

  test('頁面載入顯示正確標題', async ({ page }) => {
    await expect(page.locator('.sim-title')).toHaveText('0050 雙向模擬器');
  });

  test('輸入有效價格並執行模擬', async ({ page }) => {
    // 輸入
    await page.locator('label:has-text("0050 預估價格") ~ input').fill('180');
    await page.locator('label:has-text("00675L 預估價格") ~ input').fill('280');

    // 執行
    await page.locator('button:has-text("執行模擬")').click();

    // 驗證結果
    await expect(page.locator('.score-label:has-text("策略分數")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=建議維持現狀')).toBeVisible();
  });
});
```

---

## 6. 新增測試完整範例

### 需求：測試「切換到反向推導模式並輸入 KD 黃金交叉目標」

```javascript
// 新增在 simulator.spec.js 的 test.describe('SimulatorView - Reverse Simulation') 中

test("KD 黃金交叉目標可正確輸入並推導價格", async ({ page }) => {
  // Mock 反向推導 API 回應 KD Cross
  await page.route("**/api/v1/simulate/reverse", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        target: { type: "kdCross", value: { direction: "golden" } },
        reachable: true,
        method: "analytical",
        reason: "可達成",
        results: { price0050: 182.5, priceZ2: 285.3, achievedValue: 1 },
        calculationMode: "reverse_analytical",
        dataAsOf: "2026-08-08",
        disclaimer: "此為條件分析，非價格預測亦非投資建議。",
      }),
    });
  });

  // 1. 切換到反向推導分頁
  await page.locator("text=目標 → 價格").click();
  await expect(page.locator("text=目標類型")).toBeVisible();

  // 2. 選擇 KD Cross
  await page.locator(".selector-field").first().selectOption("kdCross");

  // 3. 選擇黃金交叉
  await expect(page.locator(".selector-field").nth(1)).toBeVisible();
  await page.locator(".selector-field").nth(1).selectOption("golden");

  // 4. 執行反向推導
  await page.locator('button:has-text("反向推導")').click();

  // 5. 驗證結果
  await expect(page.locator('.score-label:has-text("策略分數")')).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator("text=模擬 0050 價格")).toBeVisible();
  await expect(page.locator("text=182.5")).toBeVisible(); // price0050
});
```

---

## 7. 除錯技巧

### 1. 有頭模式觀察

```bash
cd webapp && npm run test:e2e:headed
```

### 2. Debug 模式 (暫停、逐步)

```bash
cd webapp && npx playwright test --debug
```

### 3. 查看 Trace (失敗自動錄製)

```bash
# 失敗後會生成 trace.zip
npx playwright show-trace test-results/simulator-.../trace.zip
```

### 4. 截圖比對

```bash
# 失敗截圖在 test-results/
# 可用 npx playwright show-report 開啟 HTML 報告
```

### 5. Console 訊息捕獲

```javascript
test("捕獲瀏覽器 console", async ({ page }) => {
  const logs = [];
  page.on("console", (msg) => logs.push(msg.text()));

  await page.goto("#/simulator");
  // ... 操作

  console.log("Browser logs:", logs);
});
```

---

## 8. 常見問題與解決

| 問題                                            | 原因                   | 解決                                             |
| ----------------------------------------------- | ---------------------- | ------------------------------------------------ |
| `strict mode violation: resolved to N elements` | 選擇器不夠具體         | 用更精確選擇器：`.badge-label:has-text("MA240")` |
| `Timeout waiting for element`                   | 元素未出現、選擇器錯誤 | 檢查 Mock API 是否回應、選擇器是否正確           |
| `page.route not intercepting`                   | 路徑不匹配             | 確認 `**/api/v1/simulate` 包含完整路徑           |
| `Telegram.WebApp undefined`                     | Mock 未注入            | 確認 `page.addInitScript` 在 `page.goto` 前      |
| CI 環境測試不穩定                               | 資源競爭               | `workers: 1`, `retries: 2`                       |

---

## 9. 執行與報告

### 執行指令

```bash
# 全部測試
cd webapp && npm run test:e2e

# 特定檔案
cd webapp && npx playwright test simulator.spec.js

# 特定測試
cd webapp && npx playwright test -g "正向模擬"

# 有頭模式
cd webapp && npm run test:e2e:headed

# Debug
cd webapp && npx playwright test --debug
```

### 報告查看

```bash
# HTML 報告 (含截圖、trace)
cd webapp && npx playwright show-report

# JUnit XML (CI 整合)
cd webapp && npx playwright test --reporter=junit
```

---

## 10. 擴展指引

| 擴展方向     | 建議做法                                       |
| ------------ | ---------------------------------------------- |
| 新頁面測試   | 新增 `xxx.spec.js`，遵循現有 `beforeEach` 模式 |
| 視覺回歸測試 | 使用 `toHaveScreenshot()` 比對基準圖           |
| 多瀏覽器     | `projects` 加入 firefox、webkit                |
| 並行測試優化 | 共用 `beforeEach` 的 API mock，減少重複設定    |
