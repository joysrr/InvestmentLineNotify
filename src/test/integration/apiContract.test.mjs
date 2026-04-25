/**
 * apiContract.test.mjs
 * API Contract Test — 驗證每個 endpoint 回傳的 schema 結構符合 webapp 的消費預期。
 * 使用 supertest 直接注入 Fastify app，不依賴真實網路或外部服務。
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import { buildApp } from "../../api/server.mjs";

let app;
let request;

beforeAll(async () => {
  // 繞過 Telegram initData 驗證
  process.env.BYPASS_INIT_DATA = "true";
  // 建立測試用的 app，關閉 logger 以保持測試輸出整潔
  app = await buildApp({ logger: false });
  await app.ready();
  request = supertest(app.server);
});

afterAll(async () => {
  await app.close();
});

describe("API Contract Testing", () => {
  // ── /api/status ────────────────────────────────────────────────
  describe("GET /api/status", () => {
    it("應回傳 200 且包含 _meta 與 data 欄位", async () => {
      const res = await request
        .get("/api/status")
        .set("X-Telegram-Init-Data", "dev-bypass") // 使用 dev-bypass 繞過 Guard
        .expect(200);

      expect(res.body).toHaveProperty("data");
      expect(res.body).toHaveProperty("_meta");
    });
  });

  // ── /api/reports ───────────────────────────────────────────────
  describe("GET /api/reports", () => {
    it("應回傳陣列且每筆包含 signals 與 ai 欄位", async () => {
      const res = await request
        .get("/api/reports?limit=1")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        expect(res.body[0]).toHaveProperty("date");
        expect(res.body[0]).toHaveProperty("signals");
        expect(res.body[0]).toHaveProperty("ai");
      }
    });
  });

  // ── /api/reports/snapshots ─────────────────────────────────────
  describe("GET /api/reports/snapshots", () => {
    it("應回傳物件且包含 snapshots 陣列與 hasEncryption 狀態", async () => {
      const res = await request
        .get("/api/reports/snapshots?limit=1")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(typeof res.body).toBe("object");
      expect(res.body).toHaveProperty("hasEncryption");
      expect(Array.isArray(res.body.snapshots)).toBe(true);
    });
  });

  // ── /api/news ──────────────────────────────────────────────────
  describe("GET /api/news", () => {
    it("應回傳 200 且格式為陣列", async () => {
      const res = await request
        .get("/api/news")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  // ── /api/strategy-config ───────────────────────────────────────
  describe("GET /api/strategy-config", () => {
    it("應回傳 200 且為物件格式", async () => {
      const res = await request
        .get("/api/strategy-config")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(typeof res.body).toBe("object");
      expect(res.body).not.toBeNull();
    });
  });

  // ── /health (不需 auth) ────────────────────────────────────────
  describe("GET /health", () => {
    it("應回傳 200 ok", async () => {
      const res = await request.get("/health").expect(200);
      expect(res.body.status).toBe("ok");
    });
  });
});
