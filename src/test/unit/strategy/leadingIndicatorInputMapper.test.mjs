import { describe, expect, it } from "vitest";
import { mapLeadingIndicatorInputs } from "../../../modules/strategy/leadingIndicatorInputMapper.mjs";

describe("mapLeadingIndicatorInputs", () => {
  it("將融資餘額變化億元換算為前一日基準的比例", () => {
    const result = mapLeadingIndicatorInputs({
      rawMargin: {
        marginBalance100M: 6406.18,
        marginBalanceChange100M: -49.76,
        maintenanceRatio: 181.29,
      },
    });

    expect(result.maintenanceRatio).toBe(181.29);
    expect(result.marginBalanceChangePct).toBeCloseTo(
      -49.76 / (6406.18 + 49.76),
      10,
    );
  });

  it("將大盤百分比欄位轉成雷達使用的小數比例", () => {
    const result = mapLeadingIndicatorInputs({
      rawMarketOverview: {
        changePercent: -0.61,
      },
    });

    expect(result.taiexReturn).toBeCloseTo(-0.0061, 10);
  });

  it("來源欄位缺失時回傳 null，避免以零值偽裝資料缺失", () => {
    const result = mapLeadingIndicatorInputs({});

    expect(result.maintenanceRatio).toBeNull();
    expect(result.marginBalanceChangePct).toBeNull();
    expect(result.taiexReturn).toBeNull();
  });
});
