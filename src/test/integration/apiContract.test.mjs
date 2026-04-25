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

import { mkdir, writeFile, rm } from "fs/promises";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, "../../../data");

beforeAll(async () => {
  // 建立必要的測試目錄
  await mkdir(resolve(DATA_DIR, "market"), { recursive: true });
  await mkdir(resolve(DATA_DIR, "news"), { recursive: true });
  await mkdir(resolve(DATA_DIR, "reports"), { recursive: true });

  // 寫入符合 2.0 結構的 Mock 資料
  const mockStatus = { _meta: {}, data: { rawUsMarket: { vix: "15" } } };
  const mockReport = {
    date: "2026-04-25",
    marketState: { valuation: {}, sentiment: { vix: 15 } },
    strategySnapshot: {},
    signals: { status: "🌱", score: 0 },
  };

  await writeFile(
    resolve(DATA_DIR, "market/latest.json"),
    JSON.stringify(mockStatus),
  );
  await writeFile(
    resolve(DATA_DIR, "news/pool_filtered_active.json"),
    JSON.stringify([]),
  );
  await writeFile(
    resolve(DATA_DIR, "reports/2026-04-25.json"),
    JSON.stringify(mockReport),
  );

  process.env.BYPASS_INIT_DATA = "true";
  app = await buildApp({ logger: false });
  await app.ready();
  request = supertest(app.server);
});

afterAll(async () => {
  await app.close();
  // 不刪除資料，保留作為測試證據
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
    it("應回傳 2.0 格式且包含 marketState 與 strategySnapshot", async () => {
      const res = await request
        .get("/api/reports?limit=1")
        .set("X-Telegram-Init-Data", "dev-bypass")
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      if (res.body.length > 0) {
        const report = res.body[0];
        expect(report).toHaveProperty("marketState");
        expect(report).toHaveProperty("strategySnapshot");
        expect(report).toHaveProperty("signals");

        // 驗證 marketState 深度
        expect(report.marketState).toHaveProperty("valuation");
        expect(report.marketState).toHaveProperty("sentiment");

        // 驗證 signals 深度
        expect(report.signals).toHaveProperty("status");
        expect(report.signals).toHaveProperty("score");
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
