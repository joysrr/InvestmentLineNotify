import pino from "pino";

/**
 * 系統標準結構化日誌 (Structured Logger)
 * 轉向 JSON 格式輸出，便於後續 ELK 或 CloudWatch 解析。
 *
 * 使用方式：
 *   logger.info({ detail: '...' }, 'message');
 *   logger.error(error, 'message');
 */
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

export default logger;
