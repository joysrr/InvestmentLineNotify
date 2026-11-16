// Agent 驗證的頁面清單（單一來源）
// path 用 hash 路由，slug 用於檔名
export const ROUTES = [
  { slug: "dashboard",        path: "/#/dashboard",              title: "儀表板" },
  { slug: "insights-radar",   path: "/#/insights?tab=radar",     title: "市場雷達" },
  { slug: "insights-macro",   path: "/#/insights?tab=macro",     title: "多空對決" },
  { slug: "chart",            path: "/#/chart",                  title: "圖表" },
  { slug: "news",             path: "/#/news",                   title: "新聞" },
  { slug: "account",          path: "/#/account",                title: "帳戶" },
  { slug: "strategy-config",  path: "/#/strategy-config",        title: "策略設定" },
];
