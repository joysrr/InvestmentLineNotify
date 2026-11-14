---
type: plan
status: not-started
last_updated: 2026-11-14
owner: 開發者
reviewer: 規劃者
tags:
  - webapp
  - refactor
  - phase-7
---

# 階段七 · 驗證與持續改進

## 概覽

階段七負責 E2E 驗證、效能監視與使用者回饋閉合，確保重構品質與長期可維護性。

基線：階段六驗收通過。

## 子卡清單（取自母計畫 §階段七）

| 子卡 | 項目       | 說明                                   | 狀態   |
| ---- | ---------- | -------------------------------------- | ------ |
| 7.1  | E2E 驗證   | Playwright 路由與頁面驗證（workers=1） | 未開始 |
| 7.2  | 效能監視   | bundle 體積、首屈載時間持續追蹤        | 未開始 |
| 7.3  | 使用者回饋 | localStorage 本地統計（D6），不涉隱私  | 未開始 |

## 驗收（階段七）

- [ ] E2E 全綠（workers=1，verify-pages.sh cleanup→startup→health→test→cleanup）
- [ ] bundle 體積未超過預算（Initial ≤ 156.0 KB、Total ≤ 380.0 KB）
- [ ] `npm --prefix webapp run lint` 0 errors / 0 warnings
- [ ] `npm --prefix webapp run test` 全綠
