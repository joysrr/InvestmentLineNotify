import { describe, expect, it, vi, beforeEach } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import MarketRadarView from "@/views/MarketRadarView.vue";
import StatCard from "@/components/common/StatCard.vue";
import { fetchStatus, fetchReports } from "../api/index.js";

vi.mock("../api/index.js", () => ({
  fetchStatus: vi.fn(),
  fetchReports: vi.fn(),
}));

vi.mock("@/components/radar/ExtremeRadarPanel.vue", () => ({
  default: { template: "<div data-testid='extreme-radar' />" },
}));
vi.mock("@/components/radar/CashExposureWidget.vue", () => ({
  default: { template: "<div data-testid='cash-exposure' />" },
}));
vi.mock("@/components/radar/RadarSubtabs.vue", () => ({
  default: { template: "<div data-testid='radar-subtabs' />" },
}));
vi.mock("@/components/common/GlobalErrorBoundary.vue", () => ({
  default: { template: "<div><slot /></div>" },
}));
vi.mock("@/components/common/ErrorView.vue", () => ({
  default: { template: "<div data-testid='error-view' />" },
}));
vi.mock("@/components/common/LoadingSkeleton.vue", () => ({
  default: { template: "<div data-testid='loading-skeleton' />" },
}));
vi.mock("@/components/common/Icon.vue", () => ({
  default: { template: "<span class='mock-icon' />" },
}));

const baseStatusData = {
  rawUsMarket: { vix: 18.5, spxChg: 1.2 },
  rawCnn: { score: 45, rating: "中性" },
  rawNdc: { light: "綠燈" },
  rawMargin: { marginBalance100M: 1200, maintenanceRatio: 135.5 },
  rawValuation: { pe: 14.2, pb: 1.8 },
  rawFx: { currentRate: 32.45, changePercent: 0.05 },
  leadingIndicators: { isLongTermDefense: false },
};

const baseReportData = {
  vixData: { value: 18.5 },
  usRisk: { vix: 18.5, spxChg: 1.2 },
  macroData: {
    rawMargin: { marginBalance100M: 1200, maintenanceRatio: 135.5 },
    rawValuation: { pe: 14.2, pb: 1.8 },
    rawFx: { currentRate: 32.45, changePercent: 0.05 },
  },
  valuationGuardResult: { currentPR: 1.2 },
};

describe("MarketRadarView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("應渲染 10 個 StatCard 指標卡", async () => {
    vi.mocked(fetchStatus).mockResolvedValue({
      data: baseStatusData,
    });
    vi.mocked(fetchReports).mockResolvedValue([baseReportData]);

    const wrapper = mount(MarketRadarView);
    await flushPromises();

    expect(wrapper.findAllComponents(StatCard)).toHaveLength(9);
    expect(wrapper.text()).toContain("美股 VIX");
    expect(wrapper.text()).toContain("S&P 500");
    expect(wrapper.text()).toContain("CNN 情緒");
    expect(wrapper.text()).toContain("台股 VIX");
    expect(wrapper.text()).toContain("景氣燈號");
    expect(wrapper.text()).toContain("融資維持率");
    expect(wrapper.text()).toContain("大盤 PE");
    expect(wrapper.text()).toContain("大盤 PB");
    expect(wrapper.text()).toContain("美元/台幣");

    wrapper.unmount();
  });
});
