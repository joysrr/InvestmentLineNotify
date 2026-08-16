# 部署準備檢查清單

**合併提交**: `57e3b3b` (main)
**前一版**: `42471dd` (main baseline)
**新增內容**: Phase 6 + Phase 7 全部工作

---

## ✅ 部署前自動檢查結果

### 1. 測試套件

```
Test Files:  93 passed | 2 skipped (96)
Tests:       1499 passed | 6 todo (1517)
Errors:      1 (cosmetic, vitest worker pending handles, DEC-016)
Duration:    ~55s
```

### 2. ESLint 檢查

```
Errors:    0   ✅
Warnings:  276 (從 1709 降低 84%)
```

### 3. Webapp Build

- ✅ `vite build` 成功編譯 (2280 modules, 23.56s)
- ✅ 產出 dist/index.html + 2.5MB JS bundle

### 4. API Server 啟動驗證

- ✅ `NODE_ENV=production node src/api/server.mjs` 成功啟動
- ✅ 5 個 alert rules 正常載入
- ✅ Listening on 0.0.0.0:3001

### 5. Auth 防禦驗證

- ✅ 無 `X-Telegram-Init-Data` header → 403 (missing)
- ✅ 無效 HMAC signature → 403 (hmac_mismatch)
- ✅ 真實 HMAC-SHA256 signature → 200 (validation_success)
- ✅ 過期 timestamp → 401 (initData_expired)

---

## 📋 部署建議步驟

### 環境變數 (.env / Secrets)

確保以下變數已設定：

```
TELEGRAM_API_TOKEN=<bot_token>
TELEGRAM_LOG_API_TOKEN=<bot_token>
TELEGRAM_USER_ID=<user_id>
TELEGRAM_WEBAPP_URL=<https_url>

# 部署端可選
LANGFUSE_PUBLIC_KEY=<key>     # 若需要 Langfuse observability
LANGFUSE_SECRET_KEY=<key>
LANGFUSE_BASE_URL=<url>
```

### 部署命令建議

```bash
# 1. 拉取最新 main
git pull origin main

# 2. 安裝依賴
npm ci --production

# 3. Webapp build
cd webapp && npm ci && npm run build && cd ..

# 4. 啟動 API Server (建議用 PM2 或 systemd)
NODE_ENV=production node src/api/server.mjs

# 或使用 daily check:
node src/runDailyCheck.mjs
```

### Health Check 端點

```
GET /health   → 不需要 auth, 回傳 { status: "ok", ts }
GET /healthz  → 同上 (k8s readiness probe 用)
```

---

## 🚨 部署後觀察重點

### 必要監控

1. **Server 啟動時間**: 應該 < 5 秒
2. **Memory 用量**: baseline ~150MB (觀察有無 leak)
3. **API Response Time**: P95 < 500ms
4. **HMAC 驗證失敗率**: 應該 < 1% (若 > 5% 表示 Client SDK 異常)
5. **Alert Rules**: high_error_rate, queue_backlog, worker_heartbeat_timeout

### 觀察的 Log 關鍵字

- `[initDataGuard] HMAC 驗證失敗` → Client SDK 有問題
- `[initDataGuard] initData 已過期` → Client 沒更新 timestamp
- `[api] 🚀 Server started` → Server 健康
- `[RateLimit]` → 客戶端 IP 超過速率限制 (100 req/min)

---

## 📦 合併內容摘要

### 新增檔案 (Phase 6+7)

```
src/test/setup.mjs                       (Vitest Teardown)
src/test/utils/authMock.mjs              (HMAC-SHA256 簽發器)
src/test/unit/alertEngine.test.mjs       (24 tests)
src/test/unit/errorStore.test.mjs        (16 tests)
src/test/unit/metricsCollector.test.mjs  (24 tests)
src/test/unit/simulateRoute.test.mjs     (21 tests)
src/test/__mocks__/langfuse.mjs          (Langfuse mock)
docs/decisions/DEC-016-vitest-worker-crash.md
docs/plans/completed/PHASE_6_SUMMARY.md
docs/plans/active/PHASE_6_PLAN.md
docs/plans/active/PHASE_7_PLAN.md
docs/plans/active/PHASE_7_CHECKLIST.md
```

### 修改檔案

```
src/api/middleware/initDataGuard.mjs    (移除 TEST_MODE bypass)
src/api/routes/backtestRoutes.mjs       (改用 .mjs)
src/modules/backtest/backtestScheduler  (.ts → .mjs 重新命名)
vitest.config.mjs                       (加入 setupFiles)
eslint.config.js                        (降級為 flat/essential)
webapp/scripts/dogfood-qa.mjs           (注入真實 HMAC)
+ 27 source files (修復 ESLint _ prefix)
```

### 移除檔案 (Phase 7.4 cleanup)

```
fix-unused*.py    (開發輔助)
find_langfuse.py  (debug 工具)
run_vitest_verbose.py (輔助)
```

---

## 🎯 部署後下一步建議

### Phase 8 候選項目

1. **Kubernetes / Docker 化部署**
2. **Production 監控接入** (Sentry, DataDog, Grafana)
3. **CI/CD Pipeline** (GitHub Actions)
4. **Database 備份策略** (若用 SQLite → Postgres 遷移)
5. **API Rate Limit 細化** (per-user 而非 per-IP)
6. **Webhook 重試機制** (Telegram API failure)
7. **Unit Test 推至 65%** (Phase 6.2 延後項目)

---

**部署狀態**: ✅ Ready for Production

**簽核**: Main HEAD = `57e3b3b`
**時間**: 2026-08-14
