// src/dailyCheck.mjs
// ── 向後相容轉接層 ──────────────────────────────────────────────────────────
// 原始邏輯已完全遷移至 src/scheduler/dailyCheck.mjs（runDailyCheck）。
// 保留此檔案與 `dailyCheck` 具名匯出，確保任何現存引用不需修改。
//
// 參數轉換：
//   舊：dailyCheck({ isTelegramEnabled, isAIAdvisor, isCallAI })
//   新：runDailyCheck(deps={}, options={ isTelegramEnabled, isAIAdvisor, isCallAI })
import { runDailyCheck } from "./scheduler/dailyCheck.mjs";

export function dailyCheck(options = {}) {
  return runDailyCheck({}, options);
}
