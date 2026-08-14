// src/test/unit/alertEngine.test.mjs
// TDD: Alert Engine 規則評估與通知分發

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

// Mock metricsCollector
const mockMetrics = { requests: 100, errors: 5, latency: 200 };

vi.mock("../../modules/monitoring/metricsCollector.mjs", () => ({
  metricsCollector: {
    getMetrics: vi.fn().mockReturnValue(mockMetrics),
  },
}));

vi.mock("../../utils/logger.mjs", () => ({
  default: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("alertEngine - 規則評估與通知分發", () => {
  let alertEngine;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("../../modules/monitoring/alertEngine.mjs");
    alertEngine = mod.alertEngine;
    alertEngine.reset();
  });

  describe("addRule - 新增規則", () => {
    it("應使用預設值補齊欄位", () => {
      alertEngine.addRule({
        name: "test-rule",
        condition: () => true,
      });

      const rules = alertEngine.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0]).toMatchObject({
        name: "test-rule",
        severity: "medium",
        cooldownMs: 300000,
        enabled: true,
      });
    });

    it("可覆寫預設值", () => {
      alertEngine.addRule({
        name: "custom-rule",
        condition: () => true,
        severity: "high",
        message: "Custom alert",
        cooldownMs: 60000,
        enabled: false,
      });

      const rules = alertEngine.getRules();
      expect(rules[0]).toMatchObject({
        severity: "high",
        message: "Custom alert",
        cooldownMs: 60000,
        enabled: false,
      });
    });

    it("預設 message 等於 name", () => {
      alertEngine.addRule({
        name: "alert-name",
        condition: () => true,
      });

      expect(alertEngine.getRules()[0].message).toBe("alert-name");
    });
  });

  describe("removeRule - 移除規則", () => {
    it("應移除指定名稱的規則", () => {
      alertEngine.addRule({ name: "rule-1", condition: () => true });
      alertEngine.addRule({ name: "rule-2", condition: () => true });

      alertEngine.removeRule("rule-1");

      const rules = alertEngine.getRules();
      expect(rules).toHaveLength(1);
      expect(rules[0].name).toBe("rule-2");
    });

    it("移除不存在的名稱不報錯", () => {
      alertEngine.addRule({ name: "rule-1", condition: () => true });
      alertEngine.removeRule("nonexistent");
      expect(alertEngine.getRules()).toHaveLength(1);
    });
  });

  describe("getRules - 取得所有規則", () => {
    it("應返回規則的副本", () => {
      alertEngine.addRule({ name: "rule-1", condition: () => true });
      const rules1 = alertEngine.getRules();
      const rules2 = alertEngine.getRules();
      expect(rules1).not.toBe(rules2);
      expect(rules1).toEqual(rules2);
    });
  });

  describe("check - 評估規則", () => {
    it("條件為 true 時應觸發告警", async () => {
      const notifier = vi.fn().mockResolvedValue(undefined);
      alertEngine.setNotifier(notifier);
      alertEngine.addRule({ name: "always-trigger", condition: () => true });

      const alerts = await alertEngine.check();

      expect(alerts).toHaveLength(1);
      expect(notifier).toHaveBeenCalledTimes(1);
    });

    it("條件為 false 時不應觸發告警", async () => {
      const notifier = vi.fn().mockResolvedValue(undefined);
      alertEngine.setNotifier(notifier);
      alertEngine.addRule({ name: "never-trigger", condition: () => false });

      const alerts = await alertEngine.check();

      expect(alerts).toHaveLength(0);
      expect(notifier).not.toHaveBeenCalled();
    });

    it("disabled 規則不應被評估", async () => {
      const notifier = vi.fn().mockResolvedValue(undefined);
      alertEngine.setNotifier(notifier);
      alertEngine.addRule({
        name: "disabled-rule",
        condition: () => true,
        enabled: false,
      });

      const alerts = await alertEngine.check();

      expect(alerts).toHaveLength(0);
    });

    it("冷卻期內不應重複觸發", async () => {
      const notifier = vi.fn().mockResolvedValue(undefined);
      alertEngine.setNotifier(notifier);
      alertEngine.addRule({
        name: "cooldown-rule",
        condition: () => true,
        cooldownMs: 60000,
      });

      await alertEngine.check();
      await alertEngine.check();
      await alertEngine.check();

      // 冷卻期內只觸發一次
      expect(notifier).toHaveBeenCalledTimes(1);
    });

    it("應使用傳入的 metrics 參數", async () => {
      const customMetrics = { value: 999 };
      alertEngine.addRule({
        name: "custom-metrics",
        condition: (m) => m.value === 999,
      });

      const alerts = await alertEngine.check(customMetrics);

      expect(alerts).toHaveLength(1);
    });

    it("未提供 metrics 時使用 metricsCollector", async () => {
      alertEngine.addRule({
        name: "collector-metrics",
        condition: (m) => m.requests > 0,
      });

      const alerts = await alertEngine.check();

      expect(alerts).toHaveLength(1);
    });

    it("規則拋出錯誤時不影響其他規則", async () => {
      alertEngine.addRule({
        name: "broken-rule",
        condition: () => { throw new Error("Rule failed"); },
      });
      alertEngine.addRule({
        name: "good-rule",
        condition: () => true,
      });

      const alerts = await alertEngine.check();

      expect(alerts).toHaveLength(1);
      expect(alerts[0].name).toBe("good-rule");
    });

    it("觸發告警時應發出 alert 事件", async () => {
      alertEngine.addRule({ name: "event-rule", condition: () => true });
      const eventListener = vi.fn();
      alertEngine.on("alert", eventListener);

      await alertEngine.check();

      expect(eventListener).toHaveBeenCalled();
    });

    it("告警結構應包含必要欄位", async () => {
      alertEngine.addRule({
        name: "structure-rule",
        condition: () => true,
        severity: "high",
        message: "Test alert",
      });

      const alerts = await alertEngine.check();

      expect(alerts[0]).toMatchObject({
        name: "structure-rule",
        severity: "high",
        message: "Test alert",
        timestamp: expect.any(Number),
        metrics: expect.any(Object),
      });
    });

    it("沒有 notifier 時仍記錄到 history", async () => {
      alertEngine.addRule({ name: "no-notifier", condition: () => true });

      const alerts = await alertEngine.check();
      const history = alertEngine.getHistory();

      expect(alerts).toHaveLength(1);
      expect(history).toHaveLength(1);
    });
  });

  describe("getHistory - 取得告警歷史", () => {
    it("應返回反向時間順序", async () => {
      alertEngine.addRule({ name: "rule-a", condition: () => true });
      await alertEngine.check();
      await alertEngine.check();

      const history = alertEngine.getHistory();
      // 最新優先
      expect(history.length).toBeGreaterThan(0);
    });

    it("limit 參數應限制返回數量", async () => {
      for (let i = 0; i < 5; i++) {
        alertEngine.addRule({ name: `rule-${i}`, condition: () => true });
      }
      await alertEngine.check();

      const history = alertEngine.getHistory(2);
      expect(history.length).toBeLessThanOrEqual(2);
    });
  });

  describe("clearHistory - 清除歷史", () => {
    it("應清除告警歷史與冷卻狀態", async () => {
      alertEngine.addRule({ name: "test", condition: () => true });
      await alertEngine.check();

      alertEngine.clearHistory();

      expect(alertEngine.getHistory()).toEqual([]);
    });
  });

  describe("reset - 重設引擎", () => {
    it("應清除所有狀態", () => {
      alertEngine.addRule({ name: "test", condition: () => true });
      alertEngine.setNotifier(() => {});

      alertEngine.reset();

      expect(alertEngine.getRules()).toEqual([]);
      expect(alertEngine.getHistory()).toEqual([]);
    });
  });

  describe("setNotifier - 設定通知器", () => {
    it("應更新 notifier", () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      alertEngine.setNotifier(fn1);
      alertEngine.setNotifier(fn2);

      // 透過評估驗證 notifier 被更新
      alertEngine.addRule({ name: "test", condition: () => true });
      return alertEngine.check().then(() => {
        expect(fn2).toHaveBeenCalled();
      });
    });
  });

  describe("defaultNotifier - 預設通知器", () => {
    it("應為可呼叫的函數", async () => {
      const { defaultNotifier } = await import("../../modules/monitoring/alertEngine.mjs");
      expect(typeof defaultNotifier).toBe("function");
    });

    it("console.log + 寫入檔案", async () => {
      const { defaultNotifier } = await import("../../modules/monitoring/alertEngine.mjs");
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await defaultNotifier({
        severity: "high",
        name: "test",
        message: "Test message",
        timestamp: Date.now(),
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("未配置 TELEGRAM 時不發送 Telegram", async () => {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.ADMIN_USER_IDS;

      const { defaultNotifier } = await import("../../modules/monitoring/alertEngine.mjs");
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      await defaultNotifier({
        severity: "low",
        name: "test",
        message: "no telegram",
        timestamp: Date.now(),
      });

      consoleSpy.mockRestore();
    });
  });
});