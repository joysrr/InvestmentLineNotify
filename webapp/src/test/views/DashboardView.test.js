/**
 * DashboardView.test.js
 * 驗證 DashboardView 單頁 Card Carousel 結構 (Phase 2 refactor 目標)
 *
 * TDD RED: 此測試驗證重構 *後* 的行為。目前 DashboardView 仍是 5 個 top-level tabs,
 * 因此部分斷言會 fail。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createRouter, createWebHistory } from "vue-router";
import DashboardView from "@/views/DashboardView.vue";
import { fetchStatus } from "@/api/index.js";
import { nextTick } from "vue";

vi.mock("element-plus", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
    ElMessageBox: { confirm: vi.fn() },
  };
});

vi.mock("@/api/index.js", () => ({
  fetchStatus: vi.fn(() => Promise.resolve({ rawNdc: { light: "綠" } })),
  fetchReports: (limit) =>
    Promise.resolve([
      {
        signals: {
          regimeState: "NORMAL",
          grossLeverage: 2.3,
          valuationGuardResult: {},
        },
      },
    ]),
  fetchNews: () => Promise.resolve([{ title: "test news", url: "http://x" }]),
  fetchPortfolioHealth: () =>
    Promise.resolve({
      status: "GREEN",
      score: 88,
      lightStatus: { emoji: "🟢", label: "穩健" },
      components: [],
    }),
}));

//  Stub child components, stub ECharts
vi.mock("vue-echarts", () => ({
  default: { template: '<div class="v-chart" />' },
}));
vi.mock("echarts/core", () => ({ use: vi.fn() }));
vi.mock("echarts/charts", () => ({ LineChart: {}, RadarChart: {} }));
vi.mock("echarts/components", () => ({
  GridComponent: {},
  TooltipComponent: {},
  RadarComponent: {},
}));
vi.mock("echarts/renderers", () => ({ CanvasRenderer: {} }));

const stubs = {
  GlobalErrorBoundary: {
    template: '<div class="error-boundary"><slot /></div>',
  },
  MarketSnapshot: { template: '<div class="market-snapshot-stub" />' },
  MacroCockpitCard: { template: '<div class="macro-cockpit-stub" />' },
  PortfolioShieldCard: { template: '<div class="portfolio-shield-stub" />' },
  MarketDetailDrawer: { template: '<div class="market-detail-drawer-stub" />' },
  RiskDetailDrawer: { template: '<div class="risk-detail-drawer-stub" />' },
  DecisionHero: { template: '<div class="decision-hero-stub" />' },
  DisciplineBanner: true,
  HealthPanel: { template: '<div class="health-panel-stub" />' },
  AnalysisPanel: { template: '<div class="analysis-panel-stub" />' },
  CoachingAdvice: { template: '<div class="coaching-advice-stub" />' },
  "router-link": {
    template: '<a class="router-link-stub" :href="to"><slot /></a>',
    props: ["to"],
  },
};

describe("DashboardView - Single Page Card Carousel (Phase 2 target)", () => {
  let wrapper;
  let router;

  beforeEach(() => {
    setActivePinia(createPinia());
    router = createRouter({
      history: createWebHistory(),
      routes: [{ path: "/", component: { template: "<div />" } }],
    });
    // Wait: mount with router + pinia
  });

  async function mountView() {
    wrapper = mount(DashboardView, {
      global: { plugins: [router], stubs },
    });
    await router.isReady();
    await nextTick();
    await new Promise((r) => setTimeout(r, 500));
  }

  it("應移除 top-level dash-tabs 切換群", async () => {
    await mountView();
    // Phase 2 goal: no top-level tab switcher (single-page cards)
    expect(wrapper.find('[data-testid="dashboard-tabs"]').exists()).toBe(false);
    expect(wrapper.find(".dash-tabs").exists()).toBe(false);
  });

  it("應單頁同時渲染 Cockpit + Health + Decision + 策略狀態連結", async () => {
    await mountView();
    const html = wrapper.html();
    // All core cards visible at once
    expect(html).toContain("macro-cockpit-stub");
    expect(html).toContain("portfolio-shield-stub");
    expect(html).toContain("health-panel-stub");
    expect(html).toContain("status-link");
  });

  it("應渲染 CoachingAdvice 卡片", async () => {
    await mountView();
    expect(wrapper.find(".coaching-advice-stub").exists()).toBe(true);
  });

  it("應渲染 Dashboard → Radar 入口連結 (to='/radar')", async () => {
    await mountView();
    const link = wrapper.find(".router-link-stub");
    expect(link.exists()).toBe(true);
    expect(link.text()).toContain("查看完整市場雷達");
  });

  it("HealthPanel 不應被 .dashboard-card .health-card 重複包覆（單一 ContentCard 容器）", async () => {
    await mountView();
    const healthPanel = wrapper.find(".health-panel-stub");
    expect(healthPanel.exists()).toBe(true);
    const parent = healthPanel.element.parentElement;
    expect(parent.classList.contains("dashboard-card")).toBe(false);
    expect(parent.classList.contains("health-card")).toBe(false);
  });

  it("策略狀態連結區塊不應帶 .dashboard-card（內部已有 ContentCard），並有合理 padding", async () => {
    await mountView();
    const statusLink = wrapper.find(".strategy-status-link");
    expect(statusLink.exists()).toBe(true);
    expect(statusLink.classes()).not.toContain("dashboard-card");
  });

  it("資料過期時顯示 expired 降級提示條於 L1 區塊", async () => {
    fetchStatus.mockResolvedValueOnce({
      rawNdc: { light: "綠" },
      _meta: { lastRun: "2026-01-01T00:00:00Z" }, // 遠超過 24 小時 → expired
    });
    await mountView();
    expect(wrapper.find(".freshness-expired-alert").exists()).toBe(true);
    expect(wrapper.find(".freshness-expired-alert").text()).toContain(
      "資料已超過 6 小時未更新",
    );
  });
});
