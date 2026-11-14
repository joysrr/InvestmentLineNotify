---
type: report
status: current
last_updated: 2026-11-14
tags:
  - phase-2
  - emoji-audit
  - webapp
wiki_links: []
---

# Phase 2 Emoji 掃描清單（Tier 分層）

掃描指令：

```bash
cd webapp
grep -rnP "[\x{1F000}-\x{1FAFF}\x{2190}-\x{2BFF}\x{2460}-\x{24FF}\x{2600}-\x{27BF}]" \
  src --include="*.vue" --include="*.js" \
  > /tmp/emoji-audit.txt
wc -l /tmp/emoji-audit.txt
```

掃描日期：2026-11-14
掃描 commit：1a78dcf
總計：203 處（原始 regex 命中，含非 Emoji 符號）

## Tier A：UI 可見（必須為 0）

| 檔案:行 | 字元 | 替代 | 狀態 |
| ------- | ---- | ---- | ---- |
| —       | —    | —    | 0 處 |

說明：經 NewsView.vue 移除 `<EmptyState emoji="⏳">` 後，`.vue` 模板內已無任何 UI 可見 Emoji。原始掃描命中的 `─`（表格框線 U+2500）、`→←`（方向箭頭）、`≤↓▽≥≈`（數學/幾何符號）等非 Emoji 字元，已從 Tier A 排除。

## Tier B：測試斷言字串（允許保留）

| 檔案:行                                                    | 字元          | 用途               |
| ---------------------------------------------------------- | ------------- | ------------------ |
| src/components/dashboard/MetricCard.test.js:27,29          | 📈            | 斷言卡片圖示       |
| src/components/dashboard/MarketSnapshot.test.js:15,48      | 🟢            | 斷言狀態燈號       |
| src/components/dashboard/StrategyHealthOverview.test.js:10 | 🟢            | 斷言狀態燈號       |
| 其他測試檔（共約 43 處命中）                               | →📭🔄📈🌱⚠▼▲… | 測試斷言與快照字串 |

## Tier C：console 日誌（允許保留）

| 檔案:行                                          | 字元       | 用途                                     |
| ------------------------------------------------ | ---------- | ---------------------------------------- |
| src/api/index.js:74,80,102,133,147,163,171,182 … | ❌🔄📡✅⚠️ | 開發者終端輸出（apiFetch 重試/狀態日誌） |

## 允許保留：景氣燈號

| 檔案                                  | 字元 | 說明                                                             |
| ------------------------------------- | ---- | ---------------------------------------------------------------- |
| src/utils/metricThresholds.js:103,136 | 🔴🔴 | 斷頭警戒 / 超過硬上限 狀態標籤（資料層，非 .vue 模板直寫 Emoji） |

> 註：DashboardView.vue 實際上**無 Emoji**（先前摘要所寫「🟠」並不存在）；📈🟢🟢 僅出現在測試斷言，已歸 Tier B。

## 掃描範圍說明

本清單使用擴充 regex，相較原版新增：

- `2190–21FF`：箭頭（↗）
- `2460–24FF`：Enclosed Alphanumerics（ⓘ）
- `1F000–1FAFF`：完整 Emoji 區

原 `2600–27BF` 不涵蓋上述字元，故 `ⓘ` 曾未被計入。

注意：擴充範圍 `2190–2BFF` 會同時匹配表格框線 `─`（U+2500）與方向箭頭 `→←`，這些並非 Emoji，已從 Tier A 計數排除。

## 掃描原始輸出

完整輸出（203 行）已儲存於 `/tmp/emoji-audit.txt`，部分實際輸出如下（非文字轉述）：

src/api/index.js:74: logger.error({ traceId: "api-fetch" }, `❌ [apiFetch] ${errorMsg}`);
src/api/index.js:80: `🔄 [apiFetch] 等待 ${Math.round(retryDelay)}ms 後重試...`,
src/api/index.js:102: `📡 [apiFetch] ${options.method || "GET"} ${url} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
src/api/index.js:133: `❌ [apiFetch] ${errorMsg}`,
src/api/index.js:147: `✅ [apiFetch] Success: ${path}`,
src/views/MarketRadarView.vue:367:// ⚠️ 本卡片的顏色依 PB 絕對值判定（1.5/2.0/3.0/4.0），與 DashboardView.pbPrLevel 的 PR 歷史分位判定（25/80/90）為不同維度。
src/components/dashboard/MetricCard.test.js:27: props: { title: "0050", value: "145.20", icon: "📈" },
src/components/dashboard/MetricCard.test.js:29: expect(wrapper.text()).toContain("📈");

(共 203 行；Tier A UI 可見 Emoji = 0，其餘均屬 Tier B 測試斷言 / Tier C console 日誌 / 非 Emoji 符號 / 程式註解)
