// webapp/src/test/BudgetItem.test.js
// BudgetItem 元件單元測試

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import BudgetItem from "../components/dashboard/BudgetItem.vue";

describe("BudgetItem", () => {
  it("應正確格式化大數值 (萬單位)", () => {
    const wrapper = mount(BudgetItem, {
      props: {
        label: "每日總可用",
        value: 50000,
        unit: "元",
      },
    });

    expect(wrapper.find(".value").text()).toBe("5.0 萬");
    expect(wrapper.find(".unit").text()).toBe("元");
  });

  it("小數值直接顯示", () => {
    const wrapper = mount(BudgetItem, {
      props: {
        label: "Baseline 預留",
        value: 1500,
        unit: "元",
      },
    });

    expect(wrapper.find(".value").text()).toBe("1,500");
    expect(wrapper.find(".unit").text()).toBe("元");
  });

  it("無單位時不顯示", () => {
    const wrapper = mount(BudgetItem, {
      props: {
        label: "測試",
        value: 100,
      },
    });

    expect(wrapper.find(".unit").exists()).toBe(false);
  });

  it("非數字值顯示 —", () => {
    const wrapper = mount(BudgetItem, {
      props: {
        label: "測試",
        value: "invalid",
      },
    });

    expect(wrapper.find(".value").text()).toBe("—");
    expect(wrapper.find(".unit").exists()).toBe(false);
  });
});
