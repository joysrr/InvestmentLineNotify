import { describe, it, expect } from "vitest";
import { buildDecision } from "../../modules/strategy/strategyEngine.mjs";
import { createMockStrategy, createMockCtx } from "../utils/mockFactory.mjs";

describe("StrategyEngine Orchestrator Integration", () => {
  const strategy = createMockStrategy();

  it("應優先處理 🔴 斷頭危機 (Critical Margin)", async () => {
    const ctx = createMockCtx({ maintenanceMargin: 130 });
    const res = await buildDecision(ctx, strategy, null);

    expect(res.maintenanceLayer).toBe("critical");
    expect(res.marketStatus).toContain("斷頭");
    expect(res.target).toContain("強制降槓桿");
  });

  it("應在 🟠 高危凍結 (Frozen Zone) 攔截加碼", async () => {
    const ctx = createMockCtx({ maintenanceMargin: 140 });
    const res = await buildDecision(ctx, strategy, null);

    expect(res.maintenanceLayer).toBe("frozen");
    expect(res.target).toContain("禁止進場");
  });

  it("應正確攔截 EntryGate 封鎖 (RSI 過高)", async () => {
    const ctx = createMockCtx({ priceDropPercent: 2, rsi: 80 });
    const res = await buildDecision(ctx, strategy, null);

    expect(res.entryGateBlocked).toBe(true);
    expect(res.marketStatus).toContain("前置過濾");
  });

  it("應觸發 Valuation Guard Latch (PR 100)", async () => {
    const ctx = createMockCtx({ valuation: { pb: 3.0 } }); // 極高 PB
    const res = await buildDecision(ctx, strategy, null);

    expect(res.valuationGuardStatus).toBe("latch_triggered");
    expect(res.marketStatus).toContain("估值守衛");
    expect(res.target).toContain("清倉");
  });

  it("正常市況應輸出 Scoring Matrix 建議 (Neutral)", async () => {
    const ctx = createMockCtx();
    const res = await buildDecision(ctx, strategy, null);

    expect(res.marketStatus).toContain("常態佈局");
    expect(res.target).toContain("0050 DCA");
  });
});
