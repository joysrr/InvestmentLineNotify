// src/modules/providers/kgiProvider.test.mjs
// TDD: KGI Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/coreUtils.mjs", () => ({
  fetchWithTimeout: vi.fn(),
  parseNumber: vi.fn(),
}));

import { fetchTwseMarginData } from "./kgiProvider.mjs";
import { fetchWithTimeout, parseNumber } from "../../utils/coreUtils.mjs";

describe("kgiProvider - KGI / MoneyDJ Provider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchTwseMarginData", () => {
    it("成功解析融資資料", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ResultSet: {
            Result: [
              { V1: "2024/01/15", V3: "35000000", V6: "180.5" }, // 今天
              { V1: "2024/01/12", V3: "34500000", V6: "178.0" }, // 昨天
            ],
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);
      // 呼叫順序: V6, V3, prev V3
      let callCount = 0;
      parseNumber.mockImplementation((val) => {
        callCount++;
        if (callCount === 1) return 180.5; // today V6
        if (callCount === 2) return 35000000; // today V3
        if (callCount === 3) return 34500000; // prev V3
        return null;
      });

      const result = await fetchTwseMarginData();

      expect(fetchWithTimeout).toHaveBeenCalled();
      expect(result.date).toBe("2024/01/15");
      expect(result.marginBalance100M).toBe(3500); // 35000000 / 10000
      expect(result.maintenanceRatio).toBe(180.5);
      expect(result.marginBalanceChange100M).toBe(50); // 3500 - 3450
      expect(result.raw).toEqual(
        expect.objectContaining({ ResultSet: expect.any(Object) }),
      );
      expect(result.normalized).toEqual(
        expect.objectContaining({ maintenanceRatio: 180.5 }),
      );
    });

    it("HTTP 錯誤拋出錯誤", async () => {
      const mockResponse = { ok: false, status: 500 };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      await expect(fetchTwseMarginData()).rejects.toThrow(
        "MoneyDJ API HTTP 500",
      );
    });

    it("JSON 結構不符合預期拋出錯誤", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ ResultSet: { Result: [] } }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      await expect(fetchTwseMarginData()).rejects.toThrow(
        "MoneyDJ JSON 結構不符合預期",
      );
    });

    it("Result 陣列長度不足拋出錯誤", async () => {
      const mockResponse = {
        ok: true,
        json: vi
          .fn()
          .mockResolvedValue({ ResultSet: { Result: [{ V1: "2024/01/15" }] } }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);

      await expect(fetchTwseMarginData()).rejects.toThrow(
        "MoneyDJ JSON 結構不符合預期",
      );
    });

    it("V6 解析失敗使用預設值", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ResultSet: {
            Result: [
              { V1: "2024/01/15", V3: "35000000", V6: null },
              { V1: "2024/01/12", V3: "34500000", V6: "178.0" },
            ],
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);
      // 呼叫順序: V6, V3, prev V3
      let callCount = 0;
      parseNumber.mockImplementation((val) => {
        callCount++;
        if (callCount === 1) return null; // today V6 -> 使用預設 165
        if (callCount === 2) return 35000000; // today V3
        if (callCount === 3) return 34500000; // prev V3
        return null;
      });

      const result = await fetchTwseMarginData();

      expect(result.maintenanceRatio).toBe(165); // 預設值
    });

    it("V3 解析失敗保持預設值", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          ResultSet: {
            Result: [
              { V1: "2024/01/15", V3: null, V6: "180.5" },
              { V1: "2024/01/12", V3: null, V6: "178.0" },
            ],
          },
        }),
      };
      fetchWithTimeout.mockResolvedValue(mockResponse);
      // 使用函數追蹤呼叫順序
      let callCount = 0;
      parseNumber.mockImplementation((val) => {
        callCount++;
        if (callCount === 1) return 180.5; // today V6
        return null; // V3 and prev V3
      });

      const result = await fetchTwseMarginData();

      expect(result.marginBalance100M).toBe(3000); // 預設值
      expect(result.maintenanceRatio).toBe(180.5);
      expect(result.marginBalanceChange100M).toBe(0);
    });

    it("網路超時拋出錯誤", async () => {
      const timeoutError = new Error("Timeout");
      fetchWithTimeout.mockRejectedValue(timeoutError);

      await expect(fetchTwseMarginData()).rejects.toThrow("Timeout");
    });

    it("網路錯誤拋出錯誤", async () => {
      fetchWithTimeout.mockRejectedValue(new Error("Network error"));

      await expect(fetchTwseMarginData()).rejects.toThrow("Network error");
    });
  });
});
