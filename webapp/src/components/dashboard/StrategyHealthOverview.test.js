import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StrategyHealthOverview from "./StrategyHealthOverview.vue";

const baseProps = {
  loading: false,
  health: {
    score: 78,
    status: "green",
    lightStatus: { emoji: "🟢", label: "綠燈" },
    summary: "策略執行良好",
    components: [
      { title: "配置比例", value: "85%", status: "ok" },
      { title: "風險敞口", value: "中低", status: "warn" },
    ],
  },
  report: {
    signals: {
      target: "建議加碼",
      valuationGuardResult: { currentPR: 0.85 },
      grossLeverage: 1.2,
    },
  },
};

describe("StrategyHealthOverview.vue", () => {
  it("內部包含 3 個 ContentCard（1 banner + 2 card）", () => {
    const wrapper = mount(StrategyHealthOverview, { props: baseProps });
    const cards = wrapper.findAllComponents({ name: "ContentCard" });
    expect(cards.length).toBe(3);
  });

  it("summary-banner 用 ContentCard variant=outlined padding=lg radius=xl statusStyle=left-border", () => {
    const wrapper = mount(StrategyHealthOverview, { props: baseProps });
    const banner = wrapper
      .find('[data-testid="summary-banner"]')
      .findComponent({ name: "ContentCard" });
    expect(banner.props("variant")).toBe("outlined");
    expect(banner.props("padding")).toBe("lg");
    expect(banner.props("radius")).toBe("xl");
    expect(banner.props("statusStyle")).toBe("left-border");
  });

  it("banner status 隨健康狀態切換 (green→ok, yellow→warn, red→danger)", () => {
    const wrapperGreen = mount(StrategyHealthOverview, {
      props: { ...baseProps, health: { ...baseProps.health, status: "green" } },
    });
    const greenCard = wrapperGreen
      .find('[data-testid="summary-banner"]')
      .findComponent({ name: "ContentCard" });
    expect(greenCard.props("status")).toBe("ok");

    const wrapperYellow = mount(StrategyHealthOverview, {
      props: {
        ...baseProps,
        health: { ...baseProps.health, status: "yellow" },
      },
    });
    const yellowCard = wrapperYellow
      .find('[data-testid="summary-banner"]')
      .findComponent({ name: "ContentCard" });
    expect(yellowCard.props("status")).toBe("warn");

    const wrapperRed = mount(StrategyHealthOverview, {
      props: { ...baseProps, health: { ...baseProps.health, status: "red" } },
    });
    const redCard = wrapperRed
      .find('[data-testid="summary-banner"]')
      .findComponent({ name: "ContentCard" });
    expect(redCard.props("status")).toBe("danger");
  });

  it("soh-card 用 ContentCard variant=elevated padding=md radius=xl", () => {
    const wrapper = mount(StrategyHealthOverview, { props: baseProps });
    const cards = wrapper.findAllComponents({ name: "ContentCard" });
    const sohCards = cards.filter(
      (c) => c.vm.$el.getAttribute("data-testid") !== "summary-banner",
    );
    expect(sohCards.length).toBe(2);
    sohCards.forEach((card) => {
      expect(card.props("variant")).toBe("elevated");
      expect(card.props("padding")).toBe("md");
      expect(card.props("radius")).toBe("xl");
    });
  });
});
