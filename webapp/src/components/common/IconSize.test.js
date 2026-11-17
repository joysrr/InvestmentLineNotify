import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Icon from "./Icon.vue";

// P0-3 · 尺寸映射守護
// 背景：SIZE_MAP 曾缺 xs，導致 TechnicalPanel 的 size="xs" 直出 width="xs"，
// SVG 尺寸失效。此測試鎖定「已知 key → 固定值」「未知 key → 20」兩條不變量。
describe("Icon.vue · 尺寸映射", () => {
  const CASES = [
    ["xs", "12"],
    ["sm", "16"],
    ["md", "20"],
    ["lg", "24"],
    ["xl", "32"],
  ];

  it.each(CASES)("size=%s 應輸出 %spx", (size, expected) => {
    const wrapper = mount(Icon, { props: { name: "ok", size } });
    const svg = wrapper.find("svg");
    expect(svg.attributes("width")).toBe(expected);
    expect(svg.attributes("height")).toBe(expected);
  });

  it("未知 size key 回退為 20，不得直出字串", () => {
    const wrapper = mount(Icon, { props: { name: "ok", size: "huge" } });
    const svg = wrapper.find("svg");
    expect(svg.attributes("width")).toBe("20");
    expect(svg.attributes("height")).toBe("20");
  });

  it("數字 size 直接轉字串", () => {
    const wrapper = mount(Icon, { props: { name: "ok", size: 40 } });
    expect(wrapper.find("svg").attributes("width")).toBe("40");
  });

  it("未傳 size 時預設 20", () => {
    const wrapper = mount(Icon, { props: { name: "ok" } });
    expect(wrapper.find("svg").attributes("width")).toBe("20");
  });
});
