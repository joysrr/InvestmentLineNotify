// src/api/routes/config.test.mjs
// TDD: Config Routes 測試

import { describe, it, expect, beforeEach, vi } from "vitest";
import Fastify from "fastify";

vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
  readFile: vi.fn(),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../modules/strategy/strategyLoader.mjs", () => ({
  fetchStrategyConfigUnified: vi.fn(),
}));

vi.mock("../../modules/strategy/validateStrategyConfig.mjs", () => ({
  validateStrategyConfig: vi.fn(),
}));

vi.mock("../../modules/config/configValidator.mjs", () => ({
  validateConfig: vi.fn(),
  flattenConfig: vi.fn(),
  unflattenConfig: vi.fn(),
}));

vi.mock("../../utils/logger.mjs", () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import configRoute from "./config.mjs";
import { readFile, writeFile } from "fs/promises";
import { fetchStrategyConfigUnified } from "../../modules/strategy/strategyLoader.mjs";
import { validateStrategyConfig } from "../../modules/strategy/validateStrategyConfig.mjs";
import { validateConfig } from "../../modules/config/configValidator.mjs";

describe("configRoute - 策略設定 API", () => {
  let app;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    app = Fastify({ logger: false });
    await app.register(configRoute);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe("GET /strategy-config - 取得策略設定", () => {
    it("回傳策略設定與 meta", async () => {
      readFile
        .mockResolvedValueOnce('{"labels": {"risk": "風險"}}') // META_PATH
        .mockResolvedValueOnce('{"risk": {"ma240": 0.8}}'); // DEFAULT_STRATEGY_PATH

      fetchStrategyConfigUnified.mockResolvedValue({
        risk: { ma240: 0.8 },
        buy: { tactical: 5 },
      });

      const response = await app.inject({
        method: "GET",
        url: "/strategy-config",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body._meta.labels.risk).toBe("風險");
      expect(body.strategy.content.risk.ma240).toBe(0.8);
    });

    it("meta 讀取失敗不影響回應", async () => {
      readFile
        .mockRejectedValueOnce(new Error("ENOENT")) // META_PATH
        .mockResolvedValueOnce('{"risk": {"ma240": 0.8}}');

      fetchStrategyConfigUnified.mockResolvedValue({ risk: { ma240: 0.8 } });

      const response = await app.inject({
        method: "GET",
        url: "/strategy-config",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      // 實際實作會回傳空物件
      expect(body._meta).toBeDefined();
    });

    it("strategy 載入失敗回傳錯誤資訊", async () => {
      readFile
        .mockResolvedValueOnce('{"labels": {}}')
        .mockResolvedValueOnce('{"risk": {}}');

      fetchStrategyConfigUnified.mockRejectedValue(new Error("Load failed"));

      const response = await app.inject({
        method: "GET",
        url: "/strategy-config",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.strategy.error).toBe("無法載入策略設定");
    });
  });

  describe("POST /strategy-config - 存入自訂設定", () => {
    it("驗證通過寫入檔案回傳成功", async () => {
      const newConfig = { risk: { ma240: 0.9 }, buy: { tactical: 10 } };

      validateStrategyConfig.mockReturnValue(undefined);
      readFile.mockResolvedValue('{"risk": {"ma240": {"type": "number"}}}');
      validateConfig.mockReturnValue({ valid: true, errors: [] });
      writeFile.mockResolvedValue();

      const response = await app.inject({
        method: "POST",
        url: "/strategy-config",
        payload: newConfig,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("Strategy.custom.json"),
        JSON.stringify(newConfig, null, 2) + "\n",
        "utf-8",
      );
    });

    it("validateStrategyConfig 失敗回傳 400", async () => {
      validateStrategyConfig.mockImplementation(() => {
        throw new Error("Invalid structure");
      });

      const response = await app.inject({
        method: "POST",
        url: "/strategy-config",
        payload: { invalid: true },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("策略結構驗證失敗");
    });

    it("validateConfig 失敗回傳 400", async () => {
      validateStrategyConfig.mockReturnValue(undefined);
      readFile.mockResolvedValue('{}');
      validateConfig.mockReturnValue({
        valid: false,
        errors: ["ma240: must be number"],
      });

      const response = await app.inject({
        method: "POST",
        url: "/strategy-config",
        payload: { risk: { ma240: "invalid" } },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.error).toBe("欄位驗證失敗");
    });

    it("寫入失敗回傳 500", async () => {
      validateStrategyConfig.mockReturnValue(undefined);
      readFile.mockResolvedValue('{}');
      validateConfig.mockReturnValue({ valid: true, errors: [] });
      writeFile.mockRejectedValue(new Error("Disk full"));

      const response = await app.inject({
        method: "POST",
        url: "/strategy-config",
        payload: { risk: { ma240: 0.9 } },
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe("GET /strategy-config/default - 取得預設設定", () => {
    it("回傳預設設定", async () => {
      readFile.mockResolvedValue('{"risk": {"ma240": 0.8}}');

      const response = await app.inject({
        method: "GET",
        url: "/strategy-config/default",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.config.risk.ma240).toBe(0.8);
    });

    it("讀取失敗回傳 500", async () => {
      readFile.mockRejectedValue(new Error("ENOENT"));

      const response = await app.inject({
        method: "GET",
        url: "/strategy-config/default",
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe("GET /strategy-config/meta - 取得 ConfigMeta", () => {
    it("回傳 meta", async () => {
      readFile.mockResolvedValue('{"labels": {"risk": "風險"}}');

      const response = await app.inject({
        method: "GET",
        url: "/strategy-config/meta",
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.success).toBe(true);
      expect(body.meta.labels.risk).toBe("風險");
    });
  });

  describe("POST /strategy-config/validate - 驗證設定", () => {
    it("驗證通過回傳 valid: true", async () => {
      validateStrategyConfig.mockReturnValue(undefined);
      readFile.mockResolvedValue('{}');
      validateConfig.mockReturnValue({ valid: true, errors: [] });

      const response = await app.inject({
        method: "POST",
        url: "/strategy-config/validate",
        payload: { risk: { ma240: 0.9 } },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.valid).toBe(true);
    });

    it("原始驗證失敗回傳 valid: false", async () => {
      validateStrategyConfig.mockImplementation(() => {
        throw new Error("Invalid");
      });

      const response = await app.inject({
        method: "POST",
        url: "/strategy-config/validate",
        payload: { risk: { ma240: "invalid" } },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.valid).toBe(false);
    });

    it("ConfigMeta 驗證失敗回傳 errors", async () => {
      validateStrategyConfig.mockReturnValue(undefined);
      readFile.mockResolvedValue('{}');
      validateConfig.mockReturnValue({
        valid: false,
        errors: ["ma240: out of range"],
      });

      const response = await app.inject({
        method: "POST",
        url: "/strategy-config/validate",
        payload: { risk: { ma240: 5 } },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.valid).toBe(false);
      expect(body.errors).toContain("ma240: out of range");
    });
  });
});