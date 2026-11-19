/**
 * 開發用情境式 Mock 進入點
 * 啟用條件：
 *   1. VITE_USE_MOCK_API === "true"（環境變數/建置注入）；或
 *   2. DEV / test / Playwright 環境下 URL 含 ?mock=<scenario>
 * 生產環境永遠忽略 ?mock=，且不在 production bundle 中執行 mock router。
 */

import { resolveScenario, isMockEnabled, getFixtures } from "./scenarios.js";
import { installMockRouter } from "./mock-router.js";

const IS_DEV = typeof import.meta !== "undefined" && !!import.meta.env.DEV;
const MODE =
  typeof import.meta !== "undefined" ? import.meta.env.MODE || "" : "";
const IS_PRODUCTION = MODE === "production";

export const SCENARIOS = ["rich", "risk", "empty", "error", "weak-network"];

/**
 * 讀取 VITE_USE_MOCK_API（Vite 建置時會注入 import.meta.env）
 * 生產預設為 false，避免意外啟用。
 */
export function readMockEnabled() {
  if (IS_PRODUCTION) return false;
  const raw =
    typeof import.meta !== "undefined"
      ? import.meta.env.VITE_USE_MOCK_API
      : undefined;
  return String(raw).toLowerCase() === "true";
}

/**
 * 解析目前情境，回傳情境名稱或 null
 */
export function currentScenario(url) {
  return resolveScenario(MODE, IS_DEV, url);
}

/**
 * 在瀏覽器/Playwright 中安裝 fetch 攔截器；僅開發/測試呼叫
 * @returns {Function} uninstall
 */
export function installDevMock({ scenario, weakNetwork } = {}) {
  if (IS_PRODUCTION) return () => {};
  const resolved = scenario ?? currentScenario();
  if (!isMockEnabled(readMockEnabled(), resolved)) return () => {};
  return installMockRouter({ scenario: resolved || "rich", weakNetwork });
}

export default {
  SCENARIOS,
  readMockEnabled,
  currentScenario,
  installDevMock,
  getFixtures,
};
