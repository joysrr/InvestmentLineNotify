import { fetchCentralBankRate, fetchCpiYoY } from "../modules/providers/macroProvider.mjs";

async function test() {
  console.log("🧪 測試宏觀數據 Provider 重構結果...");

  console.log("\n1. 測試央行貼放利率 (CBC HTML Scraping):");
  const rate = await fetchCentralBankRate();
  console.log(JSON.stringify(rate, null, 2));

  console.log("\n2. 測試 CPI 年增率 (DGBAS API):");
  const cpi = await fetchCpiYoY();
  console.log(JSON.stringify(cpi, null, 2));

  if (rate.source === "CBC" && cpi.source === "DGBAS") {
    console.log("\n✅ 驗證成功：資料來源已成功切換至官方管道。");
  } else {
    console.log("\n❌ 驗證失敗：資料來源未正確切換。");
  }
}

test();
