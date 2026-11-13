import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RiskItem from "./RiskItem.vue";

const baseProps = {
  label: "風險項目",
  value: "85",
  unit: "分",
  icon: "⚠️",
  desc: "風險敘述",
  itemClass: "risk-high",
};

describe("RiskItem.vue", () => {
  it("外層使用 ContentCard，variant=outlined padding=sm radius=sm", () => {
    const wrapper = mount(RiskItem, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
    expect(card.props("padding")).toBe("sm");
    expect(card.props("radius")).toBe("sm");
  });

  it("顯示標籤與數值", () => {
    const wrapper = mount(RiskItem, { props: baseProps });
    expect(wrapper.text()).toContain("風險項目");
    expect(wrapper.text()).toContain("85");
  });

  it("icon 有值時顯示圖示", () => {
    const wrapper = mount(RiskItem, { props: baseProps });
    expect(wrapper.find(".icon").text()).toContain("⚠️");
  });

  it("unit 有值時顯示單位", () => {
    const wrapper = mount(RiskItem, {
      props: { ...baseProps, unit: "點" },
    });
    expect(wrapper.find(".unit").text()).toContain("點");
  });

  it("desc 有值時顯示描述", () => {
    const wrapper = mount(RiskItem, { props: baseProps });
    expect(wrapper.find(".desc").text()).toContain("風險敘述");
  });

  it("icon 為空時不顯示 icon", () => {
    const wrapper = mount(RiskItem, {
      props: { ...baseProps, icon: "" },
    });
    expect(wrapper.find(".icon").exists()).toBe(false);
  });
});
