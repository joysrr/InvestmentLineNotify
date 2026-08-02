import logger from "../../utils/logger.mjs";
import { readFile, writeFile, readdir, mkdir, copyFile } from "fs/promises";
import { resolve, join } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const REPORTS_DIR = resolve(__dirname, "../../data/reports");
const BACKUP_BASE = resolve(__dirname, "../../data/backups");

/**
 * 2.0 安全遷移器
 */
export async function migrate() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = join(BACKUP_BASE, `reports-backup-${timestamp}`);

  try {
    const files = (await readdir(REPORTS_DIR)).filter((f) =>
      f.endsWith(".json"),
    );
    if (files.length === 0) {
      logger.info("📭 無資料需要遷移");
      return;
    }

    logger.info(
      { count: files.length },
      `🛡️ 開始安全遷移：發現 ${files.length} 份報告`,
    );

    // 1. 強制備份
    await mkdir(backupDir, { recursive: true });
    for (const file of files) {
      await copyFile(join(REPORTS_DIR, file), join(backupDir, file));
    }
    logger.info(`✅ 備份完成：${backupDir}`);

    let successCount = 0;

    for (const file of files) {
      const path = join(REPORTS_DIR, file);
      const raw = await readFile(path, "utf-8");
      const content = JSON.parse(raw);

      // 如果已經是 2.0 格式則略過
      if (content.marketState && content.signals?.status) continue;

      const oldContent = { ...content };

      try {
        // --- 核心轉換邏輯 ---

        // A. 市場狀態平移 (全量數字化)
        content.marketState = {
          valuation: {
            pe: Number(oldContent.valuation?.pe || 0),
            pb: Number(oldContent.valuation?.pb || 0),
            pr: Number(
              oldContent.valuation?.currentPR ||
                oldContent.signals?.valuationGuardResult?.currentPR ||
                0,
            ),
            yield: Number(oldContent.valuation?.yield || 0),
          },
          sentiment: {
            vix: Number(oldContent.vix || oldContent.rawUsMarket?.vix || 0),
            fearGreed: Number(
              oldContent.cnnScore || oldContent.rawCnn?.score || 0,
            ),
            isPanic: Number(oldContent.vix || 0) > 30,
          },
          liquidity: {
            marginRatio: Number(oldContent.maintenanceMargin || 0),
            fxRate: Number(oldContent.currentRate || 0),
            institutionalNetBuy: 0,
          },
          economy: {
            ndcScore: Number(oldContent.ndcScore || 0),
            ndcLight: oldContent.ndcLight || "未知",
            cpiYoY: 0,
            bankRate: 0,
          },
        };

        // B. 訊號平移
        content.signals = {
          status: oldContent.marketStatus || "🌱",
          score: Number(oldContent.weightScore || 0),
          target: oldContent.target || "🔹 0050 DCA",
          suggestion:
            oldContent.targetSuggestion || oldContent.suggestion || "",
          weightDetails: oldContent.weightDetails || {},
          priceChangePercent: Number(oldContent.priceChangePercent || 0),
          actualLeverage: Number(oldContent.actualLeverage || 0),
          grossLeverage: Number(oldContent.grossLeverage || 0),
          grossLeverageStatus: oldContent.grossLeverageStatus || "normal",
        };

        // C. 加密 Snapshot 平移 (不改動內容，僅變更位置)
        if (oldContent.snapshot) {
          content.portfolio = {
            encrypted: oldContent.snapshot,
            public_metrics: {
              grossLeverage: Number(oldContent.grossLeverage || 0),
              marginRatio: Number(oldContent.maintenanceMargin || 0),
            },
          };
          delete content.snapshot;
        }

        // D. 策略拷貝
        content.strategySnapshot =
          oldContent.strategy || oldContent.strategySnapshot || {};

        // 寫入檔案
        await writeFile(path, JSON.stringify(content, null, 2));
        successCount++;
      } catch (err) {
        logger.error(
          { file, error: err.message },
          `❌ 檔案 ${file} 轉換失敗，跳過`,
        );
      }
    }

    logger.info(`🎉 遷移大功告成！成功轉換 ${successCount} 份檔案。`);
    logger.info(
      `💡 如果 Mini App 顯示異常，請將 ${backupDir} 內容拷貝回 data/reports/`,
    );
  } catch (err) {
    logger.error({ error: err.message }, `🚨 遷移中斷`);
  }
}

if (process.argv.includes("--run")) {
  migrate();
}
