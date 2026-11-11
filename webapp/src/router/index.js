import { createRouter, createWebHashHistory } from "vue-router";
import DashboardView from "../views/DashboardView.vue";
import ChartView from "../views/ChartView.vue";
import NewsView from "../views/NewsView.vue";
import AccountView from "../views/AccountView.vue";
import MarketRadarView from "../views/MarketRadarView.vue";
import MacroBattleView from "../views/MacroBattleView.vue";
import TechnicalView from "../views/TechnicalView.vue";
import StrategyConfigEditorView from "../views/StrategyConfigEditor.vue";
import StrategyStatusView from "../views/StrategyStatusView.vue";
import TheoryView from "../views/TheoryView.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/dashboard", component: DashboardView },
    { path: "/technical", component: TechnicalView },
    { path: "/radar", component: MarketRadarView },
    { path: "/macro", component: MacroBattleView },
    { path: "/chart", component: ChartView },
    { path: "/news", component: NewsView },
    { path: "/theory", component: TheoryView },
    { path: "/strategy", redirect: "/strategy-config" },
    { path: "/account", component: AccountView },
    { path: "/strategy-config", component: StrategyConfigEditorView },
    { path: "/strategy-status", component: StrategyStatusView },
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
