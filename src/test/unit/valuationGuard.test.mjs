import { describe, it, expect } from "vitest";
import {
  resolveValuationGuard,
  resolveTrendConfirmation,
  resolveValuationMomentum,
  evaluateValuationGuard,
} from "../../modules/strategy/core/valuationGuard.mjs";

describe("valuationGuard - resolveValuationGuard", () => {
  const defaultConfig = {
    valuationGuard: {
      tiers: [
        { minPr: 50, multiplier: 0.8 },
        { minPr: 70, multiplier: 0.6 },
        { minPr: 90, multiplier: 0.3 },
      ],
    },
  };

  describe("邊界條件", () => {
    it("currentPB 為 null 應返回 guardActive: false", () => {
      const result = resolveValuationGuard(null, [1, 2, 3], defaultConfig);

      expect(result.guardActive).toBe(false);
      expect(result.currentPR).toBe(null);
      expect(result.multiplier).toBe(1.0);
      expect(result.hitTier).toBe(null);
    });

    it("pbRecords 為空陣列應返回 guardActive: false", () => {
      const result = resolveValuationGuard(1.5, [], defaultConfig);

      expect(result.guardActive).toBe(false);
      expect(result.currentPR).toBe(null);
    });

    it("pbRecords 不是陣列應返回 guardActive: false", () => {
      const result = resolveValuationGuard(1.5, "not-array", defaultConfig);

      expect(result.guardActive).toBe(false);
    });
  });

  describe("PR 計算", () => {
    it("應正確計算 Percentile Rank", () => {
      // PB 記錄：[1.0, 1.2, 1.5, 1.8, 2.0]
      // currentPB = 1.5
      // rank = 2 (索引)，PR = 2/5 * 100 = 40
      const pbRecords = [1.0, 1.2, 1.5, 1.8, 2.0];
      const result = resolveValuationGuard(1.5, pbRecords, defaultConfig);

      expect(result.currentPR).toBe(40);
      expect(result.guardActive).toBe(false);
    });

    it("currentPB 大於所有記錄應返回 PR 100", () => {
      const pbRecords = [1.0, 1.2, 1.5, 1.8, 2.0];
      const result = resolveValuationGuard(2.5, pbRecords, defaultConfig);

      expect(result.currentPR).toBe(100);
    });

    it("currentPB 等於最小值應返回 PR 0", () => {
      const pbRecords = [1.0, 1.2, 1.5, 1.8, 2.0];
      const result = resolveValuationGuard(1.0, pbRecords, defaultConfig);

      expect(result.currentPR).toBe(0);
    });

    it("應自動排序 PB 記錄", () => {
      // 未排序的記錄
      const pbRecords = [2.0, 1.0, 1.8, 1.2, 1.5];
      // currentPB = 1.5
      // 排序後：[1.0, 1.2, 1.5, 1.8, 2.0]
      // rank = 2, PR = 40
      const result = resolveValuationGuard(1.5, pbRecords, defaultConfig);

      expect(result.currentPR).toBe(40);
    });
  });

  describe("Tier 匹配", () => {
    it("PR 低於所有 tier 應返回 multiplier 1.0", () => {
      const pbRecords = Array.from({ length: 100 }, (_, i) => 1 + i * 0.01);
      const result = resolveValuationGuard(1.3, pbRecords, defaultConfig);

      // PR 約為 30，低於第一個 tier (50)
      expect(result.guardActive).toBe(false);
      expect(result.multiplier).toBe(1.0);
      expect(result.hitTier).toBe(null);
    });

    it("PR 達到第一 tier 應應用對應 multiplier", () => {
      const pbRecords = Array.from({ length: 100 }, (_, i) => 1 + i * 0.01);
      const result = resolveValuationGuard(1.6, pbRecords, defaultConfig);

      // PR 約為 60，達到第一 tier (50)
      expect(result.guardActive).toBe(true);
      expect(result.multiplier).toBe(0.8);
      expect(result.hitTier.minPr).toBe(50);
    });

    it("PR 達到第二 tier 應應用最高 tier multiplier", () => {
      const pbRecords = Array.from({ length: 100 }, (_, i) => 1 + i * 0.01);
      const result = resolveValuationGuard(1.8, pbRecords, defaultConfig);

      // PR 約為 80，達到第二 tier (70)
      expect(result.guardActive).toBe(true);
      expect(result.multiplier).toBe(0.6);
      expect(result.hitTier.minPr).toBe(70);
    });

    it("PR 達到第三 tier 應應用最高 multiplier", () => {
      const pbRecords = Array.from({ length: 100 }, (_, i) => 1 + i * 0.01);
      const result = resolveValuationGuard(2.0, pbRecords, defaultConfig);

      // PR 約為 100，達到第三 tier (90)
      expect(result.guardActive).toBe(true);
      expect(result.multiplier).toBe(0.3);
      expect(result.hitTier.minPr).toBe(90);
    });

    it("PR 正好等於 tier 閾值應觸發", () => {
      const pbRecords = Array.from({ length: 100 }, (_, i) => 1 + i * 0.01);
      const result = resolveValuationGuard(1.5, pbRecords, defaultConfig);

      // PR 約為 50，正好等於第一 tier
      expect(result.guardActive).toBe(true);
      expect(result.multiplier).toBe(0.8);
    });
  });

  describe("無配置", () => {
    it("無 config 應返回 guardActive: false", () => {
      const pbRecords = Array.from({ length: 100 }, (_, i) => 1 + i * 0.01);
      const result = resolveValuationGuard(1.8, pbRecords, undefined);

      expect(result.guardActive).toBe(false);
      expect(result.multiplier).toBe(1.0);
    });
  });
});

