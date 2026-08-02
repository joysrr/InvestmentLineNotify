// src/modules/simulator/forwardSimulator.mjs
// 正向模擬主流程：SimulationInput → 策略引擎評估 → 格式化回應

import { evaluateInvestmentSignal } from "../strategy/strategyEngine.mjs";
import { fetchStrategyConfigUnified } from "../strategy/strategyLoader.mjs";
import {
  PRICE_BOUNDS,
  DATA_QUALITY_LABELS,
  CALCULATION_MODE,
} from "./constants.mjs";
import { generatePriceDeviationWarnings } from "./validator.mjs";

/**
 * 計算維持率
 * @param {Object} portfolio - { qty0050, qtyZ2, cash, totalLoan }
 * @param {number} price0050 - 0050 價格
 * @param {number} priceZ2 - 00675L 價格
 * @returns {number} 維持率百分比
 */
function calculateMaintenanceMargin(portfolio, price0050, priceZ2) {
  const { qty0050, qtyZ2, cash, totalLoan } = portfolio;
  const netAsset = qty0050 * price0050 + qtyZ2 * priceZ2 + cash - totalLoan;
  return totalLoan > 0 ? (netAsset / totalLoan) * 100 : 0;
}

/**
 * 格式化指標輸出
 * @param {Object} data - SimulationInput
 * @param {Object} signals - 策略引擎回傳的 signals
 * @returns {Object} 格式化後的指標物件
 */
function formatIndicators(data, signals) {
  return {
    rsi: signals.RSI,
    kd: {
      k: signals.KD_K,
      d: signals.KD_D,
    },
    macd: {
      MACD:
        signals.macdSignal === "bull"
          ? Math.abs(signals.bias240 || 0)
          : -Math.abs(signals.bias240 || 0),
      signal: 0, // 策略引擎不直接回傳 MACD 細項，這裡用簡化值
      histogram: 0,
    },
    ma20: data.ma20Arr?.filter(Number.isFinite).at(-1) || null,
    ma60: data.ma60Arr?.filter(Number.isFinite).at(-1) || null,
    ma240: data.ma240Arr?.filter(Number.isFinite).at(-1) || null,
    bias240: signals.bias240,
    atr: data.atrArr?.filter(Number.isFinite).at(-1) || null,
  };
}

/**
 * 格式化資料品質標籤
 * @param {Object} dataQuality - dataAdapter 回傳的 dataQuality
 * @returns {Object} 統一格式的品質標籤
 */
function formatDataQuality(dataQuality) {
  const quality = {};
  for (const [key, value] of Object.entries(dataQuality || {})) {
    quality[key] = value || DATA_QUALITY_LABELS.INSUFFICIENT_DATA;
  }
  // 確保所有必要指標都有品質標籤
  const required = ["rsi", "kd", "macd", "ma20", "ma60", "ma240", "atr"];
  for (const key of required) {
    if (!quality[key]) {
      quality[key] = DATA_QUALITY_LABELS.INSUFFICIENT_DATA;
    }
  }
  return quality;
}

/**
 * 格式化 Portfolio Health
 * @param {Object} signals - 策略引擎 signals
 * @returns {Object}
 */
function formatPortfolioHealth(signals) {
  return {
    maintenanceRisk: signals.maintenanceRisk,
    actualLeverage: signals.actualLeverage,
    z2Ratio: signals.z2Ratio,
    grossLeverage: signals.grossLeverage,
    grossLeverageStatus: signals.grossLeverageStatus,
    decouplingAnalysis: signals.decouplingAnalysis,
    marginAnalysis: signals.marginAnalysis,
  };
}

/**
 * 執行正向模擬
 * @param {Object} simulationInput - dataAdapter.buildSimulationInput 回傳的 SimulationInput
 * @param {number} currentPrice0050 - 當前 0050 價格 (用於偏離警告)
 * @param {number} currentPriceZ2 - 當前 00675L 價格
 * @returns {Promise<Object>} 完整模擬結果
 */
export async function runForwardSimulation(
  simulationInput,
  currentPrice0050,
  currentPriceZ2,
) {
  // 1. 載入策略設定
  const strategy = await fetchStrategyConfigUnified();

  // 2. 呼叫策略引擎評估 (傳入 strategy)
  const result = await evaluateInvestmentSignal(simulationInput, strategy);

  const { signals } = result;

  // 2. 計算維持率 (使用模擬價格)
  const maintenanceMargin = calculateMaintenanceMargin(
    simulationInput.portfolio,
    simulationInput.price0050,
    simulationInput.currentPrice,
  );

  // 3. 產生價格偏離警告
  const warnings = generatePriceDeviationWarnings(
    simulationInput.price0050,
    currentPrice0050,
  );

  // 4. 組裝假設條件
  const assumptions = [
    `假設 00675L 按 0050 同比例聯動 (當前比例: 1:${(currentPriceZ2 / currentPrice0050).toFixed(2)})`,
    "假設其他市場資料 (VIX、持倉、融資等) 維持不變",
    "模擬結果基於單一最新收盤價情境，非多日價格路徑預測",
    "⚠️ 極端行情下槓桿標的跌幅可能遠超同比例，維持率風險被低估",
  ];

  // 5. 組裝完整回應
  const response = {
    // 價格資訊
    simulatedPrice0050: simulationInput.price0050,
    simulatedPriceZ2: simulationInput.currentPrice,
    currentPrice0050,
    currentPriceZ2,
    priceDiff0050: simulationInput.price0050 - currentPrice0050,
    priceDiffPct0050:
      currentPrice0050 > 0
        ? (
            ((simulationInput.price0050 - currentPrice0050) /
              currentPrice0050) *
            100
          ).toFixed(2)
        : 0,

    // 指標
    indicators: formatIndicators(simulationInput, signals),

    // 維持率與槓桿
    maintenanceMargin: Number(maintenanceMargin.toFixed(2)),
    portfolioHealth: formatPortfolioHealth(signals),

    // 生命週期 (唯讀)
    lifecycleStage: signals.regimeState?.lifecycleStage || "累積期",
    lifecycleReadOnly: true,

    // 策略結果
    strategyScore: signals.score,
    strategyStatus: signals.status,
    strategyTarget: signals.target,
    strategySuggestion: signals.suggestion,

    // 資料品質
    dataQuality: formatDataQuality(simulationInput.dataQuality),

    // 計算模式與時間戳
    calculationMode: CALCULATION_MODE.FORWARD,
    timestamp: new Date().toISOString(),
    dataAsOf: simulationInput.date,

    // 假設與警告
    assumptions,
    warnings,
    disclaimer:
      "此為條件分析，非價格預測亦非投資建議。結果基於當前資料與固定假設，實際市場表現可能因不可預期因素而有所不同。",
  };

  return response;
}
