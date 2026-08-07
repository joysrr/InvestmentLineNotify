/**
 * INotifier - 通知發送統一介面
 * 所有排程程式的通知發送操作都透過此介面
 */

/**
 * @typedef {Object} INotifier
 * @property {Function} sendTelegramBatch - 批次發送 Telegram 訊息
 * @property {Function} sendTelegramMessage - 發送單則 Telegram 訊息
 * @property {Function} broadcastDailyReport - 廣播每日報告
 * @property {Function} broadcastOptimizerResult - 廣播優化器結果
 * @property {Function} sendPeriodReport - 發送週期報告
 */

/**
 * @typedef {Object} TelegramMessage
 * @property {string} text - 訊息文字
 * @property {'HTML'|'Markdown'|'MarkdownV2'} [parse_mode] - 解析模式
 * @property {boolean} [disable_web_page_preview] - 是否禁用網頁預覽
 * @property {Object} [reply_markup] - 回覆鍵盤
 * @property {string|number} [chat_id] - 聊天室 ID
 */

/**
 * @typedef {Object} TelegramSendOptions
 * @property {'HTML'|'Markdown'|'MarkdownV2'} [parse_mode] - 解析模式
 * @property {boolean} [disable_web_page_preview] - 是否禁用網頁預覽
 * @property {Object} [reply_markup] - 回覆鍵盤
 */

/**
 * @typedef {Object} DailyReportData
 * @property {Object} result - 結果物件
 * @property {Object} vixData - VIX 資料
 * @property {Object} usRisk - 美股風險
 * @property {Object} macroData - 總經資料
 * @property {Object} macroAnalysis - 總經分析
 * @property {Object} config - 設定
 * @property {string} dateText - 日期文字
 * @property {Object} aiAdvice - AI 建議
 * @property {string} quote - 引言
 */

/**
 * @typedef {Object} NewsMessage
 * @property {string} text - 訊息文字
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
