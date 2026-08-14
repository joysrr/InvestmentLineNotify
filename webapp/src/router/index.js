import { createRouter, createWebHashHistory } from "vue-router";
import DashboardView from "../views/DashboardView.vue";
import ChartView from "../views/ChartView.vue";
import ReportsView from "../views/ReportsView.vue";
import NewsView from "../views/NewsView.vue";
import AccountView from "../views/AccountView.vue";
import MarketRadarView from "../views/MarketRadarView.vue";
import MacroBattleView from "../views/MacroBattleView.vue";
import TechnicalView from "../views/TechnicalView.vue";
import StrategyView from "../views/StrategyView.vue";
import SimulatorView from "../views/SimulatorView.vue";
import BacktestReportView from "../views/BacktestReportView.vue";
import StrategyConfigEditorView from "../views/StrategyConfigEditor.vue";

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
    { path: "/dashboard", component: DashboardView },
    { path: "/technical", component: TechnicalView },
    { path: "/radar", component: MarketRadarView },
    { path: "/macro", component: MacroBattleView },
    { path: "/chart", component: ChartView },
    { path: "/reports", component: ReportsView },
    { path: "/news", component: NewsView },
    { path: "/strategy", component: StrategyView },
    { path: "/account", component: AccountView },
    { path: "/simulator", component: SimulatorView },
    { path: "/backtest-report", component: BacktestReportView },
    { path: "/strategy-config", component: StrategyConfigEditorView },
    { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
  ],
});

// Auth guard - ����� Telegram initData
router.beforeEach((to, from, next) => {
  // 開發環境跳過��查
  if (import.meta.env.DEV) {
    next();
    return;
  }

  // ���查 Telegram WebApp SDK 是否就��
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData || initData === "") {
    // 未授權：導向����頁或��示提示
    console.warn("[Auth Guard] Telegram initData 不存在，����路由:", to.path);
    next(false);
    return;
  }

  // ��權通過
  next();
});

export default router;