describe("valuationGuard - resolveTrendConfirmation", () => {
  const createMockPriceData = (len = 30) => {
    const closeArr = [];
    const ma20Arr = [];
    const atrArr = [];

    for (let i = 0; i < len; i++) {
      closeArr.push(100 + i * 2); // 上漲趨勢
      ma20Arr.push(100 + i * 1.8);
      atrArr.push(5);
    }

    return { closeArr, ma20Arr, atrArr };
  };

  describe("邊界條件", () => {
    it("closeArr 不存在應返回資料不足", () => {
      const result = resolveTrendConfirmation(
        { closeArr: null, ma20Arr: [], atrArr: [] },
        {},
      );

      expect(result.trendLabel).toBe("資料不足");
      expect(result.ma20BreakDays).toBe(0);
    });

    it("closeArr 長度不足 2 應返回資料不足", () => {
      const result = resolveTrendConfirmation(
        { closeArr: [100], ma20Arr: [100], atrArr: [5] },
        {},
      );

      expect(result.trendLabel).toBe("資料不足");
    });

    it("ma20Arr 長度不足 2 應返回資料不足", () => {
      const result = resolveTrendConfirmation(
        { closeArr: [100, 102], ma20Arr: [100], atrArr: [5] },
        {},
      );

      expect(result.trendLabel).toBe("資料不足");
    });
  });

  describe("趨勢判斷", () => {
    it("價格高於 MA20 應返回趨勢偏多", () => {
      const priceData = createMockPriceData(30);
      const result = resolveTrendConfirmation(priceData, {});

      expect(result.trendLabel).toBe("📈 趨勢偏多");
      expect(result.ma20BreakDays).toBe(0);
    });

    it("價格低於 MA20 應計算突破天數", () => {
      // 建立最後 5 天跌破 MA20 的數據
      const closeArr = [];
      const ma20Arr = [];
      const atrArr = [];

      for (let i = 0; i < 25; i++) {
        closeArr.push(100 + i * 2);
        ma20Arr.push(100 + i * 1.8);
        atrArr.push(5);
      }

      // 最後 5 天跌破
      for (let i = 0; i < 5; i++) {
        closeArr.push(140); // 低於 MA20
        ma20Arr.push(150);
        atrArr.push(5);
      }

      const result = resolveTrendConfirmation(
        { closeArr, ma20Arr, atrArr },
        {},
      );

      expect(result.ma20BreakDays).toBe(5);
      expect(result.trendLabel).toBe("📉 MA20 跌破 5 日");
    });

    it("應正確計算 ATR 支撐", () => {
      const priceData = createMockPriceData(30);
      const result = resolveTrendConfirmation(priceData, {});

      // currentMa20 ≈ 152, atr = 5
      // atrSupport = 152 - 5 * 1.5 = 144.5
      // currentPrice ≈ 158 > 144.5
      expect(result.priceAboveAtrSupport).toBe(true);
    });

    it("價格低於 ATR 支撐應返回 false", () => {
      const closeArr = [];
      const ma20Arr = [];
      const atrArr = [];

      for (let i = 0; i < 30; i++) {
        closeArr.push(100 + i * 2);
        ma20Arr.push(100 + i * 1.8);
        atrArr.push(10); // 較大的 ATR
      }

      // 最後一天價格大幅下降
      closeArr[29] = 120;

      const result = resolveTrendConfirmation(
        { closeArr, ma20Arr, atrArr },
        {},
      );

      // currentMa20 ≈ 152, atr = 10
      // atrSupport = 152 - 10 * 1.5 = 137
      // currentPrice = 120 < 137
      expect(result.priceAboveAtrSupport).toBe(false);
    });
  });
});

