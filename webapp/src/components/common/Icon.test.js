import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Icon from "./Icon.vue";
import * as registry from "./icon-registry.js";
import { ICON_MAP, ICON_NAMES } from "./icon-registry.js";

// 收集所有 *_PATH 常數供路徑守護測試使用
const pathConstants = Object.fromEntries(
  Object.entries(registry).filter(([k]) => k.endsWith("_PATH")),
);

describe("Icon.vue", () => {
  it("渲染 ok 圖示 (svg 元素)", () => {
    const wrapper = mount(Icon, { props: { name: "ok" } });
    const svg = wrapper.find("svg");
    expect(svg.exists()).toBe(true);
  });

  it("渲染 danger 圖示 (svg 元素)", () => {
    const wrapper = mount(Icon, { props: { name: "danger" } });
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("渲染 warn 圖示 (svg 元素)", () => {
    const wrapper = mount(Icon, { props: { name: "warn" } });
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("渲染 neutral 圖示 (svg 元素)", () => {
    const wrapper = mount(Icon, { props: { name: "neutral" } });
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("渲染 chart 圖示 (svg 元素)", () => {
    const wrapper = mount(Icon, { props: { name: "chart" } });
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("渲染 shield 圖示 (svg 元素)", () => {
    const wrapper = mount(Icon, { props: { name: "shield" } });
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("不存在的 name 回退到預設圖示 (circle)", () => {
    const wrapper = mount(Icon, { props: { name: "nonexistent" } });
    expect(wrapper.find("svg").exists()).toBe(true);
  });

  it("size prop 應用到 svg width/height", () => {
    const wrapper = mount(Icon, { props: { name: "ok", size: "lg" } });
    const svg = wrapper.find("svg");
    expect(svg.attributes("width")).toBe("24");
    expect(svg.attributes("height")).toBe("24");
  });

  it("color prop 應用到 svg fill", () => {
    const wrapper = mount(Icon, { props: { name: "ok", color: "#ff0000" } });
    const svg = wrapper.find("svg");
    expect(svg.attributes("fill")).toBe("#ff0000");
  });

  it("渲染 settings 圖示 (path 元素，非預設 fallback)", () => {
    const wrapper = mount(Icon, { props: { name: "settings", size: "sm" } });
    expect(wrapper.find("path").exists()).toBe(true);
    expect(wrapper.find("svg").attributes("width")).toBe("16");
  });

  it("渲染 search 圖示 (path 元素，非預設 fallback)", () => {
    const wrapper = mount(Icon, { props: { name: "search", size: "sm" } });
    expect(wrapper.find("path").exists()).toBe(true);
  });

  it("渲染 info 圖示 (path 元素，非預設 fallback)", () => {
    const wrapper = mount(Icon, { props: { name: "info", size: "sm" } });
    expect(wrapper.find("path").exists()).toBe(true);
  });

  it("渲染 news 圖示 (path 元素，非預設 fallback)", () => {
    const wrapper = mount(Icon, { props: { name: "news", size: "sm" } });
    expect(wrapper.find("path").exists()).toBe(true);
  });

  it("渲染 wallet 圖示 (path 元素，非預設 fallback)", () => {
    const wrapper = mount(Icon, { props: { name: "wallet", size: "sm" } });
    expect(wrapper.find("path").exists()).toBe(true);
  });
});

describe("Icon.vue · path 資料守護", () => {
  // P0-4 · SETTINGS_PATH 曾損壞（"-.08-.47 0 .59-.22" 這類非法指令），
  // 導致齒輪渲染成殘缺圖形。注意：合法的相對貝茲指令也會出現
  // "-.32-.02" 這種形態，因此不能靠該模式判斷，改用結構化斷言。
  it("所有 PATH 常數以 M 開頭、無連續空格、以 z/Z 閉合", () => {
    const bad = [];
    for (const [key, val] of Object.entries(pathConstants)) {
      if (typeof val !== "string") continue;
      if (!val.startsWith("M")) bad.push(`${key}: 未以 M 開頭`);
      if (val.includes("  ")) bad.push(`${key}: 含連續空格`);
      if (!/[zZ]$/.test(val)) bad.push(`${key}: 未以 z/Z 閉合`);
    }
    expect(bad).toEqual([]);
  });

  it("SETTINGS_PATH 為完整齒輪幾何（含圓心段與足夠長度）", () => {
    // 標準 Material gear：外圈齒 + 內圓，長度約 640+
    expect(pathConstants.SETTINGS_PATH.length).toBeGreaterThan(500);
    expect(pathConstants.SETTINGS_PATH).toContain("12 15.6");
    expect(pathConstants.SETTINGS_PATH).toContain("12 8.4");
  });

  it("ICON_MAP 中每個圖示都綁定了 component", () => {
    const bad = ICON_NAMES.filter((n) => !ICON_MAP[n]?.component);
    expect(bad).toEqual([]);
  });
});
