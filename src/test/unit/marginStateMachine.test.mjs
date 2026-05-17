import { describe, it, expect } from "vitest";
import {
  getMarginLayer,
  evaluateMarginLayer,
} from "../../modules/strategy/core/marginStateMachine.mjs";

describe("marginStateMachine - getMarginLayer", () => {
  const defaultMaint = {
    marginCallThreshold: 135,
    frozenZone: 145,
    protectTrigger: 160,
    protectTarget: 180,
  };

  describe("🔴 Layer 0: Critical (斷頭危機)", () => {
    it("維持率低於 135% 應返回 critical", () => {
      expect(getMarginLayer(130, defaultMaint)).toBe("critical");
    });

    it("維持率等於 134.9% 應返回 critical", () => {
      expect(getMarginLayer(134.9, defaultMaint)).toBe("critical");
    });

    it("維持率為 0 應返回 critical", () => {
      expect(getMarginLayer(0, defaultMaint)).toBe("critical");
    });

    it("維持率為負數應返回 critical", () => {
      expect(getMarginLayer(-10, defaultMaint)).toBe("critical");
    });
  });

  describe("🟠 Layer 1: Frozen (高危凍結)", () => {
    it("維持率 135% 應返回 frozen", () => {
      expect(getMarginLayer(135, defaultMaint)).toBe("frozen");
    });

    it("維持率 140% 應返回 frozen", () => {
      expect(getMarginLayer(140, defaultMaint)).toBe("frozen");
    });

    it("維持率 144.9% 應返回 frozen", () => {
      expect(getMarginLayer(144.9, defaultMaint)).toBe("frozen");
    });
  });

  describe("🟡 Layer 2: Protect (預備金防禦)", () => {
    it("維持率 145% 應返回 protect", () => {
      expect(getMarginLayer(145, defaultMaint)).toBe("protect");
    });

    it("維持率 150% 應返回 protect", () => {
      expect(getMarginLayer(150, defaultMaint)).toBe("protect");
    });

    it("維持率 159.9% 應返回 protect", () => {
      expect(getMarginLayer(159.9, defaultMaint)).toBe("protect");
    });
  });

  describe("🟢 Layer 3: Normal (常態運行)", () => {
    it("維持率 160% 應返回 normal", () => {
      expect(getMarginLayer(160, defaultMaint)).toBe("normal");
    });

    it("維持率 180% 應返回 normal", () => {
      expect(getMarginLayer(180, defaultMaint)).toBe("normal");
    });

    it("維持率 200% 應返回 normal", () => {
      expect(getMarginLayer(200, defaultMaint)).toBe("normal");
    });
  });

  describe("自定義閾值", () => {
    it("應使用自定義閾值判斷", () => {
      const customMaint = {
        marginCallThreshold: 120,
        frozenZone: 130,
        protectTrigger: 150,
        protectTarget: 170,
      };

      expect(getMarginLayer(115, customMaint)).toBe("critical");
      expect(getMarginLayer(125, customMaint)).toBe("frozen");
      expect(getMarginLayer(135, customMaint)).toBe("protect");
      expect(getMarginLayer(155, customMaint)).toBe("normal");
    });

    it("應使用預設值當未提供閾值時", () => {
      expect(getMarginLayer(130, {})).toBe("critical");
      expect(getMarginLayer(140, {})).toBe("frozen");
      expect(getMarginLayer(150, {})).toBe("protect");
      expect(getMarginLayer(170, {})).toBe("normal");
    });
  });
});

