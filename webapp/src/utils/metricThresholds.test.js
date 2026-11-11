import { describe, it, expect } from "vitest";
import {
  getVixLevel,
  getCnnLevel,
  getMaintenanceLevel,
  getLeverageLevel,
  getPrLevel,
} from "./metricThresholds.js";

describe("metricThresholds", () => {
  describe("getVixLevel", () => {
    it("美股 VIX >= 30 為 danger", () => {
      expect(getVixLevel(35, "us").level).toBe("danger");
      expect(getVixLevel(30, "us").level).toBe("danger");
    });
    it("美股 VIX 20-30 為 warn", () => {
      expect(getVixLevel(25, "us").level).toBe("warn");
    });
    it("美股 VIX 13.5-20 為 ok", () => {
      expect(getVixLevel(15, "us").level).toBe("ok");
    });
    it("美股 VIX < 13.5 為 info（過度安逸）", () => {
      expect(getVixLevel(12, "us").level).toBe("info");
    });
    it("台股 VIX < 20 為 ok（無 info 級別）", () => {
      expect(getVixLevel(15, "tw").level).toBe("ok");
      expect(getVixLevel(12, "tw").level).toBe("ok");
    });
    it("null/NaN 回傳 neutral", () => {
      expect(getVixLevel(null).level).toBe("neutral");
      expect(getVixLevel(NaN).level).toBe("neutral");
      expect(getVixLevel("abc").level).toBe("neutral");
    });
  });

  describe("getCnnLevel", () => {
    it("<=25 為 danger", () => {
      expect(getCnnLevel(20).level).toBe("danger");
      expect(getCnnLevel(25).level).toBe("danger");
    });
    it("26-45 為 warn", () => {
      expect(getCnnLevel(30).level).toBe("warn");
      expect(getCnnLevel(45).level).toBe("warn");
    });
    it("46-74 為 ok", () => {
      expect(getCnnLevel(50).level).toBe("ok");
      expect(getCnnLevel(70).level).toBe("ok");
    });
    it(">=75 為 warn（極度貪婪）", () => {
      expect(getCnnLevel(80).level).toBe("warn");
    });
    it("null/NaN 回傳 neutral", () => {
      expect(getCnnLevel(null).level).toBe("neutral");
    });
  });

  describe("getMaintenanceLevel", () => {
    it("< 135 為 danger", () => {
      expect(getMaintenanceLevel(130).level).toBe("danger");
    });
    it("135-159 為 warn", () => {
      expect(getMaintenanceLevel(140).level).toBe("warn");
      expect(getMaintenanceLevel(155).level).toBe("warn");
    });
    it(">= 160 為 ok", () => {
      expect(getMaintenanceLevel(160).level).toBe("ok");
      expect(getMaintenanceLevel(200).level).toBe("ok");
    });
    it("null/NaN 回傳 neutral", () => {
      expect(getMaintenanceLevel(null).level).toBe("neutral");
    });
  });

  describe("getLeverageLevel", () => {
    it(">= 3.0 為 danger", () => {
      expect(getLeverageLevel(3.0).level).toBe("danger");
      expect(getLeverageLevel(3.5).level).toBe("danger");
    });
    it("2.5-2.99 為 warn", () => {
      expect(getLeverageLevel(2.5).level).toBe("warn");
      expect(getLeverageLevel(2.9).level).toBe("warn");
    });
    it("< 2.5 為 ok", () => {
      expect(getLeverageLevel(1.8).level).toBe("ok");
    });
    it("null/NaN 回傳 neutral", () => {
      expect(getLeverageLevel(null).level).toBe("neutral");
    });
  });

  describe("getPrLevel", () => {
    it(">= 90 為 danger", () => {
      expect(getPrLevel(90).level).toBe("danger");
      expect(getPrLevel(95).level).toBe("danger");
    });
    it("80-89 為 warn", () => {
      expect(getPrLevel(85).level).toBe("warn");
    });
    it("26-79 為 neutral", () => {
      expect(getPrLevel(50).level).toBe("neutral");
      expect(getPrLevel(70).level).toBe("neutral");
    });
    it("<= 25 為 ok", () => {
      expect(getPrLevel(25).level).toBe("ok");
      expect(getPrLevel(10).level).toBe("ok");
    });
    it("null/NaN 回傳 neutral", () => {
      expect(getPrLevel(null).level).toBe("neutral");
    });
  });
});
