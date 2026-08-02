/**
 * 手動執行 Optimizer Rollback
 * 用法：node src/scripts/rollbackOptimizer.mjs <date> [region]
 * 範例：node src/scripts/rollbackOptimizer.mjs 2026-04-25 TW
 *        node src/scripts/rollbackOptimizer.mjs 2026-04-25 ALL
 */
import logger from "../../utils/logger.mjs";
import { rollbackOptimizerRules } from "../modules/ai/ruleOptimizerAgent.mjs";

const [, , date, region = "ALL"] = process.argv;

if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
  logger.error(
    "❌ 用法：node src/scripts/rollbackOptimizer.mjs <YYYY-MM-DD> [TW|US|ALL]",
  );
  process.exit(1);
}

try {
  const result = rollbackOptimizerRules(date, region);
  if (result.removed === 0) {
    logger.warn(
      "⚠️ 無規則被移除，請確認日期、region 是否正確，或是否已執行過 rollback",
    );
    process.exit(1);
  }
  process.exit(0);
} catch (err) {
  logger.error({ error: err.message }, `❌ Rollback 執行失敗：${err.message}`);
  process.exit(1);
}