describe("marginStateMachine - evaluateMarginLayer", () => {
  const defaultStrategy = {
    maintenance: {
      marginCallThreshold: 135,
      frozenZone: 145,
      protectTrigger: 160,
      protectTarget: 180,
    },
  };

  const defaultReserveStatus = {
    currentReserve: 100000,
  };

  describe("🔴 Layer 0: Critical (斷頭危機)", () => {
    it("應返回正確的斷頭危機資訊", () => {
      const ctx = {
        maintenanceMargin: 130,
        totalLoan: 1000000,
      };

      const result = evaluateMarginLayer(
        "critical",
        ctx,
        defaultStrategy,
        defaultReserveStatus,
      );

      expect(result).toBeDefined();
      expect(result.maintenanceLayer).toBe("critical");
      expect(result.marketStatus).toContain("斷頭危機");
      expect(result.target).toContain("強制降槓桿");
      expect(result.targetSuggestionShort).toContain("立即補保證金");
      expect(result.maintenanceMargin).toBe(130);
      expect(result.marginCallThreshold).toBe(135);
      expect(result.suggestion).toContain("強制降槓桿模式");
    });

    it("應包含正確的警告訊息", () => {
      const ctx = {
        maintenanceMargin: 125,
        totalLoan: 500000,
      };

      const result = evaluateMarginLayer(
        "critical",
        ctx,
        defaultStrategy,
        defaultReserveStatus,
      );

      expect(result.targetSuggestion).toContain("維持率已低於斷頭警戒線");
      expect(result.suggestion).toContain("一票否決");
      expect(result.suggestion).toContain("目標：維持率回升至 145% 以上");
    });
  });

  describe("🟠 Layer 1: Frozen (高危凍結)", () => {
    it("應返回正確的凍結資訊", () => {
      const ctx = {
        maintenanceMargin: 140,
        totalLoan: 1000000,
      };

      const result = evaluateMarginLayer(
        "frozen",
        ctx,
        defaultStrategy,
        defaultReserveStatus,
      );

      expect(result).toBeDefined();
      expect(result.maintenanceLayer).toBe("frozen");
      expect(result.marketStatus).toContain("高危凍結");
      expect(result.target).toContain("禁止進場");
      expect(result.targetSuggestionShort).toContain("禁止所有新進場");
      expect(result.maintenanceMargin).toBe(140);
      expect(result.frozenZone).toBe(145);
      expect(result.needAmount).toBeGreaterThan(0);
    });

    it("應計算正確的資金缺口", () => {
      // 維持率 140%，目標 145%，借款 1000000
      // impliedCollateral = 1.4 * 1000000 = 1400000
      // targetCollateral = 1.45 * 1000000 = 1450000
      // needAmount = 1450000 - 1400000 = 50000
      const ctx = {
        maintenanceMargin: 140,
        totalLoan: 1000000,
      };

      const result = evaluateMarginLayer(
        "frozen",
        ctx,
        defaultStrategy,
        defaultReserveStatus,
      );

      expect(result.needAmount).toBe(50000);
    });

    it("預備金充足時應標記為充足", () => {
      const ctx = {
        maintenanceMargin: 140,
        totalLoan: 1000000,
      };

      const reserveStatus = { currentReserve: 100000 }; // 大於 needAmount (50000)
      const result = evaluateMarginLayer(
        "frozen",
        ctx,
        defaultStrategy,
        reserveStatus,
      );

      expect(result.reserveSufficient).toBe(true);
      expect(result.suggestion).toContain("✅ 充足，可立即動用");
    });

    it("預備金不足時應標記為不足", () => {
      const ctx = {
        maintenanceMargin: 140,
        totalLoan: 1000000,
      };

      const reserveStatus = { currentReserve: 10000 }; // 小於 needAmount (50000)
      const result = evaluateMarginLayer(
        "frozen",
        ctx,
        defaultStrategy,
        reserveStatus,
      );

      expect(result.reserveSufficient).toBe(false);
      expect(result.suggestion).toContain("⚠️ 不足，需補充額外現金");
    });
  });

  describe("🟡 Layer 2: Protect (預備金防禦)", () => {
    it("應返回正確的防禦資訊", () => {
      const ctx = {
        maintenanceMargin: 150,
        totalLoan: 1000000,
      };

      const result = evaluateMarginLayer(
        "protect",
        ctx,
        defaultStrategy,
        defaultReserveStatus,
      );

      expect(result).toBeDefined();
      expect(result.maintenanceLayer).toBe("protect");
      expect(result.marketStatus).toContain("維持率低於安全線");
      expect(result.target).toContain("預備金防禦");
      expect(result.targetSuggestionShort).toContain("動用預備金");
      expect(result.maintenanceMargin).toBe(150);
      expect(result.protectTrigger).toBe(160);
      expect(result.protectTarget).toBe(180);
    });

    it("應計算正確的資金缺口至目標", () => {
      // 維持率 150%，目標 180%，借款 1000000
      // impliedCollateral = 1.5 * 1000000 = 1500000
      // targetCollateral = 1.8 * 1000000 = 1800000
      // needAmount = 1800000 - 1500000 = 300000
      const ctx = {
        maintenanceMargin: 150,
        totalLoan: 1000000,
      };

      const result = evaluateMarginLayer(
        "protect",
        ctx,
        defaultStrategy,
        defaultReserveStatus,
      );

      expect(result.needAmount).toBe(300000);
    });

    it("應允許 0050 DCA 但暫停 00675L 加碼", () => {
      const ctx = {
        maintenanceMargin: 155,
        totalLoan: 500000,
      };

      const result = evaluateMarginLayer(
        "protect",
        ctx,
        defaultStrategy,
        defaultReserveStatus,
      );

      expect(result.suggestion).toContain("暫停 00675L 槓桿加碼");
      expect(result.suggestion).toContain("允許 0050 baseline DCA 維持");
    });
  });

  describe("🟢 Layer 3: Normal (常態運行)", () => {
    it("正常維持率應返回 null", () => {
      const ctx = {
        maintenanceMargin: 180,
        totalLoan: 1000000,
      };

      const result = evaluateMarginLayer(
        "normal",
        ctx,
        defaultStrategy,
        defaultReserveStatus,
      );

      expect(result).toBeNull();
    });
  });

  describe("邊界條件測試", () => {
    it("維持率為 0 時應正確處理", () => {
      const ctx = {
        maintenanceMargin: 0,
        totalLoan: 1000000,
      };

      const result = evaluateMarginLayer(
        "critical",
        ctx,
        defaultStrategy,
        defaultReserveStatus,
      );

      expect(result.maintenanceMargin).toBe(0);
      expect(result.marketStatus).toContain("斷頭危機");
    });

    it("totalLoan 為 0 時應避免除零錯誤", () => {
      const ctx = {
        maintenanceMargin: 140,
        totalLoan: 0,
      };

      const result = evaluateMarginLayer(
        "frozen",
        ctx,
        defaultStrategy,
        defaultReserveStatus,
      );

      expect(result.needAmount).toBe(0);
    });

    it("小數點維持率應正確處理", () => {
      const ctx = {
        maintenanceMargin: 134.99,
        totalLoan: 1000000,
      };

      const result = evaluateMarginLayer(
        "critical",
        ctx,
        defaultStrategy,
        defaultReserveStatus,
      );

      expect(result.maintenanceMargin).toBe(134.99);
    });
  });
});

