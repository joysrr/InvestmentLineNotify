// webapp/src/test/RiskItem.test.js
// RiskItem 元件單元測試

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import RiskItem from "../components/dashboard/RiskItem.vue";

describe("RiskItem", () => {
  it("應正確渲染標籤、數值與圖示", () => {
    const wrapper = mount(RiskItem, {
      props: {
        label: "維持率",
        value: 155.5,
        unit: "%",
        icon: "🟢",
      },
    });

    expect(wrapper.find(".label").text()).toBe("維持率");
    expect(wrapper.find(".value").text()).toBe("155.50");
    expect(wrapper.find(".unit").text()).toBe("%");
    expect(wrapper.find(".icon").text()).toBe("🟢");
  });

  it("傳入 itemClass 時應套用額外類別", () => {
    const wrapper = mount(RiskItem, {
      props: {
        label: "測試",
        value: "值",
        itemClass: "custom-class",
      },
    });

    expect(wrapper.classes()).toContain("custom-class");
  });

  it("無單位/圖示時正常渲染", () => {
    const wrapper = mount(RiskItem, {
      props: {
        label: "Regime 狀態",
        value: "NORMAL",
      },
    });

    expect(wrapper.find(".unit").exists()).toBe(false);
    expect(wrapper.find(".icon").exists()).toBe(false);
  });

  it("長浮點數應格式化為 2 位小數，並在 title 屬性中保留原精度", () => {
    const wrapper = mount(RiskItem, {
      props: {
        label: "綜合槓桿",
        value: 0.93955613524562,
        unit: "x",
      },
    });

    expect(wrapper.find(".value").text()).toBe("0.94");
    expect(wrapper.find(".value").attributes("title")).toBe("0.93955613524562");
  });
});
