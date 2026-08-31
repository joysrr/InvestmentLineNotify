import { replayFixture } from "./replayRunner.mjs";
import { getInvestmentSignalAsync } from "../strategy/strategyEngine.mjs";

export async function runInterimReplay(reportsDir = "data/reports") {
  return await replayFixture(reportsDir, async (report) => {
    const currentPrice = report.currentPrice;
    const priceChangePercent =
      report.signals?.priceChangePercent ??
      report.replay?.finalDecision?.priceChangePercent ??
      0;

    // 計算 basePrice
    const basePrice =
      report.basePrice ??
      (priceChangePercent !== -100
        ? currentPrice / (1 + priceChangePercent / 100)
        : currentPrice);

    const input = {
      ...report.snapshot,
      ...report.replay?.signalData,
      portfolio: report.portfolio,
      price0050: report.price0050,
      currentPrice,
      basePrice,
      VIX: report.VIX,
      vixData: report.vixData,
    };

    if (!input.portfolio || !input.price0050) {
      return { signal: "NO_DATA", reason: "Missing portfolio or price data" };
    }

    const decisionResult = await getInvestmentSignalAsync(input);
    const decision = decisionResult.signals ?? decisionResult;

    return {
      status: decision.status,
      target: decision.target,
      suggestion: decision.suggestion,
      signalDirection: decision.signalDirection,
      finalScore: decision.finalScore,
      signalType: decision.signalType,
    };
  });
}
