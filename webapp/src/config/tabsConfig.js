/**
 * 4 大 Bottom Nav 靜態設定檔（P2-1）
 *
 * P2-1：底部保留儀表板、洞察、圖表、帳號；新聞 Tab 移出底部。
 * icon 欄位為 icon-registry 中的圖標名稱，由 <Icon :name> 渲染。
 */
export const tabs = [
  {
    to: "/dashboard",
    exact: true,
    label: "總覽",
    testId: "nav-tab-dashboard",
    icon: "dashboard",
  },
  {
    to: "/insights",
    exact: false,
    label: "洞察",
    testId: "nav-tab-insights",
    icon: "radar",
  },
  {
    to: "/chart",
    exact: false,
    label: "圖表",
    testId: "nav-tab-chart",
    icon: "chart",
  },
  {
    to: "/account",
    exact: false,
    label: "設定與帳戶",
    testId: "nav-tab-account",
    icon: "user",
  },
];
