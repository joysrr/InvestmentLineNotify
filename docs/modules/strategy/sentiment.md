---
title: "社群情緒引擎 (Sentiment Engine)"
category: "modules/strategy"
type: reference
status: "current"
created: "2026-11-11"
last_updated: "2026-11-11"
tags:
  - sentiment
  - social
  - ptt
  - bluesky
  - emotion-indicator
code_refs:
  - src/modules/sentiment/sentimentEngine.mjs
  - src/modules/sentiment/socialCollector.mjs
  - src/modules/sentiment/socialKeywordResolver.mjs
  - src/modules/sentiment/crawlers/pttCrawler.mjs
  - src/modules/sentiment/crawlers/bskyCrawler.mjs
  - src/modules/sentiment/crawlers/socialScoreCalculator.mjs
---

# 社群情緒引擎 (Sentiment Engine)

## 📋 目錄

1. [架構總覽](#架構總覽)
2. [採集層：PTT + Bluesky 雙軌](#採集層)
3. [Score 計算邏輯](#score-計算邏輯)
4. [MA3、MA7、Delta 定義](#ma3ma7delta-定義)
5. [信號類型](#信號類型)
6. [頂底背離偵測](#頂底背離偵測)
7. [輸出資料結構 (snapshot)](#輸出資料結構-snapshot)
8. [sampleCount / pttItems / bskyItems 關係](#samplecount--pttitems--bskyitems-關係)
9. [資料儲存](#資料儲存)

---

## 架構總覽

```
PTT Stock 看板   ─┐
                  ├─→ socialCollector.mjs → socialScoreCalculator.mjs
Bluesky 貼文     ─┘         ↓
                      sentimentEngine.mjs
                   (MA3/MA7/信號/背離計算)
                            ↓
                  data/sentiment/news_history.jsonl
                  data/sentiment/social_sentiment_snapshot.json
```

**核心模組**：

| 檔案                        | 職責                                     |
| --------------------------- | ---------------------------------------- |
| `socialCollector.mjs`       | PTT + Bluesky 雙軌採集 + 歷史 JSONL 追加 |
| `sentimentEngine.mjs`       | MA3/MA7/信號/背離計算 + snapshot 產出    |
| `socialKeywordResolver.mjs` | 解析多空關鍵字                           |
| `pttCrawler.mjs`            | PTT Stock 看板爬蟲                       |
| `bskyCrawler.mjs`           | Bluesky 貼文爬蟲（Session Auth）         |
| `socialScoreCalculator.mjs` | 關鍵字多空計分                           |

---

## 採集層

**入口**：`collectSocialSentiment(options)` ← `socialCollector.mjs`

**流程**：

1. 解析關鍵字（`socialKeywordResolver.mjs`）
2. 並行呼叫 PTT 爬蟲 + Bluesky 爬蟲
3. 合併貼文，計算多空分數（`calcSocialSentimentScore`）
4. 追加寫入歷史 JSONL：`data/sentiment/news_history.jsonl`

**採集選項**：

```javascript
{
  historyPath?: string,       // 預設 data/sentiment/news_history.jsonl
  keywords?: string[],        // 自訂主要關鍵字（否則從 config 讀取）
  dynamicKeywords?: string[]  // 動態關鍵字（僅補充，不合併入主詞庫）
}
```

---

## Score 計算邏輯

Score 由 `socialScoreCalculator.mjs` 計算，範圍 **0–100**：

| 範圍   | 情緒標籤 |
| ------ | -------- |
| 0–29   | 恐慌     |
| 30–44  | 偏空     |
| 45–55  | 中性     |
| 56–70  | 偏多     |
| 71–100 | 過熱     |

計算方式：貼文中出現**多方關鍵字**加分、**空方關鍵字**減分，正規化至 0–100 區間。

---

## MA3、MA7、Delta 定義

定義於 `sentimentEngine.mjs`：

| 指標    | 定義                    | 說明                                    |
| ------- | ----------------------- | --------------------------------------- |
| `ma3`   | 最近 3 日 score 均值    | 短期趨勢，需 ≥3 筆歷史                  |
| `ma7`   | 最近 7 日 score 均值    | 中期趨勢，需 ≥7 筆歷史                  |
| `delta` | 今日 score − 昨日 score | 單日變動；> 1 升溫，< −1 降溫，否則穩定 |

**資料不足時**（歷史 < 3 或 < 7 筆），ma3 / ma7 回傳字串 `"資料累積中"`。

---

## 信號類型

由 `calculateSentimentIndicators()` 產出，優先序由高至低：

| 優先序 | 信號類型           | 觸發條件                                 |
| ------ | ------------------ | ---------------------------------------- |
| 1      | `VOLATILITY_SPIKE` | \|今日 − 昨日\| > 10 分                  |
| 2      | `HIGH_TO_COLD`     | 今日 score < 30 且昨日 score > 50        |
| 3      | `DEATH_CROSS`      | ma3 < ma7 且差距 ≥ 2.0（前日 ma3 ≥ ma7） |
| 4      | `GOLDEN_CROSS`     | ma3 > ma7 且差距 ≥ 2.0（前日 ma3 ≤ ma7） |

---

## 頂底背離偵測

**函數**：`calculateDivergence(sentimentHistory, priceHistory, windowDays=10)`

| 信號                           | 觸發條件                     |
| ------------------------------ | ---------------------------- |
| `BEARISH_DIVERGENCE`（頂背離） | ma7 > 80 且股價未創 N 日新高 |
| `BULLISH_DIVERGENCE`（底背離） | ma7 < 30 且股價未破 N 日新低 |
| 無                             | 其他情況                     |

---

## 輸出資料結構 (snapshot)

**函數**：`generateSentimentSnapshot(historyData, priceHistory, outputPath?)` ← `sentimentEngine.mjs`

```javascript
{
  date: "YYYY-MM-DD",          // 最新記錄日期
  updatedAt: "ISO timestamp",
  score: 65.3,                  // 當日分數 (0–100)
  scoreLabel: "偏多",           // 情緒標籤
  trend: "升溫",                // "升溫" | "降溫" | "穩定"
  ma3: 63.1,                    // 3 日均值
  ma7: 60.5,                    // 7 日均值
  delta: 2.8,                   // 今日 - 昨日
  sampleCount: 180,             // 總採集貼文數
  pttItems: 120,                // 來自 PTT 的貼文數
  bskyItems: 60,                // 來自 Bluesky 的貼文數
  divergenceStatus: "無",       // "觸發" | "無" | "資料不足"
  divergenceDetail: "無背離現象",
  signals: [...],               // 信號陣列
  hotTopics: ["0050", "AI"]     // 熱門話題（最近 3 日 top 3）
}
```

---

## sampleCount / pttItems / bskyItems 關係

```
sampleCount = pttItems + bskyItems
```

- `pttItems`：PTT Stock 看板採集的有效貼文數（含關鍵字命中）
- `bskyItems`：Bluesky 採集的有效貼文數（含關鍵字命中）
- `sampleCount`：兩者之和，代表當次計分的總樣本數

**注意**：採集量受爬蟲速率限制（PTT 分頁限制、Bluesky API 配額）影響，sampleCount 不保證固定。

---

## 資料儲存

| 路徑                                            | 格式  | 說明                                               |
| ----------------------------------------------- | ----- | -------------------------------------------------- |
| `data/sentiment/news_history.jsonl`             | JSONL | 每次採集追加一行（Daily Upsert by date）           |
| `data/sentiment/social_sentiment_snapshot.json` | JSON  | 最新 snapshot（由 generateSentimentSnapshot 覆寫） |

**歷史保存策略**：每日 Daily Upsert，以 `date` 為鍵去重，當日最後一次採集結果覆蓋。

---

> **SSOT**：以 `src/modules/sentiment/sentimentEngine.mjs` 為準。
> 本文件最後更新於 2026-11-11，對應程式碼版本 `main`（HEAD `f50b15b`）。
