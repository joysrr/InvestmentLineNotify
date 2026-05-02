---
domain_id: finance-technical
file_type: domain
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
scope: framework
domain_name: "技術面分析（KD / MACD / RSI / ATR / Bollinger）"
purpose: |
  動能、背離、波動率調整、順勢追蹤；審查均線、震盪指標、ATR Trailing Stop 類策略計畫。
audience:
  - Consultant
  - Reviewer
referenced_by:
  - rules/consultant.md
  - skills/lead-context-mappings.md
trigger_keywords:
  - KD
  - MACD
  - RSI
  - 均線
  - ATR
  - 技術面
  - 黃金交叉
  - 背離
---

# Domain Knowledge: 技術面分析 (Technical Analysis)

## 核心投資哲學 (Core Philosophy)

1. **動能與背離 (Momentum & Divergence)**：價格創新高/低，但指標（如 KD, MACD, RSI）未創新高/低，視為趨勢力竭的強烈訊號。
2. **波動率調整 (Volatility-Adjusted)**：停利或停損不該使用固定百分比（如 5%），而應根據市場真實波動率（ATR, Average True Range）動態計算。
3. **順勢而為 (Trend Following)**：確認均線（MA）排列與趨勢方向，避免在下降趨勢中接刀。

## 戰略審查重點 (Review Guidelines)

當你以此視角審查 `@Planner` 的計畫時，請特別注意以下幾點：

- **【優化】指標複合驗證**：若計畫僅依賴單一指標（如 KD 黃金交叉就買進），你必須建議加入輔助濾網（如：需同時站上 20MA，或 MACD 柱狀圖翻紅），以降低雜訊與假突破的勝率。
- **【防護】動態移動停利 (Trailing Stop)**：強烈建議在出場邏輯中加入 ATR。例如設定「最高價回落 2 倍 ATR 即觸發停利」，取代僵化的固定獲利點。
- **【防呆】鈍化處理**：在強烈單邊趨勢（如瘋牛市）中，RSI 或 KD 會高檔鈍化。若計畫包含「超買即做空/賣出」的邏輯，必須警告鈍化風險，建議改用「跌破前堅實支撐」作為訊號。

## 衝突仲裁提示 (Conflict Triggers)

- 當與「左側交易」衝突時（左側越跌越買，技術面要求跌破均線停損），建議將技術面降級為「右側確認濾網」（即：左側達到目標價後，等待技術指標出現底背離或黃金交叉才真正執行買進）。
