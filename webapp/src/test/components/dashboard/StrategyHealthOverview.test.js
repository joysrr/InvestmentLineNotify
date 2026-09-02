/**
 * StrategyHealthOverview.test.js
 * 單元測試：整合元件能渲染健康度指標、市場多空、策略信號三大區塊
 */
import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StrategyHealthOverview from "@/components/dashboard/StrategyHealthOverview.vue";

const healthMock = {
  status: "GREEN",
  score: 88,
  lightStatus: { emoji: "🟢", label: "穩健" },
  summary: "整體防禦健全，可依計畫操作",
  components: [
    { title: "維持保證金", value: "2.3x", status: "green" },
    { title: "耐受跌幅", value: "35%", status: "green" },
  ],
};

const reportMock = {
  signals: {
    regimeState: "NORMAL",
    grossLeverage: 2.3,
    valuationGuardResult: { currentPR: 42 },
    target: "分批加碼",
    priceChangePercentText: "+1.2",
    weightDetails: {
      dropScore: 3,
      rsiScore: 2,
      macdScore: 4,
      kdScore: 2,
      sentimentScore: 1,
    },
  },
};

function createWrapper(props = {}) {
  return mount(StrategyHealthOverview, {
    props: {
      health: null,
      report: null,
      loading: true,
      ...props,
    },
  });
}

describe("StrategyHealthOverview", () => {
  it("loading=true 時顯示 skeleton", () => {
    const wrapper = createWrapper({ loading: true });
    expect(wrapper.find('[data-testid="summary-banner"]').exists()).toBe(false);
    expect(wrapper.find(".overview-skeleton").exists()).toBe(true);
  });

  it("渲染 Summary Banner（健康分數 + 燈號 + 建議動作）", () => {
    const wrapper = createWrapper({
      loading: false,
      health: healthMock,
      report: reportMock,
    });
    const banner = wrapper.find('[data-testid="summary-banner"]');
    expect(banner.exists()).toBe(true);
    expect(banner.text()).toContain("88");
    expect(banner.text()).toContain("穩健");
  });

  it("渲染左側健康度與風險剖析卡", () => {
    const wrapper = createWrapper({
      loading: false,
      health: healthMock,
      report: reportMock,
    });
    const card = wrapper.find('[data-testid="health-risk-card"]');
    expect(card.exists()).toBe(true);
    expect(card.text()).toContain("維持保證金");
    expect(card.text()).toContain("耐受跌幅");
  });

  it("渲染右側市場多空與策略戰術卡", () => {
    const wrapper = createWrapper({
      loading: false,
      health: healthMock,
      report: reportMock,
    });
    const card = wrapper.find('[data-testid="market-tactics-card"]');
    expect(card.exists()).toBe(true);
    expect(card.text()).toContain("分批加碼");
  });

  it("health/report 為 null 時不崩潰，顯示 fallback", () => {
    const wrapper = createWrapper({
      loading: false,
      health: null,
      report: null,
    });
    expect(wrapper.find('[data-testid="summary-banner"]').exists()).toBe(true);
    expect(wrapper.text()).not.toContain("undefined");
    expect(wrapper.text()).not.toContain("null");
  });
});
