import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import EmptyState from "./EmptyState.vue";

describe("EmptyState.vue", () => {
  it("預設渲染「暫無資料」", () => {
    const wrapper = mount(EmptyState);
    expect(wrapper.text()).toContain("暫無資料");
  });

  it("自訂描述文字", () => {
    const wrapper = mount(EmptyState, {
      props: {
        description: "找不到任何報告",
      },
    });
    expect(wrapper.text()).toContain("找不到任何報告");
  });

  it("顯示行動按鈕", async () => {
    const wrapper = mount(EmptyState, {
      props: {
        actionText: "新增項目",
      },
    });
    
    const button = wrapper.find("button");
    expect(button.exists()).toBe(true);
    expect(button.text()).toBe("新增項目");
  });

  it("點擊行動按鈕觸發 action 事件", async () => {
    const wrapper = mount(EmptyState, {
      props: {
        actionText: "重新載入",
      },
    });

    const button = wrapper.find("button");
    await button.trigger("click");

    expect(wrapper.emitted("action")).toBeTruthy();
    expect(wrapper.emitted("action")).toHaveLength(1);
  });

  it("使用自訂 icon", () => {
    const wrapper = mount(EmptyState, {
      props: {
        icon: "Document",
        iconSize: 100,
        iconColor: "#ff0000",
      },
    });

    expect(wrapper.props("icon")).toBe("Document");
    expect(wrapper.props("iconSize")).toBe(100);
    expect(wrapper.props("iconColor")).toBe("#ff0000");
  });

  it("使用自訂圖片 URL", () => {
    const wrapper = mount(EmptyState, {
      props: {
        imageUrl: "https://example.com/empty.png",
      },
    });

    expect(wrapper.props("imageUrl")).toBe("https://example.com/empty.png");
  });

  it("無行動按鈕時不顯示按鈕", () => {
    const wrapper = mount(EmptyState);
    expect(wrapper.find("button").exists()).toBe(false);
  });
});
