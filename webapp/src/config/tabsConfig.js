/**
 * 5 大 Bottom Nav 靜態設定檔
 *
 * icon 欄位為 icon-registry 中的圖標名稱，由 <Icon :name> 渲染。
 * P2-6：原本的內聯 SVG 字串已遷移至統一圖標體系。
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
    to: "/news",
    exact: false,
    label: "新聞",
    testId: "nav-tab-news",
    icon: "news",
  },
  {
    to: "/account",
    exact: false,
    label: "設定與帳戶",
    testId: "nav-tab-account",
    icon: "user",
  },
];
