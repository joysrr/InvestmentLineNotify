/**
 * alertEngine.mjs
 * 告警引擎 - 閾值檢查、通知發送
 */

import { EventEmitter } from "events";
import logger from "../../utils/logger.mjs";
import { metricsCollector } from "./metricsCollector.mjs";

class AlertEngine extends EventEmitter {
  constructor() {
    super();
    this.rules = [];
    this.notifier = null;
    this.alertHistory = [];
    this.cooldowns = new Map(); // 防止重複告警
  }

  /**
   * 設定通知發送器
   */
  setNotifier(fn) {
    this.notifier = fn;
  }

  /**
   * 新增告警規則
   */
  addRule(rule) {
    const validatedRule = {
      name: rule.name,
      condition: rule.condition,
      severity: rule.severity || "medium",
      message: rule.message || rule.name,
      cooldownMs: rule.cooldownMs || 300000, // 預設 5 分鐘冷卻
      enabled: rule.enabled !== false,
    };

    this.rules.push(validatedRule);
    logger.info({ rule: validatedRule.name }, "Alert rule added");
  }

  /**
   * 移除告警規則
   */
  removeRule(name) {
    this.rules = this.rules.filter(r => r.name !== name);
    logger.info({ name }, "Alert rule removed");
  }

  /**
   * 取得所有規則
   */
  getRules() {
    return [...this.rules];
  }

  /**
   * 檢查告警條件
   */
  async check(metrics = null) {
    const currentMetrics = metrics || metricsCollector.getMetrics();
    const triggeredAlerts = [];

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      // 檢查冷卻期
      const cooldownKey = rule.name;
      const lastAlert = this.cooldowns.get(cooldownKey);
      if (lastAlert && Date.now() - lastAlert < rule.cooldownMs) {
        continue;
      }

      try {
        const shouldAlert = rule.condition(currentMetrics);
        if (shouldAlert) {
          const alert = {
            name: rule.name,
            severity: rule.severity,
            message: rule.message,
            metrics: currentMetrics,
            timestamp: Date.now(),
          };

          triggeredAlerts.push(alert);
          this.cooldowns.set(cooldownKey, Date.now());
          this.alertHistory.push(alert);

          // 發送通知
          if (this.notifier) {
            await this.notifier(alert);
          }

          this.emit("alert", alert);
          logger.warn({ alert }, "Alert triggered");
        }
      } catch (err) {
        logger.error({ rule: rule.name, err: err.message }, "Alert rule evaluation failed");
      }
    }

    return triggeredAlerts;
  }

  /**
   * 取得告警歷史
   */
  getHistory(limit = 100) {
    return this.alertHistory.slice(-limit).reverse();
  }

  /**
   * 清除告警歷史
   */
  clearHistory() {
    this.alertHistory = [];
    this.cooldowns.clear();
  }

  /**
   * 重設引擎
   */
  reset() {
    this.rules = [];
    this.notifier = null;
    this.alertHistory = [];
    this.cooldowns.clear();
  }
}

/**
 * 預設通知發送器
 */
export async function defaultNotifier(alert) {
  const { sendTelegramMessage } = await import("../telegram/notify.mjs").catch(() => ({ sendTelegramMessage: null }));

  // Console log
  console.log(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`, {
    name: alert.name,
    timestamp: new Date(alert.timestamp).toISOString(),
  });

  // 檔案記錄
  const { writeFile, mkdir } = await import("fs/promises");
  const { resolve } = await import("path");
  const { fileURLToPath } = await import("url");
  const __dirname = resolve(fileURLToPath(import.meta.url), "..");
  const PROJECT_ROOT = resolve(__dirname, "../../../..");
  const ALERT_LOG = resolve(PROJECT_ROOT, "data/monitoring/alerts.log");

  await mkdir(resolve(ALERT_LOG, ".."), { recursive: true });
  await writeFile(ALERT_LOG, JSON.stringify(alert) + "\n", { flag: "a" });

  // Telegram 通知 (如果配置了)
  if (sendTelegramMessage && process.env.TELEGRAM_BOT_TOKEN && process.env.ADMIN_USER_IDS) {
    const adminIds = process.env.ADMIN_USER_IDS.split(",").map(id => id.trim());
    const message = `🚨 *${alert.severity.toUpperCase()}* - ${alert.message}\nTime: ${new Date(alert.timestamp).toISOString()}`;

    for (const adminId of adminIds) {
      await sendTelegramMessage(adminId, message).catch(err => {
        logger.error({ err: err.message }, "Failed to send Telegram alert");
      });
    }
  }
}

export const alertEngine = new AlertEngine();
export default alertEngine;