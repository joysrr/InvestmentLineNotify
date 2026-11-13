import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RiskDetailDrawer from "./RiskDetailDrawer.vue";

const baseProps = {
  visible: true,
  marginRatio: 200,
  grossLeverage: 1.5,
  hardCapLeverage: 3.0,
  warningThreshold: 160,
  dropBufferPercent: 20,
};

const mountOpts = {
  global: {
    stubs: {
      "el-drawer": {
        template: '<div><slot /></div><div><slot name="header" /></div>',
      },
    },
  },
};

describe("RiskDetailDrawer.vue", () => {
  it("內部包含 3 個 ContentCard（2 度量行 + 1 風控提示卡）", () => {
    const wrapper = mount(RiskDetailDrawer, { props: baseProps, ...mountOpts });
    const cards = wrapper.findAllComponents({ name: "ContentCard" });
    expect(cards.length).toBe(3);
  });

  it("度量行 ContentCard variant=flat padding=sm radius=md", () => {
    const wrapper = mount(RiskDetailDrawer, { props: baseProps, ...mountOpts });
    const cards = wrapper.findAllComponents({ name: "ContentCard" });
    const metricCards = cards.filter((c) => c.props("variant") === "flat");
    expect(metricCards.length).toBe(2);
    metricCards.forEach((card) => {
      expect(card.props("padding")).toBe("sm");
      expect(card.props("radius")).toBe("md");
    });
  });

  it("風控提示卡 ContentCard variant=outlined padding=md radius=lg", () => {
    const wrapper = mount(RiskDetailDrawer, { props: baseProps, ...mountOpts });
    const cards = wrapper.findAllComponents({ name: "ContentCard" });
    const infoCards = cards.filter((c) => c.props("variant") === "outlined");
    expect(infoCards.length).toBe(1);
    expect(infoCards[0].props("padding")).toBe("md");
    expect(infoCards[0].props("radius")).toBe("lg");
  });

  it("顯示維持率數值", () => {
    const wrapper = mount(RiskDetailDrawer, { props: baseProps, ...mountOpts });
    expect(wrapper.text()).toContain("200%");
  });

  it("顯示槓桿倍率", () => {
    const wrapper = mount(RiskDetailDrawer, { props: baseProps, ...mountOpts });
    expect(wrapper.text()).toContain("1.50x");
  });

  it("顯示風控原則標題", () => {
    const wrapper = mount(RiskDetailDrawer, { props: baseProps, ...mountOpts });
    expect(wrapper.text()).toContain("質押與槓桿風控原則");
  });
});
