/**
 * leverageMonitor.mjs
 *
 * 計算帳戶綜合曝險倍數（Gross Leverage Ratio）並判斷雙層天花板狀態。
 *
 * 公式：grossLeverage = (0050市值 + 00675L市值 × 2) / 帳戶淨值
 *
 * 00675L 內含 2x 期貨槓桿，係數採固定值 2。
 *
 * 雙層天花板：
 *   - 主動擴張上限（ceiling）：grossLeverage > ceiling → 禁止新增借款與00675L，一票否決加碼
 *   - 被動危機紅線（hardCap）：grossLeverage > hardCap  → 強制賣出00675L至recoveryTarget
 */

/**
 * @typedef {Object} GrossLeverageConfig
 * @property {number} ceiling         - 主動擴張上限倍數（例如 2.5）
 * @property {number} hardCap          - 被動危機紅線倍數（例如 3.0）
 * @property {number} recoveryTarget   - 強制平倉後的著陸目標倍數（例如 2.0）
 */

/**
 * @typedef {Object} GrossLeverageInput
 * @property {number} etf0050Value    - 0050 市值（元）
 * @property {number} etf675LValue    - 00675L 市值（元）
 * @property {number} netAssetValue   - 帳戶淨值（元）；必須 > 0
 */

/**
 * @typedef {Object} GrossLeverageResult
 * @property {number}  grossLeverage         - 計算出的綜合曝險倍數
 * @property {'normal' | 'ceiling_breach' | 'hardcap_breach'} status - 當前天花板狀態
 * @property {boolean} blockNewLeverage      - 是否禁止新增借款與00675L買入
 * @property {boolean} forceDeleverage       - 是否強制觸發降槓桿賣出
 * @property {number}  recoveryTarget        - 強制平倉的著陸目標倍數（forceDeleverage 時才具意義）
 * @property {string}  message               - 人類可讀的狀態說明
 */

/** 00675L 內含期貨槓桿係數（固定值） */
const LEVERAGE_ETF_MULTIPLIER = 2;

/**
 * 計算綜合曝險倍數並判斷雙層天花板狀態。
 *
 * @param {GrossLeverageInput}  input
 * @param {GrossLeverageConfig} config
 * @returns {GrossLeverageResult}
 */
export function computeGrossLeverage(input, config) {
  const { etf0050Value, etf675LValue, netAssetValue } = input;
  const { ceiling, hardCap, recoveryTarget } = config;

  // 防禦：淨值不可為零或負數，避免除以零或產生無意義結果
  if (!netAssetValue || netAssetValue <= 0) {
    return {
      grossLeverage: null,
      status: "error",
      blockNewLeverage: true,
      forceDeleverage: false,
      recoveryTarget: recoveryTarget,
      message:
        "⚠️ 帳戶淨值異常（≤0），Gross Leverage 計算跳過，保守起見封鎖加碼",
    };
  }

  const grossLeverage =
    (etf0050Value + etf675LValue * LEVERAGE_ETF_MULTIPLIER) / netAssetValue;

  // 被動危機紅線：hardCap 觸發優先級高於 ceiling
  if (grossLeverage > hardCap) {
    return {
      grossLeverage,
      status: "hardcap_breach",
      blockNewLeverage: true,
      forceDeleverage: true,
      recoveryTarget: recoveryTarget,
      message: `🚨 Gross Leverage ${grossLeverage.toFixed(2)}x 超越危機紅線 ${hardCap}x，強制降槓至 ${recoveryTarget}x`,
    };
  }

  // 主動擴張上限：ceiling 觸發，禁止加碼但不強制砍倉
  if (grossLeverage > ceiling) {
    return {
      grossLeverage,
      status: "ceiling_breach",
      blockNewLeverage: true,
      forceDeleverage: false,
      recoveryTarget: recoveryTarget,
      message: `⚠️ Gross Leverage ${grossLeverage.toFixed(2)}x 超越主動上限 ${ceiling}x，一票否決新增槓桿`,
    };
  }

  // 正常範圍
  return {
    grossLeverage,
    status: "normal",
    blockNewLeverage: false,
    forceDeleverage: false,
    recoveryTarget: recoveryTarget,
    message: `✅ Gross Leverage ${grossLeverage.toFixed(2)}x（正常範圍）`,
  };
}
