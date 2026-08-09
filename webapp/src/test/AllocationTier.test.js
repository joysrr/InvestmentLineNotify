// webapp/src/test/AllocationTier.test.js
// AllocationTier 元件單元測試

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AllocationTier from "../components/dashboard/AllocationTier.vue";

describe("AllocationTier", () => {
  const baseTier = {
    minScore: 6,
    leverage: 0.4,
    cash: 0.6,
    comment: "一般訊號",
  };

  it("應正確渲染分數門檻", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: baseTier },
    });

    expect(wrapper.find(".tier-score").text()).toBe("6pt+");
  });

  it("應正確渲染槓桿與現金比例", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: baseTier },
    });

    expect(wrapper.find(".tier-leverage").text()).toBe("0.4x");
    expect(wrapper.find(".tier-cash").text()).toBe("現金 60%");
    expect(wrapper.find(".tier-comment").text()).toBe("一般訊號");
  });

  it("isCurrent=true 時應有當前樣式", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: baseTier, isCurrent: true },
    });

    expect(wrapper.classes()).toContain("is-current");
    expect(wrapper.find(".tier-fill").classes()).toContain("current");
  });

  it("isNext=true 時應有下一檔樣式", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: baseTier, isNext: true },
    });

    expect(wrapper.classes()).toContain("is-next");
    expect(wrapper.find(".tier-fill").classes()).toContain("next");
  });

  it("tierFillWidth 應依 leverage 計算", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: { ...baseTier, leverage: 0.5 } },
    });

    // 0.5 * 50 = 25%
    expect(wrapper.find(".tier-fill").element.style.width).toBe("25%");
  });

  it("leverage 過大時寬度上限 100%", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: { ...baseTier, leverage: 3 } },
    });

    expect(wrapper.find(".tier-fill").element.style.width).toBe("100%");
  });
});
