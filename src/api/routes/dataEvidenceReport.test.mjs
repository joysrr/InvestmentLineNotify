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
});