describe("valuationGuard - resolveValuationMomentum", () => {
  const defaultConfig = {
    valuationGuard: {
      momentum: {
        enabled: true,
        highPRZone: 80,
        relaxedMomentumThreshold: 2,
        risingPenaltyMultiplier: 0.8,
      },
    },
  };

  describe("動量未啟用", () => {
    it("momentum.enabled = false 應返回預設值", () => {
      const config = {
        valuationGuard: {
          momentum: { enabled: false },
        },
      };

      const result = resolveValuationMomentum(85, [], config);

      expect(result.prMomentum).toBe(0);
      expect(result.momentumAdjustment).toBe(1.0);
      expect(result.momentumLabel).toBe("");
    });
  });

  describe("PR 動量計算", () => {
    it("應計算當前 PR 與 5 天前的差異", () => {
      const pbRecordsObjects = Array.from({ length: 10 }, (_, i) => ({
        pr: 50 + i * 5,
      }));
      // currentPR = 90
      // prevPR (6 天前) = 50
      // prMomentum = 90 - 50 = 40

      const result = resolveValuationMomentum(90, pbRecordsObjects, defaultConfig);

      expect(result.prMomentum).toBe(40);
    });

    it("歷史記錄不足 6 天應使用當前 PR", () => {
      const pbRecordsObjects = [{ pr: 70 }, { pr: 75 }];

      const result = resolveValuationMomentum(80, pbRecordsObjects, defaultConfig);

      // prevPR = currentPR = 80
      // prMomentum = 0
      expect(result.prMomentum).toBe(0);
    });

    it("PR 下降應返回負動量", () => {
      const pbRecordsObjects = Array.from({ length: 10 }, (_, i) => ({
        pr: 90 - i * 5,
      }));
      // currentPR = 45
      // prevPR = 90
      // prMomentum = 45 - 90 = -45

      const result = resolveValuationMomentum(45, pbRecordsObjects, defaultConfig);

      expect(result.prMomentum).toBe(-45);
    });
  });

  describe("動量調整", () => {
    it("高 PR 且正動量應應用懲罰乘數", () => {
      const pbRecordsObjects = Array.from({ length: 10 }, (_, i) => ({
        pr: 50 + i * 5,
      }));
      // currentPR = 90 (>= 80)
      // prMomentum = 40 (> 2)

      const result = resolveValuationMomentum(90, pbRecordsObjects, defaultConfig);

      expect(result.momentumAdjustment).toBe(0.8);
      expect(result.momentumLabel).toContain("估值動量");
      expect(result.momentumLabel).toContain("壓縮");
    });

    it("高 PR 但動量不足應不應用懲罰", () => {
      const pbRecordsObjects = Array.from({ length: 10 }, (_, i) => ({
        pr: 88 + i * 0.5,
      }));
      // currentPR = 90 (>= 80)
      // prMomentum = 1 (< 2)

      const result = resolveValuationMomentum(90, pbRecordsObjects, defaultConfig);

      expect(result.momentumAdjustment).toBe(1.0);
    });

    it("低 PR 應不應用懲罰", () => {
      const pbRecordsObjects = Array.from({ length: 10 }, (_, i) => ({
        pr: 20 + i * 5,
      }));
      // currentPR = 65 (< 80)

      const result = resolveValuationMomentum(65, pbRecordsObjects, defaultConfig);

      expect(result.momentumAdjustment).toBe(1.0);
    });
  });
});

