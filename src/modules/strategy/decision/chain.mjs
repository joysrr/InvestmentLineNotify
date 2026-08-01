/**
 * Decision Chain Runner
 * 負責依優先級順序執行 DecisionRule，並在第一個回傳非 null 時終止
 */

import { DecisionRule, createDecisionResult } from "./DecisionRule.mjs";

/**
 * 建立並排序規則鏈（模組載入時靜態排序一次）
 * @param {DecisionRule[]} rules - 規則實例陣列
 * @returns {DecisionRule[]} 已排序的規則陣列
 */
function createSortedChain(rules) {
  // 驗證所有元素皆為 DecisionRule 實例
  for (const rule of rules) {
    if (!(rule instanceof DecisionRule)) {
      throw new Error(
        `DecisionChain: 所有規則必須為 DecisionRule 實例，發現 ${rule?.constructor?.name || typeof rule}`,
      );
    }
  }

  // 依 priority 升序排序（數值越小越優先）
  return [...rules].sort((a, b) => a.priority - b.priority);
}

/**
 * 執行決策鏈
 * @param {Object} ctx - 唯讀上下文
 * @param {Object} strategy - 唯讀策略設定
 * @param {Object} grossLeverageResult - 槓桿計算結果
 * @param {number|null} ma60Slope - MA60 坡度
 * @param {DecisionRule[]} sortedRules - 已排序的規則陣列
 * @returns {Promise<Object>} 決策結果
 */
export async function runDecisionChain(
  ctx,
  strategy,
  grossLeverageResult,
  ma60Slope,
  sortedRules,
) {
  // 共享可變狀態（單一可變邊界）
  const engineState = {
    panicBypassActive: false,
    valuationGuardResult: null,
    valuationMomentumResult: null,
    regimeResult: null,
    adjustedMaxLeverage: null,
  };

  // 依序執行規則
  for (const rule of sortedRules) {
    try {
      const result = rule.evaluate(
        ctx,
        strategy,
        engineState,
        grossLeverageResult,
        ma60Slope,
      );

      if (result !== null) {
        // 規則強制終止並回傳決策
        // 為 ScoringDecisionRule 特例：需套用預算協同
        if (rule.name === "ScoringDecisionRule") {
          return await applyBudgetSynergyToResult(result, ctx, strategy);
        }

        // 統一補齊共享狀態欄位（確保輸出一致性）
        return enrichDecisionResult(result, engineState);
      }
    } catch (error) {
      // 規則執行錯誤：記錄並拋出，避免靜默失敗
      console.error(`[DecisionChain] 規則 "${rule.name}" 執行失敗:`, error);
      throw error;
    }
  }

  // 理論上不應到達這裡（ScoringDecisionRule 應總是回傳結果）
  // 防禦性：回傳中性決策
  return createDecisionResult({
    marketStatus: "🌱【中性/常態佈局】（鏈條未產出決策， fallback）",
    target: "🔹 0050 DCA",
    targetSuggestionShort: "決策鏈未產出結果，僅執行基礎 DCA",
    targetSuggestion: "決策鏈未產出結果，僅執行 0050 基礎保底投入",
    suggestion: "⚠️ 決策鏈異常：無規則產出決策，採預設中性策略",
    regimeState: engineState.regimeResult?.state ?? null,
    regimeResult: engineState.regimeResult,
    valuationGuardResult: engineState.valuationGuardResult,
    valuationMomentumResult: engineState.valuationMomentumResult,
    signalDirection: "hold",
  });
}

/**
 * 將 engineState 的共享狀態補齊到決策結果
 */
function enrichDecisionResult(result, engineState) {
  return {
    ...result,
    regimeState: result.regimeState ?? engineState.regimeResult?.state ?? null,
    regimeResult: result.regimeResult ?? engineState.regimeResult,
    valuationGuardResult:
      result.valuationGuardResult ?? engineState.valuationGuardResult,
    valuationMomentumResult:
      result.valuationMomentumResult ?? engineState.valuationMomentumResult,
  };
}

