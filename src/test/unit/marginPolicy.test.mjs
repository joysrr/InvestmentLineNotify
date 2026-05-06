/**
 * marginPolicy.test.mjs
 *
 * Unit tests for marginPolicy.mjs
 * 測試 analyzeMarginRisk / analyzeSurvival / analyzeCapitalDecoupling
 */

import { describe, it, expect } from "vitest";
import {
  analyzeMarginRisk,
  analyzeSurvival,
  analyzeCapitalDecoupling,
} from "../../modules/strategy/policies/marginPolicy.mjs";

// ─────────────────────────────────────────────────────────────
// 共用測試配置
// ─────────────────────────────────────────────────────────────

const defaultStrategy = {
  maintenance: {
    marginCallThreshold: 135,
    frozenZone: 145,
    protectTrigger: 160,
    protectTarget: 180,
  },
};

const defaultPortfolio = {
  qty0050: 1000,
  totalLoan: 500000,
};

const defaultPrice = 500; // 0050 當前價格

// ─────────────────────────────────────────────────────────────
// analyzeMarginRisk 測試
// ─────────────────────────────────────────────────────────────

describe("marginPolicy - analyzeMarginRisk", () => {
  describe("✅ 正常狀態計算", () => {
    it("應正確計算當前維持率", () => {
      // 抵押品價值 = 1000 * 500 = 500,000
      // 維持率 = (500,000 / 500,000) * 100 = 100%
      const result = analyzeMarginRisk(defaultPortfolio, defaultPrice, defaultStrategy);

      expect(result).toBeDefined();
      expect(result.currentMargin).toBe(100);
      expect(result.qty0050).toBe(1000);
      expect(result.totalLoan).toBe(500000);
    });

    it("應生成壓力測試報告", () => {
      const result = analyzeMarginRisk(defaultPortfolio, defaultPrice, defaultStrategy);

      expect(result.stressTests).toBeDefined();
      expect(result.stressTests.length).toBe(4); // -10%, -20%, -30%, -40%

      const drop10 = result.stressTests.find((s) => s.drop === 10);
      expect(drop10).toBeDefined();
      expect(drop10.status).toBe("🔴 斷頭"); // 100% * 0.9 = 90% < 135%
    });

    it("應計算生存邊際與回補需求", () => {
      const result = analyzeMarginRisk(defaultPortfolio, defaultPrice, defaultStrategy);

      expect(result.riskAssessment).toBeDefined();
      expect(result.riskAssessment.survivalDropLimit).toBeNull(); // 維持率 < 135%，無生存邊際
      expect(result.riskAssessment.refillRequirement).toBeGreaterThan(0); // 需要回補
    });
  });

  describe("🟢 安全狀態（維持率 > protectTrigger）", () => {
    it("維持率 200% 應顯示安全", () => {
      const safePortfolio = {
        qty0050: 2000,
        totalLoan: 500000,
      };
      // 抵押品 = 2000 * 500 = 1,000,000
      // 維持率 = (1,000,000 / 500,000) * 100 = 200%

      const result = analyzeMarginRisk(safePortfolio, defaultPrice, defaultStrategy);

      expect(result.currentMargin).toBe(200);
      expect(result.riskAssessment.refillRequirement).toBe(0); // 不需要回補
    });

    it("壓力測試 -10% 後仍應安全", () => {
      const safePortfolio = {
        qty0050: 2000,
        totalLoan: 500000,
      };

      const result = analyzeMarginRisk(safePortfolio, defaultPrice, defaultStrategy);

      const drop10 = result.stressTests.find((s) => s.drop === 10);
      expect(drop10.margin).toBe("180.0"); // 200% * 0.9 = 180%
      expect(drop10.status).toBe("🟢 安全");
    });
  });

  describe("🟡 預警狀態（160% <= 維持率 < protectTrigger）", () => {
    it("維持率 150% 應顯示預警", () => {
      const warningPortfolio = {
        qty0050: 1500,
        totalLoan: 500000,
      };
      // 抵押品 = 1500 * 500 = 750,000
      // 維持率 = (750,000 / 500,000) * 100 = 150%

      const result = analyzeMarginRisk(warningPortfolio, defaultPrice, defaultStrategy);

      expect(result.currentMargin).toBe(150);
      expect(result.riskAssessment.refillRequirement).toBeGreaterThan(0);
    });
  });

  describe("🟠 追繳狀態（145% <= 維持率 < 160%）", () => {
    it("維持率 148% 應顯示追繳", () => {
      const frozenPortfolio = {
        qty0050: 1480,
        totalLoan: 500000,
      };
      // 維持率 = (1480 * 500 / 500000) * 100 = 148%

      const result = analyzeMarginRisk(frozenPortfolio, defaultPrice, defaultStrategy);

      expect(result.currentMargin).toBe(148);
    });

    it("壓力測試 -10% 後應觸發斷頭", () => {
      const frozenPortfolio = {
        qty0050: 1480,
        totalLoan: 500000,
      };

      const result = analyzeMarginRisk(frozenPortfolio, defaultPrice, defaultStrategy);

      const drop10 = result.stressTests.find((s) => s.drop === 10);
      expect(drop10.margin).toBe("133.2"); // 148% * 0.9 ≈ 133.2%
      expect(drop10.status).toBe("🔴 斷頭");
    });
  });

  describe("🔴 斷頭狀態（維持率 < 135%）", () => {
    it("維持率 130% 應顯示斷頭", () => {
      const dangerPortfolio = {
        qty0050: 1300,
        totalLoan: 500000,
      };
      // 維持率 = (1300 * 500 / 500000) * 100 = 130%

      const result = analyzeMarginRisk(dangerPortfolio, defaultPrice, defaultStrategy);

      expect(result.currentMargin).toBe(130);
      expect(result.riskAssessment.survivalDropLimit).toBeNull(); // 已低於斷頭門檻
    });

    it("壓力測試所有情境都應斷頭", () => {
      const dangerPortfolio = {
        qty0050: 1300,
        totalLoan: 500000,
      };

      const result = analyzeMarginRisk(dangerPortfolio, defaultPrice, defaultStrategy);

      result.stressTests.forEach((st) => {
        expect(st.status).toBe("🔴 斷頭");
      });
    });
  });

  describe("❌ 錯誤處理", () => {
    it("價格為 0 應返回 null", () => {
      const result = analyzeMarginRisk(defaultPortfolio, 0, defaultStrategy);
      expect(result).toBeNull();
    });

    it("價格為負數應返回 null", () => {
      const result = analyzeMarginRisk(defaultPortfolio, -100, defaultStrategy);
      expect(result).toBeNull();
    });

    it("qty0050 為 0 應返回維持率 0", () => {
      const emptyPortfolio = {
        qty0050: 0,
        totalLoan: 500000,
      };

      const result = analyzeMarginRisk(emptyPortfolio, defaultPrice, defaultStrategy);

      expect(result.currentMargin).toBe(0);
    });

    it("totalLoan 為 0 應返回維持率 999", () => {
      const noLoanPortfolio = {
        qty0050: 1000,
        totalLoan: 0,
      };

      const result = analyzeMarginRisk(noLoanPortfolio, defaultPrice, defaultStrategy);

      expect(result.currentMargin).toBe(999);
    });

    it("缺少 strategy 應使用預設配置", () => {
      const result = analyzeMarginRisk(defaultPortfolio, defaultPrice, null);

      expect(result).toBeDefined();
      expect(result.currentMargin).toBe(100);
    });
  });

  describe("🔧 自定義配置", () => {
    it("應使用自定義 marginCallThreshold", () => {
      const customStrategy = {
        maintenance: {
          marginCallThreshold: 140,
          frozenZone: 150,
          protectTrigger: 170,
          protectTarget: 190,
        },
      };

      const result = analyzeMarginRisk(defaultPortfolio, defaultPrice, customStrategy);

      expect(result.riskAssessment.dangerThreshold).toBe(140);
    });

    it("應使用自定義 frozenZone", () => {
      const customStrategy = {
        maintenance: {
          marginCallThreshold: 135,
          frozenZone: 150,
          protectTrigger: 160,
          protectTarget: 180,
        },
      };

      const portfolio = {
        qty0050: 1480,
        totalLoan: 500000,
      };
      // 維持率 = 148%

      const result = analyzeMarginRisk(portfolio, defaultPrice, customStrategy);

      const drop10 = result.stressTests.find((s) => s.drop === 10);
      expect(drop10.margin).toBe("133.2");
      expect(drop10.status).toBe("🔴 斷頭"); // 133.2% < 140% (marginCallThreshold)
    });
  });
});

