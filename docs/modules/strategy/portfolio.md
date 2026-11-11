---
type: reference
title: "Portfolio 快照模組 (`src/modules/portfolio/`)"
category: "strategy"
status: current
created: "2026-11-11"
last_updated: "2026-11-11"
last_verified: "2026-11-11"
related_code:
  - src/modules/portfolio/derivedPortfolioSnapshot.mjs
  - src/modules/portfolio/marketPriceSnapshot.mjs
  - src/modules/portfolio/reportPortfolioSnapshot.mjs
  - src/modules/portfolio/verifiedPortfolioFields.mjs
related_docs:
  - docs/modules/presentation/api/portfolio_health_api.md
  - docs/modules/strategy/cash_exposure_advisor.md
tags:
  - portfolio
  - snapshot
  - strategy
  - verified-data
wiki_links:
  - [[Strategy Engine]]
  - [[Portfolio Health]]
---

# Portfolio 快照模組 (`src/modules/portfolio/`)

負責建構每日策略計算所需的 Portfolio 快照，並嚴格區分「外部驗證值」與「模型推導值」兩種資料來源。

---

## 📋 目錄

1. [資料來源層級](#資料來源層級)
2. [模組清單與職責](#模組清單與職責)
3. [快照建構流程](#快照建構流程)
4. [欄位定義](#欄位定義)
5. [狀態碼](#狀態碼)

---

## 資料來源層級

```
VERIFIED  > DERIVED  > UNAVAILABLE
  ↓            ↓            ↓
外部輸入     市場價格       資料缺失
(可信)      推算(估計)     (不計算)
```

| 層級          | 說明                                                       | 信任度       |
| ------------- | ---------------------------------------------------------- | ------------ |
| `VERIFIED`    | 由外部資料來源（如券商報表）直接讀入，含來源標記與時間戳記 | 最高         |
| `DERIVED`     | 由市場即時價格 × 持股數量推算，來源為 `TWSE_MIS`           | 中（估計值） |
| `UNAVAILABLE` | 任一必要欄位缺失或無效，不建構快照                         | —            |

---

## 模組清單與職責

| 檔案                           | 職責                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `verifiedPortfolioFields.mjs`  | 讀取外部驗證欄位（帳戶淨資產、擔保品市值），回傳 `VERIFIED` 或 `UNAVAILABLE` |
| `derivedPortfolioSnapshot.mjs` | 以市場價格推算帳戶淨資產與擔保品市值，回傳 `DERIVED`                         |
| `marketPriceSnapshot.mjs`      | 建構市場價格快照（0050、00675L），驗證有效性                                 |
| `reportPortfolioSnapshot.mjs`  | 整合入口：VERIFIED 優先，否則嘗試 DERIVED，均失敗回 UNAVAILABLE              |

---

## 快照建構流程

```
reportPortfolioSnapshot()
  ├─ 嘗試 buildVerifiedPortfolioState(portfolio)
  │   ├─ 外部欄位完整 → 回傳 VERIFIED snapshot  ✅
  │   └─ 欄位不完整   → UNAVAILABLE
  │
  └─ UNAVAILABLE → 嘗試 buildDerivedPortfolioSnapshot()
      ├─ 市場價格 + qty + cash + totalLoan 均有效 → 回傳 DERIVED snapshot
      └─ 任一缺失 → 回傳 UNAVAILABLE
```

**決策原則**：外部驗證值優先；模型推導值作為備援。
當 DERIVED 也不可用時，策略引擎應降低信心度或跳過該日計算。

---

## 欄位定義

### `portfolio` 輸入物件必要欄位

| 欄位                    | 說明                              | 型別         |
| ----------------------- | --------------------------------- | ------------ |
| `accountNetAsset`       | 帳戶淨資產                        | number       |
| `accountNetAssetSource` | 資料來源（如 `SinoPac`）          | string       |
| `accountNetAssetAsOf`   | 資料時間                          | string (ISO) |
| `collateralValue`       | 擔保品市值                        | number       |
| `collateralValueSource` | 擔保品市值來源                    | string       |
| `collateralValueAsOf`   | 擔保品市值時間                    | string (ISO) |
| `qty0050`               | 0050 持股數量（DERIVED 模式用）   | number       |
| `qtyZ2`                 | 00675L 持股數量（DERIVED 模式用） | number       |
| `cash`                  | 現金                              | number       |
| `totalLoan`             | 總貸款金額                        | number       |

### `marketPriceSnapshot` 物件

```js
{
  price: 185.4,         // 即時股價
  source: "TWSE_MIS",   // 資料來源
  asOf: "2026-11-11T09:00:00.000Z",
  dataStatus: "VERIFIED" | "SOURCE_UNAVAILABLE"
}
```

---

## 狀態碼

| 狀態                 | 原因代碼                                          | 說明                 |
| -------------------- | ------------------------------------------------- | -------------------- |
| `VERIFIED`           | —                                                 | 外部驗證欄位完整     |
| `DERIVED`            | `DERIVED_FROM_PORTFOLIO_FIELDS_AND_MARKET_PRICES` | 由市場價格推算       |
| `UNAVAILABLE`        | `ACCOUNT_FIELDS_NOT_VERIFIED`                     | 外部驗證欄位不完整   |
| `UNAVAILABLE`        | `MISSING_DERIVED_PORTFOLIO_INPUT`                 | 市場價格或持股數缺失 |
| `SOURCE_UNAVAILABLE` | —                                                 | 市場價格快照無效     |

---

> **相關 API**：Portfolio Health 計算結果透過 `/api/portfolio/health` 端點公開，詳見 `docs/modules/presentation/api/portfolio_health_api.md`。
