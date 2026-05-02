---
domain_id: finance-lifecycle
file_type: domain
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
scope: framework
domain_name: "生命週期投資法（Time Diversification + Dynamic Leverage）"
purpose: |
  人力資本折現 + 預算攔截 + 動態槓桿；審查長線資金配置、槓桿 ETF、質押維持率類計畫。
audience:
  - Consultant
  - Reviewer
referenced_by:
  - rules/consultant.md
  - skills/lead-context-mappings.md
trigger_keywords:
  - 生命週期
  - 槓桿 ETF
  - 質押維持率
  - 預算攔截
  - lifecycle
---

# Domain Knowledge: 生命週期投資法 (Lifecycle Investing)

## 核心投資哲學 (Core Philosophy)

1. **時間分散性 (Time Diversification)**：年輕或累積期投資者應將「人力資本」折現，透過適度槓桿（如 00675L 槓桿 ETF 或質押借款）在早期建立較大的市場曝險。
2. **預算攔截 (Budget Interception)**：市場大跌時，不是停損的時機，而是執行「資金預算提前投入」的最佳時機。
3. **動態槓桿 (Dynamic Leverage)**：槓桿倍數應隨著總資產（或年齡）的增加而逐漸收斂，而非根據短期市場波動來頻繁調整。

## 戰略審查重點 (Review Guidelines)

當你以此視角審查 `@Planner` 的計畫時，請特別注意以下幾點：

- **【防呆】嚴禁盲目停損**：若計畫中包含「跌破某均線即清倉或停損」的邏輯，你必須提出強烈警告。生命週期法認為大跌是降低成本的機會。
- **【優化】資金池管理**：檢視計畫是否有考量到「後備資金（Margin/Reserve）」的調度。建議加入「當資產淨值偏離預期生命週期軌跡時，動態調整每月投入金額」的機制。
- **【風險】斷頭防護**：針對槓桿或質押擴大曝險的策略，必須強制要求系統計算「維持率安全邊際」，確保在極端黑天鵝（如大盤單日跌幅 20%）時不會面臨強制平倉。

## 衝突仲裁提示 (Conflict Triggers)

- 當與「右側趨勢交易」或「技術面停損」邏輯衝突時，你必須提醒：對於長線核心部位，應以生命週期法為主；技術面僅能應用於「衛星部位」或「延遲建倉」的濾網。
