---
type: reference
status: current
last_updated: 2026-09-11
tags:
  - testing
  - troubleshooting
  - debugging
wiki_links: []
---

# 測試疑難排解指南

> **版本**：v1.0  
> **更新日期**：2026-08-08  
> **適用對象**：所有開發人員

---

## 1. 後端測試 (Vitest) 常見問題

### 1.1 測試失敗：找不到 Mock / Module

```
Error: Cannot find module '../mocks/index.mjs'
ReferenceError: createMockDataProvider is not defined
```

**原因**：import 路徑錯誤、Mock 檔案未建立  
**解決**：

```bash
# 確認 Mock 檔案存在
ls src/test/mocks/
ls src/test/mocks/factories/

# 檢查 import 路徑 (相對路徑從測試檔案出發)
# 正確：../../../mocks/index.mjs
# 錯誤：../../mocks/index.mjs
```

### 1.2 `describe` / `it` / `vi` not defined

```
ReferenceError: describe is not defined
ReferenceError: vi is not defined
```

**原因**：缺少 `import { describe, it, expect, vi, beforeEach } from "vitest"`  
**解決**：確保測試檔案開頭有完整 import：

```javascript
import { describe, it, expect, vi, beforeEach } from "vitest";
```

### 1.3 Mock 已宣告重複

```
Error: Identifier 'describe' has already been declared
```

**原因**：頂層 `vi.mock()` 後又重複 import vitest  
**解決**：移除重複的 import 陳述式：

```javascript
// ❌ 錯誤：頂層 vi.mock 後又 import vitest
vi.mock(...);
import { describe, it } from "vitest";  // 重複宣告

// ✅ 正確：只 import 一次，或在 vi.mock 之前 import
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock(...);
```

### 1.4 測試超時

```
Test timed out after 5000ms
```

**原因**：非同步操作未正確 await、無限循環、外部服務無回應  
**解決**：

```javascript
// 增加單測超時
it('慢速測試', async () => {
  await slowOperation();
}, 10000); // 10 秒

// 或在 vitest.config.js 設定全域
testTimeout: 10000,
```

### 1.4 API 409 CONFLICT：戰報過期

```
{"error":"CONFLICT","message":"戰報過期: 最新戰報超過 24 小時"}
```

**原因**：Mock 報告日期太舊，`getValidatedLatestReport()` 檢查 24 小時內  
**解決**：在測試 `beforeAll` 寫入最新報告：

```javascript
beforeAll(async () => {
  const now = Date.now();
  const oneHourAgo = new Date(now - 1 * 60 * 60 * 1000);
  const dateStr = oneHourAgo.toISOString().split('T')[0];

  const mockReport = {
    date: dateStr,
    price0050: 180,
    currentPrice: 280,
    strategySnapshot: { ... },
    // ... 其他必要欄位
  };

  await fs.writeFile(`data/reports/${dateStr}.json`, JSON.stringify(mockReport));
});
```

### 1.5 覆蓋率不達標

```
File           | % Stmts | % Branch | % Funcs | % Lines
dailyCheck.mjs |   67.5  |   61.5   |   50    |   67.5
```

**原因**：分支未覆蓋 (if/else、try/catch)、錯誤處理路徑未測試  
**解決**：

```bash
# 看詳細未覆蓋行號
npx vitest run --coverage --reporter=verbose

# 補測缺失分支
it('錯誤處理路徑', async () => {
  mockFn.mockRejectedValue(new Error('DB error'));
  await expect(runDailyCheck()).rejects.toThrow();
});
```

---

## 2. 前端測試 (Vitest + Vue) 常見問題

### 2.1 組件找不到 props / emits

```
[Vue warn]: Property "xxx" was accessed during render but is not defined
```

**原因**：`<script setup>` 中 `defineProps`/`defineEmits` 未正確宣告  
**解決**：

```vue
<script setup>
import { defineProps, defineEmits } from "vue";

const props = defineProps({
  // 必須指定給 const
  price0050: { type: Number, required: true },
});

const emit = defineEmits(["update:price0050"]); // 必須指定給 const
</script>
```

### 2.2 ESLint: `'defineProps' is not defined`

**原因**：ESLint 未識別 Vue compiler macros  
**解決**：`eslint.config.js` 加入 globals：

```javascript
export default [
  {
    languageOptions: {
      globals: {
        ...globals.vue, // Vue 3 globals
        ...globals["vue/macros"], // defineProps, defineEmits, etc.
      },
    },
  },
];
```

---

## 3. E2E 測試 (Playwright) 常見問題

