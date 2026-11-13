import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ThresholdItem from "./ThresholdItem.vue";

const baseProps = {
  label: "閾值項目",
  value: "80%",
  unit: "佔用",
};

describe("ThresholdItem.vue", () => {
  it("外層使用 ContentCard，variant=outlined padding=sm radius=md", () => {
    const wrapper = mount(ThresholdItem, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
    expect(card.props("padding")).toBe("sm");
    expect(card.props("radius")).toBe("md");
  });

  it("顯示標籤與數值", () => {
    const wrapper = mount(ThresholdItem, { props: baseProps });
    expect(wrapper.text()).toContain("閾值項目");
    expect(wrapper.text()).toContain("80%");
  });

  it("unit 有值時顯示單位", () => {
    const wrapper = mount(ThresholdItem, {
      props: { ...baseProps, unit: "點" },
    });
    expect(wrapper.find(".unit").text()).toContain("點");
  });

  it("unit 無值時不顯示單位", () => {
    const wrapper = mount(ThresholdItem, {
      props: { ...baseProps, unit: "" },
    });
    expect(wrapper.find(".unit").exists()).toBe(false);
  });

  it("label 為空時不顯示", () => {
    const wrapper = mount(ThresholdItem, {
      props: { ...baseProps, label: "" },
    });
    expect(wrapper.find(".label").text()).toBe("");
  });
});
