import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ErrorView from "./ErrorView.vue";

const stubs = {
  ElButton: { template: "<button><slot /></button>" },
  ElIcon: { template: '<div class="el-icon-stub"><slot /></div>' },
};

describe("ErrorView", () => {
  it("渲染標題與訊息", () => {
    const wrapper = mount(ErrorView, {
      props: { title: "載入失敗", message: "網路逾時，請稍後重試" },
      global: { stubs },
    });
    expect(wrapper.text()).toContain("載入失敗");
    expect(wrapper.text()).toContain("網路逾時，請稍後重試");
  });

  it("retryable 預設 true 顯示重試按鈕，點擊 emit 'retry'", async () => {
    const wrapper = mount(ErrorView, {
      props: { title: "錯誤", message: "失敗" },
      global: { stubs },
    });
    const btn = wrapper.find("button");
    expect(btn.exists()).toBe(true);
    await btn.trigger("click");
    expect(wrapper.emitted("retry")).toHaveLength(1);
  });

  it("retryable=false 不顯示重試按鈕", () => {
    const wrapper = mount(ErrorView, {
      props: { title: "錯誤", message: "失敗", retryable: false },
      global: { stubs },
    });
    expect(wrapper.find("button").exists()).toBe(false);
  });
});