### 3.1 Strict mode violation：選擇器匹配多個元素

```
strict mode violation: locator('text=MA240') resolved to 3 elements
```

**原因**：文字選擇器不夠具體，匹配到多個相同文字元素  
**解決**：使用更精確選擇器：

```javascript
// ❌ 錯誤
await expect(page.locator("text=MA240")).toBeVisible();

// ✅ 正確：指定 class 或屬性
await expect(page.locator('.badge-label:has-text("MA240")')).toBeVisible();
await expect(page.locator('[data-testid="ma240-badge"]')).toBeVisible();

// ✅ 正確：限制範圍
await expect(
  page.locator(".data-quality-section").locator("text=MA240"),
).toBeVisible();
```

### 3.2 Timeout waiting for element

```
Timeout 5000ms exceeded waiting for locator('.score-label')
```

**原因**：元素未渲染、Mock API 未回應、頁面未載入完成  
**排查步驟**：

1. 確認 Mock API 路徑正確：`**/api/v1/simulate`
2. 確認 `page.goto('#/simulator')` 後有 `waitForSelector`
3. 檢查瀏覽器 console 是否有錯誤：

```javascript
test("捕獲錯誤", async ({ page }) => {
  page.on("console", (msg) => console.log("BROWSER:", msg.text()));
  page.on("pageerror", (err) => console.log("PAGE ERROR:", err.message));
  // ...
});
```

### 3.3 page.route 不攔截請求

**原因**：路徑模式不匹配、請求已在 route 註冊前發出  
**解決**：

```javascript
// ✅ 正確：在 page.goto 之前註冊 route
await page.route("**/api/v1/simulate", handler);
await page.goto("#/simulator");

// ❌ 錯誤：goto 後才註冊
await page.goto("#/simulator");
await page.route("**/api/v1/simulate", handler); // 太晚了
```

### 3.4 Telegram.WebApp is undefined

**原因**：Mock 腳本未正確注入  
**解決**：在 `beforeEach` 中使用 `addInitScript`：

```javascript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.Telegram = {
      WebApp: {
        initData: "query_id=test&user=...",
        initDataUnsafe: { user: { id: 123, first_name: "Test" } },
        ready: () => {},
        expand: () => {},
        close: () => {},
        // ...
      },
    };
  });

  await page.goto("#/simulator");
  await page.waitForSelector(".simulator-view");
});
```

### 3.4 CI 環境測試不穩定

**解決**：在 `playwright.config.js` 設定：

```javascript
export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
});
```

---

## 4. Lint / 格式化問題

### 4.1 ESLint 錯誤無法自動修復

```bash
npm run lint
# 輸出大量錯誤
```

**解決**：

```bash
# 先跑 prettier 格式化
npm run format

# 再跑 eslint --fix
npm run lint -- --fix

# 仍有錯誤需手動修復
```

### 4.2 Prettier 與 ESLint 衝突

**現象**：`npm run format` 後跑 `npm run lint` 又報錯  
**解決**：確認 `.prettierrc` 和 `eslint.config.js` 規則一致，或使用 `eslint-config-prettier` 關閉衝突規則。

---

## 5. 部署相關問題

### 5.1 `npm run pre-deploy` 失敗

**排查順序**：

1. `npm run lint` - 修復所有 lint 錯誤
2. `npm run test` - 後端測試全綠
3. `cd webapp && npm run test` - 前端測試全綠
4. `cd webapp && npm run build` - 建置成功
5. `npm run openapi:generate` - OpenAPI 產出
6. `npm run openapi:check` - 無 Breaking Change
7. `cd webapp && npm run test:e2e` - E2E 全綠

### 5.2 部署腳本 SSH 連線失敗

```
ssh: connect to host vm-ip port 22: Connection refused
```

**排查**：

- 確認 `VM_HOST` 環境變數正確：`user@ip`
- 確認本機 SSH key 已加入 VM `~/.ssh/authorized_keys`
- 測試手動連線：`ssh user@vm-ip`

### 5.3 PM2 服務重啟後不正常

```bash
# 查看狀態
pm2 list

# 查看錯誤日誌
pm2 logs api-server --lines 100
pm2 logs bot-daemon --lines 100

# 重啟特定服務
pm2 restart api-server

# 完全重建
pm2 delete all
pm2 start ecosystem.config.cjs --env production
```

---

## 6. 環境變數問題

### 6.1 本機開發缺少環境變數

```bash
# 複製範本
cp .env.example .env

# 編輯填入必要值
vim .env
```

