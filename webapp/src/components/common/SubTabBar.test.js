import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import SubTabBar from "./SubTabBar.vue";

describe("SubTabBar", () => {
  const tabs = [{ label: "市場雷達" }, { label: "多空對決" }];

  it("渲染所有 tab 標籤", () => {
    const wrapper = mount(SubTabBar, { props: { tabs } });
    expect(wrapper.text()).toContain("市場雷達");
    expect(wrapper.text()).toContain("多空對決");
  });

  it("第一個 tab 預設為 active", () => {
    const wrapper = mount(SubTabBar, { props: { tabs } });
    expect(wrapper.findAll(".sub-tab")[0].classes()).toContain(
      "sub-tab--active",
    );
    expect(wrapper.findAll(".sub-tab")[1].classes()).not.toContain(
      "sub-tab--active",
    );
  });

  it("click 切換 active tab 並 emit tab-change", async () => {
    const wrapper = mount(SubTabBar, { props: { tabs } });
    await wrapper.findAll(".sub-tab")[1].trigger("click");
    expect(wrapper.findAll(".sub-tab")[1].classes()).toContain(
      "sub-tab--active",
    );
    expect(wrapper.emitted("tab-change")).toHaveLength(1);
    expect(wrapper.emitted("tab-change")[0]).toEqual(["多空對決"]);
  });

  it("activeTab prop 控制預設選中", () => {
    const wrapper = mount(SubTabBar, {
      props: { tabs, activeTab: "多空對決" },
    });
    expect(wrapper.findAll(".sub-tab")[1].classes()).toContain(
      "sub-tab--active",
    );
  });
});
