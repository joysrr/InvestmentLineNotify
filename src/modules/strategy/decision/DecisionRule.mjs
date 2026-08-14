/**
 * DecisionRule 基底類別
 * Chain of Responsibility 模式的規則介面
 *
 * 契約：
 * - ctx、strategy 視為唯讀（Read-Only）
 * - 所有可變狀態集中在 engineState
 * - evaluate() 回傳 DecisionResult 物件表示「終止鏈條、輸出決策」
 * - evaluate() 回傳 null 表示「繼續下一條規則」
 */

export class DecisionRule {
  constructor({ priority, name }) {
    if (typeof priority !== "number") {
      throw new Error(`DecisionRule "${name}": priority 必須為數字`);
    }
    if (!name || typeof name !== "string") {
      throw new Error("DecisionRule: name 必須為非空字串");
    }

    this.priority = priority; // 數值越小 = 優先級越高（越早評估）
    this.name = name;
  }

  /**
   * 評估規則
   * @param {Object} ctx - 唯讀市場與投資組合上下文
   * @param {Object} strategy - 唯讀使用者策略設定
   * @param {Object} engineState - 可變共享狀態（跨規則傳遞旗標、預計算值）
   * @returns {Object|null} DecisionResult 或 null（繼續下一條）
   */
  evaluate(_ctx, _strategy, _engineState) {
    throw new Error(`DecisionRule "${this.name}": 必須實作 evaluate() 方法`);
  }

  /**
   * 選擇性：規則初始化（模組載入時呼叫一次）
   * 可用於預計算、驗證策略設定等
   */
  initialize(_strategy) {
    // 預設無操作，子類別可覆寫
  }

  /**
   * 選擇性：規則清理（應用關閉時呼叫）
   */
  dispose() {
    // 預設無操作
  }
}

/**
 * 決策結果標準欄位（建議包含，非強制）
 * 實際欄位視各規則業務需求而定
 */
export const DecisionResultFields = {
  // 核心識別
  maintenanceLayer: "normal | critical | frozen | caution",
  marketStatus: "人類可讀的狀態描述（含 emoji）",
  target: "決策目標（如：撥款加碼、減碼還款、強制賣出...）",
  targetSuggestionShort: "簡短建議（通知用）",
  targetSuggestion: "完整建議說明",
  suggestion: "詳細建議（含數據支撐）",

  // 共享狀態（供後續規則或輸出格式化使用）
  regimeState: "CRISIS | CAUTIOUS | NORMAL | null",
  regimeResult: "完整 Regime 物件",
  valuationGuardResult: "估值守衛結果物件",
  valuationMomentumResult: "估值動能結果",

  // 評分相關
  finalScore: "數值",
  categoryResults: "各類別評分明細",
  signalDirection:
    "buy_tactical | sell_tactical | exit_buffer | hold | neutral",
  scalingRatio: "撥款比例 0~1",

  // 停損/移動停利
  trailingActive: "boolean",
  dynamicAnchor: "數值或 null",

  // 預算相關
  budgetInfo: "{ availableRolling, finalAvailableBudget, budgetCapped }",
  budgetSynergy: "預算協同分析結果",

  // 其他業務欄位...
  entryGateBlocked: "boolean",
  entryGateLevel: "數值",
  entryGateLabel: "字串",
  lifecycleBlocked: "boolean",
  lifecycleStage: "字串",
};

/**
 * 建立標準決策結果物件的輔助函式
 */
export function createDecisionResult(overrides = {}) {
  return {
    maintenanceLayer: "normal",
    marketStatus: "",
    target: "",
    targetSuggestionShort: "",
    targetSuggestion: "",
    suggestion: "",
    regimeState: null,
    regimeResult: null,
    valuationGuardResult: null,
    valuationMomentumResult: null,
    finalScore: null,
    categoryResults: null,
    signalDirection: "hold",
    scalingRatio: 1.0,
    trailingActive: false,
    dynamicAnchor: null,
    budgetInfo: null,
    budgetSynergy: null,
    entryGateBlocked: false,
    entryGateLevel: null,
    entryGateLabel: null,
    lifecycleBlocked: false,
    lifecycleStage: null,
    ...overrides,
  };
}
