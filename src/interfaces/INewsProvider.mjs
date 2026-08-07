/**
 * INewsProvider - 新聞抓取專用介面
 * News Fetch 排程專用的資料存取與 AI 操作
 */

/**
 * @typedef {Object} INewsProvider
 * @property {Function} getLatestMarketData - 取得最新市場資料
 * @property {Function} updatePool - 更新新聞池
 * @property {Function} purgeExpiredFromPool - 清除過期新聞
 * @property {Function} generateDailySearchQueries - 產生每日搜尋查詢關鍵字
 * @property {Function} getRawNews - 抓取原始新聞
 * @property {Function} score - 記錄 Langfuse 分數
 */

/**
 * @typedef {Object} MarketData
 * @property {Object} [_meta] - 元資料
 * @property {Object} data - 資料內容
 * @property {Object} data.rawUsMarket - 美股原始資料
 * @property {string|number} data.rawUsMarket.vix - VIX 值
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
 * @typedef {Object} SearchQueries
 * @property {string[]} twQueries - 台股查詢
 * @property {string[]} usQueries - 美股查詢
 */

/**
 * @typedef {Object} RawNewsResult
 * @property {Article[]} articles - 文章陣列
 * @property {NewsMetrics} metrics - 新聞指標
 */

/**
 * @typedef {Object} Article
 * @property {string} title - 標題
 * @property {string} url - 網址
 * @property {string} source - 來源
 * @property {string} publishedAt - 發布時間
 * @property {string} [content] - 內容
 */

/**
 * @typedef {Object} NewsMetrics
 * @property {number} keywordYieldRate - 關鍵字產出率
 * @property {number} matchedQueryCount - 比對查詢數
 * @property {number} totalQueryCount - 總查詢數
 * @property {number} dynamicMatchedQueryCount - 動態比對查詢數
 * @property {number} dynamicQueryCount - 動態查詢數
 * @property {number} dynamicKeywordYieldRate - 動態關鍵字產出率
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
 * @typedef {Object} LangfuseScorePayload
 * @property {string} traceId - 追蹤 ID
 * @property {string} name - 名稱
 * @property {number} value - 數值
 * @property {string} [comment] - 註解
 */
