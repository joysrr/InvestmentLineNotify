import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ErrorAlert from "./ErrorAlert.vue";

describe("ErrorAlert.vue", () => {
  it("visible=true 時渲染", () => {
    const wrapper = mount(ErrorAlert, {
      props: {
        visible: true,
      },
    });
    expect(wrapper.find(".error-alert").exists()).toBe(true);
  });

  it("visible=false 時不渲染", () => {
    const wrapper = mount(ErrorAlert, {
      props: {
        visible: false,
      },
    });
    expect(wrapper.find(".error-alert").exists()).toBe(false);
  });

  it("預設顯示「操作失敗」", () => {
    const wrapper = mount(ErrorAlert, {
      props: {
        visible: true,
      },
    });
    expect(wrapper.text()).toContain("操作失敗");
  });

  it("自訂標題與描述", () => {
    const wrapper = mount(ErrorAlert, {
      props: {
        visible: true,
        title: "載入失敗",
        description: "網路連線逾時",
      },
    });
    expect(wrapper.text()).toContain("載入失敗");
    expect(wrapper.text()).toContain("網路連線逾時");
  });

  it("顯示重試按鈕", () => {
    const wrapper = mount(ErrorAlert, {
      props: {
        visible: true,
        showRetry: true,
      },
    });
    const buttons = wrapper.findAll("button");
    expect(buttons.length).toBeGreaterThan(0);
    expect(wrapper.text()).toContain("重試");
  });

  it("點擊重試按鈕觸發 retry 事件", async () => {
    const wrapper = mount(ErrorAlert, {
      props: {
        visible: true,
        showRetry: true,
      },
    });

    const retryButton = wrapper.findAll("button").find((btn) =>
      btn.text().includes("重試")
    );
    await retryButton.trigger("click");

    expect(wrapper.emitted("retry")).toBeTruthy();
    expect(wrapper.emitted("retry")).toHaveLength(1);
  });

  it("顯示錯誤詳情", async () => {
    const wrapper = mount(ErrorAlert, {
      props: {
        visible: true,
        showDetail: true,
        errorDetail: "Error: Network timeout at line 42",
      },
    });

    expect(wrapper.text()).toContain("查看詳情");

    const detailButton = wrapper.findAll("button").find((btn) =>
      btn.text().includes("查看詳情")
    );
    await detailButton.trigger("click");

    expect(wrapper.text()).toContain("Error: Network timeout");
  });

  it("關閉 alert 觸發 close 事件", async () => {
    const wrapper = mount(ErrorAlert, {
      props: {
        visible: true,
        closable: true,
      },
    });

    // Element Plus Alert 的關閉按鈕有 .el-alert__close-btn class
    // 模擬觸發 close 事件
    wrapper.vm.handleClose();

    expect(wrapper.emitted("close")).toBeTruthy();
    expect(wrapper.emitted("close")).toHaveLength(1);
  });

  it("type 屬性控制樣式", () => {
    const wrapper = mount(ErrorAlert, {
      props: {
        visible: true,
        type: "warning",
      },
    });
    expect(wrapper.props("type")).toBe("warning");
  });

  it("自訂重試按鈕文字", () => {
    const wrapper = mount(ErrorAlert, {
      props: {
        visible: true,
        showRetry: true,
        retryText: "重新載入",
      },
    });
    expect(wrapper.text()).toContain("重新載入");
  });
});
