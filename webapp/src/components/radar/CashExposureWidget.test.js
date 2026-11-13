import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CashExposureWidget from "./CashExposureWidget.vue";

const baseProps = {
  analysis: {
    status: "RECOMMEND_DCA",
    suggestedDcaAmt: 50000,
    exposureGap: 100000,
    targetExposure: 300000,
    message: "建議加速 DCA 以補足曝險缺口",
    batchCalculation: {
      exposureGap: 100000,
      capitalGap: 50000,
      batchByCount: 10000,
      batchByCash: 20000,
      selectedBatch: 10000,
    },
    targetLeverage: 1.5,
    currentLeverage: 1.0,
    leverageGap: 0.5,
  },
};

describe("CashExposureWidget.vue", () => {
  it("外層包含 ContentCard (variant=outlined, padding=sm, radius=md)", () => {
    const wrapper = mount(CashExposureWidget, { props: baseProps });
    const cards = wrapper.findAllComponents({ name: "ContentCard" });
    expect(cards.length).toBe(1);
    expect(cards[0].props("variant")).toBe("outlined");
    expect(cards[0].props("padding")).toBe("sm");
    expect(cards[0].props("radius")).toBe("md");
  });

  it("dc-row 用 StatCard (size=sm, framed=false, align=left)", () => {
    const wrapper = mount(CashExposureWidget, { props: baseProps });
    const statCards = wrapper.findAllComponents({ name: "StatCard" });
    // 4 dc-row + 3 metric-card + 5 batch-card = 12 StatCards
    expect(statCards.length).toBe(12);
    statCards.forEach((card) => {
      expect(card.props("size")).toBe("sm");
      expect(card.props("framed")).toBe(false);
    });
  });

  it("顯示建議 DCA 金額", () => {
    const wrapper = mount(CashExposureWidget, { props: baseProps });
    expect(wrapper.text()).toContain("5.0 萬");
  });

  it("顯示曝險缺口", () => {
    const wrapper = mount(CashExposureWidget, { props: baseProps });
    expect(wrapper.text()).toContain("10.0 萬");
  });

  it("顯示目標曝險", () => {
    const wrapper = mount(CashExposureWidget, { props: baseProps });
    expect(wrapper.text()).toContain("30.0 萬");
  });

  it("顯示槓桿儀表板數值", () => {
    const wrapper = mount(CashExposureWidget, { props: baseProps });
    expect(wrapper.text()).toContain("1.50x");
    expect(wrapper.text()).toContain("1.00x");
    expect(wrapper.text()).toContain("0.50x");
  });

  it("顯示批次計算推導數值", () => {
    const wrapper = mount(CashExposureWidget, { props: baseProps });
    expect(wrapper.text()).toContain("1.0 萬");
    expect(wrapper.text()).toContain("2.0 萬");
  });

  it("顯示風險狀態訊息", () => {
    const wrapper = mount(CashExposureWidget, { props: baseProps });
    expect(wrapper.text()).toContain("建議加速 DCA");
  });
});
