# 後端端點原始資料驗證報告 (Phase 2)

生成時間: 2026-11-08T01:49:12.931Z

## 摘要

- 驗證端點總數: 6
- 資料源有效: 6
- 資料源無效/缺失: 0

> 說明：未提供端點實際返回值時，僅驗證 data/ 原始資料檔案存在且為有效 JSON。
> 對於間接讀取的端點（status, strategy-status, portfolio-health, reports），
> 驗證其依賴的 data/ 檔案是否存在且結構正確。

## 詳細結果

| 端點                    | 原始資料檔案                                            | 檔案存在 | 資料有效 | 結果    | 差異 |
| ----------------------- | ------------------------------------------------------- | -------- | -------- | ------- | ---- |
| `GET /news`             | `data/news/pool_filtered_active.json`                   | ✅       | ✅       | ✅ 通過 | `—`  |
| `GET /status`           | `data/market/latest.json (+ data/reports/)`             | ✅       | ✅       | ✅ 通過 | `—`  |
| `GET /social-sentiment` | `data/sentiment/social_sentiment_daily.json`            | ✅       | ✅       | ✅ 通過 | `—`  |
| `GET /reports`          | `data/reports/ (目錄)`                                  | ✅       | ✅       | ✅ 通過 | `—`  |
| `GET /strategy-status`  | `data/market/latest.json + data/reports/ (最新)`        | ✅       | ✅       | ✅ 通過 | `—`  |
| `GET /portfolio/health` | `data/cache/strategy_cache.json + data/reports/ (最新)` | ✅       | ✅       | ✅ 通過 | `—`  |
