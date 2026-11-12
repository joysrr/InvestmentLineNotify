import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import EmptyState from "@/components/common/EmptyState.vue";

describe("EmptyState emoji prop (P4-1-4)", () => {
  it("renders emoji slot when emoji prop is provided", () => {
    const wrapper = mount(EmptyState, {
      props: {
        emoji: "📭",
        title: "尚無資料",
        message: "資料將於每日分析完成後更新",
      },
    });
    expect(wrapper.find(".empty-emoji").exists()).toBe(true);
    expect(wrapper.find(".empty-emoji").text()).toBe("📭");
  });

  it("does not render emoji slot when emoji prop is empty", () => {
    const wrapper = mount(EmptyState, {
      props: { title: "尚無資料", message: "資料將於每日分析完成後更新" },
    });
    expect(wrapper.find(".empty-emoji").exists()).toBe(false);
  });

  it("emoji takes priority over icon when both provided", () => {
    const wrapper = mount(EmptyState, {
      props: { emoji: "📭", icon: "Warning" },
    });
    expect(wrapper.find(".empty-emoji").exists()).toBe(true);
    expect(wrapper.findComponent({ name: "el-icon" }).exists()).toBe(false);
  });
});
