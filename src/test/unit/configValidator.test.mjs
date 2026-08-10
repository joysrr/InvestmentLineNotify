/**
 * configValidator.test.mjs
 * 策略設定驗證器單元測試
 */

import { describe, it, expect } from "vitest";
import {
  validateConfig,
  validateField,
  getFieldMeta,
  flattenConfig,
  unflattenConfig,
} from "../../modules/config/configValidator.mjs";

// Mock ConfigMeta (subset for testing)
const mockConfigMeta = {
  version: { label: "系統版本", unit: "", type: "string" },
  description: { label: "策略描述", unit: "", type: "string" },
  "maintenance.protectTrigger": {
    label: "正常運作安全線",
    unit: "%",
    type: "number",
    min: 100,
    max: 200,
  },
  "maintenance.protectTarget": {
    label: "資金還款目標",
    unit: "%",
    type: "number",
    min: 100,
    max: 300,
  },
  "maintenance.marginCallThreshold": {
    label: "斷頭警戒線",
    unit: "%",
    type: "number",
    min: 100,
    max: 200,
  },
  "maintenance.frozenZone": {
    label: "絕對凍結線",
    unit: "%",
    type: "number",
    min: 100,
    max: 200,
  },
  "trading.minAction": {
    label: "最小操作金額",
    unit: "元",
    type: "number",
    min: 1000,
    max: 100000,
  },
  "trading.cooldownDays": {
    label: "交易冷卻天數",
    unit: "天",
    type: "number",
    min: 0,
    max: 30,
  },
  "trading.transFee": {
    label: "交易手續費率",
    unit: "",
    type: "number",
    min: 0,
    max: 0.01,
  },
  "buy.minDropPercentToConsider": {
    label: "最低考慮跌幅",
    unit: "%",
    type: "number",
    min: 1,
    max: 50,
  },
  "buy.minWeightScoreToBuy": {
    label: "買入分數門檻",
    unit: "pt",
    type: "number",
    min: 0,
    max: 20,
  },
  "buy.panic.minDropRank": {
    label: "恐慌跌幅級別",
    unit: "",
    type: "number",
    min: 1,
    max: 5,
  },
  "sell.minUpPercentToSell": {
    label: "最小賣出漲幅",
    unit: "%",
    type: "number",
    min: 1,
    max: 200,
  },
  "sell.trailingStop.enabled": {
    label: "啟用追蹤停損",
    unit: "",
    type: "boolean",
  },
  "threshold.z2TargetRatio": {
    label: "正二部位目標比",
    unit: "",
    type: "number",
    min: 0,
    max: 1,
  },
  "threshold.vixLowComplacency": {
    label: "VIX極度自滿",
    unit: "",
    type: "number",
    min: 5,
    max: 20,
  },
  "macroSentiment.enabled": {
    label: "啟用總經情緒",
    unit: "",
    type: "boolean",
  },
  "grossLeverage.ceiling": {
    label: "總槓桿軟上限",
    unit: "x",
    type: "number",
    min: 1,
    max: 5,
  },
  "valuationGuard.enabled": {
    label: "啟用估值守衛",
    unit: "",
    type: "boolean",
  },
};

describe("configValidator", () => {
  describe("getFieldMeta", () => {
    it("應回傳欄位元資料", () => {
      const meta = getFieldMeta("maintenance.protectTrigger", mockConfigMeta);
      expect(meta).toEqual({
        label: "正常運作安全線",
        unit: "%",
        type: "number",
        min: 100,
        max: 200,
      });
    });

    it("不存在的欄位回傳 null", () => {
      const meta = getFieldMeta("nonexistent.field", mockConfigMeta);
      expect(meta).toBeNull();
    });
  });

  describe("validateField", () => {
    it("通過有效的數值欄位", () => {
      const result = validateField(
        "maintenance.protectTrigger",
        160,
        mockConfigMeta,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("拒絕超出範圍的數值", () => {
      const result = validateField(
        "maintenance.protectTrigger",
        50,
        mockConfigMeta,
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("低於最小值 100");
    });

    it("拒絕非數值型別", () => {
      const result = validateField(
        "maintenance.protectTrigger",
        "abc",
        mockConfigMeta,
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("必須是數值");
    });

    it("通過有效的布林欄位", () => {
      const result = validateField(
        "sell.trailingStop.enabled",
        true,
        mockConfigMeta,
      );
      expect(result.valid).toBe(true);
    });

    it("拒絕非布林值", () => {
      const result = validateField(
        "sell.trailingStop.enabled",
        "yes",
        mockConfigMeta,
      );
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("必須是布林值");
    });

    it("通過有效的字串欄位", () => {
      const result = validateField("version", "2.9", mockConfigMeta);
      expect(result.valid).toBe(true);
    });
  });

  describe("flattenConfig", () => {
    it("將巢狀物件扁平化", () => {
      const config = {
        version: "2.8",
        maintenance: {
          protectTrigger: 160,
          protectTarget: 180,
        },
        buy: {
          panic: { minDropRank: 2 },
        },
      };

      const flat = flattenConfig(config);
      expect(flat).toEqual({
        version: "2.8",
        "maintenance.protectTrigger": 160,
        "maintenance.protectTarget": 180,
        "buy.panic.minDropRank": 2,
      });
    });

    it("處理空物件", () => {
      const flat = flattenConfig({});
      expect(flat).toEqual({});
    });
  });

  describe("unflattenConfig", () => {
    it("將扁平物件還原為巢狀", () => {
      const flat = {
        version: "2.8",
        "maintenance.protectTrigger": 160,
        "maintenance.protectTarget": 180,
        "buy.panic.minDropRank": 2,
      };

      const nested = unflattenConfig(flat);
      expect(nested).toEqual({
        version: "2.8",
        maintenance: { protectTrigger: 160, protectTarget: 180 },
        buy: { panic: { minDropRank: 2 } },
      });
    });
  });

  describe("validateConfig", () => {
    it("通過完整有效的設定", () => {
      const validConfig = {
        version: "2.8",
        description: "測試策略",
        maintenance: {
          protectTrigger: 160,
          protectTarget: 180,
          marginCallThreshold: 135,
          frozenZone: 145,
        },
        trading: {
          minAction: 10000,
          cooldownDays: 10,
          transFee: 0.001425,
        },
        buy: {
          minDropPercentToConsider: 5,
          minWeightScoreToBuy: 3,
          panic: { minDropRank: 2 },
        },
        sell: {
          minUpPercentToSell: 80,
          trailingStop: { enabled: true },
        },
        threshold: {
          z2TargetRatio: 0.4,
          vixLowComplacency: 12,
        },
        macroSentiment: { enabled: true },
        grossLeverage: { ceiling: 2.5 },
        valuationGuard: { enabled: true },
      };

      const result = validateConfig(validConfig, mockConfigMeta);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("偵測多個錯誤", () => {
      const invalidConfig = {
        maintenance: {
          protectTrigger: 50, // 太低
          protectTarget: 400, // 太高
        },
        trading: {
          minAction: 100, // 太低
          cooldownDays: -1, // 負數
        },
      };

      const result = validateConfig(invalidConfig, mockConfigMeta);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });

    it("回傳錯誤包含欄位路徑", () => {
      const config = { maintenance: { protectTrigger: 50 } };
      const result = validateConfig(config, mockConfigMeta);
      expect(result.errors[0]).toMatch(/maintenance\.protectTrigger/);
    });
  });
});
