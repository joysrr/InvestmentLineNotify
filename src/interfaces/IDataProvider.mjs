/**
 * IDataProvider - 資料存取統一介面
 * 所有排程程式的資料存取操作都透過此介面
 * @interface
 */

/**
 * @typedef {Object} IDataProvider
 * @property {Function} getLatestReport - 取得最新報告
 * @property {Function} getLatestMarketData - 取得最新市場資料
 * @property {Function} saveReport - 儲存報告
 * @property {Function} saveValuationGuardState - 儲存估值防護狀態
 * @property {Function} loadRecentReports - 載入最近 N 份報告
 * @property {Function} getStockHistory - 取得股價歷史資料
 * @property {Function} listArchiveDates - 列出所有可用的檔案日期
 * @property {Function} updatePool - 更新新聞池
 * @property {Function} purgeExpiredFromPool - 清除過期新聞
 * @property {Function} getStrategyConfig - 取得策略設定
 * @property {Function} saveStrategyConfig - 儲存策略設定
 * @property {Function} getBlacklist - 取得黑名單設定
 * @property {Function} getValuationGuardState - 取得估值防護狀態
 */

/**
 * @typedef {Object} Report
 * @property {string} date - 報告日期
 * @property {MarketState} marketState - 市場狀態
 * @property {Signals} signals - 訊號
 * @property {StrategySnapshot} strategySnapshot - 策略快照
 * @property {AiData} ai - AI 資料
 * @property {Portfolio} [portfolio] - 投資組合
 * @property {number} [price0050] - 0050 價格
 * @property {number} [currentPrice] - 當前價格
 * @property {number} [VIX] - VIX 指數
 * @property {string} [quote] - 引言
 * @property {VixData} [vixData] - VIX 資料
 * @property {UsRisk} [usRisk] - 美股風險
 * @property {MacroAnalysis} [macroAnalysis] - 總經分析
 * @property {NewsData} [news] - 新聞資料
 */

/**
 * @typedef {Object} MarketData
 * @property {Object} [_meta] - 元資料
 * @property {Object} data - 資料內容
 * @property {Object} data.rawUsMarket - 美股原始資料
 * @property {string|number} data.rawUsMarket.vix - VIX 值
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
 * @typedef {Object} StrategySnapshot
 */

/**
 * @typedef {Object} AiData
 */

/**
 * @typedef {Object} Portfolio
 * @property {number} [totalValue] - 總價值
 * @property {number} [qty0050] - 0050 數量
 * @property {number} [qtyZ2] - Z2 數量
 * @property {number} [cash] - 現金
 * @property {number} [totalLoan] - 總借款
 * @property {string} [lastBuyDate] - 最後買入日期
 */

/**
 * @typedef {Object} VixData
 * @property {number} [value] - VIX 值
 */

/**
 * @typedef {Object} UsRisk
 */

/**
 * @typedef {Object} MacroAnalysis
 */

/**
 * @typedef {Object} NewsData
 * @property {Object[]} tw - 台股新聞
 * @property {Object[]} us - 美股新聞
 * @property {string} generatedAt - 生成時間
 */

/**
 * @typedef {Object} OHLCV
 * @property {string} date - 日期
 * @property {number} open - 開盤價
 * @property {number} high - 最高價
 * @property {number} low - 最低價
 * @property {number} close - 收盤價
 * @property {number} volume - 成交量
 */

/**
 * @typedef {Object} PoolUpdateResult
 * @property {number} appended - 新增筆數
 * @property {number} expired - 過期筆數
 * @property {number} skipped_fuzzy - 模糊跳過筆數
 * @property {number} total - 總量
 * @property {Object} sourceCounts - 來源統計
 * @property {number} sourceCount - 來源種類數
 */

/**
 * @typedef {Object} StrategyConfig
 * @property {string} version - 版本
 * @property {string} description - 說明
 * @property {Object} defense - 防護設定
 * @property {Object} buy - 買入設定
 * @property {Object} sell - 賣出設定
 * @property {Object[]} allocation - 分配設定
 */

/**
 * @typedef {Object} BlacklistConfig
 * @property {string[]} [titleBlackListPatterns] - 標題黑名單模式
 */

/**
 * @typedef {Object} ValuationGuardState
 * @property {boolean} defenseLatch - 防護閂
 * @property {string|null} [latchTriggeredAt] - 觸發日期
 * @property {number|null} [latchTriggeredPR] - 觸發 PR 值
 */

/**
 * @typedef {Object} ValuationGuardResult
 * @property {number} [currentPR] - 當前 PR 值
 */

/**
 * @typedef {Object} Article
 * @property {string} title - 標題
 * @property {string} url - 網址
 * @property {string} source - 來源
 * @property {string} publishedAt - 發布時間
 * @property {string} [content] - 內容
 */
