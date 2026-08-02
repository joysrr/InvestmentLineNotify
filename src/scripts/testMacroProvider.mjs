import logger from "../../utils/logger.mjs";
import {
  fetchCentralBankRate,
  fetchCpiYoY,
} from "../modules/providers/macroProvider.mjs";

async function test() {
  logger.info("🧪 測試宏觀數據 Provider 重構結果...");

  logger.info("\n1. 測試央行貼放利率 (CBC HTML Scraping):");
  const rate = await fetchCentralBankRate();
  console.log(JSON.stringify(rate, null, 2));

  logger.info("\n2. 測試 CPI 年增率 (DGBAS API):");
  const cpi = await fetchCpiYoY();
  console.log(JSON.stringify(cpi, null, 2));

  if (rate.source === "CBC" && cpi.source === "DGBAS") {
    logger.info("\n✅ 驗證成功：資料來源已成功切換至官方管道。");
  } else {
    logger.error("\n❌ 驗證失敗：資料來源未正確切換。");
  }
}

test();
