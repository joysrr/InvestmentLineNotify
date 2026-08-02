# Changelog

所有重要變更均記錄於此，格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)。

---

## [Unreleased]

---

## [2026-08-02] — 0050 雙向智慧模擬器 v1.3 完整上線

### Added

#### Phase A: 基礎模型與正向模擬

- **輸入驗證器** (`src/modules/simulator/validator.mjs`)：股價邊界檢查 (50-500)、目標類型驗證、必填欄位檢查、priceZ2 同比例同步 (DEC-01)
- **資料適配器** (`src/modules/simulator/dataAdapter.mjs`)：最新戰報獲取、歷史資料完整性檢查、月 K 棒合併、末月燭籤替換、指標全量重算 (DEC-02, DEC-07)、記憶體快取 TTL+mtime 雙重驗證 (D6, DEC-28)、MA240 分級 Fallback (DEC-06)
- **正向模擬引擎** (`src/modules/simulator/forwardSimulator.mjs`)：策略引擎評估、結果格式化、三級價格偏離警告 (DEC-19)、假設條件與免責聲明
- **API 路由** (`src/api/routes/v1/simulate.mjs`)：`POST /api/v1/simulate` 正向模擬、`POST /api/v1/simulate/reverse` 反向推導
- **Dev Bypass** (DEC-33)：`NODE_ENV=development` 時跳過 Telegram initData 驗證，利於本地開發

#### Phase B: 解析型反向推導

- **解析型求解器** (`src/modules/simulator/analyticalSolvers.mjs`)：維持率線性解、MA20/MA60 線性解、MA240 偏離解析解
- **RSI 二分搜尋** (`src/modules/simulator/rsiSolver.mjs`)：固定 ±30% 搜尋範圍 (DEC-11)、50 次迭代上限、0.5 RSI 容忍度 (D5)、邊界自動擴展機制
- **掃描器** (`src/modules/simulator/scanner.mjs`)：通用區間掃描 ±15% (DEC-12)、0.5% 步距 (D3)、200 次迭代上限 (D4)、KD/MACD 交叉檢查、策略分數檢查、Portfolio Health AND 邏輯 (DEC-14, DEC-15)
- **反向推導主流程** (`src/modules/simulator/reverseEngine.mjs`)：9 種目標類型路由、解析解優先、掃描法備用、不可達回傳最近結果 (DEC-20)

#### Phase C: 近似型反向推導深化

- 掃描器優化：早停機制 (DEC-14)、匹配點統計、耗時統計
- MA240 偏離反向：單次驗證機制 (DEC-10)、品質標籤傳遞

#### Phase D: Mini App UX

- **SimulatorView** (`webapp/src/views/SimulatorView.vue`)：主視圖、Mode A/B 切換、API 整合
- **14 個 Vue 元件**：ModeSelector、ForwardPanel、ReversePanel、PriceInput、TargetSelector、TargetInput、ForwardResultCard、ReverseResultCard、IndicatorComparisonTable、DataQualityBadges、DisclaimerBanner、LoadingSkeleton
- **Dashboard 整合**：新增「模擬器」Tab，從總覽頁直接進入
- **UX 完整**：三級價格偏離警告、彩色狀態+圖示、載入骨架屏、錯誤/不可達/近似狀態、免責聲明固定顯示

#### Phase E: TDD 與整合驗收

- **單元測試**：152 tests (simulator modules) 全部通過
- **整合測試**：20 tests (API routes) 全部通過
- **E2E 測試**：22 tests (Webapp components + user flows) 全部通過
- **回歸測試**：376 passed, 6 todo (完整專案)
- **效能驗證**：掃描 60 步 < 2s，API 響應 < 500ms

#### Phase F: 文件與部署

- **README 更新**：新增模擬器特色、API 端點、專案結構
- **CHANGELOG 更新**：完整記錄 v1.3 所有階段
- **API 版本**：`/api/v1/` 前綴 (DEC-34)

### Changed

- **系統架構文件**：`docs/modules/_index.md`、`docs/modules/strategy/_index.md` 新增 simulator 模組說明
- **開發規劃**：`docs/plans/active/0050-simulator-development-plan.md` v1.3 確認 34 個決策、完整規格凍結
- **專案結構**：新增 `src/modules/simulator/` (9 檔)，`webapp/src/components/simulator/` (14 檔)

### Technical Decisions (34 個決策全部確認)

| 決策   | 選項 | 關鍵點                         |
| ------ | ---- | ------------------------------ |
| D1     | A    | 僅 0050，00675L 同比例         |
| D2     | A    | 指標全量 13 月重算             |
| D3     | B    | 0.5% 步距，60 步               |
| D4     | B    | 200 次迭代上限                 |
| D5     | A    | RSI 二分搜尋                   |
| D6     | B    | 記憶體 Map + TTL + mtime       |
| D7     | A    | Telegram initData              |
| D8     | C    | dataAsOf + timestamp 雙時間戳  |
| DEC-01 | A    | priceZ2 當前比例同步           |
| DEC-05 | A    | 缺月嚴格 409                   |
| DEC-06 | A    | MA240 分級 Fallback + 品質標籤 |
| DEC-07 | A    | 復用 calculateIndicators       |
| DEC-08 | A    | 維持率同比例                   |
| DEC-11 | A    | RSI ±30% 固定範圍              |
| DEC-12 | A    | 雙邊掃描架構                   |
| DEC-13 | A    | 0.5% 相對步距                  |
| DEC-14 | A    | 精確匹配教科書定義             |
| DEC-15 | A    | Portfolio Health AND 邏輯      |
| DEC-16 | A    | 完整指標 + 品質標籤            |
| DEC-17 | A    | 結構化錯誤                     |
| DEC-18 | A    | 409 明確列舉                   |
| DEC-19 | A    | 三級價格警告                   |
| DEC-20 | A    | 不可達回傳最近結果             |
| DEC-22 | A    | 9 檔模組拆分                   |
| DEC-25 | A    | 後端產生白話解讀               |
| DEC-28 | A    | TTL + mtime 雙重檢查           |
| DEC-29 | A    | 掃描串行                       |
| DEC-33 | A    | NODE_ENV=dev bypass            |
| DEC-34 | A    | /api/v1/ 版本前綴              |

---

## [2026-04-14] — 大盤量價資料整合 & Provider 架構抽象化

### Added

- **大盤量價概覽** (`twseProvider.mjs`)：TWSE FMTQIK endpoint，指數收盤、漲跌點、成交金額、20日均量/最大量
- **Provider 架構抽象化**：`dataSourceConfig.mjs` + `providerRegistry.mjs` Slot-based 設計
- **快取策略**：段落 G，每日抓一次，同日多次呼叫讀快取

### Changed

- **文件更新**：`docs/modules/providers.md`、`docs/architecture.md` 全面更新 Slot-based 架構說明
- **技術細節**：CommonJS → ESM、`fetchWithTimeout` + `twseAgent`、漲跌點 fallback 機制

---

## [2026-04-13] — Oracle VM 全面遷移 & Mini App 完整功能上線

### Changed

- 所有排程從 GitHub Actions 移轉至 Oracle VM crontab
- Bot daemon + API Server 改由 PM2 長駐執行
- GitHub Actions 降格為手動觸發備援

### Added

- Telegram Mini App 正式上線 (7 Tab)
- 系統狀態區塊：Provider 健康度即時顯示
- `/api/snapshots/weekly`、`/api/snapshots/monthly` 聚合端點
- `snapshotAggregator.mjs`：市價淨值週/月聚合
- AES-256-GCM 快照加密 (`SNAPSHOT_ENCRYPT_KEY`)

---
