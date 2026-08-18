// src/modules/providers/ndcProvider.test.mjs
// TDD: NDC Provider 測試

import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../utils/coreUtils.mjs", () => ({
  fetchWithTimeout: vi.fn(),
  isoDateToROC: vi.fn((date) => date),
  parseNumber: vi.fn((val) =>
    val === null || val === undefined || val === "" ? null : parseFloat(val),
  ),
}));

import { fetchBusinessIndicator } from "./ndcProvider.mjs";
import { fetchWithTimeout } from "../../utils/coreUtils.mjs";

describe("ndcProvider - 國發會景氣指標 Provider", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("fetchBusinessIndicator", () => {
    it("成功解析景氣燈號資料", async () => {
      const mockData = {
        row: [["115年1月"], ["114年12月"]],
        col: [["col1"], ["景氣對策信號綜合判斷分數"], ["col3"]],
        outdata: [
          [1, 2],
          [25, 28],
          [3, 4],
        ],
      };
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      });

      const result = await fetchBusinessIndicator();

      expect(result.score).toBe(28); // 從最新日期往前找，找到第一個 > 0 的分數 (28)
      expect(result.light).toBe("綠燈 (穩定)");
      expect(result.lightColor).toBe("green");
      expect(result.date).toMatch(/^\d{4}-\d{2}$/);
      expect(result.raw).toEqual(mockData);
      expect(result.normalized).toEqual(
        expect.objectContaining({ score: 28, lightColor: "green" }),
      );
    });

    it("分數 >= 38 回傳紅燈", async () => {
      const mockData = {
        row: [["115年1月"]],
        col: [["col1"], ["景氣對策信號綜合判斷分數"]],
        outdata: [[1], [40]],
      };
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      });

      const result = await fetchBusinessIndicator();
      expect(result.light).toBe("紅燈 (過熱)");
      expect(result.lightColor).toBe("red");
    });

    it("分數 >= 32 回傳黃紅燈", async () => {
      const mockData = {
        row: [["115年1月"]],
        col: [["col1"], ["景氣對策信號綜合判斷分數"]],
        outdata: [[1], [35]],
      };
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      });

      const result = await fetchBusinessIndicator();
      expect(result.light).toBe("黃紅燈 (轉熱)");
      expect(result.lightColor).toBe("yellow-red");
    });

    it("分數 >= 23 回傳綠燈", async () => {
      const mockData = {
        row: [["115年1月"]],
        col: [["col1"], ["景氣對策信號綜合判斷分數"]],
        outdata: [[1], [28]],
      };
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      });

      const result = await fetchBusinessIndicator();
      expect(result.light).toBe("綠燈 (穩定)");
      expect(result.lightColor).toBe("green");
    });

    it("分數 >= 17 回傳黃藍燈", async () => {
      const mockData = {
        row: [["115年1月"]],
        col: [["col1"], ["景氣對策信號綜合判斷分數"]],
        outdata: [[1], [20]],
      };
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      });

      const result = await fetchBusinessIndicator();
      expect(result.light).toBe("黃藍燈 (轉弱)");
      expect(result.lightColor).toBe("yellow-blue");
    });

    it("分數 < 17 回傳藍燈", async () => {
      const mockData = {
        row: [["115年1月"]],
        col: [["col1"], ["景氣對策信號綜合判斷分數"]],
        outdata: [[1], [15]],
      };
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      });

      const result = await fetchBusinessIndicator();
      expect(result.light).toBe("藍燈 (低迷)");
      expect(result.lightColor).toBe("blue");
    });

    it("JSON 結構缺少 row 或 outdata 拋出錯誤", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({ row: [] }),
      });

      await expect(fetchBusinessIndicator()).rejects.toThrow(
        "JSON 結構缺少 row 或 outdata",
      );
    });

    it("找不到有效分數拋出錯誤", async () => {
      const mockData = {
        row: [["115年1月"]],
        col: [["col1"], ["景氣對策信號綜合判斷分數"]],
        outdata: [[], [null, null]], // score column has null values
      };
      fetchWithTimeout.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockData),
      });

      await expect(fetchBusinessIndicator()).rejects.toThrow(
        "找不到最新月份的分數資料",
      );
    });

    it("HTTP 錯誤拋出錯誤", async () => {
      fetchWithTimeout.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchBusinessIndicator()).rejects.toThrow(
        "Gov API HTTP 500",
      );
    });

    it("網路異常拋出錯誤", async () => {
      fetchWithTimeout.mockRejectedValueOnce(new Error("Timeout"));

      await expect(fetchBusinessIndicator()).rejects.toThrow("Timeout");
    });
  });

  describe("getLightStatus 內部邏輯", () => {
    it("正確判斷各燈號區間", () => {
      const getLightStatus = (score) => {
        if (score >= 38) return { light: "紅燈 (過熱)", lightColor: "red" };
        if (score >= 32)
          return { light: "黃紅燈 (轉熱)", lightColor: "yellow-red" };
        if (score >= 23) return { light: "綠燈 (穩定)", lightColor: "green" };
        if (score >= 17)
          return { light: "黃藍燈 (轉弱)", lightColor: "yellow-blue" };
        return { light: "藍燈 (低迷)", lightColor: "blue" };
      };

      expect(getLightStatus(40)).toEqual({
        light: "紅燈 (過熱)",
        lightColor: "red",
      });
      expect(getLightStatus(35)).toEqual({
        light: "黃紅燈 (轉熱)",
        lightColor: "yellow-red",
      });
      expect(getLightStatus(25)).toEqual({
        light: "綠燈 (穩定)",
        lightColor: "green",
      });
      expect(getLightStatus(20)).toEqual({
        light: "黃藍燈 (轉弱)",
        lightColor: "yellow-blue",
      });
      expect(getLightStatus(10)).toEqual({
        light: "藍燈 (低迷)",
        lightColor: "blue",
      });
    });
  });
});
