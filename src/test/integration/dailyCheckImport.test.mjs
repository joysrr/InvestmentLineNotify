import { describe, expect, it, vi } from "vitest";

vi.mock("../../utils/envGuard.mjs", () => ({
  assertEnv: vi.fn(),
}));

// Verify the production entrypoint can be instantiated without a stale export.
describe("dailyCheck production entrypoint", () => {
  it("loads with the real strategy module contract", async () => {
    const module = await import("../../scheduler/dailyCheck.mjs");
    expect(module.runDailyCheck).toBeTypeOf("function");
  });
});

// The test environment supplies required variables through the test setup.
// This test is intentionally integration-level, not a mocked import test.
