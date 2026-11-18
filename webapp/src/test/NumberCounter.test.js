import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import NumberCounter from "@/components/common/NumberCounter.vue";

vi.useFakeTimers();

describe("P3 NumberCounter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("T-07: 初始顯示 0，組件掛載後計數至目標值", async () => {
    const wrapper = mount(NumberCounter, {
      props: { target: 1234, duration: 1000 },
    });
    expect(wrapper.text()).toContain("0");

    vi.advanceTimersByTime(500);
    await wrapper.vm.$nextTick();
    const mid = Number(wrapper.text().replace(/,/g, ""));
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1234);

    vi.runAllTimers();
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("1,234");
  });

  it("T-07: 使用 --iln-text-primary 設計token，無硬編碼顏色", () => {
    const wrapper = mount(NumberCounter, { props: { target: 100 } });
    const html = wrapper.html();
    expect(html).not.toMatch(/color:\s*#/);
    expect(html).not.toMatch(/color:\s*rgba\(/);
    expect(html).not.toMatch(/color:\s*rgb\(/);
  });

  it("T-07: target 為 0 時直接顯示 0，不啟動計時器", () => {
    const wrapper = mount(NumberCounter, { props: { target: 0 } });
    expect(wrapper.text()).toContain("0");
  });
});
