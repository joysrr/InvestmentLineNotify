/**
 * IReportGenerator - 週/月報產生器介面
 * Monthly/Weekly Report 排程專用的報告產生操作
 */

/**
 * @typedef {Object} IReportGenerator
 * @property {Function} loadRecentReports - 載入最近 N 份報告
 * @property {Function} buildPeriodStats - 建立週期統計
 * @property {Function} buildSignalAccuracyStats - 建立訊號準確度統計
 * @property {Function} generateAiSummary - 產生 AI 摘要
 * @property {Function} buildMessages - 建立 Telegram 訊息
 */

/**
 * @typedef {Object} Report
 * @property {string} date - 日期
 * @property {MarketState} marketState - 市場狀態
 * @property {Signals} signals - 訊號
 * @property {StrategySnapshot} strategySnapshot - 策略快照
 * @property {AiData} ai - AI 資料
 */

/**
 * @typedef {Object} MarketState
 * @property {Object} valuation - 估值
 * @property {Object} sentiment - 情緒
 * @property {Object} liquidity - 流動性
 * @property {Object} economy - 經濟
 */

/**
 * @typedef {Object} Signals
 * @property {string} status - 狀態
 * @property {number} score - 分數
 * @property {string} target - 目標
 * @property {string} suggestion - 建議
 */

/**
 * @typedef {Object} StrategySnapshot
 */

/**
 * @typedef {Object} AiData
 */

/**
 * @typedef {Object} PeriodStats
 */

/**
 * @typedef {Object} AccuracyStats
 */

/**
 * @typedef {Object} TelegramMessage
 * @property {string} text - 訊息文字
 * @property {'HTML'|'Markdown'} [parse_mode] - 解析模式
 * @property {Object} [reply_markup] - 回覆鍵盤
 */
