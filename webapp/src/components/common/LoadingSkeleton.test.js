import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import LoadingSkeleton from "./LoadingSkeleton.vue";

describe("LoadingSkeleton", () => {
  it("variant=card 渲染 rows 個 sk-card", () => {
    const wrapper = mount(LoadingSkeleton, {
      props: { variant: "card", rows: 3 },
    });
    expect(wrapper.findAll(".sk-card").length).toBe(3);
  });

  it("variant=list 渲染 rows 個 sk-list-item", () => {
    const wrapper = mount(LoadingSkeleton, {
      props: { variant: "list", rows: 2 },
    });
    expect(wrapper.findAll(".sk-list-item").length).toBe(2);
  });

  it("variant=grid 渲染 rows * gridCols 個 sk-grid-item", () => {
    const wrapper = mount(LoadingSkeleton, {
      props: { variant: "grid", rows: 2, gridCols: 3 },
    });
    expect(wrapper.findAll(".sk-grid-item").length).toBe(6);
  });
});
