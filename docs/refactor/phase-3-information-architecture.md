---
type: plan
status: not-started
last_updated: 2026-11-14
owner: 開發者
reviewer: 規劃者
tags:
  - webapp
  - refactor
  - phase-3
---

# 階段三 · 資訊架構與導航重構（CARD-00 ～ CARD-05）

## 概覽

階段三將 WebApp 的視圖與路由結構重構為 5 個一級入口（決策 D4），並協調 CARD-00～CARD-05 五張卡的執行順序與依賴。階段三不新增功能，僅進行資訊架構整理、導航收斂與內容去重準備。

基線：Phase 2 最終狀態（main @ 0c8f1d7，10 個視圖／11 條路由）。

## 範圍（取自母計畫 §階段三）

- CARD-00：計畫落地與現狀核實（M0）
- CARD-01：Dashboard ↔ StrategyStatus 去重（M1，決策 D3）
- CARD-02：News 精選報告 ↔ 新聞池釐清（M1）
- CARD-03：指標卡跨頁統一（M1）
- CARD-05：頁面職責矩陣（M2，可與 CARD-04 並行）
- CARD-04：一級入口精簡與路由重構（M2，決策 D1、D2、D4）

## 子計畫清單

| 卡號    | 里程碑 | 預估   | 前置                       | 狀態   |
| ------- | ------ | ------ | -------------------------- | ------ |
| CARD-00 | M0     | 0.5 日 | 無                         | 未開始 |
| CARD-01 | M1     | 1 日   | CARD-00                    | 未開始 |
| CARD-02 | M1     | 1 日   | CARD-00                    | 未開始 |
| CARD-03 | M1     | 0.5 日 | CARD-00                    | 未開始 |
| CARD-05 | M2     | 0.5 日 | 可與 CARD-04 並行          | 未開始 |
| CARD-04 | M2     | 4 日   | CARD-01 / 02 / 03 全部驗收 | 未開始 |

## 關鍵決策（D1–D4）

- D1：TheoryView 歸屬於「帳戶與設定」的「關於」區段；模擬器承載與否待 CARD-00 第 5 項核實。
- D2：TechnicalView 與 ChartView 合併為單一「圖表」頁。
- D3：StrategyStatusView 廢止獨立路由，改以 drawer 呈現。
- D4：一級入口為 5 項：總覽、市場洞察、圖表、新聞與報告、帳戶與設定。

## 驗收（階段三）

- [ ] CARD-00 六項現狀核實全部有結論與證據
- [ ] CARD-01～CARD-03 全部驗收通過
- [ ] CARD-04 收斂為 5 個一級入口
- [ ] CARD-05 頁面職責矩陣完整
- [ ] `npm --prefix webapp run lint` 0 errors / 0 warnings
- [ ] `npm --prefix webapp run test` 全綠
- [ ] `npm --prefix webapp run build && node webapp/scripts/check-bundle-size.mjs` 體積預算內

## 未決事項

- CARD-00 第 5 項（TheoryView 是否承載模擬器）結果將決定 D1 微調與 CARD-04 Theory 併入方式。

---

## 偏差記錄（CARD-04 步驟 D）

原計畫 `/theory` → `/account#about` 使用錨點導航，
實作改為 `/account?panel=about`，與 CARD-01 的 `?panel=strategy-status` 模式一致。
錨點 `id="about"` 仍保留於 AccountView.vue 的「關於」區段，
作為無 JS 環境的 fallback。
