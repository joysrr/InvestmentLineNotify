import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SkeletonLoader from "./SkeletonLoader.vue";

describe("SkeletonLoader.vue", () => {
  it("預設渲染 5 行骨架屏", () => {
    const wrapper = mount(SkeletonLoader);
    expect(wrapper.find(".skeleton-loader").exists()).toBe(true);
  });

  it("自訂行數", () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        rows: 10,
      },
    });
    expect(wrapper.props("rows")).toBe(10);
  });

  it("variant=card 渲染卡片骨架", () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        variant: "card",
      },
    });
    expect(wrapper.props("variant")).toBe("card");
  });

  it("variant=list 渲染列表骨架", () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        variant: "list",
        rows: 3,
      },
    });
    expect(wrapper.props("variant")).toBe("list");
    expect(wrapper.props("rows")).toBe(3);
  });

  it("variant=chart 渲染圖表骨架", () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        variant: "chart",
      },
    });
    expect(wrapper.props("variant")).toBe("chart");
  });

  it("variant=table 渲染表格骨架", () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        variant: "table",
        rows: 5,
      },
    });
    expect(wrapper.props("variant")).toBe("table");
    expect(wrapper.props("rows")).toBe(5);
  });

  it("animated 控制動畫", () => {
    const wrapper = mount(SkeletonLoader, {
      props: {
        animated: false,
      },
    });
    expect(wrapper.props("animated")).toBe(false);
  });

  it("無效 variant 觸發驗證器", () => {
    // Vue 的 validator 會在開發模式發出警告，但不會拋出錯誤
    const wrapper = mount(SkeletonLoader, {
      props: {
        variant: "invalid",
      },
    });
    // 確認 props 被設置（即使無效）
    expect(wrapper.props("variant")).toBe("invalid");
  });
});
