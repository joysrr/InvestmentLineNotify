import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import DecisionHero from "./DecisionHero.vue";

const baseProps = {
  report: {
    date: "2026-11-13",
    signals: { target: "買入", suggestion: "逐步建倉", score: 85 },
  },
  loading: false,
  error: false,
  activePriority: "高",
  targetClass: "target-buy",
  pctClass: "badge-ok",
  pctText: "+12.5%",
  routingPath: "0050 → 00675L",
  showTrendLink: true,
};

describe("DecisionHero.vue", () => {
  it("外層使用 ContentCard，variant=outlined padding=lg radius=lg", () => {
    const wrapper = mount(DecisionHero, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
    expect(card.props("padding")).toBe("lg");
    expect(card.props("radius")).toBe("lg");
  });

  it("loading 時顯示 skeleton-card", () => {
    const wrapper = mount(DecisionHero, {
      props: { ...baseProps, loading: true },
    });
    expect(wrapper.find(".skeleton-card").exists()).toBe(true);
  });

  it("error 時顯示 inline-error", () => {
    const wrapper = mount(DecisionHero, {
      props: { ...baseProps, error: true, report: null },
    });
    expect(wrapper.find(".inline-error").exists()).toBe(true);
  });

  it("report 為 null 時顯示 inline-hint", () => {
    const wrapper = mount(DecisionHero, {
      props: { ...baseProps, report: null },
    });
    expect(wrapper.find(".inline-hint").exists()).toBe(true);
  });

  it("report 有值時顯示目標、建議、評分", () => {
    const wrapper = mount(DecisionHero, { props: baseProps });
    expect(wrapper.text()).toContain("買入");
    expect(wrapper.text()).toContain("逐步建倉");
    expect(wrapper.text()).toContain("85");
  });

  it("顯示資產趨勢連結", () => {
    const wrapper = mount(DecisionHero, { props: baseProps });
    expect(wrapper.find(".hero-trend-link").exists()).toBe(true);
  });
});
