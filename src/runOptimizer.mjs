import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { runRuleOptimizer } from "./modules/ai/ruleOptimizerAgent.mjs";
import { langfuse } from "./modules/ai/aiClient.mjs";
import { broadcastOptimizerResult } from "./modules/notifications/notifier.mjs";

const BLACKLIST_PATH = join(process.cwd(), "data", "config", "blacklist.json");

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

    // 讀取 blacklist 總規則數，供通知顯示
    let totalRuleCount = null;
    try {
      if (existsSync(BLACKLIST_PATH)) {
        const bl = JSON.parse(readFileSync(BLACKLIST_PATH, "utf-8"));
        totalRuleCount = bl.titleBlackListPatterns?.length ?? null;
      }
    } catch (e) {
      console.warn("[Optimizer] ⚠️  讀取 blacklist 總數失敗:", e.message);
    }

    // 發送靜默通知至 Log 頻道（失敗不中斷主流程）
    await broadcastOptimizerResult(result, totalRuleCount).catch((err) =>
      console.warn("[Optimizer] ⚠️  通知發送失敗（不影響主流程）:", err.message)
    );

  } catch (err) {
    console.error("[Optimizer] ❌ 執行失敗（不影響主要新聞流程）:", err.message);
    process.exit(1);
  } finally {
    console.log("🚀 optimizer 執行結束");
    // 確保 Langfuse 正確關閉，避免資源洩漏
    console.log("🔒 正在關閉 Langfuse...");
    langfuse.shutdownAsync().catch((e) => {
      console.warn("⚠️ Langfuse 關閉失敗:", e.message);
    });
    console.log("✅ Langfuse 已關閉");
  }
}

main();
