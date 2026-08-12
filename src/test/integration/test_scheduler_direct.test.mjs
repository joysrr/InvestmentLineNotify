import { describe, it, expect } from "vitest";
import backtestScheduler from "../../modules/backtest/backtestScheduler.ts";

describe("Direct scheduler import test", () => {
  it("should import scheduler", () => {
    expect(backtestScheduler).toBeDefined();
    expect(typeof backtestScheduler.createSchedule).toBe("function");
  });
});
