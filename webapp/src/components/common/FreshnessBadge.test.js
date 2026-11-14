import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import FreshnessBadge from "./FreshnessBadge.vue";

describe("FreshnessBadge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const oneHourAgo = new Date("2026-11-14T11:30:00Z").getTime(); // 30 分鐘前，穩定落在 fresh
  const threeHoursAgo = new Date("2026-11-14T09:00:00Z").getTime(); // 3 小時前
  const twentyFiveHoursAgo = new Date("2026-11-13T11:00:00Z").getTime(); // 25 小時前

  it("未滿 1 小時顯示 fresh（綠色）", () => {
    const wrapper = mount(FreshnessBadge, {
      props: { timestamp: oneHourAgo, label: "更新" },
    });
    expect(wrapper.classes()).toContain("freshness-badge--fresh");
    expect(wrapper.find(".icon-clock").exists()).toBe(true);
  });

  it("1–6 小時顯示 stale（黃色）", () => {
    const wrapper = mount(FreshnessBadge, {
      props: { timestamp: threeHoursAgo, label: "更新" },
    });
    expect(wrapper.classes()).toContain("freshness-badge--stale");
  });

  it("超過 6 小時顯示 expired（紅色）", () => {
    const wrapper = mount(FreshnessBadge, {
      props: { timestamp: twentyFiveHoursAgo, label: "更新" },
    });
    expect(wrapper.classes()).toContain("freshness-badge--expired");
  });

  it("顯示自訂 label", () => {
    const wrapper = mount(FreshnessBadge, {
      props: { timestamp: oneHourAgo, label: "最後同步" },
    });
    expect(wrapper.text()).toContain("最後同步");
  });

  it("顯示絕對時間在 title 屬性", () => {
    const wrapper = mount(FreshnessBadge, {
      props: { timestamp: oneHourAgo },
    });
    expect(wrapper.attributes("title")).toContain("2026-11-14T11:30:00");
  });

  it("首次掛載時 emit level-change（immediate: true），level 為 fresh", () => {
    const wrapper = mount(FreshnessBadge, {
      props: { timestamp: oneHourAgo, label: "更新" },
    });
    const emitted = wrapper.emitted("level-change");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0]).toBe("fresh");
  });

  it("三小時前 emit level-change，level 為 stale", () => {
    const wrapper = mount(FreshnessBadge, {
      props: { timestamp: threeHoursAgo, label: "更新" },
    });
    const emitted = wrapper.emitted("level-change");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0]).toBe("stale");
  });

  it("超過 6 小時 emit level-change，level 為 expired", () => {
    const wrapper = mount(FreshnessBadge, {
      props: { timestamp: twentyFiveHoursAgo, label: "更新" },
    });
    const emitted = wrapper.emitted("level-change");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0]).toBe("expired");
  });
});
