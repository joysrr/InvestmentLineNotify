---
type: reference
status: current
last_updated: 2026-09-24
last_verified: 2026-09-24
related_code:
  - src/api/routes/reports.mjs
  - src/modules/data/archiveManager.mjs
  - src/api/routes/reports.test.mjs
related_docs:
  - docs/modules/presentation/api/_index.md
  - docs/modules/presentation/api/report_signals_contract.md
tags:
  - api
  - news
  - report
  - data-freshness
wiki_links:
  - [[API Index]]
  - [[Report Signals Contract]]
---

# `/api/report/news` 新聞報告契約

## 目的

`GET /api/report/news` 提供 Mini App「精選報告」頁面的每日 AI 篩選新聞。此端點必須讓使用者看見**最新每日報告的實際狀態**，不可用較舊新聞掩蓋最新報告沒有新聞的情況。

## 讀取規則

1. 透過 `archiveManager.listArchiveDates()` 取得已排序的每日報告日期。
2. 只讀取最新日期的 canonical report：`data/reports/YYYY-MM-DD.json`。
3. `YYYY-MM-DD_HHMMSS.json` 是歷史產出殘留，不是 API 的替代版本，也不可納入選取順序。
4. 最新報告的 `news` 為空、缺少或沒有有效 `tw`／`us` 項目時，直接回傳空陣列，不掃描舊報告。
5. 空新聞回應仍回傳最新報告日期作為 `generatedAt`，避免前端誤以為資料來自更早日期。

## 回應格式

```json
{
  "tw": [],
  "us": [],
  "generatedAt": "YYYY-MM-DD"
}
```

有新聞時，`tw` 與 `us` 直接取自最新 canonical report 的 `news` 欄位；`generatedAt` 優先使用 `news.generatedAt`，缺少時使用報告日期。

沒有任何每日報告時，回應為：

```json
{
  "tw": [],
  "us": [],
  "generatedAt": null
}
```

## 資料新鮮度邊界

新聞池 `data/news/pool_active.json` 與每日精選新聞報告是不同產出層。新聞池有新資料，不代表最新每日報告已成功寫入精選新聞；兩者必須分開查驗。若最新 canonical report 沒有新聞，API 顯示空結果，讓排程或資料產出問題可被觀測，而不是靜默顯示舊新聞。

## 驗證

相關回歸測試位於 `src/api/routes/reports.test.mjs`，至少覆蓋：

- 最新報告有新聞時回傳最新報告內容。
- 最新報告無新聞時不回退到舊新聞。
- 沒有報告日期時回傳空結果。
