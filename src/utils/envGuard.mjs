import logger from "./logger.mjs";

/**
 * envGuard.mjs
 * 啟動時檢查必要環境變數，缺少時立即 fail 並列出缺少清單。
 *
 * 新增必填變數 SOP：
 *   1. 在 GitHub Secrets 新增
 *   2. 在對應 yaml 的 env: 區塊加入
 *   3. 在下方 REQUIRED_VARS 陣列加入
 *   4. 更新 docs/env-vars.md
 */

/** 必填環境變數清單（缺少任一個將造成程式終止） */
const REQUIRED_VARS = [
  // Google Sheets
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "GOOGLE_PRIVATE_KEY",
  "GOOGLE_SHEET_ID",
  // Telegram
  "TELEGRAM_API_TOKEN",
  "TELEGRAM_USER_ID",
  "TELEGRAM_WEBAPP_URL",
  // AI / Gemini
  "GEMINI_API_KEY1",
  "GEMINI_MODEL",
  // 市場資料
  "FRED_API_KEY",
  "BASE_PRICE_URL",
];

/**
 * 檢查必填環境變數。
 * 缺少時列印這些變數名稱并呼叫 process.exit(1)。
 * 同時對「強烈建議設定」的變數發出警告。
 */
export function assertEnv() {
  const missing = REQUIRED_VARS.filter(
    (key) => !process.env[key] || process.env[key].trim() === "",
  );

  if (missing.length > 0) {
    logger.error("\n❌ [envGuard] 程式終止：缺少必要環境變數");
    logger.error(
      "請確認 GitHub Secrets 與 workflow yaml 的 env: 區塊均已設定以下變數：",
    );
    missing.forEach((key) => logger.error(`  • ${key}`));
    logger.error("詳情請參考 docs/env-vars.md\n");
    process.exit(1);
  }

  // ── 強烈建議設定的變數（缺少時 warn，不中斷） ──────────────────────────────
  const RECOMMENDED_VARS = [
    {
      key: "SNAPSHOT_ENCRYPT_KEY",
      reason:
        "帳戶快照將以明文儲存於 daily_report_*.json，財務資料缺乏加密保護",
    },
  ];

  for (const { key, reason } of RECOMMENDED_VARS) {
    if (!process.env[key] || process.env[key].trim() === "") {
      logger.warn(`⚠️ [envGuard] 建議設定 ${key} 但未找到：${reason}`);
    }
  }
}