### 6.2 VM 上環境變數遺失

```bash
# VM 上檢查
cat ~/investnotify/.env

# 必填清單 (見 docs/DEPLOYMENT_CHECKLIST.md)
TELEGRAM_API_TOKEN=xxx
TELEGRAM_LOG_API_TOKEN=xxx
TELEGRAM_USER_ID=xxx
TELEGRAM_WEBAPP_URL=https://your-domain.duckdns.org
GEMINI_API_KEY1=xxx
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_SHEET_ID=xxx
FRED_API_KEY=xxx
BASE_PRICE_URL=xxx
NODE_ENV=production
BYPASS_INIT_DATA=false
```

### 6.3 GOOGLE_PRIVATE_KEY 換行符問題

**現象**：Private key 解析失敗  
**解決**：`.env` 中需用 `\n` 表示換行：

```bash
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD...\n-----END PRIVATE KEY-----\n"
```

---

## 7. 常用除錯指令速查

```bash
# === 測試 ===
npm run test                          # 後端測試
cd webapp && npm run test             # 前端測試
cd webapp && npm run test:e2e         # E2E 測試
npx vitest run --coverage             # 覆蓋率報告
npx vitest run -t "測試名稱"          # 單一測試
npx vitest run --reporter=verbose     # 詳細輸出

# === Lint/格式 ===
npm run lint                          # 檢查
npm run format                        # 自動格式化
npm run lint -- --fix                 # 嘗試自動修復

# === 建置/驗證 ===
npm run verify                        # 完整驗證
npm run pre-deploy                    # 部署前驗證
cd webapp && npm run build            # 前端建置
npm run openapi:generate              # 產出 OpenAPI
npm run openapi:check                 # Breaking Change 檢查

# === 部署 ===
npm run deploy:dry                    # Dry-run
npm run deploy                        # 完整部署
npm run deploy -- --skip-pre          # 緊急部署

# === PM2 (VM 上) ===
pm2 list                              # 服務狀態
pm2 logs api-server --lines 100       # 查看日誌
pm2 logs --err                        # 只看錯誤
pm2 restart api-server                # 重啟
pm2 reload ecosystem.config.cjs       # 重載
pm2 monit                             # 監控面板

# === Git ===
git status                            # 工作目錄狀態
git diff                              # 未暫存變更
git diff --cached                     # 已暫存變更
git stash                             # 暫存
git stash pop                         # 還原

# === 環境 ===
cat .env                              # 檢查環境變數
env | grep TELEGRAM                   # 過濾 Telegram 變數
```

---

## 8. 已知問題清單 (歷史記錄)

| 日期       | 問題                                | 解決方案                                                       | 相關檔案                                    |
| ---------- | ----------------------------------- | -------------------------------------------------------------- | ------------------------------------------- |
| 2026-08-04 | E2E 選擇器 `text=MA240` 匹配 3 元素 | 改用 `.badge-label:has-text("MA240")`                          | `webapp/src/test/e2e/simulator.spec.js`     |
| 2026-08-06 | API 409 戰報過期                    | Mock 報告寫入 `data/reports/YYYY-MM-DD.json`，日期用 1hr 前    | `src/test/integration/apiContract.test.mjs` |
| 2026-08-06 | ESLint `defineProps` 未定義         | `eslint.config.js` 加入 `globals['vue/macros']`                | `eslint.config.js`                          |
| 2026-08-07 | Vitest `describe` 重複宣告          | 移除 `vi.mock` 後的重複 import                                 | `src/test/unit/scheduler/*.test.mjs`        |
| 2026-08-07 | Mock 路徑錯誤                       | 統一使用 `../../../mocks/index.mjs` (從 test/unit/scheduler/)  | 所有 scheduler test                         |
| 2026-08-08 | `pre-deploy` script 缺失            | 加入 `package.json`: `verify && cd webapp && npm run test:e2e` | `package.json`                              |

---

## 9. 回報新問題模板

發現新問題時，請記錄：

```markdown
## 問題描述

- 發生階段：測試 / 建置 / 部署 / 執行期
- 錯誤訊息：完整錯誤堆疊
- 復現步驟：1. ... 2. ... 3. ...

## 環境

- OS：macOS / Ubuntu (VM)
- Node：`node --version`
- 套件管理：npm

## 嘗試過的解決方案

- [ ] 方案 1
- [ ] 方案 2

## 最終解決方案

- 根因：
- 修正：

## 相關檔案

- `path/to/file1`
- `path/to/file2`
```

將解決方案新增到本文件「已知問題清單」區段。
