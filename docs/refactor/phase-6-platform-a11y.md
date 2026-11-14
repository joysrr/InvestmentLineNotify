---
type: plan
status: not-started
last_updated: 2026-11-14
owner: 開發者
reviewer: 規劃者
tags:
  - webapp
  - refactor
  - phase-6
---

# 階段六 · 平台無障礙與相容性

## 概覽

階段六補齊平台無障礙與相容性基線，確保 WebApp 在各種視口與輸入方式下可用。

基線：階段五驗收通過。

## 子卡清單（取自母計畫 §階段六）

| 子卡 | 項目               | 說明                                   | 狀態   |
| ---- | ------------------ | -------------------------------------- | ------ |
| 6.1  | 資料新鮮度全域元件 | 統一顯示資料更新時間                   | 未開始 |
| 6.2  | 視口與相容性       | 360px 寬下無橫向滾動、5 個導航項不換行 | 未開始 |
| 6.3  | a11y 基線          | 鍵盤導航、ARIA、對比度                 | 未開始 |

## 驗收（階段六）

- [ ] 鍵盤可完整導航所有互動元件
- [ ] 關鍵元件具備正確 ARIA 標籤
- [ ] 色彩對比度符合 WCAG AA
- [ ] `npm --prefix webapp run lint` 0 errors / 0 warnings
- [ ] `npm --prefix webapp run test` 全綠
