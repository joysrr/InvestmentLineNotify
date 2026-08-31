#!/usr/bin/env node
import { runInterimReplay } from "../src/modules/replay/interimReplay.mjs";

async function main() {
  console.log(
    "🔍 開始執行 Interim Production Replay 比對 (基於現有真實報告)...",
  );
  const results = await runInterimReplay("data/reports");

  console.log("\n📊 逐日比對結果：");
  console.log("--------------------------------------------------");
  for (const item of results) {
    const statusIcon = item.matches ? "✅ MATCH" : "❌ MISMATCH";
    console.log(`[${item.date}] ${statusIcon}`);
    console.log(`  - Data As Of: ${JSON.stringify(item.dataAsOf)}`);
    console.log(`  - Strategy Hash: ${item.strategyHash}`);
    console.log(
      `  - Expected Signal: ${item.expectedDecision?.target ?? item.expectedDecision?.status}`,
    );
    console.log(
      `  - Replay Signal:   ${item.replayDecision?.target ?? item.replayDecision?.status}`,
    );
  }
  console.log("--------------------------------------------------");
  console.log(`🎯 Overall Result Hash: ${results.resultHash}`);
  console.log(
    `📈 成功比對筆數: ${results.filter((r) => r.matches).length} / ${results.length}`,
  );
}

main().catch((err) => {
  console.error("❌ Replay 執行失敗:", err);
  process.exit(1);
});
