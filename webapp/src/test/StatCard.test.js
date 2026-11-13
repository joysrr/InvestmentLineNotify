import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { readFileSync } from "node:fs";
import path from "node:path";
import StatCard from "@/components/common/StatCard.vue";

describe("StatCard.vue (B10: design tokens)", () => {
  const baseProps = {
    label: "測試指標",
    value: 100,
    unit: "%",
  };

  it("framed 為 true 時套用 stat-card--framed class", () => {
    const wrapper = mount(StatCard, { props: { ...baseProps, framed: true } });
    expect(wrapper.classes()).toContain("stat-card--framed");
  });

  it("framed 為 false 時不套用 stat-card--framed class", () => {
    const wrapper = mount(StatCard, { props: { ...baseProps, framed: false } });
    expect(wrapper.classes()).not.toContain("stat-card--framed");
  });

  it("CSS 中 .stat-card--framed 應使用 --iln-space-3 而非硬編碼 12px", () => {
    const sfcPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "../components/common/StatCard.vue",
    );
    const sfc = readFileSync(sfcPath, "utf-8");
    // 不應包含硬編碼的 padding: 12px
    expect(sfc).not.toContain("padding: 12px");
    // 應使用設計令牌 --iln-space-3
    expect(sfc).toContain("padding: var(--iln-space-3)");
  });

  it('trend="up" 渲染 arrow-up 圖示，無 ::after 趨勢字元', () => {
    const wrapper = mount(StatCard, { props: { ...baseProps, trend: "up" } });
    const icon = wrapper.findComponent({ name: "Icon" });
    expect(icon.exists()).toBe(true);
    expect(icon.props("name")).toBe("arrow-up");
  });

  it('trend="down" 渲染 arrow-down 圖示', () => {
    const wrapper = mount(StatCard, { props: { ...baseProps, trend: "down" } });
    const icon = wrapper.findComponent({ name: "Icon" });
    expect(icon.exists()).toBe(true);
    expect(icon.props("name")).toBe("arrow-down");
  });

  it('trend="flat" 渲染 minus 圖示', () => {
    const wrapper = mount(StatCard, { props: { ...baseProps, trend: "flat" } });
    const icon = wrapper.findComponent({ name: "Icon" });
    expect(icon.exists()).toBe(true);
    expect(icon.props("name")).toBe("minus");
  });

  it("trend=null 不渲染趨勢圖示", () => {
    const wrapper = mount(StatCard, { props: baseProps });
    const icons = wrapper.findAllComponents({ name: "Icon" });
    expect(icons.length).toBe(0);
  });

  it("CSS 中無 ::after 趨勢字元 ▲ ▼ —", () => {
    const sfcPath = path.resolve(
      path.dirname(new URL(import.meta.url).pathname),
      "../components/common/StatCard.vue",
    );
    const sfc = readFileSync(sfcPath, "utf-8");
    expect(sfc).not.toContain('content: " ▲"');
    expect(sfc).not.toContain('content: " ▼"');
    expect(sfc).not.toContain('content: " —"');
  });
});
