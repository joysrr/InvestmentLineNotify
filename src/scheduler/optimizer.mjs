// src/scheduler/optimizer.mjs
// 優化器核心邏輯
// 提取為獨立函數供 Bot 指令與 CLI 共用

import { fileURLToPath } from "url";
import { join } from "path";
import { readFileSync, existsSync } from "fs";
import { runRuleOptimizer } from "../modules/ai/ruleOptimizerAgent.mjs";
import { langfuse } from "../modules/ai/aiClient.mjs";
import { broadcastOptimizerResult } from "../modules/notifications/notifier.mjs";
import logger from "../utils/logger.mjs";

const BLACKLIST_PATH = join(process.cwd(), "data", "config", "blacklist.json");

/**
 * 優化器核心邏輯
 * @param {Object} deps - 依賴注入物件
 * @param {Object} deps.dataProvider - 符合 IDataProvider 介面
 * @param {Object} deps.aiProvider - 符合 IAIProvider 介面
 * @param {Object} deps.notifier - 符合 INotifier 介面
 * @returns {Promise<Object>} 優化結果
 */
export async function runOptimizer(deps = {}) {
  const { _dataProvider, _aiProvider, _notifier } = deps;

  logger.info("=".repeat(60));
  logger.info("[Optimizer] 🚀 Starting daily blacklist optimization...");
  logger.info("=".repeat(60));

  try {
    const result = await runRuleOptimizer();

    const twA = result.tw.accepted.length;
    const twR = result.tw.rejected.length;
    const usA = result.us.accepted.length;
    const usR = result.us.rejected.length;

    logger.info("=".repeat(60));
    logger.info(`[Optimizer] 🏁 完成`);
    logger.info(`            TW — ✅ 通過：${twA}  ❌ 拒絕：${twR}`);
    logger.info(`            US — ✅ 通過：${usA}  ❌ 拒絕：${usR}`);

    if (twR > 0 || usR > 0) {
      logger.info(
        "[Optimizer] 💡 提示：有規則被拒，請查 data/ai_logs/latest_RuleOptimizer.json 確認原因",
      );
    }
    if (twA + usA === 0) {
      logger.info("[Optimizer] ℹ️  本次無新規則寫入，blacklist.json 不變");
    }
    logger.info("=".repeat(60));

    // 讀取 blacklist 總規則數，供通知顯示
    let totalRuleCount = null;
    try {
      if (existsSync(BLACKLIST_PATH)) {
        const bl = JSON.parse(readFileSync(BLACKLIST_PATH, "utf-8"));
        totalRuleCount = bl.titleBlackListPatterns?.length ?? null;
      }
    } catch (e) {
      logger.warn(e, "[Optimizer] ⚠️  讀取 blacklist 總數失敗");
    }

    // 發送靜默通知至 Log 頻道（失敗不中斷主流程）
    await broadcastOptimizerResult(result, totalRuleCount).catch((err) =>
      logger.warn(err, "[Optimizer] ⚠️  通知發送失敗（不影響主流程）"),
    );

    return result;
  } catch (err) {
    logger.error(err, "[Optimizer] ❌ 執行失敗（不影響主要新聞流程）");
    throw err; // 重新拋出供上層處理
  } finally {
    logger.info("🚀 optimizer 執行結束");
    // 確保 Langfuse 正確關閉，避免資源洩漏
    logger.info("🔒 正在關閉 Langfuse...");
    try {
      await langfuse.shutdownAsync();
      logger.info("✅ Langfuse 已關閉");
    } catch (e) {
      logger.warn(e, "⚠️ Langfuse 關閉失敗");
    }
  }
}

// ── CLI 入口（直接執行此檔案時）──
async function main() {
  try {
    await runOptimizer({});
  } catch (err) {
    logger.error(err, "❌ [Optimizer] 執行失敗");
    process.exit(1);
  } finally {
    logger.info("🚀 optimizer 執行結束");
    logger.info("🔒 正在關閉 Langfuse...");
    try {
      const { langfuse } = await import("../modules/ai/aiClient.mjs");
      await langfuse.shutdownAsync();
      logger.info("✅ Langfuse 已關閉");
    } catch (e) {
      logger.warn(e, "⚠️ Langfuse 關閉失敗");
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}

export { BLACKLIST_PATH };
