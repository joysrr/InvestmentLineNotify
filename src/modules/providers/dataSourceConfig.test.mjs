// src/modules/providers/dataSourceConfig.test.mjs
// TDD: Data Source Config 測試

import { describe, it, expect } from "vitest";

import { macroDataSlots, SLOT_CRITICALITY } from "./dataSourceConfig.mjs";

describe("dataSourceConfig - 資料來源設定", () => {
  describe("macroDataSlots", () => {
    it("包含所有必要的槽位", () => {
      const requiredSlots = [
        "rawNdc",
        "rawMargin",
        "rawCnn",
        "rawUsMarket",
        "rawValuation",
        "rawMarketOverview",
        "rawFx",
        "rawInstitutional",
        "rawStockMargin",
        "rawBankRate",
        "rawCpi",
        "quote",
      ];

      requiredSlots.forEach((slot) => {
        expect(macroDataSlots[slot]).toBeDefined();
        expect(macroDataSlots[slot].providerId).toBeTypeOf("string");
      });
    });

    it("rawNdc 使用 ndcBusinessIndicator", () => {
      expect(macroDataSlots.rawNdc.providerId).toBe("ndcBusinessIndicator");
    });

    it("rawMargin 使用 marginKgi", () => {
      expect(macroDataSlots.rawMargin.providerId).toBe("marginKgi");
    });

    it("rawCnn 使用 cnnFearGreed", () => {
      expect(macroDataSlots.rawCnn.providerId).toBe("cnnFearGreed");
    });

    it("rawUsMarket 使用 usMarketFred", () => {
      expect(macroDataSlots.rawUsMarket.providerId).toBe("usMarketFred");
    });

    it("rawValuation 使用 twMarketValuation", () => {
      expect(macroDataSlots.rawValuation.providerId).toBe("twMarketValuation");
    });

    it("rawFx 使用 usdTwdYahoo", () => {
      expect(macroDataSlots.rawFx.providerId).toBe("usdTwdYahoo");
    });

    it("quote 使用 dailyQuote", () => {
      expect(macroDataSlots.quote.providerId).toBe("dailyQuote");
    });
  });

  describe("SLOT_CRITICALITY", () => {
    it("每個關鍵槽位都有設定", () => {
      const criticalSlots = [
        "rawValuation",
        "rawMargin",
        "rawUsMarket",
        "rawFx",
        "rawCnn",
        "rawMarketOverview",
        "rawInstitutional",
        "rawStockMargin",
        "rawNdc",
        "rawBankRate",
        "rawCpi",
      ];

      criticalSlots.forEach((slot) => {
        expect(SLOT_CRITICALITY[slot]).toBeDefined();
        expect(SLOT_CRITICALITY[slot].level).toBeTypeOf("string");
        expect(SLOT_CRITICALITY[slot].staleHours).toBeTypeOf("number");
      });
    });

    it("CRITICAL 等級的槽位 staleHours >= 48", () => {
      const criticalSlots = ["rawValuation", "rawMargin", "rawUsMarket"];
      criticalSlots.forEach((slot) => {
        expect(SLOT_CRITICALITY[slot].level).toBe("CRITICAL");
        expect(SLOT_CRITICALITY[slot].staleHours).toBeGreaterThanOrEqual(48);
      });
    });

    it("IMPORTANT 等級的槽位有合理的 staleHours", () => {
      const importantSlots = [
        "rawFx",
        "rawCnn",
        "rawMarketOverview",
        "rawInstitutional",
        "rawStockMargin",
      ];
      importantSlots.forEach((slot) => {
        expect(SLOT_CRITICALITY[slot].level).toBe("IMPORTANT");
        expect(SLOT_CRITICALITY[slot].staleHours).toBeGreaterThan(0);
      });
    });

    it("LOW 等級的槽位 staleHours 較長", () => {
      const lowSlots = ["rawNdc", "rawBankRate", "rawCpi"];
      lowSlots.forEach((slot) => {
        expect(SLOT_CRITICALITY[slot].level).toBe("LOW");
        expect(SLOT_CRITICALITY[slot].staleHours).toBeGreaterThanOrEqual(720);
      });
    });
  });

  describe("完整性驗證", () => {
    it("macroDataSlots 的所有 providerId 都有對應的 SLOT_CRITICALITY 設定", () => {
      Object.values(macroDataSlots).forEach((slot) => {
        // 找到對應的 criticality 設定
        const slotKey = Object.keys(macroDataSlots).find(
          (k) => macroDataSlots[k] === slot,
        );
        // quote slot 可能沒有 criticality 設定，允許 undefined
        if (slotKey !== "quote") {
          expect(SLOT_CRITICALITY[slotKey]).toBeDefined();
        }
      });
    });
  });
});
