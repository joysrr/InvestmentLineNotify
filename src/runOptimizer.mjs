import "dotenv/config";
import { runRuleOptimizer } from "./modules/ai/ruleOptimizerAgent.mjs";

async function main() {
  console.log("=".repeat(60));
  console.log("[Optimizer] 🚀 Starting daily blacklist optimization...");
  console.log("=".repeat(60));

  try {
    const result = await runRuleOptimizer();

    const twA = result.tw.accepted.length;
    const twR = result.tw.rejected.length;
    const usA = result.us.accepted.length;
    const usR = result.us.rejected.length;

    console.log("=".repeat(60));
    console.log(`[Optimizer] 🏁 完成`);
    console.log(`            TW — ✅ 通過：${twA}  ❌ 拒絕：${twR}`);
    console.log(`            US — ✅ 通過：${usA}  ❌ 拒絕：${usR}`);

    if (twR > 0 || usR > 0) {
      console.log("[Optimizer] 💡 提示：有規則被拒，請查 data/ai_logs/latest_RuleOptimizer.json 確認原因");
    }
    if (twA + usA === 0) {
      console.log("[Optimizer] ℹ️  本次無新規則寫入，blacklist.json 不變");
    }
    console.log("=".repeat(60));
  } catch (err) {
    console.error("[Optimizer] ❌ 執行失敗（不影響主要新聞流程）:", err.message);
    process.exit(1);
  }
}

main();
