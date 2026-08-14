import { describe, it, expect, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import GlobalErrorBoundary from "./GlobalErrorBoundary.vue";

describe("GlobalErrorBoundary.vue", () => {
  it("正常渲染子元件", () => {
    const wrapper = mount(GlobalErrorBoundary, {
      slots: {
        default: "<div class='child'>測試內容</div>",
      },
    });

    expect(wrapper.find(".child").exists()).toBe(true);
    expect(wrapper.find(".child").text()).toBe("測試內容");
    expect(wrapper.find(".error-fallback").exists()).toBe(false);
  });

  it("捕捉子元件錯誤並顯示 fallback UI", async () => {
    const ThrowError = {
      template: "<div>{{ willThrow }}</div>",
      computed: {
        willThrow() {
          throw new Error("測試錯誤");
        },
      },
    };

    const wrapper = mount(GlobalErrorBoundary, {
      slots: {
        default: ThrowError,
      },
    });

    await nextTick();

    expect(wrapper.find(".error-fallback").exists()).toBe(true);
    expect(wrapper.text()).toContain("頁面載入失敗");
  });

  it("自訂錯誤訊息", async () => {
    const ThrowError = {
      template: "<div>{{ willThrow }}</div>",
      computed: {
        willThrow() {
          throw new Error("測試錯誤");
        },
      },
    };

    const wrapper = mount(GlobalErrorBoundary, {
      props: {
        errorTitle: "自訂標題",
        errorDescription: "自訂描述",
      },
      slots: {
        default: ThrowError,
      },
    });

    await nextTick();

    expect(wrapper.text()).toContain("自訂標題");
    expect(wrapper.text()).toContain("自訂描述");
  });

  it("重試按鈕觸發 onRetry 回調", async () => {
    const onRetry = vi.fn();
    const ThrowError = {
      template: "<div>{{ willThrow }}</div>",
      computed: {
        willThrow() {
          throw new Error("測試錯誤");
        },
      },
    };

    const wrapper = mount(GlobalErrorBoundary, {
      props: {
        onRetry,
      },
      slots: {
        default: ThrowError,
      },
    });

    await nextTick();

    const retryButton = wrapper.find("button");
    await retryButton.trigger("click");

    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("隱藏重試按鈕", async () => {
    const ThrowError = {
      template: "<div>{{ willThrow }}</div>",
      computed: {
        willThrow() {
          throw new Error("測試錯誤");
        },
      },
    };

    const wrapper = mount(GlobalErrorBoundary, {
      props: {
        showRetry: false,
      },
      slots: {
        default: ThrowError,
      },
    });

    await nextTick();

    expect(wrapper.find("button").exists()).toBe(false);
  });
});
