// webapp/src/test/ScoreBar.test.js
// ScoreBar 元件單元測試

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ScoreBar from "../components/dashboard/ScoreBar.vue";

describe("ScoreBar", () => {
  it("應正確渲染標籤與數值", () => {
    const wrapper = mount(ScoreBar, {
      props: {
        label: "測試評分",
        value: 3,
        max: 5,
        color: "#ff0000",
      },
    });

    expect(wrapper.find(".score-label").text()).toBe("測試評分");
    expect(wrapper.find(".score-value").text()).toBe("3 / 5pt");
  });

  it("長條圖寬度應依比例計算", () => {
    const wrapper = mount(ScoreBar, {
      props: {
        label: "測試",
        value: 2.5,
        max: 5,
        color: "#ff0000",
      },
    });

    const fill = wrapper.find(".score-bar-fill");
    expect(fill.element.style.width).toBe("50%");
  });

  it("超過最大值時寬度上限 100%", () => {
    const wrapper = mount(ScoreBar, {
      props: {
        label: "測試",
        value: 10,
        max: 5,
        color: "#ff0000",
      },
    });

    const fill = wrapper.find(".score-bar-fill");
    expect(fill.element.style.width).toBe("100%");
  });

  it("應正確顯示描述文字", () => {
    const wrapper = mount(ScoreBar, {
      props: {
        label: "測試",
        value: 3,
        max: 5,
        color: "#ff0000",
        description: "測試描述",
      },
    });

    expect(wrapper.find(".score-description").text()).toBe("測試描述");
  });

  it("無描述時不渲染 description 元素", () => {
    const wrapper = mount(ScoreBar, {
      props: {
        label: "測試",
        value: 3,
        max: 5,
        color: "#ff0000",
      },
    });

    expect(wrapper.find(".score-description").exists()).toBe(false);
  });

  it("預設 max 為 5", () => {
    const wrapper = mount(ScoreBar, {
      props: {
        label: "測試",
        value: 2,
        color: "#ff0000",
      },
    });

    const fill = wrapper.find(".score-bar-fill");
    expect(fill.element.style.width).toBe("40%");
  });
});
