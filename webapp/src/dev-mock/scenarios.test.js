import { describe, expect, it } from "vitest";
import {
  getFixtures,
  resolveScenario,
  routeApi,
  SCENARIOS,
} from "./scenarios.js";

describe("dev mock scenarios", () => {
  it("supports the five approved scenarios", () => {
    expect(SCENARIOS).toEqual([
      "rich",
      "risk",
      "empty",
      "error",
      "weak-network",
    ]);
  });

  it("only accepts query overrides in dev/test", () => {
    expect(
      resolveScenario("production", false, "http://localhost/?mock=risk"),
    ).toBeNull();
    expect(
      resolveScenario("development", true, "http://localhost/?mock=risk"),
    ).toBe("risk");
    expect(resolveScenario("test", false, "http://localhost/?mock=empty")).toBe(
      "empty",
    );
    expect(
      resolveScenario("development", true, "http://localhost/?mock=dark"),
    ).toBeNull();
  });

  it("keeps consumer response shapes deterministic", async () => {
    const rich = getFixtures("rich");
    const reports = await routeApi("/api/reports", {}, { scenario: "rich" });
    const snapshots = await routeApi(
      "/api/reports/snapshots",
      {},
      { scenario: "rich" },
    );
    expect(rich.reports.length).toBeGreaterThan(0);
    expect(Array.isArray(await reports.json())).toBe(true);
    expect(Array.isArray(await snapshots.json())).toBe(true);
  });

  it("returns deterministic error status", async () => {
    const response = await routeApi("/api/status", {}, { scenario: "error" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "mock error scenario" });
  });

  it("does not intercept non API paths", async () => {
    const response = await routeApi("/assets/app.js", {}, { scenario: "rich" });
    expect(response.status).toBe(404);
  });

  it("delays weak-network responses deterministically", async () => {
    const started = Date.now();
    const response = await routeApi(
      "/api/status",
      {},
      { scenario: "weak-network", isWeakNetwork: true },
    );
    expect(Date.now() - started).toBeGreaterThanOrEqual(2400);
    expect(response.status).toBe(200);
  });

  it("routes health and preserves response cloning", async () => {
    const response = await routeApi(
      "/api/portfolio/health",
      {},
      { scenario: "rich" },
    );
    const clone = response.clone();
    expect((await response.json()).status).toBeDefined();
    expect((await clone.json()).status).toBeDefined();
  });
});
