import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ScoreBar from "./ScoreBar.vue";

const baseProps = {
  label: "風險評分",
  value: 3,
  max: 5,
  color: "var(--iln-warn)",
  description: "風險較高",
};

describe("ScoreBar.vue", () => {
  it("外層使用 ContentCard，variant=outlined padding=sm radius=sm", () => {
    const wrapper = mount(ScoreBar, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
    expect(card.props("padding")).toBe("sm");
    expect(card.props("radius")).toBe("sm");
  });

  it("顯示標籤與數值", () => {
    const wrapper = mount(ScoreBar, { props: baseProps });
    expect(wrapper.text()).toContain("風險評分");
    expect(wrapper.text()).toContain("3 / 5pt");
  });

  it("顯示進度條填充寬度", () => {
    const wrapper = mount(ScoreBar, { props: baseProps });
    const fill = wrapper.find(".score-bar-fill");
    expect(fill.exists()).toBe(true);
    expect(fill.attributes("style")).toContain("width: 60%");
  });

  it("有 description 時顯示描述", () => {
    const wrapper = mount(ScoreBar, { props: baseProps });
    expect(wrapper.find(".score-description").text()).toContain("風險較高");
  });

  it("無 description 時不顯示描述", () => {
    const wrapper = mount(ScoreBar, {
      props: { ...baseProps, description: "" },
    });
    expect(wrapper.find(".score-description").exists()).toBe(false);
  });

  it("百分比不超過 100%", () => {
    const wrapper = mount(ScoreBar, {
      props: { ...baseProps, value: 10 },
    });
    const fill = wrapper.find(".score-bar-fill");
    expect(fill.attributes("style")).toContain("width: 100%");
  });
});