// ─────────────────────────────────────────────────────────────
// analyzeSurvival 測試
// ─────────────────────────────────────────────────────────────

describe("marginPolicy - analyzeSurvival", () => {
  describe("✅ 存活分析", () => {
    it("應計算當前維持率", () => {
      const result = analyzeSurvival(defaultPortfolio, defaultPrice, defaultStrategy);

      expect(result.currentMargin).toBe(100);
    });

    it("應計算隔日跌停壓力測試", () => {
      const result = analyzeSurvival(defaultPortfolio, defaultPrice, defaultStrategy);

      expect(result.nextDayLimitDownMargin).toBe(90); // 100% * 0.9 = 90%
    });

    it("應判斷是否脆弱（isVulnerable）", () => {
      // 維持率 100% < protectTarget 180% → isVulnerable = true
      const result = analyzeSurvival(defaultPortfolio, defaultPrice, defaultStrategy);

      expect(result.isVulnerable).toBe(true);
    });

    it("高維持率應判斷為不脆弱", () => {
      const safePortfolio = {
        qty0050: 2000,
        totalLoan: 500000,
      };
      // 維持率 = 200%

      const result = analyzeSurvival(safePortfolio, defaultPrice, defaultStrategy);

      expect(result.isVulnerable).toBe(false);
    });
  });

  describe("📊 生存邊際計算", () => {
    it("維持率 > 135% 應計算生存邊際", () => {
      const safePortfolio = {
        qty0050: 2000,
        totalLoan: 500000,
      };
      // 維持率 = 200%

      const result = analyzeSurvival(safePortfolio, defaultPrice, defaultStrategy);

      expect(result.survivalDropLimit).toBeGreaterThan(0);
      // 生存邊際 = ((200 - 135) / 200) * 100 = 32.5%
      expect(result.survivalDropLimit).toBeCloseTo(32.5, 1);
    });

    it("維持率 < 135% 應返回 null", () => {
      const dangerPortfolio = {
        qty0050: 1300,
        totalLoan: 500000,
      };
      // 維持率 = 130%

      const result = analyzeSurvival(dangerPortfolio, defaultPrice, defaultStrategy);

      expect(result.survivalDropLimit).toBeNull();
    });
  });

  describe("💰 回補需求計算", () => {
    it("維持率 < protectTarget 應計算回補需求", () => {
      const result = analyzeSurvival(defaultPortfolio, defaultPrice, defaultStrategy);

      expect(result.refillRequirement).toBeGreaterThan(0);
      // 目標抵押品 = 180% * 500000 = 900000
      // 當前抵押品 = 500000
      // 回補需求 = 900000 - 500000 = 400000
      expect(result.refillRequirement).toBe(400000);
    });

    it("維持率 >= protectTarget 應返回 0", () => {
      const safePortfolio = {
        qty0050: 2000,
        totalLoan: 500000,
      };
      // 維持率 = 200% > 180%

      const result = analyzeSurvival(safePortfolio, defaultPrice, defaultStrategy);

      expect(result.refillRequirement).toBe(0);
    });
  });

  describe("❌ 錯誤處理", () => {
    it("價格為 0 應返回 null", () => {
      const result = analyzeSurvival(defaultPortfolio, 0, defaultStrategy);
      expect(result).toBeNull();
    });

    it("價格為負數應返回 null", () => {
      const result = analyzeSurvival(defaultPortfolio, -100, defaultStrategy);
      expect(result).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// analyzeCapitalDecoupling 測試
// ─────────────────────────────────────────────────────────────

describe("marginPolicy - analyzeCapitalDecoupling", () => {
  describe("✅ 資金解耦分析", () => {
    it("應計算淨資產", () => {
      const portfolio = {
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 500000,
        cash: 100000,
      };

      const prices = {
        price0050: 500,
        priceZ2: 300,
      };

      const result = analyzeCapitalDecoupling(portfolio, prices);

      // 淨資產 = 1000*500 + 500*300 - 500000 + 100000 = 500000 + 150000 - 500000 + 100000 = 250000
      expect(result.netAsset).toBe(250000);
    });

    it("應計算戰術槓桿部位佔比", () => {
      const portfolio = {
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 500000,
        cash: 100000,
      };

      const prices = {
        price0050: 500,
        priceZ2: 300,
      };

      const result = analyzeCapitalDecoupling(portfolio, prices);

      // 戰術部位 = 500 * 300 = 150000
      // 淨資產 = 250000
      // 戰術佔比 = 150000 / 250000 * 100 = 60%
      expect(result.tacticRatio).toBeCloseTo(60, 2);
    });

    it("應計算基礎 DCA 部位佔比", () => {
      const portfolio = {
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 500000,
        cash: 100000,
      };

      const prices = {
        price0050: 500,
        priceZ2: 300,
      };

      const result = analyzeCapitalDecoupling(portfolio, prices);

      // 基礎財富 = 1000*500 - 500000 = 0
      // 基礎佔比 = 0 / 250000 * 100 = 0%
      expect(result.baseRatio).toBeCloseTo(0, 2);
    });
  });

  describe("📊 邊界條件", () => {
    it("無 00675L 部位應返回 tacticRatio = 0", () => {
      const portfolio = {
        qty0050: 1000,
        qtyZ2: 0,
        totalLoan: 500000,
        cash: 100000,
      };

      const prices = {
        price0050: 500,
        priceZ2: 300,
      };

      const result = analyzeCapitalDecoupling(portfolio, prices);

      expect(result.tacticRatio).toBe(0);
    });

    it("無借貸應正確計算", () => {
      const portfolio = {
        qty0050: 1000,
        qtyZ2: 500,
        totalLoan: 0,
        cash: 100000,
      };

      const prices = {
        price0050: 500,
        priceZ2: 300,
      };

      const result = analyzeCapitalDecoupling(portfolio, prices);

      // 淨資產 = 500000 + 150000 - 0 + 100000 = 750000
      expect(result.netAsset).toBe(750000);
    });

    it("所有欄位為 0 應返回 0", () => {
      const portfolio = {
        qty0050: 0,
        qtyZ2: 0,
        totalLoan: 0,
        cash: 0,
      };

      const prices = {
        price0050: 0,
        priceZ2: 0,
      };

      const result = analyzeCapitalDecoupling(portfolio, prices);

      expect(result.netAsset).toBe(0);
      expect(result.tacticRatio).toBe(0);
      expect(result.baseRatio).toBe(0);
    });
  });

  describe("🔧 自定義情境", () => {
    it("高槓桿帳戶應顯示高 tacticRatio", () => {
      const portfolio = {
        qty0050: 1000,
        qtyZ2: 2000,
        totalLoan: 800000,
        cash: 50000,
      };

      const prices = {
        price0050: 500,
        priceZ2: 300,
      };

      const result = analyzeCapitalDecoupling(portfolio, prices);

      // 戰術部位 = 2000 * 300 = 600000
      // 淨資產 = 500000 + 600000 - 800000 + 50000 = 350000
      // 戰術佔比 = 600000 / 350000 * 100 ≈ 171.43%
      expect(result.tacticRatio).toBeGreaterThan(100);
    });

    it("保守帳戶應顯示低 tacticRatio", () => {
      const portfolio = {
        qty0050: 2000,
        qtyZ2: 100,
        totalLoan: 100000,
        cash: 200000,
      };

      const prices = {
        price0050: 500,
        priceZ2: 300,
      };

      const result = analyzeCapitalDecoupling(portfolio, prices);

      // 戰術部位 = 100 * 300 = 30000
      // 淨資產 = 1000000 + 30000 - 100000 + 200000 = 1130000
      // 戰術佔比 = 30000 / 1130000 * 100 ≈ 2.65%
      expect(result.tacticRatio).toBeLessThan(10);
    });
  });
});
