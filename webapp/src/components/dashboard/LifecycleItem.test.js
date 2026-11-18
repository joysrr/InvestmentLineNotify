import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LifecycleItem from "./LifecycleItem.vue";

const baseProps = {
  label: "階段",
  value: "執行中",
  unit: "",
  icon: "chart",
};

describe("LifecycleItem.vue", () => {
  it("外層使用 ContentCard，variant=outlined size=sm", () => {
    const wrapper = mount(LifecycleItem, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
    expect(card.props("size")).toBe("sm");
  });

  it("顯示標籤與數值", () => {
    const wrapper = mount(LifecycleItem, { props: baseProps });
    expect(wrapper.text()).toContain("階段");
    expect(wrapper.text()).toContain("執行中");
  });

  it("icon 有值時顯示圖示", () => {
    const wrapper = mount(LifecycleItem, { props: baseProps });
    const icon = wrapper.findComponent({ name: "Icon" });
    expect(icon.exists()).toBe(true);
    expect(icon.props("name")).toBe("chart");
  });

  it("unit 有值時顯示單位", () => {
    const wrapper = mount(LifecycleItem, {
      props: { ...baseProps, unit: "日" },
    });
    expect(wrapper.find(".unit").text()).toContain("日");
  });

  it("icon 為空時不顯示 icon", () => {
    const wrapper = mount(LifecycleItem, {
      props: { ...baseProps, icon: "" },
    });
    expect(wrapper.find(".icon").exists()).toBe(false);
  });
});
