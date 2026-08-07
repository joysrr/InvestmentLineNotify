/**
 * IAIProvider - AI/LLM 服務統一介面
 * 所有排程程式的 AI 相關操作都透過此介面
 */

/**
 * @typedef {Object} IAIProvider
 * @property {Function} getInvestmentSignal - 取得投資訊號 (策略引擎)
 * @property {Function} getAiInvestmentAdvice - 取得 AI 投資建議
 * @property {Function} shouldRunJudge - 判斷是否應執行 LLM Judge
 * @property {Function} runJudge - 執行 LLM Judge
 * @property {Function} generateDailySearchQueries - 產生每日搜尋查詢關鍵字
 * @property {Function} generatePeriodAiSummary - 產生週期報告 AI 摘要
 * @property {Function} runRuleOptimizer - 執行規則優化器
 * @property {Function} score - 記錄 Langfuse 分數
 * @property {Function} shutdownAsync - 關閉 Langfuse 連線
 */

/**
 * @typedef {Object} SignalData
 */

/**
 * @typedef {Object} InvestmentResult
 * @property {Signals} signals - 訊號
 * @property {MarketState} marketState - 市場狀態
 * @property {StrategySnapshot} strategySnapshot - 策略快照
 */

/**
 * @typedef {Object} Signals
 * @property {string} status - 狀態
 * @property {number} score - 分數
 * @property {string} target - 目標
 * @property {string} suggestion - 建議
 * @property {boolean} [latchNowActive] - 防護閂是否啟動
 * @property {boolean} [shouldLatch] - 應觸發閂
 * @property {boolean} [shouldUnlatch] - 應解除閂
 * @property {ValuationGuardResult} [valuationGuardResult] - 估值防護結果
 * @property {string} [signalDirection] - 訊號方向
 * @property {string} [action] - 動作
 */

/**
 * @typedef {Object} ValuationGuardResult
 * @property {number} [currentPR] - 當前 PR 值
 */

/**
 * @typedef {Object} MarketState
 * @property {Object} valuation - 估值
 * @property {Object} sentiment - 情緒
 * @property {Object} liquidity - 流動性
 * @property {Object} economy - 經濟
 */

/**
 * @typedef {Object} StrategySnapshot
 */

/**
 * @typedef {Object} AiAdviceParams
 * @property {Object} result - 結果物件
 * @property {Object} lastState - 上一狀態
 * @property {Object} vixData - VIX 資料
 * @property {string} newsSummaryText - 新聞摘要文字
 * @property {string} macroTextForCoach - 總經文字供教練
 * @property {string} macroAndChipStr - 總經與籌碼字串
 * @property {string} previousAdviceSummary - 前次建議摘要
 * @property {boolean} disableAI - 是否停用 AI
 */

/**
 * @typedef {Object} AiAdviceResult
 * @property {Object} advice - 建議物件
 * @property {string|null} traceId - 追蹤 ID
 */

/**
 * @typedef {Object} JudgeContext
 * @property {boolean} [forceRun] - 強制執行
 * @property {number} [vixValue] - VIX 值
 * @property {string} [signalDirection] - 訊號方向
 * @property {boolean} [latchChanged] - 閂是否變更
 */

/**
 * @typedef {Object} SearchQueryParams
 * @property {string} marketStatus - 市場狀態
 * @property {string|number} vix - VIX 值
 */

/**
 * @typedef {Object} SearchQueriesResult
 * @property {string[]} twQueries - 台股查詢
 * @property {string[]} usQueries - 美股查詢
 * @property {string|null} traceId - 追蹤 ID
 */

/**
 * @typedef {Object} PeriodStats
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
 * @typedef {Object} AiData
 */

/**
 * @typedef {Object} AiAdviceResult
 * @property {string|null} aiSummary - AI 摘要
 * @property {string} [traceId] - 追蹤 ID
 */

/**
 * @typedef {Object} OptimizerResult
 * @property {Object} tw - 台股結果
 * @property {Object[]} tw.accepted - 通過規則
 * @property {Object[]} tw.rejected - 拒絕規則
 * @property {Object} us - 美股結果
 * @property {Object[]} us.accepted - 通過規則
 * @property {Object[]} us.rejected - 拒絕規則
 */

/**
 * @typedef {Object} LangfuseScorePayload
 * @property {string} traceId - 追蹤 ID
 * @property {string} name - 名稱
 * @property {number} value - 數值
 * @property {string} [comment] - 註解
 */

/**
 * @typedef {Object} MarketState
 * @property {Object} valuation - 估值
 * @property {Object} sentiment - 情緒
 * @property {Object} liquidity - 流動性
 * @property {Object} economy - 經濟
 */

/**
 * @typedef {Object} StrategySnapshot
 */

/**
 * @typedef {Object} AiData
 */
