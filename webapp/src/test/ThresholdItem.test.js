// webapp/src/test/ThresholdItem.test.js
// ThresholdItem 元件單元測試

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ThresholdItem from "../components/dashboard/ThresholdItem.vue";

describe("ThresholdItem", () => {
  it("應正確渲染標籤與數值", () => {
    const wrapper = mount(ThresholdItem, {
      props: {
        label: "起始買入門檻",
        value: 3,
        unit: "pt",
      },
    });

    expect(wrapper.find(".label").text()).toBe("起始買入門檻");
    expect(wrapper.find(".value").text()).toContain("3");
    expect(wrapper.find(".unit").text()).toBe("pt");
  });

  it("無單位時不顯示 unit", () => {
    const wrapper = mount(ThresholdItem, {
      props: {
        label: "測試",
        value: 5,
      },
    });

    expect(wrapper.find(".unit").exists()).toBe(false);
  });

  it("預設值為 '—'", () => {
    const wrapper = mount(ThresholdItem, {
      props: {
        label: "測試",
      },
    });

    expect(wrapper.find(".value").text()).toBe("—");
  });
});
