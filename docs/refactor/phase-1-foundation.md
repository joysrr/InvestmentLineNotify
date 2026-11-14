---
type: plan
status: completed
last_updated: 2026-11-14
tags:
  - phase-1
  - refactor
  - webapp
wiki_links: []
---

# 第一階段改造計畫：工程基礎與啟動效能

文件位置：docs/refactor/phase-1-foundation.md
適用範圍：webapp/ 前端子專案
前置閱讀：docs/webapp-refactor-plan.md §二
執行模式：單一開發者、嚴格串行，所有工作項目依編號順序完成，前一項驗收通過後才進入下一項
分支策略：直接於 main 提交（單一開發者）

---

## 0. 階段範圍定義

**階段範圍定義**：第一階段 = 子計畫 1.1（工程基礎與啟動效能） + 子計畫 1.2（設計令牌與 Telegram 主題對齊）。
兩者皆完成並通過驗收，方視為第一階段完成。

**驗證方式說明**：本階段驗證不依賴截圖，改以 DevTools CSS 變數檢查、對比度計算與單元測試為準。
原因：開發環境無法產生視覺截圖，改以可量測的數值指標作為驗收依據。

| 子計畫 | 名稱                         | 狀態                          |
| ------ | ---------------------------- | ----------------------------- |
| 1.1    | 工程基礎與啟動效能           | 已完成（含補做 A1–A4）        |
| 1.2    | 設計令牌與 Telegram 主題對齊 | 已完成（含補做 B1–B7、P1–P4） |

---

## 1. 子計畫 1.1：路由懶載入改造

### 1.1 現狀事實（已核實源碼）

- webapp/src/router/index.js：10 個視圖，DashboardView 靜態匯入，其餘 9 個動態匯入
- webapp/vite.config.js：manualChunks 含 vendor-vue、vendor-echarts；chunkSizeWarningLimit: 350；manifest: true
- webapp/src/main.js：mount 前預檢 initData，未授權時 renderAuthFallback；mount 後呼叫 waitReady()
- webapp/src/App.vue：<router-view v-slot> 包 <keep-alive> 包 <Suspense>，fallback 顯示 RouteLoading
- webapp/src/components/common/RouteLoading.vue：新增，樣式使用 --iln-* design tokens
- webapp/scripts/check-bundle-size.mjs：manifest-based 初始/總和體積預算

### 1.5 基線與結果記錄表

| 指標                        | 改前      | 改後     | 目標     |
| --------------------------- | --------- | -------- | -------- |
| entry chunk gzip            | 155.34 KB | 152.1 KB | ≤ 300 KB |
| initial gzip                | 總和      | 152.1 KB | ≤ 300 KB |
| vendor-echarts 是否 initial | 是        | 否       | 否       |
| Total gzip                  | 368.9 KB  | 370.4 KB | ≤ 500 KB |

---

## 2. 子計畫 1.2：設計令牌與 Telegram 主題對齊

### 2.1 改造前現狀（歷史記錄）

- webapp/src/styles/tokens.css：:root 中 --iln-brand: #2481cc 等裸 hex；深色覆寫使用 @media (prefers-color-scheme: dark)
- webapp/src/composables/useTelegram.js：handleThemeChanged 僅更新 colorScheme 值，未寫入 data-tg-scheme
- .vue <style> 區塊中存在多處裸 hex 色值（待掃描）

### 2.2 問題清單

- 深色主題跟隨系統 prefers-color-scheme，而非 Telegram colorScheme
- 品牌色硬編碼 #2481cc，未映射到 --tg-theme-button-color
- .vue 樣式區塊存在裸 hex，缺乏 CI 守護

---

## 4. DoD（驗收標準）

### 1.1 工程基礎與啟動效能

- [x] T1.1 基線記錄：entry chunk 155.34 KB → 152.1 KB（manifest 實測值）
- [x] T1.2 ready() 修正：main.js mount 後呼叫 waitReady()
- [x] T1.3 路由動態匯入：Dashboard 靜態，其餘 9 個動態，補 meta.title/chunk
- [x] T1.4 建置配置：manifest: true，chunkSizeWarningLimit: 350
- [x] T1.5 認證守衛：mount 前預檢 initData，未授權顯示提示畫面
- [x] T1.6 首屏後預取：prefetch MarketRadarView
- [x] T1.7 體積閘門：manifest 首包計算，Initial ≤ 300 KB，Total ≤ 500 KB
- [x] T1.8 載入態與錯誤處理：Suspense + RouteLoading + ErrorAlert 重試
- [x] A1 keep-alive/Suspense 順序修正：跨路由快取正確
- [x] A2 waitReady 重複呼叫移除：統一收斂到 main.js
- [x] A3 未授權提示畫面：renderAuthFallback
- [x] A4 計畫文件更新：本文件

### 1.2 設計令牌與 Telegram 主題對齊

- [x] B1 主題檢測機制：data-tg-scheme 屬性寫入
- [x] B2 tokens.css 深色覆寫切換：:root[data-tg-scheme="dark"]
- [x] B3 根令牌映射到 Telegram 變數：--iln-brand 等
- [x] B4 RouteLoading.vue fallback 鏈簡化
- [x] B5 全站裸 hex 替換
- [x] B6 CI 守護腳本：check-no-hex.mjs
- [x] B7 三主題組合驗證（改為：三種主題組合下 --iln-* 令牌取值與對比度檢查通過，見 P2 驗證表）
- [x] npm run build 在 CI 通過，首包 gzip ≤ 300 KB（實測 152.1 KB）
- [x] npm run lint:tokens 通過

---

## 維護方式

每個子計畫完成後，在對應節點標註狀態：未開始／盤點中／進行中／待驗收／已完成。

## 附錄：補做記錄

| 項目  | 內容                                                                | commit  |
| ----- | ------------------------------------------------------------------- | ------- |
| A1–A4 | 1.1 收尾（keep-alive 順序、waitReady 去重、未授權提示、文件更新）   | ff54464 |
| B1–B7 | 1.2 主體（主題檢測、深色切換、令牌映射、hex 替換、CI 守護）         | ff54464 |
| P1–P4 | 令牌一致性修正（brand-hover-bg、深色業務色、surface 跟隨 Telegram） | ee78740 |
| F1    | 文件一致性修正（本次）                                              | 612fa33 |
