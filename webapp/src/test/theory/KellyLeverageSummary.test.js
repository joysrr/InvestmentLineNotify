// webapp/src/test/theory/KellyLeverageSummary.test.js
// KellyLeverageSummary 元件單元測試 — Phase 3: Kelly vs 槓桿對比

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import KellyLeverageSummary from "../../components/theory/KellyLeverageSummary.vue";

describe("KellyLeverageSummary - Phase 3 Kelly vs 槓桿對比", () => {
  const baseTheory = {
    currentLeverage: 0.78,
    kellyLimits: {
      conservative: 0.05,
      full: 0.1,
    },
  };

  it("顯示當前槓桿與保守/完全凱莉", () => {
    const wrapper = mount(KellyLeverageSummary, {
      props: { theory: baseTheory },
    });

    expect(wrapper.find(".leverage-value").text()).toContain("0.78");
    expect(wrapper.find(".limit-item").exists()).toBe(true);
  });

  it("傳入 targetLeverage 時顯示槓桿對比區塊", () => {
    const theory = { ...baseTheory, targetLeverage: 1.3 };
    const wrapper = mount(KellyLeverageSummary, {
      props: { theory },
    });

    expect(wrapper.find(".leverage-comparison").exists()).toBe(true);
    expect(wrapper.text()).toContain("1.30");
  });

  it("槓桿缺口顯示為正數時顯示「可增加槓桿」", () => {
    const theory = { ...baseTheory, targetLeverage: 1.3 }; // 1.3 > 0.78
    const wrapper = mount(KellyLeverageSummary, {
      props: { theory },
    });

    expect(wrapper.text()).toContain("可增加");
  });

  it("槓桿缺口為負數時顯示「超過建議槓桿」", () => {
    const theory = { ...baseTheory, targetLeverage: 0.5 }; // 0.5 < 0.78
    const wrapper = mount(KellyLeverageSummary, {
      props: { theory },
    });

    expect(wrapper.text()).toContain("超過");
  });

  it("未傳入 targetLeverage 時不顯示對比區塊", () => {
    const wrapper = mount(KellyLeverageSummary, {
      props: { theory: baseTheory },
    });

    expect(wrapper.find(".leverage-comparison").exists()).toBe(false);
  });
});
