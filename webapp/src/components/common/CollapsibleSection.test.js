import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import CollapsibleSection from "./CollapsibleSection.vue";

describe("CollapsibleSection", () => {
  it("renders title and toggle button", () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試標題" },
      slots: { default: "<p>內容</p>" },
    });
    expect(wrapper.text()).toContain("測試標題");
    expect(wrapper.text()).toContain("展開");
  });

  it("defaults to collapsed state (content hidden)", () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試標題" },
      slots: { default: "<p data-testid='content'>內容</p>" },
    });
    expect(wrapper.find("[data-testid='content']").exists()).toBe(false);
  });

  it("expands content when toggle button clicked", async () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試標題" },
      slots: { default: "<p data-testid='content'>內容</p>" },
    });
    await wrapper.find("button.toggle-btn").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-testid='content']").exists()).toBe(true);
  });

  it("collapses content when toggle button clicked again", async () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試標題", expanded: true },
      slots: { default: "<p data-testid='content'>內容</p>" },
    });
    expect(wrapper.find("[data-testid='content']").exists()).toBe(true);
    await wrapper.find("button.toggle-btn").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-testid='content']").exists()).toBe(false);
  });

  it("emits update:expanded on toggle", async () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試標題", expanded: false },
      slots: { default: "<p>內容</p>" },
    });
    await wrapper.find("button.toggle-btn").trigger("click");
    await wrapper.vm.$nextTick();
    const emitted = wrapper.emitted("update:expanded");
    expect(emitted).toBeTruthy();
    expect(emitted[0][0]).toBe(true);
  });

  it("supports expanded prop to show content initially", () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試標題", expanded: true },
      slots: { default: "<p data-testid='content'>內容</p>" },
    });
    expect(wrapper.find("[data-testid='content']").exists()).toBe(true);
  });

  it("supports custom toggle text via prop", () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試標題", toggleText: "顯示/隱藏" },
      slots: { default: "<p>內容</p>" },
    });
    expect(wrapper.find("button.toggle-btn").text()).toContain("顯示/隱藏");
  });
});
