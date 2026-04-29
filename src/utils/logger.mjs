import pino from "pino";

/**
 * 系統標準結構化日誌 (Structured Logger)
 * 轉向 JSON 格式輸出，便於後續 ELK 或 CloudWatch 解析。
 *
 * 使用方式：
 *   logger.info({ detail: '...' }, 'message');
 *   logger.error(error, 'message');
 *
 * 支援上下文追蹤：
 *   const ctxLogger = logger.child({ traceId: 'xxx', sessionId: 'yyy' });
 *   ctxLogger.info('帶有追蹤 ID 的日誌');
 */

// 全域上下文儲存（用於簡易追蹤）
let globalContext = {};

/**
 * 設定全域追蹤上下文
 * @param {Object} context - 上下文物件 { traceId?, sessionId?, userId? }
 */
export function setGlobalContext(context) {
  globalContext = context;
}

/**
 * 清除全域追蹤上下文
 */
export function clearGlobalContext() {
  globalContext = {};
}

/**
 * 建立帶上下文的 logger
 * @param {Object} additionalContext - 額外上下文
 * @returns {Object} Pino logger instance
 */
export function createChildLogger(additionalContext = {}) {
  return logger.child({ ...globalContext, ...additionalContext });
}

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  base: {
    env: process.env.NODE_ENV || "development",
  },
});

// 合併全域上下文到所有日誌
const originalChild = logger.child.bind(logger);
logger.child = function (bindings) {
  return originalChild({ ...globalContext, ...bindings });
};

export default logger;
