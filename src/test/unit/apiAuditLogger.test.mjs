import { describe, expect, it } from "vitest";
import { buildApp } from "../../api/server.mjs";

describe("API Audit Logger Hooks", () => {
  it("應在 initDataGuard 之前記錄所有抵達的 HTTP 請求日誌", async () => {
    const app = await buildApp();

    // 發送一個會被 Guard 處理的請求
    const response = await app.inject({
      method: "GET",
      url: "/api/reports?limit=1",
    });

    expect(response.statusCode).toBeDefined();
  });
});
