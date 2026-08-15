// src/api/server.test.mjs
// TDD: Fastify Server Build & Logger Audit Hook 測試

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { buildApp } from "./server.mjs";
import logger from "../utils/logger.mjs";

describe("buildApp - Fastify Server Audit & Logger Hook", () => {
  let app;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it("應成功建立 Fastify 實例並正確回應 /health", async () => {
    app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/health",
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("ok");
    expect(typeof body.ts).toBe("number");
  });

  it("應觸發 onRequest 與 onResponse 日誌審計", async () => {
    process.env.BYPASS_INIT_DATA = "true";
    const loggerInfoSpy = vi.spyOn(logger, "info");
    app = await buildApp();

    const res = await app.inject({
      method: "GET",
      url: "/api/status",
    });

    expect(res.statusCode).toBe(200);
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/api/status",
      }),
      expect.stringContaining("[API Request]"),
    );
    expect(loggerInfoSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/api/status",
        statusCode: 200,
      }),
      expect.stringContaining("[API Response]"),
    );

    loggerInfoSpy.mockRestore();
  });
});
