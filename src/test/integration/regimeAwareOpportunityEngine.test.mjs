import { describe, it, expect } from "vitest";
import { SYSTEM_STATES } from "../../modules/strategy/marginStateMachine.mjs";
import { determineRegime } from "../../modules/strategy/regimePolicy.mjs";
import { evaluateCashExposure } from "../../modules/strategy/cashExposureAdvisor.mjs";
import {
  formatLeadingIndicatorTelegramCard,
  evaluateLeadingIndicators,
} from "../../modules/strategy/leadingIndicatorEvaluator.mjs";
import {
  PANIC_RADARS,
  CRISIS_ACCUMULATE_BATCH_RATIO,
  CRISIS_ACCUMULATE_MAX_BATCH,
} from "../../modules/strategy/strategyDefaults.mjs";

describe("Phase 5: Regime-Aware Opportunity Engine 端到端整合驗收", () => {
  const config = {
    vixOverrideTrigger: 28,
    vixAbsoluteOverride: 35,
    regimeProfiles: {
      NORMAL: { leverageMultiplier: 1.0, mode: "normal" },
      CAUTIOUS: { leverageMultiplier: 0.5, mode: "reduced" },
      CRISIS: { leverageMultiplier: 0.0, mode: "sell_only" },
    },
  };

  describe("5.1 附錄 A 實例驗收（2026-11-04 暴跌情境）", () => {
    const portfolio20261104 = {
      cash: 600000,
      totalDebt: 0,
      totalValue: 2449778,
      stock0050Value: 1798768,
      stock00675LValue: 51010,
    };

    it("無借款帳戶遇 VIX=41.18 暴跌時，正確判定為 OPPORTUNITY 模式與 crisis_accumulate", () => {
      const debtMode =
        portfolio20261104.totalDebt === 0 ? "OPPORTUNITY" : "DEFENSE";
      const regime = determineRegime(41.18, "BEAR", config, debtMode);

      expect(regime.state).toBe("CRISIS");
      expect(regime.mode).toBe("crisis_accumulate");
      expect(regime.leverageMultiplier).toBe(0);
      expect(regime.reason).toContain("無借款帳戶");
      expect(regime.reason).toContain("恐慌加碼視窗");
    });

    it("現金曝險分析正確計算動態加碼上限並輸出三層資訊", () => {
      const grossExposure =
        portfolio20261104.stock0050Value +
        portfolio20261104.stock00675LValue * 2; // 1,900,788
      const accountNetAsset = portfolio20261104.totalValue; // 2,449,778
      const targetLeverage = 1.2; // Phase 7: 改用 portfolio.targetLeverage
      const targetExposure = accountNetAsset * targetLeverage; // 2,939,733.6
      const exposureGap = targetExposure - grossExposure; // 1,038,945.6

      const exposure = evaluateCashExposure({
        cash: portfolio20261104.cash,
        grossExposure,
        accountNetAsset,
        totalDebt: portfolio20261104.totalDebt,
        radarTriggered: ["extremePanic", "retailSentiment"],
        portfolio: { targetLeverage: 1.2 },
        strategy: { allocation: [{ minScore: -99, leverage: 0.15 }] },
        lifecycleContext: { profile: { maxLeverageForNewZ2: 1.5 } },
        marketScore: 4,
      });

      expect(exposure.status).toBe("CRISIS_ACCUMULATE");
      // Phase 7 動態批次計算：
      // 曝險缺口 = 2,939,733.6 - 1,900,788 = 1,038,945.6
      // 資本缺口 = 519,472.8
      // 均攤批次 = 51,947
      // 現金 10% = 60,000
      // batchLimit = min(51,947, 60,000, 519,472) = 51,000（千元取整）
      expect(exposure.suggestedDcaAmt).toBe(51000);
      expect(exposure.batchLimit).toBe(51000);
      expect(exposure.exposureGap).toBeCloseTo(exposureGap, 1);

      // 驗收三層資訊
      expect(exposure.message).toContain("⚡ 恐慌加碼模式");
      expect(exposure.message).toContain("51,000");

      expect(exposure.batchRationale).toContain("批次上限");
      expect(exposure.batchRationale).toContain("10%");

      expect(exposure.disclaimer).toContain("P0 DCA 維持不變");
      expect(exposure.disclaimer).toContain("複利損耗");
    });

    it("Telegram 卡片模板產生器輸出符合計畫書 §6.1 規格", () => {
      const card = formatLeadingIndicatorTelegramCard({
        state: SYSTEM_STATES.TRIGGERED,
        triggeredRadars: [
          { radarId: "EXTREME_PANIC" },
          { radarId: "RETAIL_SENTIMENT" },
        ],
        personalBreaker: { breakerTriggered: false },
        constraints: { freeze00675L: false, allowLeft0050: true },
        cashExposureAnalysis: {
          status: "CRISIS_ACCUMULATE",
          suggestedDcaAmt: 50000,
          exposureGap: 500000,
          targetLeverage: 1.2,
          currentLeverage: 0.78,
        },
      });

      expect(card).toContain("🚨【極端雷達矩陣警報】");
      expect(card).toContain(
        "🛡 行動紀律：00675L 限速加碼 | 0050 啟動左側布局 | P0 定期定額正常執行",
      );
      expect(card).toContain("建議：本批加碼 00675L 上限 $50,000 TWD");
      expect(card).toContain("📱 細節：Mini App → 雷達監控 → 槓桿與批次計算");
    });

    it("整合領先指標評估器端到端產出 Telegram 警報卡片", () => {
      const marketData = {
        vix: 41.18,
        price0050: 178,
        z2Ratio: 2.0,
        kellyConservative: 1.2,
        extremePanicTriggered: true,
        bias60: -0.15,
        retailSentimentDataStatus: "VERIFIED",
        rsr: -35,
      };

      const portfolio = {
        ...portfolio20261104,
        accountNetAsset: portfolio20261104.totalValue,
        currentExposure:
          portfolio20261104.stock0050Value +
          portfolio20261104.stock00675LValue * 2,
      };

      const result = evaluateLeadingIndicators({
        marketData,
        portfolio,
        options: {
          rNight: null,
          nightDataStatus: "UNAVAILABLE",
          overnightShockTriggered: false,
          marginSettlingTriggered: false,
        },
      });

      expect(result.cashExposureAnalysis.status).toBe("CRISIS_ACCUMULATE");
      // Phase 7 動態批次計算：
      // 目標曝險 = 2,449,778 × 1.5 = 3,674,667
      // 曝險缺口 = 3,674,667 - 1,900,788 = 1,773,879
      // 資本缺口 = 1,773,879 / 2 = 886,940
      // 均攤批次 = 886,940 / 10 = 88,694
      // 現金 10% = 600,000 × 0.1 = 60,000（限制因子）
      // batchLimit = min(88,694, 60,000, 886,940) = 60,000
      expect(result.cashExposureAnalysis.suggestedDcaAmt).toBe(60000);
      expect(result.telegramCard).toBeDefined();
      expect(result.telegramCard).toContain(
        "建議：本批加碼 00675L 上限 $60,000 TWD",
      );
      expect(result.telegramCard).toContain("📱 細節：Mini App");
      expect(result.telegramCard).not.toContain("恐慌加碼視窗");
      expect(result.telegramCard).not.toContain("複利耗損");
    });

    it("5.4 實戰決策鏈穿透：2026-11-09 恐慌場景（totalDebt=0, VIX=43.8）決策鏈不被 entryGate 阻斷", async () => {
      const { createDefaultDecisionChain, runDecisionChain } =
        await import("../../modules/strategy/decision/chain.mjs");
      const { createMockCtx, createMockStrategy } =
        await import("../utils/mockFactory.mjs");

      const ctx = createMockCtx({
        vix: 43.8,
        priceDropPercent: 0,
        rsi: 65,
        totalDebt: 0,
        portfolio: {
          totalLoan: 0,
          totalDebt: 0,
          cash: 600000,
          totalValue: 2449778,
          stock0050Value: 1798768,
          stock00675LValue: 51010,
        },
      });

      const strategy = createMockStrategy({
        buy: {
          entryGate: { enabled: true },
        },
        regime: {
          vixOverrideTrigger: 28,
          vixAbsoluteOverride: 35,
          regimeProfiles: {
            CRISIS: { leverageMultiplier: 0, mode: "sell_only" },
          },
        },
      });

      const chain = await createDefaultDecisionChain();
      const result = await runDecisionChain(
        ctx,
        strategy,
        { currentGrossLeverage: 0.804 },
        0.05,
        chain,
      );

      // 驗證核心修復目標：
      // 1. EntryGateRule 穿透：target 不被攔截為「🚧 槓桿封鎖」
      expect(result.target).not.toBe("🚧 槓桿封鎖");
      // 2. Regime 正確設置為 CRISIS 且模式為 crisis_accumulate
      expect(result.regimeState).toBe("CRISIS");
      expect(result.regimeResult?.mode).toBe("crisis_accumulate");
      // 3. 放行後決策鏈正常流轉（非 null，正常產出決策結果）
      expect(result.marketStatus).toBeDefined();
    });
  });

  describe("5.2 對照組：有借款帳戶（DEFENSE 模式）安全防線驗收", () => {
    const portfolioWithDebt = {
      cash: 600000,
      totalDebt: 500000, // 有融資或增貸借款
      totalValue: 2449778,
    };

    it("有借款帳戶遇 VIX=41.18 暴跌時，維持 DEFENSE 模式與 sell_only", () => {
      const debtMode =
        portfolioWithDebt.totalDebt === 0 ? "OPPORTUNITY" : "DEFENSE";
      const regime = determineRegime(41.18, "BEAR", config, debtMode);

      expect(regime.state).toBe("CRISIS");
      expect(regime.mode).toBe("sell_only");
      expect(regime.leverageMultiplier).toBe(0);
    });

    it("有借款帳戶遇恐慌雷達觸發時，cashExposureAdvisor 回傳 DEFER 拒絕加碼", () => {
      const exposure = evaluateCashExposure({
        cash: portfolioWithDebt.cash,
        grossExposure: 1800000,
        accountNetAsset: portfolioWithDebt.totalValue,
        kellyConservative: 1.2,
        totalDebt: portfolioWithDebt.totalDebt,
        radarTriggered: ["extremePanic"],
      });

      expect(exposure.status).toBe("DEFER");
      expect(exposure.suggestedDcaAmt).toBe(0);
      expect(exposure.message).toContain("暫緩加速");
    });
  });

  describe("5.3 邊界案例：恐慌＋基本面同時觸發時安全防禦優先", () => {
    it("無借款帳戶即使遇恐慌，若同時觸發基本面/流動性雷達，依然回傳 DEFER", () => {
      const exposure = evaluateCashExposure({
        cash: 600000,
        grossExposure: 1800000,
        accountNetAsset: 2449778,
        kellyConservative: 1.2,
        totalDebt: 0,
        radarTriggered: ["marginSettling", "extremePanic"],
      });

      expect(exposure.status).toBe("DEFER");
      expect(exposure.suggestedDcaAmt).toBe(0);
      expect(exposure.reason).toBe("fundamental_radars_triggered");
    });
  });
});
