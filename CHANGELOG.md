# Changelog

所有重要變更均記錄於此，格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)。

---

## [Unreleased]

---

## [2026-04-14] — 大盤量價資料整合 & Provider 架構抽象化

### Added

#### 大盤量價概覽（`rawMarketOverview`）

- **`twseProvider.mjs`**：新增 `fetchMarketOverview()` 函式，呼叫 TWSE OpenAPI `FMTQIK` endpoint，回傳：
  - 最新交易日加權指數收盤價（`taiex`）
  - 當日漲跌點（`changePoint`）與漲跌幅百分比（`changePercent`）
  - 當日全市場成交金額（`tradeValueHundredMillion`，億元）
  - 近 20 日平均成交金額（`avgTradeValue20dHundredMillion`）
  - 近 20 日最大成交金額（`maxTradeValue20dHundredMillion`）
- **`dataSourceConfig.mjs`**：新增 `rawMarketOverview` Slot，`providerId: 'twMarketOverview'`。
- **`providerRegistry.mjs`**：新增 `twMarketOverview` provider adapter，label 為「台股大盤量價概覽 (指數與成交金額)」。
- **`marketData.mjs`**：新增 **段落 G** 快取策略——每日抓一次（比對 `lastFetch` 日期），同日多次呼叫讀快取。

#### Provider 架構抽象化（Slot + Registry）

- 引入 `dataSourceConfig.mjs` 與 `providerRegistry.mjs`，將「資料來源」與「快取策略」從 `marketData.mjs` 的程式碼中分離。
- `marketData.mjs` 不再直接 import 個別 provider，所有總經資料一律透過 Slot key + providerId 路由。
- 抽換資料來源只需：① 在 `providerRegistry` 加 adapter、② 改 `dataSourceConfig` 的 `providerId`，無需變動上層消費者。

### Changed

- **`docs/modules/providers.md`**：全面更新，補充 Slot-based 架構說明、`fetchAllMacroData()` A~G 七段快取表、`twMarketOverview` 相關欄位與診斷說明。
- **`docs/architecture.md`**：補充 `rawMarketOverview` 於 `MarketRadarView.vue` 台股資料欄位說明、`data/market` persistence 快取結構說明。

### Technical Notes

- 原始程式碼使用 CommonJS `require('axios')`，整合時改為專案既有的 `fetchWithTimeout` + `twseAgent`（ES Module，無需新增套件）。
- 漲跌點優先讀 API `Change` 欄位；缺值時自動 fallback 為 `taiex - prevTaiex`（取陣列倒數第二筆計算）。
- 前端 `AccountView.vue` 的 `SOURCE_LABELS` 可加入 `twMarketOverview: '大盤量價 (FMTQIK)'` 以顯示中文 provider 名稱。

---

## [2026-04-13] — Oracle VM 全面遷移 & Mini App 完整功能上線

### Changed

- 所有排程任務從 GitHub Actions 全面移轉至 Oracle VM crontab，消除 Actions 延遲問題。
- Bot daemon（`src/bot.mjs`）與 API Server（`src/api/server.mjs`）改由 PM2 長駐執行。
- GitHub Actions workflows 降格為「僅手動觸發」備援模式。

### Added

- Telegram Mini App 正式上線，7 個 Tab 儀表板（總覽 / 雷達 / 多空 / 圖表 / 報告 / 新聞 / 設定）。
- `AccountView.vue` 系統狀態區塊：即時顯示各 provider 健康度（OK / FAIL / STALE）與最後更新時間。
- `/api/snapshots/weekly` 與 `/api/snapshots/monthly` 聚合端點，支援資產趨勢週/月粒度切換。
- `snapshotAggregator.mjs`：市價淨值（`netValueMarket = qty0050 × price0050 + qtyZ2 × priceZ2 - totalLoan`）週/月聚合計算。
- AES-256-GCM 快照加密（`snapshotCrypto.mjs`），金鑰由 `SNAPSHOT_ENCRYPT_KEY` 環境變數管理。
