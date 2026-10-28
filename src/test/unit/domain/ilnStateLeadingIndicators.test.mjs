import { describe, it, expect } from "vitest";
import { IlnState } from "../../../domain/ilnState.mjs";

describe("Phase A: IlnState Leading Indicators Support", () => {
  it("正確將 leadingIndicators 封裝並輸出於 toReportObject 與 toStatusPayload", () => {
    const mockLeadingIndicators = {
      hasAnyRadarTriggered: true,
      radars: {
        overnightShock: { triggered: true },
        marginSettling: { triggered: false },
        extremePanic: { triggered: false },
        retailSentiment: { triggered: false },
      },
      stateMachine: {
        state: "TRIGGERED",
        cooldownDays: 0,
        activeDays: 1,
      },
      constraints: {
        freeze00675L: true,
        allowLeft0050: false,
        p0Exempt: true,
      },
      telegramCard: "🚨【極端雷達矩陣警報】美股隔夜衝擊 觸發",
    };

    const state = new IlnState({
      marketState: {},
      rawMarket: { _meta: { test: true }, data: { someMarket: 123 } },
      leadingIndicators: mockLeadingIndicators,
      reportDate: "2026-10-20",
    });

    // 1. toReportObject 需包含 leadingIndicators
    const reportObj = state.toReportObject();
    expect(reportObj.leadingIndicators).toBeDefined();
    expect(reportObj.leadingIndicators.hasAnyRadarTriggered).toBe(true);
    expect(reportObj.leadingIndicators.stateMachine.state).toBe("TRIGGERED");

    // 2. toStatusPayload 需輸出 leadingIndicators (向下相容)
    const statusPayload = state.toStatusPayload();
    expect(statusPayload.leadingIndicators).toBeDefined();
    expect(statusPayload.leadingIndicators.telegramCard).toContain(
      "美股隔夜衝擊",
    );
    expect(statusPayload.data.someMarket).toBe(123);
  });
});