describe("valuationGuard - evaluateValuationGuard", () => {
  const defaultStrategy = {
    valuationGuard: {
      enabled: true,
      latch: {
        triggerPrThreshold: 90,
        unlockConditions: {
          condition1: { prBelowThreshold: 50 },
        },
      },
    },
  };

  const defaultValuationGuardResult = {
    guardActive: true,
    currentPR: 95,
    multiplier: 0.3,
    hitTier: { minPr: 90, multiplier: 0.3 },
    hitTierIndex: 2,
  };

  describe("Latch 觸發", () => {
    it("PR >= 90 且 latch 未啟用應觸發 latch", () => {
      const ctx = {
        valuationGuardState: {
          latchActive: false,
          latchTriggeredAt: null,
          latchTriggeredPR: null,
        },
      };

      const result = evaluateValuationGuard(
        ctx,
        defaultStrategy,
        defaultValuationGuardResult,
      );

      expect(result).toBeDefined();
      expect(result.valuationGuardStatus).toBe("latch_triggered");
      expect(result.marketStatus).toContain("清算觸發");
      expect(result.target).toContain("立即清倉");
      expect(result.shouldLatch).toBe(true);
      expect(result.latchNowActive).toBe(true);
    });

    it("PR 正好等於 90 應觸發 latch", () => {
      const ctx = {
        valuationGuardState: {
          latchActive: false,
        },
      };

      const vgResult = {
        ...defaultValuationGuardResult,
        currentPR: 90,
      };

      const result = evaluateValuationGuard(ctx, defaultStrategy, vgResult);

      expect(result.valuationGuardStatus).toBe("latch_triggered");
    });
  });

  describe("Latch 維持", () => {
    it("Latch 已啟用且 PR 仍高應返回 active", () => {
      const ctx = {
        valuationGuardState: {
          latchActive: true,
          latchTriggeredAt: "2024-01-01",
          latchTriggeredPR: 95,
        },
      };

      const vgResult = {
        ...defaultValuationGuardResult,
        currentPR: 85, // 仍高於 50
      };

      const result = evaluateValuationGuard(ctx, defaultStrategy, vgResult);

      expect(result.valuationGuardStatus).toBe("latch_active");
      expect(result.marketStatus).toContain("清算鎖定");
      expect(result.target).toContain("清倉降槓");
    });

    it("Latch 已啟用且 PR 低於 50 應解鎖（返回 null）", () => {
      const ctx = {
        valuationGuardState: {
          latchActive: true,
          latchTriggeredAt: "2024-01-01",
          latchTriggeredPR: 95,
        },
      };

      const vgResult = {
        ...defaultValuationGuardResult,
        currentPR: 45, // 低於 50
      };

      const result = evaluateValuationGuard(ctx, defaultStrategy, vgResult);

      // 解鎖時返回 null
      expect(result).toBeNull();
    });
  });

  describe("Guard 活躍但無 Latch", () => {
    it("multiplier < 0.5 應返回 guard_active", () => {
      const ctx = {
        valuationGuardState: {
          latchActive: false,
        },
      };

      const vgResult = {
        guardActive: true,
        currentPR: 85, // 低於 90，不觸發 latch
        multiplier: 0.4, // < 0.5
      };

      const result = evaluateValuationGuard(ctx, defaultStrategy, vgResult);

      expect(result.valuationGuardStatus).toBe("guard_active");
      expect(result.marketStatus).toContain("強勢壓縮");
      expect(result.target).toContain("槓桿限制");
    });

    it("multiplier >= 0.5 應返回 null", () => {
      const ctx = {
        valuationGuardState: {
          latchActive: false,
        },
      };

      const vgResult = {
        guardActive: true,
        currentPR: 75,
        multiplier: 0.6, // >= 0.5
      };

      const result = evaluateValuationGuard(ctx, defaultStrategy, vgResult);

      expect(result).toBeNull();
    });
  });

  describe("Guard 未啟用", () => {
    it("valuationGuard.enabled = false 應返回 null", () => {
      const ctx = {
        valuationGuardState: {
          latchActive: false,
        },
      };

      const strategy = {
        valuationGuard: { enabled: false },
      };

      const result = evaluateValuationGuard(ctx, strategy, defaultValuationGuardResult);

      expect(result).toBeNull();
    });
  });

  describe("自定義閾值", () => {
    it("應使用自定義 triggerPrThreshold", () => {
      const strategy = {
        valuationGuard: {
          enabled: true,
          latch: {
            triggerPrThreshold: 85,
            unlockConditions: {
              condition1: { prBelowThreshold: 40 },
            },
          },
        },
      };

      const ctx = {
        valuationGuardState: {
          latchActive: false,
        },
      };

      const vgResult = {
        guardActive: true,
        currentPR: 87, // >= 85
        multiplier: 0.5,
      };

      const result = evaluateValuationGuard(ctx, strategy, vgResult);

      expect(result.valuationGuardStatus).toBe("latch_triggered");
    });

    it("應使用自定義 prBelowThreshold", () => {
      const strategy = {
        valuationGuard: {
          enabled: true,
          latch: {
            triggerPrThreshold: 90,
            unlockConditions: {
              condition1: { prBelowThreshold: 40 },
            },
          },
        },
      };

      const ctx = {
        valuationGuardState: {
          latchActive: true,
          latchTriggeredAt: "2024-01-01",
          latchTriggeredPR: 95,
        },
      };

      const vgResult = {
        guardActive: true,
        currentPR: 45, // 高於 40，仍鎖定
        multiplier: 0.3,
      };

      const result = evaluateValuationGuard(ctx, strategy, vgResult);

      expect(result.valuationGuardStatus).toBe("latch_active");
    });
  });
});

