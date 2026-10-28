import Fastify from "fastify";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import dataEvidenceReportRoute from "./dataEvidenceReport.mjs";

describe("data evidence report route", () => {
  it("returns the persisted evidence report metadata and items", async () => {
    const app = Fastify({ logger: false });
    await app.register(dataEvidenceReportRoute, {
      reportPath: "data/verification-reports/2026-10-21-data-evidence.json",
    });

    const response = await app.inject({
      method: "GET",
      url: "/data-evidence-report",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.verificationScope).toContain("no external API re-fetch");
    expect(payload.items.length).toBeGreaterThan(0);
    expect(payload.items[0]).toHaveProperty("source");
  });

  it("serves the newest persisted report when no report path is configured", async () => {
    const reportsDir = await mkdtemp(
      path.join(os.tmpdir(), "evidence-reports-"),
    );
    const olderPath = path.join(reportsDir, "2026-10-20-data-evidence.json");
    const newerPath = path.join(reportsDir, "2026-10-21-data-evidence.json");
    const report = { verificationScope: "newest", items: [{ source: "test" }] };
    await writeFile(
      olderPath,
      JSON.stringify({ ...report, verificationScope: "older" }),
    );
    await writeFile(newerPath, JSON.stringify(report));

    const app = Fastify({ logger: false });
    await app.register(dataEvidenceReportRoute, { reportsDir });

    const response = await app.inject({
      method: "GET",
      url: "/data-evidence-report",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(report);
  });

  it("returns 404 when the persisted report is unavailable", async () => {
    const app = Fastify({ logger: false });
    await app.register(dataEvidenceReportRoute, {
      reportPath: "data/verification-reports/not-found.json",
    });

    const response = await app.inject({
      method: "GET",
      url: "/data-evidence-report",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Data evidence report unavailable",
    });
  });

  it("POST /data-evidence-report generates a fresh evidence report on demand", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "fresh-evidence-"));
    const app = Fastify({ logger: false });
    await app.register(dataEvidenceReportRoute, {
      rootDir,
      reportsDir: path.join(rootDir, "data/verification-reports"),
    });

    const response = await app.inject({
      method: "POST",
      url: "/data-evidence-report",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.reportType).toBe("data-evidence");
    expect(payload.items).toBeDefined();
    expect(payload.generatedAt).toBeDefined();
  });

  it("POST /data-evidence-report succeeds when called with Content-Type: application/json and empty body", async () => {
    const rootDir = await mkdtemp(
      path.join(os.tmpdir(), "empty-body-evidence-"),
    );
    const app = Fastify({ logger: false });
    await app.register(dataEvidenceReportRoute, {
      rootDir,
      reportsDir: path.join(rootDir, "data/verification-reports"),
    });

    const response = await app.inject({
      method: "POST",
      url: "/data-evidence-report",
      headers: { "content-type": "application/json" },
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.reportType).toBe("data-evidence");
  });

  it("GET /data-evidence-report/download serves report with attachment disposition header", async () => {
    const reportsDir = await mkdtemp(
      path.join(os.tmpdir(), "evidence-download-"),
    );
    const reportPath = path.join(reportsDir, "2026-10-27-data-evidence.json");
    await writeFile(
      reportPath,
      JSON.stringify({ reportType: "data-evidence", items: [] }),
    );

    const app = Fastify({ logger: false });
    await app.register(dataEvidenceReportRoute, { reportsDir });

    const response = await app.inject({
      method: "GET",
      url: "/data-evidence-report/download",
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(response.headers["content-disposition"]).toContain(
      "data-evidence.json",
    );
    expect(response.json().reportType).toBe("data-evidence");
  });

  it("POST /data-evidence-report 回傳包含 downloadUrl 與 ticket 的回應", async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), "ticket-evidence-"));
    const app = Fastify({ logger: false });
    await app.register(dataEvidenceReportRoute, {
      rootDir,
      reportsDir: path.join(rootDir, "data/verification-reports"),
    });

    const response = await app.inject({
      method: "POST",
      url: "/data-evidence-report",
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.downloadUrl).toBeDefined();
    expect(payload.downloadUrl).toContain("/api/data-evidence-report/download");
    expect(payload.downloadUrl).toContain("ticket=");
  });

  it("GET /data-evidence-report/download?ticket= 帶有效 ticket 可直接下載，不需 initData", async () => {
    const reportsDir = await mkdtemp(
      path.join(os.tmpdir(), "ticket-download-"),
    );
    const reportPath = path.join(reportsDir, "2026-10-28-data-evidence.json");
    await writeFile(
      reportPath,
      JSON.stringify({ reportType: "data-evidence", items: [] }),
    );

    const app = Fastify({ logger: false });
    await app.register(dataEvidenceReportRoute, { reportsDir });

    // 先 POST 取得 ticket
    const postResp = await app.inject({
      method: "POST",
      url: "/data-evidence-report",
      headers: { "content-type": "application/json" },
    });
    expect(postResp.statusCode).toBe(200);
    const { downloadUrl } = postResp.json();
    const ticket = new URL(downloadUrl, "http://localhost").searchParams.get(
      "ticket",
    );
    expect(ticket).not.toBeNull();

    // 用 ticket 下載
    const dlResp = await app.inject({
      method: "GET",
      url: `/data-evidence-report/download?ticket=${ticket}`,
    });
    expect(dlResp.statusCode).toBe(200);
    expect(dlResp.headers["content-disposition"]).toContain("attachment;");
    expect(dlResp.json().reportType).toBe("data-evidence");
  });

  it("GET /data-evidence-report/download?ticket= 使用過的 ticket 回傳 403", async () => {
    const reportsDir = await mkdtemp(path.join(os.tmpdir(), "ticket-used-"));
    const reportPath = path.join(reportsDir, "2026-10-28-data-evidence.json");
    await writeFile(
      reportPath,
      JSON.stringify({ reportType: "data-evidence", items: [] }),
    );

    const app = Fastify({ logger: false });
    await app.register(dataEvidenceReportRoute, { reportsDir });

    const postResp = await app.inject({
      method: "POST",
      url: "/data-evidence-report",
    });
    const { downloadUrl } = postResp.json();
    const ticket = new URL(downloadUrl, "http://localhost").searchParams.get(
      "ticket",
    );

    // 第一次兌換成功
    await app.inject({
      method: "GET",
      url: `/data-evidence-report/download?ticket=${ticket}`,
    });

    // 第二次應被拒絕
    const second = await app.inject({
      method: "GET",
      url: `/data-evidence-report/download?ticket=${ticket}`,
    });
    expect(second.statusCode).toBe(403);
  });

  it("GET /data-evidence-report/download?ticket= 傳入無效 ticket 回傳 403", async () => {
    const app = Fastify({ logger: false });
    await app.register(dataEvidenceReportRoute, {});

    const response = await app.inject({
      method: "GET",
      url: "/data-evidence-report/download?ticket=invalid-ticket-id",
    });
    expect(response.statusCode).toBe(403);
  });

  it("GET /data-evidence-report/download 無 ticket 仍可透過舊有路徑下載（向下相容）", async () => {
    const reportsDir = await mkdtemp(
      path.join(os.tmpdir(), "compat-download-"),
    );
    const reportPath = path.join(reportsDir, "2026-10-28-data-evidence.json");
    await writeFile(
      reportPath,
      JSON.stringify({ reportType: "data-evidence", items: [] }),
    );

    const app = Fastify({ logger: false });
    await app.register(dataEvidenceReportRoute, { reportsDir });

    const response = await app.inject({
      method: "GET",
      url: "/data-evidence-report/download",
    });
    // 無 ticket 且無 initData 時，由 initDataGuard 攔截（unit test 中無 guard 所以仍 200）
    // 此處驗證路由本身在 unit scope 仍可下載（guard 在 server.mjs 層）
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-disposition"]).toContain("attachment;");
  });
});