/**
 * 套用預算協同分析（ScoringDecisionRule 專用）
 * 保持與原 buildDecision 相同邏輯
 */
async function applyBudgetSynergyToResult(result, ctx, strategy) {
  // 動態匯入避免循環依賴
  const { resolveBudgetSynergy } =
    await import("../policies/budgetSynergyPolicy.mjs");
  const { applyBudgetSynergy } = await import("../strategyEngine.mjs");

  const budgetSynergy = resolveBudgetSynergy(
    ctx,
    strategy,
    result.finalScore || 0,
  );
  return applyBudgetSynergy(result, budgetSynergy);
}

/**
 * 決策鏈建構器（Builder Pattern）
 * 用於宣告式組裝規則鏈
 */
export class DecisionChainBuilder {
  constructor() {
    this.rules = [];
  }

  addRule(rule) {
    if (!(rule instanceof DecisionRule)) {
      throw new Error("DecisionChainBuilder: 只能加入 DecisionRule 實例");
    }
    this.rules.push(rule);
    return this;
  }

  addRules(...rules) {
    for (const rule of rules) {
      this.addRule(rule);
    }
    return this;
  }

  build() {
    if (this.rules.length === 0) {
      throw new Error("DecisionChainBuilder: 至少需要一條規則");
    }
    return createSortedChain(this.rules);
  }
}

/**
 * 建立預設決策鏈（生產環境用）
 * 優先級對應 docs/api/decision-chain_api.md 規範
 * 使用 lazy loading 避免循環依賴
 */
let _defaultChainPromise = null;

export function createDefaultDecisionChain() {
  if (_defaultChainPromise) return _defaultChainPromise;

  _defaultChainPromise = (async () => {
    // 動態匯入各規則（避免循環依賴）
    const { RegimePolicyRule } = await import("./rules/RegimePolicyRule.mjs");
    const { MarginLayerRule } = await import("./rules/MarginLayerRule.mjs");
    const { LifecycleLeverageRule } =
      await import("./rules/LifecycleLeverageRule.mjs");
    const { GrossLeverageRule } = await import("./rules/GrossLeverageRule.mjs");
    const { ValuationGuardRule } =
      await import("./rules/ValuationGuardRule.mjs");
    const { EntryGateRule } = await import("./rules/EntryGateRule.mjs");
    const { StopLossTrailingRule } =
      await import("./rules/StopLossTrailingRule.mjs");
    const { ValuationBubbleRule } =
      await import("./rules/ValuationBubbleRule.mjs");
    const { RebalanceRule } = await import("./rules/RebalanceRule.mjs");
    const { ConversionGuardRule } =
      await import("./rules/ConversionGuardRule.mjs");
    const { ScoringDecisionRule } =
      await import("./rules/ScoringDecisionRule.mjs");

    const chain = new DecisionChainBuilder()
      .addRule(new RegimePolicyRule()) // P0: Regime 硬條件
      .addRule(new MarginLayerRule()) // P10: 維持率 4 層狀態機
      .addRule(new LifecycleLeverageRule()) // P20: 生命週期槓桿封鎖
      .addRule(new GrossLeverageRule()) // P30: Gross Leverage 警戒
      .addRule(new ValuationGuardRule()) // P40: 估值守衛
      .addRule(new EntryGateRule()) // P50: EntryGate 前置過濾
      .addRule(new StopLossTrailingRule()) // P60: 停損/移動停利
      .addRule(new ValuationBubbleRule()) // P70: 估值泡沫 (PB ≥ 2.2)
      .addRule(new RebalanceRule()) // P80: 再平衡
      .addRule(new ConversionGuardRule()) // P90: 階梯式獲利轉化
      .addRule(new ScoringDecisionRule()) // P100: 評分驅動決策（最後）
      .build();

    return chain;
  })();

  return _defaultChainPromise;
}
