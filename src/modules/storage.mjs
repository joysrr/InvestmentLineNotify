import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { TwDate, parseNumber } from "../utils/coreUtils.mjs";
import { archiveManager } from "./data/archiveManager.mjs";
import logger from "../utils/logger.mjs";
import { withRetry } from "../utils/retryUtils.mjs";

// 1. 取得並處理私鑰 (自動修復各種常見格式錯誤)
let privateKey = process.env.GOOGLE_PRIVATE_KEY || "";
privateKey = privateKey.replace(/^["']|["']$/g, "");
privateKey = privateKey.replace(/\\n/g, "\n");

// 若金鑰被壓縮成單行 (無換行符號)，嘗試修復
if (privateKey.includes("BEGIN PRIVATE KEY") && !privateKey.includes("\n")) {
  privateKey = privateKey
    .replace("-----BEGIN PRIVATE KEY-----", "-----BEGIN PRIVATE KEY-----\n")
    .replace("-----END PRIVATE KEY-----", "\n-----END PRIVATE KEY-----");
  const parts = privateKey.split("\n");
  if (parts.length === 3) {
    // 將金鑰本體內的空格還原為換行
    const payload = parts[1].replace(/\s+/g, "\n");
    privateKey = `${parts[0]}\n${payload}\n${parts[2]}`;
  }
}

// 2. 初始化驗證
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

async function getSheetDoc() {
  const doc = new GoogleSpreadsheet(
    process.env.GOOGLE_SHEET_ID,
    serviceAccountAuth,
  );
  await doc.loadInfo();
  return doc;
}

/**
 * 驗證日期字串格式是否合理 (YYYY-MM-DD 或 YYYY/MM/DD)
 * @param {string} str
 * @returns {boolean}
 */
function isValidDateStr(str) {
  if (!str || typeof str !== "string") return false;
  return /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(str.trim());
}

/**
 * 讀取「資產紀錄」（第一張表）的最後一筆有效紀錄
 * 用途：獲取你手動更新的最新持股狀態
 *
 * lastBuyDate 雙來源容錯邏輯：
 *   1. Sheet 讀到合理值 → 備份至 last_buy.json，回傳 Sheet 值
 *   2. Sheet 值異常 / 空白 → fallback 至 last_buy.json
 *   3. 兩者均無可用 → 回傳 null，輸出警告
 *
 * avgCost0050 / avgCostZ2 容錯邏輯：
 *   - 欄位有值 → 回傳數字
 *   - 欄位空白或非數字 → 回傳 null（不影響流程，Coach 會顯示「未設均價」）
 */
export async function fetchLastPortfolioState() {
  try {
    return await withRetry(
      async () => {
        const doc = await getSheetDoc();
        const sheet = doc.sheetsByIndex[0];
        const rows = await sheet.getRows();

        if (rows.length === 0) {
          logger.info("⚠️ 資產紀錄表為空，將使用預設值");
          return null;
        }

        // 倒序尋找最後一筆有日期的紀錄，同時記錄最後一筆「主動交易」為「是」的紀錄
        let lastRow = null;
        let lastBuyRow = null;
        for (let i = rows.length - 1; i >= 0; i--) {
          const dateCell = rows[i].get("日期");
          if (dateCell && dateCell.trim() !== "") {
            if (!lastRow) {
              lastRow = rows[i];
            }
            if (
              rows[i].get("主動交易") &&
              rows[i].get("主動交易").trim() === "是"
            ) {
              lastBuyRow = rows[i];
            }
            if (lastRow != null && lastBuyRow != null) {
              break;
            }
          }
        }

        if (!lastRow) {
          logger.info("⚠️ 找不到有效持股紀錄，將使用預設值");
          return null;
        }

        logger.info(
          `✅ 讀取持股來源：[${sheet.title}] 日期：${lastRow.get("日期")}`,
        );

        // ── lastBuyDate 雙來源容錯 ──────────────────────────────────────────────
        const sheetLastBuyDate = lastBuyRow ? lastBuyRow.get("日期") : null;
        let resolvedLastBuyDate = null;

        if (isValidDateStr(sheetLastBuyDate)) {
          // Sheet 讀到合理值 → 更新本地備份
          resolvedLastBuyDate = sheetLastBuyDate;
          await archiveManager.saveLastBuyDate(sheetLastBuyDate);
        } else {
          // Sheet 值異常 → fallback 至本地備份
          const localDate = await archiveManager.getLastBuyDate();
          if (localDate) {
            logger.warn(
              `⚠️ [Storage] lastBuyDate Sheet 值異常 ("${sheetLastBuyDate}")` +
                `，使用本地備份：${localDate}`,
            );
            resolvedLastBuyDate = localDate;
          } else {
            logger.warn(
              `⚠️ [Storage] lastBuyDate 無可用來源（Sheet 异常且無本地備份），冷卻期將以無歷史購入處理`,
            );
          }
        }
        // ──────────────────────────────────────────────────────────────────────────────

        const parsedLoan = parseNumber(lastRow.get("借貸總額"));
        const parsedCash = parseNumber(lastRow.get("現金儲備"));

        return {
          date: lastRow.get("日期"),
          lastBuyDate: resolvedLastBuyDate,
          qty0050: parseNumber(lastRow.get("0050 股數")) || 0,
          qtyZ2: parseNumber(lastRow.get("00675L 股數")) || 0,
          totalLoan: parsedLoan || 0,
          cash: parsedCash ?? (parseNumber(process.env.CASH_RESERVE) || 0),
          // 持倉均價（手動維護欄位，空白時為 null，不影響主流程）
          avgCost0050: parseNumber(lastRow.get("0050 均價")),
          avgCostZ2: parseNumber(lastRow.get("00675L 均價")),
        };
      },
      {
        operationName: "fetchLastPortfolioState",
        maxRetries: 3,
        baseDelay: 1000,
        onRetry: (attempt, error, delayMs) => {
          logger.warn(
            `[Storage] fetchLastPortfolioState 失敗 (嘗試 ${attempt}/3)，` +
              `等待 ${Math.round(delayMs)}ms 後重試：${error.message}`,
          );
        },
      },
    );
  } catch (err) {
    logger.error("❌ 讀取持股失敗（已重試 3 次）:", err);
    return null;
  }
}

/**
 * 將每日戰報寫入到「通知紀錄」工作表
 * 如果工作表不存在，會自動建立
 */
export async function logDailyToSheet(data) {
  try {
    await withRetry(
      async () => {
        const doc = await getSheetDoc();
        const targetSheetTitle = "通知紀錄";

        let sheet = doc.sheetsByTitle[targetSheetTitle];

        if (!sheet) {
          logger.info(`🆕 發現新需求，正在建立 [${targetSheetTitle}] 分頁...`);
          sheet = await doc.addSheet({ title: targetSheetTitle });
          await sheet.setHeaderRow([
            "日期",
            "0050 股數",
            "00675L 股數",
            "0050 市値",
            "00675L 市値",
            "借貸總額",
            "現金儲備",
            "維持率（%）",
            "總淨資產",
            "正 2 占總資產比例",
            "正 2 應賣出金額",
            "備註",
          ]);
        }

        const rows = await sheet.getRows();
        const dateStr = TwDate().formatDateKey().replace(/-/g, "/");

        const val0050 = Math.round(data.portfolio.qty0050 * data.price0050);
        const valZ2 = Math.round(data.portfolio.qtyZ2 * data.currentPrice);
        const loan = data.portfolio.totalLoan || 0;
        const cash = data.portfolio.cash || 0;
        const netAsset = val0050 + valZ2 - loan + cash;

        let marginStr = "無借貸";
        if (loan > 0) {
          marginStr = data.maintenanceMargin.toFixed(2) + "%";
        }

        let sellAmount = 0;
        if (data.z2Ratio > 42) {
          const targetZ2Value = netAsset * 0.4;
          sellAmount = Math.round(valZ2 - targetZ2Value);
        }

        const rowData = {
          日期: dateStr,
          "0050 股數": data.portfolio.qty0050,
          "00675L 股數": data.portfolio.qtyZ2,
          "0050 市値": val0050,
          "00675L 市値": valZ2,
          借貸總額: loan === 0 ? "無借貸" : loan,
          現金儲備: cash,
          "維持率（%）": marginStr,
          總淨資產: netAsset,
          "正 2 占總資產比例": (data.z2Ratio / 100).toFixed(3),
          "正 2 應賣出金額": sellAmount,
          備註: data.suggestion,
        };

        const lastRow = rows[rows.length - 1];

        if (lastRow && lastRow.get("日期") === dateStr) {
          logger.info(`🔄 [${targetSheetTitle}] 今天已有資料，執行更新...`);
          lastRow.assign(rowData);
          await lastRow.save();
        } else {
          logger.info(`📝 [${targetSheetTitle}] 新增今日紀錄...`);
          await sheet.addRow(rowData);
        }

        logger.info("✅ 通知紀錄已同步");
      },
      {
        operationName: "logDailyToSheet",
        maxRetries: 3,
        baseDelay: 1000,
        onRetry: (attempt, error, delayMs) => {
          logger.warn(
            `[Storage] logDailyToSheet 失敗 (嘗試 ${attempt}/3)，` +
              `等待 ${Math.round(delayMs)}ms 後重試：${error.message}`,
          );
        },
      },
    );
  } catch (err) {
    logger.error("❌ 寫入通知紀錄失敗（已重試 3 次）:", err);
  }
}
