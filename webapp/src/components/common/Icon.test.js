import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Icon from "./Icon.vue";

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
