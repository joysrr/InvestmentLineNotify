import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { logger } = vi.hoisted(() => ({
  logger: { warn: vi.fn(), debug: vi.fn(), info: vi.fn() },
}));
vi.mock("../../utils/logger.mjs", () => ({ default: logger }));

import {
  ADMIN_USER_IDS,
  adminGuard,
  reloadAdminUserIds,
} from "./adminGuard.mjs";

async function runGuard(userId) {
  const app = Fastify({ logger: false });
  app.addHook("preHandler", adminGuard);
  app.get("/test", async () => ({ ok: true }));
  await app.ready();
  const response = await app.inject({
    method: "GET",
    url: "/test",
    headers: {},
  });
  response.request = undefined;
  await app.close();
  return response;
}

describe("adminGuard", () => {
  beforeEach(() => {
    delete process.env.ADMIN_USER_IDS;
    delete process.env.TELEGRAM_USER_ID;
    ADMIN_USER_IDS.clear();
  });

  it("uses TELEGRAM_USER_ID as the single-admin fallback", async () => {
    process.env.TELEGRAM_USER_ID = "123456789";
    reloadAdminUserIds();

    const app = Fastify({ logger: false });
    app.addHook("preHandler", adminGuard);
    app.addHook("onRequest", async (request) => {
      request.telegramUser = { id: 123456789 };
    });
    app.get("/test", async () => ({ ok: true }));
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/test" });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.payload)).toEqual({ ok: true });
    await app.close();
  });

  it("keeps explicit ADMIN_USER_IDS authoritative", async () => {
    process.env.TELEGRAM_USER_ID = "123456789";
    process.env.ADMIN_USER_IDS = "987654321";
    reloadAdminUserIds();

    const response = await (async () => {
      const app = Fastify({ logger: false });
      app.addHook("preHandler", adminGuard);
      app.addHook("onRequest", async (request) => {
        request.telegramUser = { id: 123456789 };
      });
      app.get("/test", async () => ({ ok: true }));
      await app.ready();
      const result = await app.inject({ method: "GET", url: "/test" });
      await app.close();
      return result;
    })();

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.payload)).toMatchObject({
      error: "Forbidden",
      message: "需要管理員權限",
    });
  });
});
