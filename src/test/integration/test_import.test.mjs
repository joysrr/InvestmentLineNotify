import backtestScheduler from "../../modules/backtest/backtestScheduler.mjs";

describe("Import test", () => {
  it("should import successfully", () => {
    expect(backtestScheduler).toBeDefined();
  });
});
