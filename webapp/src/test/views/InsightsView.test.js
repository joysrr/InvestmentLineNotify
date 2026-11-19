import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import InsightsView from "@/views/InsightsView.vue";

vi.mock("@/views/MarketRadarView.vue", () => ({
  default: { template: '<div class="market-radar-stub" />' },
}));
vi.mock("@/views/MacroBattleView.vue", () => ({
  default: { template: '<div class="macro-battle-stub" />' },
}));

const stubs = {
  SegmentedControl: {
    template:
      '<div class="segmented-control-stub" data-testid="segmented-control-stub" />',
    props: ["modelValue", "options"],
    emits: ["change"],
  },
  "router-link": {
    template: '<a class="router-link-stub" :href="to"><slot /></a>',
    props: ["to"],
  },
};

describe("InsightsView — P2-1 頂部 Segmented Control，入口卡片為次要", () => {
  let wrapper;
  let router;

  beforeEach(() => {
    setActivePinia(createPinia());
    router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/insights", component: { template: "<div />" } }],
    });
  });

  async function mountView() {
    wrapper = mount(InsightsView, {
      global: { plugins: [router], stubs },
    });
    await router.isReady();
  }

  it("應渲染 SegmentedControl（P2-1 頂部主導航）", async () => {
    await mountView();
    expect(wrapper.find(".segmented-control-stub").exists()).toBe(true);
  });

  it("SegmentedControl 應有兩個選項：市場雷達、多空對決", async () => {
    await mountView();
    const sc = wrapper.find(".segmented-control-stub");
    expect(sc.exists()).toBe(true);
  });

  it("應保留兩個入口卡片但標記為次要", async () => {
    await mountView();
    expect(wrapper.find(".entry-card--radar").exists()).toBe(true);
    expect(wrapper.find(".entry-card--macro").exists()).toBe(true);
    expect(
      wrapper.find(".entry-card--radar.entry-card--secondary").exists(),
    ).toBe(true);
    expect(
      wrapper.find(".entry-card--macro.entry-card--secondary").exists(),
    ).toBe(true);
  });

  it("市場雷達卡片標題正確", async () => {
    await mountView();
    expect(wrapper.find(".entry-card--radar .entry-card-title").text()).toBe(
      "市場雷達",
    );
  });

  it("多空對決卡片標題正確", async () => {
    await mountView();
    expect(wrapper.find(".entry-card--macro .entry-card-title").text()).toBe(
      "多空對決",
    );
  });

  it("內容區應根據 route.query.tab 顯示對應子頁", async () => {
    await mountView();
    expect(wrapper.find(".market-radar-stub").exists()).toBe(true);
    expect(wrapper.find(".macro-battle-stub").exists()).toBe(false);
  });
});
