import { describe, expect, it } from "vitest";
import { tabs } from "../config/tabsConfig.js";

describe("tabsConfig", () => {
  it("應有 5 個導覽項目", () => {
    expect(tabs).toHaveLength(5);
  });

  it("項目路徑應符合統合後的導覽結構", () => {
    const paths = tabs.map((t) => t.to);
    expect(paths).toContain("/dashboard");
    expect(paths).toContain("/insights");
    expect(paths).toContain("/news");
    expect(paths).toContain("/chart");
    expect(paths).toContain("/account");
    expect(paths).not.toContain("/radar");
    expect(paths).not.toContain("/theory");
  });

  it("每個項目應有 label 與 testId", () => {
    for (const tab of tabs) {
      expect(tab.label).toBeTruthy();
      expect(tab.testId).toBeTruthy();
      expect(tab.icon).toBeTruthy();
    }
  });

  it("insights 標籤應為「洞察」", () => {
    const insights = tabs.find((t) => t.to === "/insights");
    expect(insights.label).toBe("洞察");
    expect(insights.testId).toBe("nav-tab-insights");
  });

  it("chart 標籤應為「圖表」", () => {
    const chart = tabs.find((t) => t.to === "/chart");
    expect(chart.label).toBe("圖表");
    expect(chart.testId).toBe("nav-tab-chart");
  });
});
