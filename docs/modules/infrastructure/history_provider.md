---
type: reference
status: current
last_updated: 2026-10-01
last_verified: 2026-10-01
related_code:
  - src/modules/providers/historyProvider.mjs
  - src/modules/providers/twseProvider.mjs
  - src/domain/dailyRunContext.mjs
  - src/test/historyProvider.resilience.test.mjs
tags:
  - providers
  - twse
  - historical-data
  - resilience
wiki_links:
  - [[Data Manager]]
  - [[Providers Layer]]
---

# 歷史資料回補提供者 (`historyProvider`)

`historyProvider.mjs` 將 TWSE STOCK_DAY 的月資料查詢，組合成 dailyCheck 可使用的歷史日 K 線資料。它的核心契約是：**月份只代表 API 查詢批次，資料筆數才是歷史資料是否足夠的判定依據。**

## 1. 主要入口

| 函式                                                                       | 用途                                           |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| `fetchStockHistoryWithAutoFill(symbol, minCount, endISO)`                  | 相容舊呼叫者，只回傳歷史資料陣列。             |
| `fetchStockHistoryWithAutoFillDetailed(symbol, minCount, endISO, options)` | 回傳資料、筆數、處理月份與來源診斷狀態。       |
| `fetchStockDayMonthWithCache(stockNo, yyyymm01)`                           | 由 `twseProvider` 查詢單月資料並處理月份快取。 |

目前 dailyCheck 對 00675L 與 0050 的最低歷史資料需求為 60 筆。

## 2. 往前回補流程

1. 從結束日期所在月份開始查詢。
2. 將該月份有效資料加入累積集合。
3. 依日期去重並排序。
4. 若累積筆數尚未達到 `minCount`，往前查詢上一個月份。
5. 達到最低筆數後停止，不必再查詢更早月份。
6. 若達到安全限制仍不足，依錯誤狀態回報。

TWSE STOCK_DAY 只能按月份查詢，因此系統仍會使用月份作為 API 批次；但不會要求某個特定月份一定要有資料。

## 3. 當月尚無成交資料

在月份剛開始、尚未開市或當月尚無成交紀錄時，TWSE 可能回覆：

```text
很抱歉，沒有符合條件的資料!
```

這不是來源中斷。對「目前月份」而言，這是可預期的空月份，系統會：

- 不將該月份加入 `failedMonths`。
- 清除該次預期空月份錯誤。
- 繼續往前查詢上一個月份。
- 只要累積資料達到 `minCount`，回傳 `status: "available"`。

例如：

```text
202610：無成交資料，略過
202609：取得 64 筆
結果：available，count=64，failedMonths=[]
```

## 4. 真正來源失敗與結果狀態

非預期的 timeout、HTTP 錯誤、JSON 格式錯誤或其他來源例外，仍會記錄該月份並保留診斷訊息。

詳細入口回傳的主要狀態如下：

| 狀態                   | 意義                                           |
| ---------------------- | ---------------------------------------------- |
| `available`            | 累積資料已達最低需求，且沒有未處理的來源失敗。 |
| `source_unavailable`   | 至少一個必要月份發生真正的來源錯誤。           |
| `insufficient_history` | 沒有來源錯誤，但回補後仍未達最低筆數。         |

`dailyRunContext.mjs` 只會對非 `available` 狀態建立致命錯誤。當月預期空資料不會單獨造成 dailyCheck 終止。

## 5. 快取規則

- 非當月取得有效資料後，透過 `archiveManager` 寫入 `data/stock_history/{stockNo}_YYYYMM.json`。
- 當月資料不永久寫入月份快取，避免把尚未完成的月份當成完整歷史。
- 快取資料與線上資料會在 history provider 層合併、去重並排序。

## 6. 回歸測試

`src/test/historyProvider.resilience.test.mjs` 覆蓋：

- 單月暫時失敗後重試成功。
- 當月回覆無符合資料、前月資料已足夠時仍回傳 `available`。
- 真正來源錯誤時回傳 `source_unavailable` 與失敗月份診斷。

修改此流程時，必須先新增會重現實際資料源行為的 failing test，再修改 provider；不可把「當月無資料」重新分類為來源故障。
