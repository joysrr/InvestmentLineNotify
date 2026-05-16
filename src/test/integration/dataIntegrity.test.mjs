import { describe, it, expect, beforeAll } from "vitest";
import { buildDailyRunContext } from "../../domain/dailyRunContext.mjs";
import { buildSignalContext } from "../../domain/signalContext.mjs";
import logger from "../../utils/logger.mjs";

// 關閉測試時的日誌干擾
logger.level = "silent";

describe("🔍 資料抓取與整合完整性測試 (Data Integrity Test)", () => {
  let context = null;
  let signalContext = null;

  beforeAll(async () => {
    // 模擬真實環境參數，但不發送 Telegram 與 AI
    const options = {
      isCallAI: false,
      isTelegramEnabled: false,
      forceNotify: true,
      minCount: 60, // 驗證我們新設定的 60 筆門檻
    };

    console.log("📡 正在從網路抓取即時數據進行整合測試（這可能需要幾秒鐘）...");
    context = await buildDailyRunContext(options);
    signalContext = buildSignalContext(context);
  }, 45000); // 給予 45 秒寬限期抓取網路資料

  it("✅ 歷史資料筆數應符合門檻 (minCount=60)", () => {
    expect(context.historyZ2.length).toBeGreaterThanOrEqual(60);
    expect(context.history0050.length).toBeGreaterThanOrEqual(60);
    console.log(`   - 00675L 歷史資料筆數: ${context.historyZ2.length}`);
    console.log(`   - 0050 歷史資料筆數: ${context.history0050.length}`);
  });

  it("✅ 即時價/收盤價 Fallback 邏輯應運作正常", () => {
    // 確保最終價格不是 null 或 NaN
    expect(signalContext.finalPriceZ2).toBeDefined();
    expect(Number.isFinite(signalContext.finalPriceZ2)).toBe(true);
    expect(signalContext.finalPriceZ2).toBeGreaterThan(0);
    console.log(`   - 最終採用價格 (Z2): ${signalContext.finalPriceZ2}`);
  });

  it("✅ 技術指標計算不應崩潰 (含 MA240 Fallback)", () => {
    const { indicatorsZ2 } = signalContext;
    expect(indicatorsZ2.rsiArr.length).toBeGreaterThan(0);
    expect(indicatorsZ2.ma20Arr.length).toBeGreaterThan(0);

    // 特別驗證 MA240 是否有成功 Fallback 而非傳回 null
    expect(indicatorsZ2.ma240).not.toBeNull();
    expect(Number.isFinite(indicatorsZ2.ma240)).toBe(true);
    console.log(`   - MA240 (Fallback): ${indicatorsZ2.ma240}`);
  });

  it("✅ 帳戶快照試算欄位應齊全 (解決通知 N/A 問題)", () => {
    const { signalData } = signalContext;

    // 驗證關鍵數據是否存在
    expect(signalData.actualLeverage).toBeDefined();
    expect(signalData.maintenanceMargin).toBeDefined();
    expect(signalData.netAsset).toBeGreaterThan(0);

    // 若有借款，維持率應 > 0；若無借款，則應為 0
    if (signalData.totalLoan > 0) {
      expect(signalData.maintenanceMargin).toBeGreaterThan(0);
    }

    console.log(`   - 試算槓桿: ${signalData.actualLeverage.toFixed(2)}x`);
    console.log(`   - 試算維持率: ${signalData.maintenanceMargin.toFixed(1)}%`);
    console.log(
      `   - 試算可跌空間: ${signalData.dropLimit ? signalData.dropLimit.toFixed(1) + "%" : "N/A"}`,
    );
  });

  it("✅ 大盤 PB/PE 估值資料應存在", () => {
    const { signalData } = signalContext;
    expect(signalData.pbRecords.length).toBeGreaterThan(0);
    // 驗證 rawValuation 是否有抓到今日或最新的 PB
    expect(signalData.rawValuation.pb).toBeDefined();
    expect(Number.isFinite(signalData.rawValuation.pb)).toBe(true);
    console.log(`   - 當前大盤 PB: ${signalData.rawValuation.pb}`);
  });
});
