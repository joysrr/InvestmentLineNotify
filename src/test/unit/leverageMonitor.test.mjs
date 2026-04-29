import { describe, it, expect } from "vitest";
import { computeGrossLeverage } from "../../modules/strategy/leverageMonitor.mjs";

describe("leverageMonitor - computeGrossLeverage", () => {
  const defaultConfig = {
    ceiling: 2.5,
    hardCap: 3.0,
    recoveryTarget: 2.0,
  };

  const defaultInput = {
    etf0050Value: 1000000,
    etf675LValue: 250000,
    netAssetValue: 1000000,
  };

  // 預期槓桿 = (1000000 + 250000 * 2) / 1000000 = 1.5
  const expectedNormalLeverage = 1.5;

  describe("✅ 正常狀態 (normal)", () => {
    it("槓桿低於 ceiling 應返回 normal", () => {
      const result = computeGrossLeverage(defaultInput, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(expectedNormalLeverage, 5);
      expect(result.status).toBe("normal");
      expect(result.blockNewLeverage).toBe(false);
      expect(result.forceDeleverage).toBe(false);
      expect(result.message).toContain("正常範圍");
    });

    it("槓桿等於 2.0 應返回 normal", () => {
      const input = {
        etf0050Value: 1000000,
        etf675LValue: 500000,
        netAssetValue: 1000000,
      };
      // (1000000 + 500000 * 2) / 1000000 = 2.0
      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(2.0, 5);
      expect(result.status).toBe("normal");
    });

    it("槓桿接近 ceiling 但未超過應返回 normal", () => {
      // 設定 etf0050Value = 2400000, etf675LValue = 50000
      // (2400000 + 50000 * 2) / 1000000 = 2.5
      const input = {
        etf0050Value: 2400000,
        etf675LValue: 50000,
        netAssetValue: 1000000,
      };
      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(2.5, 5);
      expect(result.status).toBe("normal");
    });
  });

  describe("⚠️ Ceiling Breach (主動擴張上限)", () => {
    it("槓桿超過 ceiling 應返回 ceiling_breach", () => {
      // etf0050Value = 2000000, etf675LValue = 500000
      // (2000000 + 500000 * 2) / 1000000 = 3.0 > 2.5 (ceiling)
      const input = {
        etf0050Value: 2000000,
        etf675LValue: 500000,
        netAssetValue: 1000000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(3.0, 5);
      expect(result.status).toBe("ceiling_breach");
      expect(result.blockNewLeverage).toBe(true);
      expect(result.forceDeleverage).toBe(false);
      expect(result.message).toContain("超越主動上限");
    });

    it("槓桿 2.6x 應觸發 ceiling_breach", () => {
      // (2000000 + 300000 * 2) / 1000000 = 2.6
      const input = {
        etf0050Value: 2000000,
        etf675LValue: 300000,
        netAssetValue: 1000000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(2.6, 5);
      expect(result.status).toBe("ceiling_breach");
    });

    it("ceiling_breach 時 recoveryTarget 應為 null", () => {
      const input = {
        etf0050Value: 2000000,
        etf675LValue: 500000,
        netAssetValue: 1000000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.recoveryTarget).toBe(null);
    });
  });

  describe("🚨 Hardcap Breach (被動危機紅線)", () => {
    it("槓桿超過 hardCap 應返回 hardcap_breach", () => {
      // etf0050Value = 1000000, etf675LValue = 1000000
      // (1000000 + 1000000 * 2) / 1000000 = 3.0 = hardCap (未超過)
      // 需要 > 3.0
      const input = {
        etf0050Value: 1000000,
        etf675LValue: 1000001,
        netAssetValue: 1000000,
      };
      // (1000000 + 1000001 * 2) / 1000000 = 3.000002

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeGreaterThan(3.0);
      expect(result.status).toBe("hardcap_breach");
      expect(result.forceDeleverage).toBe(true);
      expect(result.blockNewLeverage).toBe(true);
      expect(result.recoveryTarget).toBe(2.0);
      expect(result.message).toContain("危機紅線");
    });

    it("槓桿 3.5x 應觸發 hardcap_breach", () => {
      // etf0050Value = 500000, etf675LValue = 1500000
      // (500000 + 1500000 * 2) / 1000000 = 3.5
      const input = {
        etf0050Value: 500000,
        etf675LValue: 1500000,
        netAssetValue: 1000000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(3.5, 5);
      expect(result.status).toBe("hardcap_breach");
      expect(result.forceDeleverage).toBe(true);
      expect(result.recoveryTarget).toBe(2.0);
    });

    it("hardcap_breach 優先於 ceiling_breach", () => {
      // 同時超過 ceiling (2.5) 和 hardCap (3.0)
      const input = {
        etf0050Value: 2000000,
        etf675LValue: 1000000,
        netAssetValue: 1000000,
      };
      // (2000000 + 1000000 * 2) / 1000000 = 4.0

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.status).toBe("hardcap_breach");
      expect(result.forceDeleverage).toBe(true);
      expect(result.message).toContain("強制降槓");
    });
  });

  describe("❌ 錯誤狀態 (error)", () => {
    it("netAssetValue 為 0 應返回 error", () => {
      const input = {
        etf0050Value: 1000000,
        etf675LValue: 250000,
        netAssetValue: 0,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.status).toBe("error");
      expect(result.grossLeverage).toBe(null);
      expect(result.blockNewLeverage).toBe(true);
      expect(result.message).toContain("帳戶淨值異常");
    });

    it("netAssetValue 為負數應返回 error", () => {
      const input = {
        etf0050Value: 1000000,
        etf675LValue: 250000,
        netAssetValue: -100000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.status).toBe("error");
    });

    it("etf0050Value 為負數應返回 error", () => {
      const input = {
        etf0050Value: -100000,
        etf675LValue: 250000,
        netAssetValue: 1000000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.status).toBe("error");
      expect(result.message).toContain("etf0050Value");
    });

    it("etf675LValue 為負數應返回 error", () => {
      const input = {
        etf0050Value: 1000000,
        etf675LValue: -250000,
        netAssetValue: 1000000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.status).toBe("error");
    });

    it("etf0050Value 為 NaN 應返回 error", () => {
      const input = {
        etf0050Value: NaN,
        etf675LValue: 250000,
        netAssetValue: 1000000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.status).toBe("error");
    });

    it("netAssetValue 為 Infinity 應返回 error", () => {
      const input = {
        etf0050Value: 1000000,
        etf675LValue: 250000,
        netAssetValue: Infinity,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.status).toBe("error");
    });

    it("所有值為 0 應返回 error", () => {
      const input = {
        etf0050Value: 0,
        etf675LValue: 0,
        netAssetValue: 0,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.status).toBe("error");
    });
  });

  describe("自定義配置", () => {
    it("應使用自定義 ceiling 值", () => {
      const customConfig = {
        ceiling: 2.0,
        hardCap: 3.0,
        recoveryTarget: 1.5,
      };

      // 槓桿 2.5，超過 ceiling 2.0
      const input = {
        etf0050Value: 1500000,
        etf675LValue: 500000,
        netAssetValue: 1000000,
      };
      // (1500000 + 500000 * 2) / 1000000 = 2.5

      const result = computeGrossLeverage(input, customConfig);

      expect(result.status).toBe("ceiling_breach");
      expect(result.message).toContain("2.0");
    });

    it("應使用自定義 hardCap 值", () => {
      const customConfig = {
        ceiling: 2.5,
        hardCap: 2.8,
        recoveryTarget: 1.8,
      };

      // 槓桿 3.0，超過 hardCap 2.8
      const input = {
        etf0050Value: 1000000,
        etf675LValue: 1000000,
        netAssetValue: 1000000,
      };
      // (1000000 + 1000000 * 2) / 1000000 = 3.0

      const result = computeGrossLeverage(input, customConfig);

      expect(result.status).toBe("hardcap_breach");
      expect(result.recoveryTarget).toBe(1.8);
      expect(result.message).toContain("2.8");
    });

    it("應使用自定義 recoveryTarget 值", () => {
      const customConfig = {
        ceiling: 2.5,
        hardCap: 3.0,
        recoveryTarget: 1.5,
      };

      const input = {
        etf0050Value: 500000,
        etf675LValue: 1500000,
        netAssetValue: 1000000,
      };
      // (500000 + 1500000 * 2) / 1000000 = 3.5

      const result = computeGrossLeverage(input, customConfig);

      expect(result.recoveryTarget).toBe(1.5);
      expect(result.message).toContain("1.5");
    });
  });

  describe("邊界條件測試", () => {
    it("槓桿正好等於 ceiling 應為 normal", () => {
      // ceiling = 2.5
      // (2000000 + 500000 * 2) / 1000000 = 3.0 > 2.5
      // 需要正好等於 2.5
      // (2000000 + 250000 * 2) / 1000000 = 2.5
      const input = {
        etf0050Value: 2000000,
        etf675LValue: 250000,
        netAssetValue: 1000000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(2.5, 5);
      expect(result.status).toBe("normal");
    });

    it("槓桿正好等於 hardCap 應為 ceiling_breach（不超過 hardCap）", () => {
      // hardCap = 3.0
      // (2000000 + 500000 * 2) / 1000000 = 3.0
      const input = {
        etf0050Value: 2000000,
        etf675LValue: 500000,
        netAssetValue: 1000000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(3.0, 5);
      expect(result.status).toBe("ceiling_breach"); // 超過 ceiling (2.5) 但未超過 hardCap (3.0)
    });

    it("極小淨值應正確計算", () => {
      const input = {
        etf0050Value: 1000,
        etf675LValue: 500,
        netAssetValue: 100,
      };
      // (1000 + 500 * 2) / 100 = 20.0

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(20.0, 5);
      expect(result.status).toBe("hardcap_breach");
    });

    it("極大數值應正確計算", () => {
      const input = {
        etf0050Value: 1000000000,
        etf675LValue: 500000000,
        netAssetValue: 500000000,
      };
      // (1000000000 + 500000000 * 2) / 500000000 = 4.0

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(4.0, 5);
      expect(result.status).toBe("hardcap_breach");
    });
  });

  describe("00675L 槓桿係數驗證", () => {
    it("00675L 應使用 2x 槓桿係數", () => {
      // 若 etf0050Value = 0, netAssetValue = 1000000
      // etf675LValue = 500000
      // 槓桿 = (0 + 500000 * 2) / 1000000 = 1.0
      const input = {
        etf0050Value: 0,
        etf675LValue: 500000,
        netAssetValue: 1000000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(1.0, 5);
    });

    it("純 0050 部位（無 00675L）應正確計算", () => {
      // etf0050Value = 2000000, etf675LValue = 0
      // 槓桿 = (2000000 + 0 * 2) / 1000000 = 2.0
      const input = {
        etf0050Value: 2000000,
        etf675LValue: 0,
        netAssetValue: 1000000,
      };

      const result = computeGrossLeverage(input, defaultConfig);

      expect(result.grossLeverage).toBeCloseTo(2.0, 5);
      expect(result.status).toBe("normal");
    });
  });
});

describe("leverageMonitor - 整合場景測試", () => {
  const config = {
    ceiling: 2.5,
    hardCap: 3.0,
    recoveryTarget: 2.0,
  };

  it("場景：帳戶從正常逐步增加到危機", () => {
    const scenarios = [
      {
        input: { etf0050Value: 1000000, etf675LValue: 0, netAssetValue: 1000000 },
        expected: "normal",
        expectedLeverage: 1.0,
      },
      {
        input: { etf0050Value: 1500000, etf675LValue: 250000, netAssetValue: 1000000 },
        expected: "normal",
        expectedLeverage: 2.0,
      },
      {
        input: { etf0050Value: 2000000, etf675LValue: 250000, netAssetValue: 1000000 },
        expected: "normal",
        expectedLeverage: 2.5,
      },
      {
        input: { etf0050Value: 2000000, etf675LValue: 300000, netAssetValue: 1000000 },
        expected: "ceiling_breach",
        expectedLeverage: 2.6,
      },
      {
        input: { etf0050Value: 2000000, etf675LValue: 500000, netAssetValue: 1000000 },
        expected: "ceiling_breach",
        expectedLeverage: 3.0,
      },
      {
        input: { etf0050Value: 1000000, etf675LValue: 1000001, netAssetValue: 1000000 },
        expected: "hardcap_breach",
        expectedLeverage: 3.000002,
      },
    ];

    for (const { input, expected, expectedLeverage } of scenarios) {
      const result = computeGrossLeverage(input, config);
      expect(result.status).toBe(expected);
      expect(result.grossLeverage).toBeCloseTo(expectedLeverage, 4);
    }
  });

  it("場景：高槓桿帳戶的降槓桿路徑", () => {
    // 初始狀態：hardcap_breach
    const crisisState = {
      etf0050Value: 500000,
      etf675LValue: 1500000,
      netAssetValue: 1000000,
    };
    // 槓桿 = 3.5

    const crisisResult = computeGrossLeverage(crisisState, config);
    expect(crisisResult.status).toBe("hardcap_breach");
    expect(crisisResult.forceDeleverage).toBe(true);
    expect(crisisResult.recoveryTarget).toBe(2.0);

    // 降槓桿後目標：2.0x
    // 假設賣出部分 00675L，etf675LValue 降至 750000
    const recoveredState = {
      etf0050Value: 500000,
      etf675LValue: 750000,
      netAssetValue: 1000000,
    };
    // 槓桿 = (500000 + 750000 * 2) / 1000000 = 2.0

    const recoveredResult = computeGrossLeverage(recoveredState, config);
    expect(recoveredResult.status).toBe("normal");
    expect(recoveredResult.forceDeleverage).toBe(false);
  });

  it("場景：低淨值帳戶的風險評估", () => {
    // 淨值下降（虧損），但資產市值不變
    const highRiskState = {
      etf0050Value: 1000000,
      etf675LValue: 500000,
      netAssetValue: 500000, // 淨值只剩一半
    };
    // 槓桿 = (1000000 + 500000 * 2) / 500000 = 4.0

    const result = computeGrossLeverage(highRiskState, config);

    expect(result.grossLeverage).toBeCloseTo(4.0, 5);
    expect(result.status).toBe("hardcap_breach");
    expect(result.forceDeleverage).toBe(true);
  });
});
