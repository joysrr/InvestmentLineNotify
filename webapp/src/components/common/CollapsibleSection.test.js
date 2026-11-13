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
    expect(wrapper.find(".collapsible-indicator").exists()).toBe(true);
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
    await wrapper.find(".collapsible-header").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-testid='content']").exists()).toBe(true);
  });

  it("collapses content when toggle button clicked again", async () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試標題", expanded: true },
      slots: { default: "<p data-testid='content'>內容</p>" },
    });
    expect(wrapper.find("[data-testid='content']").exists()).toBe(true);
    await wrapper.find(".collapsible-header").trigger("click");
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[data-testid='content']").exists()).toBe(false);
  });

  it("emits update:expanded on toggle", async () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試標題", expanded: false },
      slots: { default: "<p>內容</p>" },
    });
    await wrapper.find(".collapsible-header").trigger("click");
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
      props: { title: "測試標題", toggleText: "顯示/隱藏", indicator: "text" },
      slots: { default: "<p>內容</p>" },
    });
    expect(wrapper.find(".collapsible-indicator").text()).toContain(
      "顯示/隱藏",
    );
  });

  /* ---------- B7: 可用性與受控同步 ---------- */

  it("has aria-controls pointing to content id", async () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試", expanded: true },
      slots: { default: "<p>內容</p>" },
    });
    const header = wrapper.find(".collapsible-header");
    const content = wrapper.find(".collapsible-content");
    expect(header.attributes("aria-controls")).toBe(content.attributes("id"));
  });

  it("renders header slot", () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試" },
      slots: { header: "<span data-testid='custom-header'>自訂標題</span>" },
    });
    expect(wrapper.find("[data-testid='custom-header']").exists()).toBe(true);
    expect(wrapper.text()).not.toContain("測試");
  });

  it("syncs with expanded prop changes", async () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試", expanded: false },
      slots: { default: "<p data-testid='content'>內容</p>" },
    });
    expect(wrapper.find("[data-testid='content']").exists()).toBe(false);
    await wrapper.setProps({ expanded: true });
    expect(wrapper.find("[data-testid='content']").exists()).toBe(true);
  });

  it("clickableHeader=false renders non-clickable header div", () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試", clickableHeader: false },
      slots: { default: "<p data-testid='content'>內容</p>" },
    });
    const header = wrapper.find(".collapsible-header");
    expect(header.attributes("type")).toBeUndefined();
    expect(header.exists()).toBe(true);
  });

  it("indicator=chevron adds is-open class when expanded", () => {
    const wrapper = mount(CollapsibleSection, {
      props: { title: "測試", expanded: true, indicator: "chevron" },
      slots: { default: "<p>內容</p>" },
    });
    expect(wrapper.find(".collapsible-indicator.is-open").exists()).toBe(true);
  });

  /* ---------- R2: 同頁多實例 id 不重複 ---------- */

  it("同頁多實例的 contentId 與 aria-controls 不重複", () => {
    const wrapper = mount({
      components: { CollapsibleSection },
      template: `
        <div>
          <CollapsibleSection title="A" :expanded="true"><p>A</p></CollapsibleSection>
          <CollapsibleSection title="B" :expanded="true"><p>B</p></CollapsibleSection>
          <CollapsibleSection title="C" :expanded="true"><p>C</p></CollapsibleSection>
        </div>`,
    });

    const contents = wrapper.findAll(".collapsible-content");
    const headers = wrapper.findAll(".collapsible-header");

    expect(contents).toHaveLength(3);
    const ids = contents.map((n) => n.attributes("id"));
    expect(new Set(ids).size).toBe(3);

    const controls = headers.map((n) => n.attributes("aria-controls"));
    expect(new Set(controls).size).toBe(3);

    for (const c of controls) {
      expect(ids).toContain(c);
    }
  });
});
