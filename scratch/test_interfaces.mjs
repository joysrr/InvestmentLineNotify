import { fetchAllMacroData } from "./src/modules/providers/marketData.mjs";
import { archiveManager } from "./src/modules/data/archiveManager.mjs";

async function test() {
  console.log("🧪 測試新資料接口抓取...");
  try {
    const data = await fetchAllMacroData();
    console.log("✅ 抓取成功！結果快照：");
    console.log("- rawInstitutional (0050):", data.rawInstitutional ? "OK" : "MISSING");
    console.log("- rawStockMargin (00675L):", data.rawStockMargin ? "OK" : "MISSING");
    console.log("- rawBankRate:", data.rawBankRate ? `Value: ${data.rawBankRate.value}%` : "MISSING");
    console.log("- rawCpi:", data.rawCpi ? `Value: ${data.rawCpi.value}%` : "MISSING");
    
    // 檢查檔案內容
    const latest = await archiveManager.getLatestMarketData();
    console.log("\n📂 data/market/latest.json 檢查:");
    console.log("- Sources in Meta:", Object.keys(latest._meta.sources).filter(k => 
      ['stockInstitutionalTwse', 'stockMarginTwse', 'twCentralBankRate', 'twCpiYoY'].includes(k)
    ));
  } catch (err) {
    console.error("❌ 測試失敗:", err);
  }
}

test();
