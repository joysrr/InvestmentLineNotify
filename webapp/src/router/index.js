import { createRouter, createWebHashHistory } from "vue-router";
import DashboardView from "../views/DashboardView.vue";

const ChartView = () => import("../views/ChartView.vue");
const NewsView = () => import("../views/NewsView.vue");
const AccountView = () => import("../views/AccountView.vue");
const MarketRadarView = () => import("../views/MarketRadarView.vue");
const MacroBattleView = () => import("../views/MacroBattleView.vue");
const TechnicalView = () => import("../views/TechnicalView.vue");
const StrategyConfigEditorView = () =>
  import("../views/StrategyConfigEditor.vue");
const StrategyStatusView = () => import("../views/StrategyStatusView.vue");
const TheoryView = () => import("../views/TheoryView.vue");

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    {
      path: "/dashboard",
      component: DashboardView,
      meta: { title: "總覽", chunk: "high" },
    },
    {
      path: "/technical",
      component: TechnicalView,
      meta: { title: "技術分析", chunk: "low" },
    },
    {
      path: "/radar",
      component: MarketRadarView,
      meta: { title: "市場雷達", chunk: "low" },
    },
    {
      path: "/macro",
      component: MacroBattleView,
      meta: { title: "多空對決", chunk: "low" },
    },
    {
      path: "/chart",
      component: ChartView,
      meta: { title: "圖表", chunk: "high" },
    },
    {
      path: "/news",
      component: NewsView,
      meta: { title: "新聞", chunk: "low" },
    },
    {
      path: "/theory",
      component: TheoryView,
      meta: { title: "理論", chunk: "low" },
    },
    { path: "/strategy", redirect: "/strategy-config" },
    {
      path: "/account",
      component: AccountView,
      meta: { title: "帳戶", chunk: "low" },
    },
    {
      path: "/strategy-config",
      component: StrategyConfigEditorView,
      meta: { title: "策略設定", chunk: "low" },
    },
    {
      path: "/strategy-status",
      component: StrategyStatusView,
      meta: { title: "策略狀態", chunk: "low" },
    },
    { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
  ],
});

// Auth guard - 驗證 Telegram initData
router.beforeEach((to, from, next) => {
  // 開發環境跳過檢查
  if (import.meta.env.DEV) {
    next();
    return;
  }

  // 檢查 Telegram WebApp SDK 是否就緒
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData || initData === "") {
    // 未授權：導向首頁或顯示提示
    console.warn("[Auth Guard] Telegram initData 不存在，攔截路由:", to.path);
    next(false);
    return;
  }

  // 授權通過
  next();
});

export default router;
