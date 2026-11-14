/**
 * 5 大 Bottom Nav 靜態設定檔
 */
export const tabs = [
  {
    to: "/dashboard",
    exact: true,
    label: "總覽",
    testId: "nav-tab-dashboard",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>`,
  },
  {
    to: "/insights",
    exact: false,
    label: "洞察",
    testId: "nav-tab-insights",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2"/>
      <line x1="12" y1="2" x2="12" y2="6"/>
      <line x1="12" y1="18" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="6" y2="12"/>
      <line x1="18" y1="12" x2="22" y2="12"/>
    </svg>`,
  },
  {
    to: "/chart",
    exact: false,
    label: "圖表",
    testId: "nav-tab-chart",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>`,
  },
  {
    to: "/news",
    exact: false,
    label: "新聞",
    testId: "nav-tab-news",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17h11A2.5 2.5 0 0 1 20 19.5V21a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>
      <path d="M8 3h8a2 2 0 0 1 2 2v9H6V5a2 2 0 0 1 2-2z"/>
      <path d="M8 11V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"/>
      <circle cx="10" cy="8" r="1"/><circle cx="14" cy="8" r="1"/>
      <path d="M6 15h12v2a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/>
    </svg>`,
  },
  {
    to: "/account",
    exact: false,
    label: "設定與帳戶",
    testId: "nav-tab-account",
    icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="8" r="4"/>
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>`,
  },
];
