import { BacktestRunner } from "../src/modules/backtest/backtestRunner.mjs";

class DebugRunner extends BacktestRunner {
  constructor() {
    super({ quiet: false });
  }

  async handleDecision(decision, day) {
    // 只打印一次，印出詳細的分數與攔截原因
    if (day.date === "2025-10-01" || day.date === "2026-03-02") {
      console.log(`\n--- 🕵️ 深度診斷日: ${day.date} ---`);
      console.log(`目前的決策結果: ${decision.target}`);
      console.log(`Market Status: ${decision.marketStatus}`);
      console.log(`最終計分 finalScore: ${decision.finalScore}`);
      console.log(`攔截/建議: ${decision.targetSuggestion}`);

      if (decision.categoryResults) {
        console.log(
          "計分細節:",
          JSON.stringify(decision.categoryResults, null, 2),
        );
      }
    }
    await super.handleDecision(decision, day);
  }
}

async function run() {
  const runner = new DebugRunner();
  await runner.run();
}

run();
