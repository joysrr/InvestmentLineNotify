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

  it("維持率缺值時顯示未知標記，不顯示 0%", () => {
    const wrapper = mount(RiskDetailDrawer, {
      props: { ...baseProps, marginRatio: Number.NaN },
      ...mountOpts,
    });
    expect(wrapper.find(".row-val").text()).toBe("—%");
  });

  it("槓桿倍率缺值時顯示未知標記，不顯示 1.00x", () => {
    const wrapper = mount(RiskDetailDrawer, {
      props: { ...baseProps, grossLeverage: "—" },
      ...mountOpts,
    });
    expect(wrapper.text()).toContain("—x");
    expect(wrapper.text()).not.toContain("1.00x");
  });

  it("風控上限為 NaN 時顯示未知標記", () => {
    const wrapper = mount(RiskDetailDrawer, {
      props: { ...baseProps, hardCapLeverage: Number.NaN },
      ...mountOpts,
    });
    expect(wrapper.text()).toContain("硬上限 —x");
  });

  it("省略風控上限時保留 3.00x 預設", () => {
    const { hardCapLeverage: _hardCapLeverage, ...props } = baseProps;
    const wrapper = mount(RiskDetailDrawer, { props, ...mountOpts });
    expect(wrapper.text()).toContain("3.00x");
  });
});
