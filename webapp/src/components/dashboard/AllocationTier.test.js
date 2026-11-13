import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AllocationTier from "./AllocationTier.vue";

const baseTier = {
  minScore: 70,
  leverage: 1,
  cash: 0.4,
  comment: "保守配置",
};

describe("AllocationTier.vue", () => {
  it("使用 ContentCard 作為外層容器，variant=outlined padding=md radius=md", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: baseTier, isCurrent: false, isNext: false },
    });
    const contentCard = wrapper.findComponent({ name: "ContentCard" });
    expect(contentCard.exists()).toBe(true);
    expect(contentCard.props("variant")).toBe("outlined");
    expect(contentCard.props("padding")).toBe("md");
    expect(contentCard.props("radius")).toBe("md");
    expect(contentCard.props("status")).toBeNull();
    expect(contentCard.props("statusStyle")).toBe("tint");
  });

  it("isCurrent=true → status=info", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: baseTier, isCurrent: true, isNext: false },
    });
    const contentCard = wrapper.findComponent({ name: "ContentCard" });
    expect(contentCard.props("status")).toBe("info");
  });

  it("isNext=true → status=warn", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: baseTier, isCurrent: false, isNext: true },
    });
    const contentCard = wrapper.findComponent({ name: "ContentCard" });
    expect(contentCard.props("status")).toBe("warn");
  });

  it("顯示 tier.minScore、leverage、cash、comment", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: baseTier, isCurrent: false, isNext: false },
    });
    expect(wrapper.text()).toContain("70pt+");
    expect(wrapper.text()).toContain("1x");
    expect(wrapper.text()).toContain("40%");
    expect(wrapper.text()).toContain("保守配置");
  });

  it("移除舊的 .allocation-tier 外框類別", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: baseTier, isCurrent: false, isNext: false },
    });
    expect(wrapper.classes()).not.toContain("allocation-tier");
  });

  it("isCurrent=true → tier-fill 有 current 類別", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: baseTier, isCurrent: true, isNext: false },
    });
    expect(wrapper.find(".tier-fill.current").exists()).toBe(true);
  });

  it("isNext=true → tier-fill 有 next 類別", () => {
    const wrapper = mount(AllocationTier, {
      props: { tier: baseTier, isCurrent: false, isNext: true },
    });
    expect(wrapper.find(".tier-fill.next").exists()).toBe(true);
  });
});
