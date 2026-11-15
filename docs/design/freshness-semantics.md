---
type: reference
status: current
last_updated: 2026-11-14
tags:
  - auto-generated
wiki_links: []
last_verified: 2026-11-15
summary: 新鮮度語義設計文件。
related_code: []
related_docs: []
---

# 資料新鮮度分級規格 (Freshness Semantics)

> 階段五 CARD-5.0 產出。規範 `FreshnessBadge.vue` 的新鮮度分級、閾值與視覺語意。

## 1. 設計原則

- 同一概念（新鮮度）跨頁使用相同令牌、相同措辭。
- 分級為三級：`fresh` / `stale` / `expired`，對應綠 / 黃 / 紅。
- 不新增裸 hex/rgba；複用 `--iln-ok/warn/danger-*` 令牌。
- 顯示相對時間（如「3 小時前」）與絕對時間（title 屬性 ISO 字串）。

## 2. 新鮮度分級

| 等級      | 年齡閾值 | 視覺色系 | 令牌             | 語義                 |
| --------- | -------- | -------- | ---------------- | -------------------- |
| `fresh`   | < 1 小時 | 綠       | `--iln-ok-*`     | 資料新鮮，可直接依賴 |
| `stale`   | 1–6 小時 | 黃       | `--iln-warn-*`   | 資料偏舊，僅供參考   |
| `expired` | ≥ 6 小時 | 紅       | `--iln-danger-*` | 資料過期，不宜依賴   |

> 閾值單位為秒，預設 `fresh=3600`、`stale=21600`（6 小時）、`expired=86400`（24 小時）。各頁可透過 `thresholds` prop 覆蓋。

## 3. `FreshnessBadge.vue` 介面

```vue
<FreshnessBadge
  :timestamp="lastUpdated"
  label="最後同步"
  :thresholds="{ fresh: 3600, stale: 21600, expired: 86400 }"
/>
```

| Prop         | 類型                       | 預設                                            | 說明             |
| ------------ | -------------------------- | ----------------------------------------------- | ---------------- |
| `timestamp`  | `String \| Number \| Date` | 必填                                            | 資料更新時間戳   |
| `label`      | `String`                   | `"更新"`                                        | 顯示標籤文字     |
| `thresholds` | `Object`                   | `{ fresh: 3600, stale: 21600, expired: 86400 }` | 各等級閾值（秒） |

### 呈現內容

- `<Icon name="clock" />`：時鐘圖示（icon-registry 登記）
- `label`：標籤文字
- 相對時間：「剛剛」/「X 分鐘前」/「X 小時前」/「X 天前」
- `title` 屬性：ISO 8601 絕對時間（滑鼠懸停顯示）

## 4. 視覺令牌

| 等級      | 背景              | 文字                | 邊框           | 對應令牌 |
| --------- | ----------------- | ------------------- | -------------- | -------- |
| `fresh`   | `--iln-ok-bg`     | `--iln-ok-text`     | `--iln-ok`     | 綠色系   |
| `stale`   | `--iln-warn-bg`   | `--iln-warn-text`   | `--iln-warn`   | 黃色系   |
| `expired` | `--iln-danger-bg` | `--iln-danger-text` | `--iln-danger` | 紅色系   |

## 5. 跨頁驗收清單

- [ ] `FreshnessBadge.vue` 在 `components/common/` 下，可跨頁複用
- [ ] 三級分級（fresh/stale/expired）視覺明確、跨頁一致
- [ ] 使用 `--iln-ok/warn/danger-*` 令牌，無裸 hex/rgba
- [ ] `clock` icon 已登記於 `icon-registry.js`
- [ ] 相對時間與絕對時間（title）正確顯示
- [ ] 360px 寬下不溢出、不換行
- [ ] 測試覆蓋 fresh/stale/expired 三級、自訂 label、title 屬性