describe("valuationGuard - 整合場景測試", () => {
  const strategy = {
    valuationGuard: {
      enabled: true,
      tiers: [
        { minPr: 50, multiplier: 0.8 },
        { minPr: 70, multiplier: 0.6 },
        { minPr: 90, multiplier: 0.3 },
      ],
      latch: {
        triggerPrThreshold: 90,
        unlockConditions: {
          condition1: { prBelowThreshold: 50 },
        },
      },
    },
  };

  it("場景：估值從正常到觸發 Latch 的完整流程", () => {
    const pbRecords = Array.from({ length: 100 }, (_, i) => 1 + i * 0.015);

    // 階段 1: 正常估值 (PR ~30)
    let vgResult = resolveValuationGuard(1.45, pbRecords, strategy);
    expect(vgResult.currentPR).toBe(30);
    expect(vgResult.guardActive).toBe(false);

    let evalResult = evaluateValuationGuard(
      { valuationGuardState: { latchActive: false } },
      strategy,
      vgResult,
    );
    expect(evalResult).toBeNull();

    // 階段 2: 估值偏高 (PR ~75)
    vgResult = resolveValuationGuard(1.62, pbRecords, strategy);
    expect(vgResult.currentPR).toBe(75);
    expect(vgResult.guardActive).toBe(true);
    expect(vgResult.multiplier).toBe(0.6);

    evalResult = evaluateValuationGuard(
      { valuationGuardState: { latchActive: false } },
      strategy,
      vgResult,
    );
    expect(evalResult).toBeNull(); // multiplier >= 0.5

    // 階段 3: 估值極高但未觸發 Latch (PR ~88)
    vgResult = resolveValuationGuard(1.75, pbRecords, strategy);
    expect(vgResult.currentPR).toBe(88);
    expect(vgResult.multiplier).toBe(0.6);

    evalResult = evaluateValuationGuard(
      { valuationGuardState: { latchActive: false } },
      strategy,
      vgResult,
    );
    expect(evalResult).toBeNull(); // PR < 90

    // 階段 4: 觸發 Latch (PR = 92)
    vgResult = resolveValuationGuard(1.85, pbRecords, strategy);
    expect(vgResult.currentPR).toBe(92);
    expect(vgResult.multiplier).toBe(0.3);

    evalResult = evaluateValuationGuard(
      { valuationGuardState: { latchActive: false } },
      strategy,
      vgResult,
    );
    expect(evalResult.valuationGuardStatus).toBe("latch_triggered");

    // 階段 5: Latch 維持中 (PR = 85)
    evalResult = evaluateValuationGuard(
      {
        valuationGuardState: {
          latchActive: true,
          latchTriggeredAt: "2024-01-01",
          latchTriggeredPR: 92,
        },
      },
      strategy,
      { ...vgResult, currentPR: 85 },
    );
    expect(evalResult.valuationGuardStatus).toBe("latch_active");

    // 階段 6: 解鎖 (PR = 45)
    evalResult = evaluateValuationGuard(
      {
        valuationGuardState: {
          latchActive: true,
          latchTriggeredAt: "2024-01-01",
          latchTriggeredPR: 92,
        },
      },
      strategy,
      { ...vgResult, currentPR: 45 },
    );
    expect(evalResult).toBeNull(); // 解鎖
  });
});
