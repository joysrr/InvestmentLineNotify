// webapp/src/test/LifecycleItem.test.js
// LifecycleItem 元件單元測試

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LifecycleItem from "../components/dashboard/LifecycleItem.vue";

describe("LifecycleItem", () => {
  it("應正確渲染標籤、數值與圖示", () => {
    const wrapper = mount(LifecycleItem, {
      props: {
        label: "當前階段",
        value: "EARLY",
        icon: "🌱",
      },
    });

    expect(wrapper.find(".label").text()).toBe("當前階段");
    expect(wrapper.find(".value").text()).toBe("EARLY");
    expect(wrapper.find(".icon").text()).toBe("🌱");
  });

  it("有單位時顯示單位", () => {
    const wrapper = mount(LifecycleItem, {
      props: {
        label: "槓桿上限",
        value: 2.0,
        unit: "x",
      },
    });

    expect(wrapper.find(".unit").text()).toBe("x");
  });

  it("無圖示時不渲染 icon 元素", () => {
    const wrapper = mount(LifecycleItem, {
      props: {
        label: "測試",
        value: "值",
      },
    });

    expect(wrapper.find(".icon").exists()).toBe(false);
  });
});