describe("marginStateMachine - 整合場景測試", () => {
  const strategy = {
    maintenance: {
      marginCallThreshold: 135,
      frozenZone: 145,
      protectTrigger: 160,
      protectTarget: 180,
    },
  };

  const reserveStatus = { currentReserve: 50000 };

  it("場景：從正常逐步下降到危機", () => {
    const scenarios = [
      { mm: 200, expected: "normal" },
      { mm: 160, expected: "normal" },
      { mm: 155, expected: "protect" },
      { mm: 150, expected: "protect" },
      { mm: 145, expected: "protect" },
      { mm: 140, expected: "frozen" },
      { mm: 135, expected: "frozen" },
      { mm: 134, expected: "critical" },
      { mm: 120, expected: "critical" },
    ];

    for (const { mm, expected } of scenarios) {
      const layer = getMarginLayer(mm, strategy.maintenance);
      expect(layer).toBe(expected);
    }
  });

  it("場景：高槓桿帳戶的風險評估", () => {
    const highLeverageCtx = {
      maintenanceMargin: 142,
      totalLoan: 2000000, // 高借款
    };

    const layer = getMarginLayer(
      highLeverageCtx.maintenanceMargin,
      strategy.maintenance,
    );
    expect(layer).toBe("frozen");

    const evalResult = evaluateMarginLayer(
      layer,
      highLeverageCtx,
      strategy,
      reserveStatus,
    );
    expect(evalResult.marketStatus).toContain("高危凍結");
    expect(evalResult.needAmount).toBe(60000); // (1.45 - 1.42) * 2000000
  });

  it("場景：預備金充足的保護策略", () => {
    const protectCtx = {
      maintenanceMargin: 155,
      totalLoan: 1000000,
    };

    const richReserve = { currentReserve: 500000 }; // 充足預備金

    const layer = getMarginLayer(
      protectCtx.maintenanceMargin,
      strategy.maintenance,
    );
    expect(layer).toBe("protect");

    const evalResult = evaluateMarginLayer(
      layer,
      protectCtx,
      strategy,
      richReserve,
    );
    expect(evalResult.reserveSufficient).toBe(true);
    expect(evalResult.suggestion).toContain("動用預備金買入 0050");
  });
});
