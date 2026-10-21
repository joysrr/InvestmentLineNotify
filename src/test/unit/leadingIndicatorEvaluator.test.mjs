import { describe, expect, it } from "vitest";
import { evaluateLeadingIndicators } from "../../modules/strategy/leadingIndicatorEvaluator.mjs";

describe("leadingIndicatorEvaluator - bias60", () => {
  it("保留不可用的 bias60，不轉成 0", () => {
    const result = evaluateLeadingIndicators({
      marketData: {
        vix: 18,
        taiexReturn: 0,
        bias60: null,
        vixHistory: [],
      },
    });

    expect(result.radars.extremePanic.metrics.bias60).toBeNull();
    expect(result.radars.extremePanic.metrics.isBiasOversold).toBe(false);
  });

  it("保留有效的 bias60 並交給雷達判斷", () => {
    const result = evaluateLeadingIndicators({
      marketData: {
        vix: 18,
        taiexReturn: 0,
        bias60: -0.13,
        vixHistory: [],
      },
    });

    expect(result.radars.extremePanic.metrics.bias60).toBe(-0.13);
    expect(result.radars.extremePanic.metrics.isBiasOversold).toBe(true);
  });
});
