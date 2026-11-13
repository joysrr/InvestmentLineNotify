import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import ContentCard from "./ContentCard.vue";

describe("ContentCard.vue", () => {
  it("預設渲染：default variant / md padding / md radius", () => {
    const wrapper = mount(ContentCard, {
      slots: { default: "卡片內容" },
    });
    expect(wrapper.classes()).toContain("content-card");
    expect(wrapper.classes()).toContain("content-card--variant-default");
    expect(wrapper.classes()).toContain("content-card--pad-md");
    expect(wrapper.classes()).toContain("content-card--radius-md");
    expect(wrapper.text()).toContain("卡片內容");
  });

  it("variant: outlined / elevated / flat", () => {
    for (const variant of ["outlined", "elevated", "flat"]) {
      const wrapper = mount(ContentCard, {
        props: { variant },
        slots: { default: "內容" },
      });
      expect(wrapper.classes()).toContain(`content-card--variant-${variant}`);
    }
  });

  it("padding: none / sm / md / lg", () => {
    for (const padding of ["none", "sm", "md", "lg"]) {
      const wrapper = mount(ContentCard, {
        props: { padding },
        slots: { default: "內容" },
      });
      expect(wrapper.classes()).toContain(`content-card--pad-${padding}`);
    }
  });

  it("radius: sm / md / lg / xl", () => {
    for (const radius of ["sm", "md", "lg", "xl"]) {
      const wrapper = mount(ContentCard, {
        props: { radius },
        slots: { default: "內容" },
      });
      expect(wrapper.classes()).toContain(`content-card--radius-${radius}`);
    }
  });

  it("status left-border: ok / warn / danger / info", () => {
    for (const status of ["ok", "warn", "danger", "info"]) {
      const wrapper = mount(ContentCard, {
        props: { status, statusStyle: "left-border" },
        slots: { default: "內容" },
      });
      expect(wrapper.classes()).toContain("content-card--status-left");
      expect(wrapper.classes()).toContain(`content-card--status-${status}`);
    }
  });

  it("status tint: ok / warn / danger / info", () => {
    for (const status of ["ok", "warn", "danger", "info"]) {
      const wrapper = mount(ContentCard, {
        props: { status, statusStyle: "tint" },
        slots: { default: "內容" },
      });
      expect(wrapper.classes()).not.toContain("content-card--status-left");
      expect(wrapper.classes()).toContain(`content-card--tint-${status}`);
    }
  });

  it("status null 不加狀態類別", () => {
    const wrapper = mount(ContentCard, {
      props: { status: null },
      slots: { default: "內容" },
    });
    expect(wrapper.classes()).not.toContain("content-card--status-left");
    expect(wrapper.classes()).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/content-card--status-/)]),
    );
    expect(wrapper.classes()).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/content-card--tint-/)]),
    );
  });

  it("clickable 觸發 click 事件", async () => {
    const wrapper = mount(ContentCard, {
      props: { clickable: true },
      slots: { default: "內容" },
    });
    await wrapper.trigger("click");
    expect(wrapper.emitted("click")).toBeTruthy();
  });

  it("slots: header / default / footer", () => {
    const wrapper = mount(ContentCard, {
      slots: {
        header: "標題區",
        default: "內容區",
        footer: "底部區",
      },
    });
    expect(wrapper.text()).toContain("標題區");
    expect(wrapper.text()).toContain("內容區");
    expect(wrapper.text()).toContain("底部區");
  });
});
