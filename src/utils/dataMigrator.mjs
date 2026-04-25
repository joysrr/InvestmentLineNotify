import { readFile, writeFile, readdir } from "fs/promises";
import { resolve, join } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const REPORTS_DIR = resolve(__dirname, "../../data/reports");

/**
 * 歷史資料適配器：將舊版報告結構升級至 2.0 嵌套結構
 */
export async function migrateReports() {
  try {
    const files = (await readdir(REPORTS_DIR)).filter((f) =>
      f.endsWith(".json"),
    );
    console.log(`🔍 發現 ${files.length} 份報告，開始檢查結構...`);

    let migratedCount = 0;

    for (const file of files) {
      const path = join(REPORTS_DIR, file);
      const content = JSON.parse(await readFile(path, "utf-8"));
      let changed = false;

      // 1. 遷移：將頂層信號移動到 signals 內部 (如果尚未移動)
      if (content.marketStatus && !content.signals) {
        content.signals = {
          marketStatus: content.marketStatus,
          target: content.target,
          weightScore: content.weightScore,
          targetSuggestion: content.targetSuggestion,
          priceChangePercent: content.priceChangePercent,
          valuationGuardResult: content.valuationGuardResult || {},
        };
        // 刪除舊欄位
        delete content.marketStatus;
        delete content.target;
        delete content.weightScore;
        changed = true;
      }

      if (changed) {
        await writeFile(path, JSON.stringify(content, null, 2));
        migratedCount++;
      }
    }

    console.log(`✅ 遷移完成！共更新 ${migratedCount} 份報告。`);
  } catch (err) {
    console.error(`❌ 遷移失敗: ${err.message}`);
  }
}

if (process.argv.includes("--run")) {
  migrateReports();
}
