// webapp/src/test/MetricItem.test.js
// MetricItem 元件單元測試

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import MetricItem from "../components/dashboard/MetricItem.vue";

describe("MetricItem", () => {
  it("應正確格式化大數值 (萬單位)", () => {
    const wrapper = mount(MetricItem, {
      props: {
        label: "淨資產",
        value: 1200000,
        unit: "元",
        format: "compact",
      },
    });

    expect(wrapper.find(".value").text()).toBe("120.0 萬");
    expect(wrapper.find(".unit").text()).toBe("元");
  });

  it("預設格式不轉換 (number)", () => {
    const wrapper = mount(MetricItem, {
      props: {
        label: "維持率",
        value: 155.5,
        unit: "%",
      },
    });

    expect(wrapper.find(".value").text()).toBe("155.5");
    expect(wrapper.find(".unit").text()).toBe("%");
  });

  it("非數字值顯示 —", () => {
    const wrapper = mount(MetricItem, {
      props: {
        label: "測試",
        value: "invalid",
      },
    });

    expect(wrapper.find(".value").text()).toBe("—");
  });

  it("無單位時不顯示", () => {
    const wrapper = mount(MetricItem, {
      props: {
        label: "測試",
        value: 100,
      },
    });

    expect(wrapper.find(".unit").exists()).toBe(false);
  });
});
