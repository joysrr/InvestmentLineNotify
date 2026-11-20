import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StrategyStatusSummary from "./StrategyStatusSummary.vue";

const baseHealth = {
  weightScore: { total: 78 },
  cooldown: { inCooldown: false, daysLeft: 0 },
  timestamp: "2026-11-14T08:00:00Z",
};

const baseProps = {
  health: baseHealth,
  loading: false,
  error: null,
};

describe("StrategyStatusSummary.vue", () => {
  it("外層使用 ContentCard，variant=outlined", () => {
    const wrapper = mount(StrategyStatusSummary, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
  });

  it("時間戳固定顯示台北時區，無效值顯示未知標記", () => {
    const wrapper = mount(StrategyStatusSummary, {
      props: {
        ...baseProps,
        health: { ...baseHealth, timestamp: "2026-11-12T06:30:00Z" },
      },
    });
    expect(wrapper.text()).toContain("2026-11-12 14:30");

    const invalid = mount(StrategyStatusSummary, {
      props: { ...baseProps, health: { ...baseHealth, timestamp: "invalid" } },
    });
    expect(invalid.text()).toContain("—");
  });

  it("顯示策略總分", () => {
    const wrapper = mount(StrategyStatusSummary, { props: baseProps });
    expect(wrapper.text()).toContain("78");
    expect(wrapper.text()).toContain("策略狀態摘要");
  });

  it("loading 時顯示 skeleton-list", () => {
    const wrapper = mount(StrategyStatusSummary, {
      props: { ...baseProps, loading: true },
    });
    expect(wrapper.find(".skeleton-list").exists()).toBe(true);
  });

  it("error 時顯示 inline-error 並隱藏內容", () => {
    const wrapper = mount(StrategyStatusSummary, {
      props: { ...baseProps, error: "載入失敗", health: null },
    });
    expect(wrapper.text()).toContain("載入失敗");
    expect(wrapper.find(".status-summary-content").exists()).toBe(false);
  });

  it("點擊摘要卡 emit click，供父層開啟 drawer", () => {
    const wrapper = mount(StrategyStatusSummary, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    card.vm.$emit("click");
    expect(wrapper.emitted("click")).toHaveLength(1);
  });
});
