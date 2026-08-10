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

export default createRouter({
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
