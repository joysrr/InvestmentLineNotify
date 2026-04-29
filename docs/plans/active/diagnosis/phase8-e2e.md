# Phase 8: 資料流端對端審查 審查與修復計畫

## 診斷結果

### 流 A：市場資料 → Dashboard

- **[A-1] (P1)**: VIX 卡片的背景顏色原本使用昨日報告的 `sentiment.vix`，而數值顯示卻使用今日 `status` 快取。已於前階段修復 `vixLevel` 優先讀取即時快取，確保「極度恐慌」的顏色與跳升的數值能同步更新。
- **[A-2] (P2)**: 報告排序在處理同日兩份報告（如手動補跑）時缺乏次排序依據。已在 `localeCompare` 排序邏輯中追加 `createdAt` 作為次要欄位（tiebreaker），確保系統總是顯示最新的那一份。

### 流 B：Snapshot → Chart

- **[B-1] (P1)**: `ChartView` 切換至週或月粒度並遇到空陣列時，`hasEncryption` 狀態未被正確處理，導致顯示錯誤的「快照功能未啟用」。已修正為在接收到陣列格式回應時，一律將 `hasEncryption` 視為 `true`，以顯示正確的「尚無快照資料」。
- **[B-2] (P2)**: X 軸標籤在取值時若 `pt.period` 不存在，fallback 的 `endDate.slice(5)` 仍有針對 `undefined` 呼叫字串方法的風險。已在 fallback 鍊中追加 `pt.date ?? ""` 防護。
- **[B-3] (P2)**: ECharts 在繪製折線圖時，若系列包含 `null` 預設行為不確定，可能跨越斷層。已為圖表 `series` 設定 `connectNulls: false`，強制折線在資料缺口處斷開，如實反映收集中斷期間。

### 流 C：新聞 → NewsView

- **[C-1] (P1)**: 新聞池或精選報告請求失敗時，`loaded` flag 未被設為 `true`，導致使用者在 tab 之間來回切換時會不斷觸發無效的新請求。已將 `loaded = true` 移至 `finally` 區塊，用專屬的 retry 按鈕取代隱式的切換重試。
- **[C-2] (P2)**: `formatDate` 原本會讓無效的 `undefined` 變成 `"Invalid Date"` 印在畫面上。已追加 `!pubDate` 以及 `isNaN(d.getTime())` 檢查，對無效日期回傳平滑的 `"—"`。
- **[C-3] (P2)**: 「新聞池」與「精選報告」的新聞卡片 URL 欄位名稱不一致。已統一 `<div @click="openArticle(article.link || article.url)">` 使元件能夠無縫相容兩種後端資料格式。

## 實作修復

由 @Frontend 完成流 A、B、C 的邊角案例與狀態除錯，所有 E2E 資料流的不對稱與空態錯誤皆已弭平。
