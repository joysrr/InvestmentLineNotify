---
domain_id: math-quant
file_type: domain
version: v1.0
last_modified: 2026-04-30
last_proposal: PROPOSAL_20260430_005
scope: framework
domain_name: "數學與量化統計（Statistical Significance + Fat Tails）"
purpose: |
  樣本顯著性、肥尾風險、數據正規化、蒙地卡羅、共線性檢查；審查含公式、評分矩陣、機率推導類計畫。
audience:
  - Consultant
  - Reviewer
  - QA
referenced_by:
  - rules/consultant.md
  - skills/lead-context-mappings.md
trigger_keywords:
  - 蒙地卡羅
  - Z-Score
  - 共線性
  - 肥尾
  - Risk of Ruin
  - 評分矩陣
  - 標準差
---

# Domain Knowledge: 數學與量化統計 (Math & Quantitative Analysis)

## 核心投資哲學 (Core Philosophy)

1. **統計顯著性 (Statistical Significance)**：任何策略或評分矩陣（Scoring Matrix），都必須有足夠的樣本數支撐，拒絕過度擬合（Overfitting）。
2. **肥尾效應 (Fat Tails Risk)**：金融市場的報酬率從來不是標準的常態分配（Normal Distribution）。必須永遠防範六個標準差（6 Sigma）的極端黑天鵝事件。
3. **數據平滑與正規化 (Data Normalization)**：處理不同維度的指標（如股價、殖利率、匯率）時，必須先進行標準化（如 Z-Score 或 Min-Max Scaling），才能放進同一個模型中比較。

## 戰略審查重點 (Review Guidelines)

當你以此視角審查 `@Planner` 的計畫時，請嚴格檢查以下邏輯漏洞：

- **【防呆】除以零與極端值防護 (Division by Zero & Outliers)**：審查任何包含乘除運算的新公式。如果分母可能為零（例如波動率降至極低），或者資料源傳回 `null`/`NaN`，系統是否會直接崩潰？必須要求加入 fallback 數值處理。
- **【優化】蒙地卡羅驗證 (Monte Carlo Simulation)**：若計畫提出了新的資金控管或質押維持率公式，建議 `@QA` 在測試階段套用蒙地卡羅模擬，跑 10,000 次隨機漫步路徑，確保破產機率（Risk of Ruin）接近於零。
- **【防護】指標權重合理性**：若評分矩陣採用簡單加總（例如 A指標 + B指標），必須指出潛在的「共線性 (Collinearity)」問題（例如 KD 跟 RSI 常常同步，導致動能權重被重複計算），建議引入相關係數矩陣來去關聯。

## 衝突仲裁提示 (Conflict Triggers)

- 當財經專家（無論是技術面或生命週期）給出「必勝」或「絕對安全」的保證時，你必須跳出來打臉，用機率與期望值的角度，強制要求在計畫中補上「最壞情況（Worst Case Scenario）」的應對機制。
