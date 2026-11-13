import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LifecycleItem from "./LifecycleItem.vue";

const baseProps = {
  label: "階段",
  value: "執行中",
  unit: "",
  icon: "🔄",
};

describe("LifecycleItem.vue", () => {
  it("外層使用 ContentCard，variant=outlined padding=sm radius=sm", () => {
    const wrapper = mount(LifecycleItem, { props: baseProps });
    const card = wrapper.findComponent({ name: "ContentCard" });
    expect(card.exists()).toBe(true);
    expect(card.props("variant")).toBe("outlined");
    expect(card.props("padding")).toBe("sm");
    expect(card.props("radius")).toBe("sm");
  });

  it("顯示標籤與數值", () => {
    const wrapper = mount(LifecycleItem, { props: baseProps });
    expect(wrapper.text()).toContain("階段");
    expect(wrapper.text()).toContain("執行中");
  });

  it("icon 有值時顯示圖示", () => {
    const wrapper = mount(LifecycleItem, { props: baseProps });
    expect(wrapper.find(".icon").text()).toContain("🔄");
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
