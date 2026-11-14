import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import StrategyStatusPanel from "./StrategyStatusPanel.vue";

const baseHealth = {
  weightScore: { total: 78, dropScore: 4, rsiScore: 5 },
  cooldown: { inCooldown: false, daysLeft: 0 },
  timestamp: "2026-11-14T08:00:00Z",
};

const baseProps = {
  health: baseHealth,
  loading: false,
  error: null,
};

describe("StrategyStatusPanel.vue", () => {
  it("外層使用 ContentCard，variant=outlined", () => {
    const wrapper = mount(StrategyStatusPanel, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
  });

  it("顯示標題與策略總分", () => {
    const wrapper = mount(StrategyStatusPanel, { props: baseProps });
    expect(wrapper.text()).toContain("策略狀態面板");
    expect(wrapper.text()).toContain("78");
  });

  it("顯示 segmented control 兩個標籤頁", () => {
    const wrapper = mount(StrategyStatusPanel, { props: baseProps });
    expect(wrapper.text()).toContain("評分與檔位");
    expect(wrapper.text()).toContain("風控與機制");
  });

  it("loading 時顯示 skeleton-list", () => {
    const wrapper = mount(StrategyStatusPanel, {
      props: { ...baseProps, loading: true },
    });
    expect(wrapper.find(".skeleton-list").exists()).toBe(true);
  });

  it("error 時顯示 inline-error", () => {
    const wrapper = mount(StrategyStatusPanel, {
      props: { ...baseProps, error: "載入失敗", health: null },
    });
    expect(wrapper.text()).toContain("載入失敗");
  });
});
