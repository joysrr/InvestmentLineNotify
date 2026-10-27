import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("Server integration - replay evidence", () => {
  beforeAll(() => {
    process.env.BYPASS_INIT_DATA = "true";
  });

  afterAll(() => {
    delete process.env.BYPASS_INIT_DATA;
  });

  it("exposes /api/replay-evidence endpoint via buildApp", async () => {
    const { buildApp } = await import("../../api/server.mjs");
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/replay-evidence",
      headers: {
        "X-Telegram-Init-Data": "dev-bypass",
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty("evidence");
    expect(Array.isArray(body.evidence)).toBe(true);

    await app.close();
  });

  it("includes replay evidence endpoint in OpenAPI documentation", async () => {
    const { buildApp } = await import("../../api/server.mjs");
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/docs/json",
      headers: {
        "X-Telegram-Init-Data": "dev-bypass",
      },
    });

    expect(response.statusCode).toBe(200);
    const openapi = JSON.parse(response.body);
    expect(openapi.paths).toHaveProperty("/api/replay-evidence");
    expect(openapi.paths["/api/replay-evidence"]).toHaveProperty("get");

    await app.close();
  });
});
