// 圖標路徑常數與 ICON_MAP 純資料模組
import { h } from "vue";
// 由 Icon.vue 匯入，供樹搖與靜態守護測試使用

export const DANGER_PATH =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z";
export const WARN_PATH = "M1 21h22L12 2 1 21zm12-9h-2v-2h2v2zm0-4h-2V7h2v6z";
export const NEUTRAL_PATH =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4z";
export const CHART_PATH = "M3 3v18h18V3H3zm2 16V5h4l4 4 6-6h4v14H5z";
export const SHIELD_PATH =
  "M12 2L2 7l10 13 10-13zM12 7.5c-1.98 0-3.7 1.2-4.5 2.9L9 15l3 4 3-4-1.5-4.6C15.7 8.7 13.98 7.5 12 7.5z";
export const TRIGGER_PATH =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z";
export const CHECK_PATH = "M9 16.2l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4z";
export const RADAR_PATH =
  "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 10s4.477 10 10 10zM12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM2 12h20M12 2v20z";
export const X_CIRCLE_PATH =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 9.17L13 16.17l-4.17-4.17L8.83 11l4.17-4.17L13 7.83l4.17 4.17z";
export const CHEVRON_DOWN_PATH = "M6 9l6 6 6-6z";
export const ARROW_UP_PATH = "M12 2l-4 4v6h4v4h4v-4h4V6l-4-4z";
export const ARROW_DOWN_PATH = "M12 22l4-4v-6h-4v-4h-4v4h-4v6l4 4z";
export const ARROW_LEFT_PATH =
  "M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z";

export const TRENDING_UP_PATH =
  "M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z";
export const TRENDING_DOWN_PATH =
  "M16 18l2.29-2.29-4.88-4.88-4 4L2 7.41 3.41 6l6 6 4-4 6.3 6.29L22 12v6z";
export const ARROW_RIGHT_PATH =
  "M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8z";
export const CHEVRON_RIGHT_PATH = "M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z";
export const CHEVRON_UP_PATH = "M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z";
export const BULL_PATH = "M3 17l6-6 4 4 8-8M17 7h4v4z";
export const BEAR_PATH = "M3 7l6 6 4-4 8 8M17 17h4v-4z";
export const CANDLESTICK_PATH =
  "M5 9h2v10H5zm3-3h2v16H8zm3 5h2v11h-2zm3-7h2v18h-2z";
export const PERCENT_PATH =
  "M18.5 4h-3l-13 13v3h3l13-13V4zM6.5 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm11 11a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z";
export const COINS_PATH =
  "M12 2C6.48 2 2 4.02 2 6.5S6.48 11 12 11s10-2.02 10-4.5S17.52 2 12 2zm0 13c-5.52 0-10-2.02-10-4.5V13c0 2.48 4.48 4.5 10 4.5s10-2.02 10-4.5v-2.5c0 2.48-4.48 4.5-10 4.5z";
export const BANK_PATH =
  "M4 10v7h3v-7H4zm6 0v7h3v-7h-3zM2 22h19v-3H2v3zm14-12v7h3v-7h-3zm-4.5-9L2 6v2h19V6l-9.5-5z";
export const WALLET_OUTLINE_PATH =
  "M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3h-2v3H5V5h14v3h2V5a2 2 0 0 0-2-2zM21 9h-5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1z";
export const MINUS_PATH = "M18 6H6v2h12V6z";
export const SETTINGS_PATH =
  "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z";
export const SEARCH_PATH =
  "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";
export const INFO_PATH =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z";
export const NEWS_PATH =
  "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z";
export const WALLET_PATH =
  "M21 7.28V5c0-1.1-.9-2-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-2.28A2 2 0 0 0 22 15V9a2 2 0 0 0-1-1.72zM20 9v6h-7V9h7zM5 19V5h14v2h-6c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h6v2H5z";
export const CLOCK_PATH =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6zm0-10c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zM12 12l2 2 4-4z";

export const ICON_MAP = {
  "check-circle": {
    component: {
      render: () => h("path", { d: CHECK_PATH, fill: "currentColor" }),
    },
  },
  ok: {
    component: {
      render: () => h("path", { d: CHECK_PATH, fill: "currentColor" }),
    },
  },
  danger: {
    component: {
      render: () => h("path", { d: DANGER_PATH, fill: "currentColor" }),
    },
  },
  warn: {
    component: {
      render: () => h("path", { d: WARN_PATH, fill: "currentColor" }),
    },
  },
  "alert-triangle": {
    component: {
      render: () => h("path", { d: WARN_PATH, fill: "currentColor" }),
    },
  },
  neutral: {
    component: {
      render: () => h("path", { d: NEUTRAL_PATH, fill: "currentColor" }),
    },
  },
  chart: {
    component: {
      render: () => h("path", { d: CHART_PATH, fill: "currentColor" }),
    },
  },
  shield: {
    component: {
      render: () => h("path", { d: SHIELD_PATH, fill: "currentColor" }),
    },
  },
  trigger: {
    component: {
      render: () => h("path", { d: TRIGGER_PATH, fill: "currentColor" }),
    },
  },
  radar: {
    component: {
      render: () => h("path", { d: RADAR_PATH, fill: "currentColor" }),
    },
  },
  "x-circle": {
    component: {
      render: () => h("path", { d: X_CIRCLE_PATH, fill: "currentColor" }),
    },
  },
  "chevron-down": {
    component: {
      render: () => h("path", { d: CHEVRON_DOWN_PATH, fill: "currentColor" }),
    },
  },
  "arrow-up": {
    component: {
      render: () => h("path", { d: ARROW_UP_PATH, fill: "currentColor" }),
    },
  },
  "arrow-down": {
    component: {
      render: () => h("path", { d: ARROW_DOWN_PATH, fill: "currentColor" }),
    },
  },
  minus: {
    component: {
      render: () => h("path", { d: MINUS_PATH, fill: "currentColor" }),
    },
  },
  settings: {
    component: {
      render: () => h("path", { d: SETTINGS_PATH, fill: "currentColor" }),
    },
  },
  search: {
    component: {
      render: () => h("path", { d: SEARCH_PATH, fill: "currentColor" }),
    },
  },
  info: {
    component: {
      render: () => h("path", { d: INFO_PATH, fill: "currentColor" }),
    },
  },
  news: {
    component: {
      render: () => h("path", { d: NEWS_PATH, fill: "currentColor" }),
    },
  },
  wallet: {
    component: {
      render: () => h("path", { d: WALLET_PATH, fill: "currentColor" }),
    },
  },
  clock: {
    component: {
      render: () => h("path", { d: CLOCK_PATH, fill: "currentColor" }),
    },
  },
  "arrow-left": {
    component: {
      render: () => h("path", { d: ARROW_LEFT_PATH, fill: "currentColor" }),
    },
  },
  "trending-up": {
    component: {
      render: () => h("path", { d: TRENDING_UP_PATH, fill: "currentColor" }),
    },
  },
  "trending-down": {
    component: {
      render: () => h("path", { d: TRENDING_DOWN_PATH, fill: "currentColor" }),
    },
  },
  "arrow-right": {
    component: {
      render: () => h("path", { d: ARROW_RIGHT_PATH, fill: "currentColor" }),
    },
  },
  "chevron-right": {
    component: {
      render: () => h("path", { d: CHEVRON_RIGHT_PATH, fill: "currentColor" }),
    },
  },
  "chevron-up": {
    component: {
      render: () => h("path", { d: CHEVRON_UP_PATH, fill: "currentColor" }),
    },
  },
  "bull": {
    component: {
      render: () => h("path", { d: BULL_PATH, fill: "currentColor" }),
    },
  },
  "bear": {
    component: {
      render: () => h("path", { d: BEAR_PATH, fill: "currentColor" }),
    },
  },
  "candlestick": {
    component: {
      render: () => h("path", { d: CANDLESTICK_PATH, fill: "currentColor" }),
    },
  },
  "percent": {
    component: {
      render: () => h("path", { d: PERCENT_PATH, fill: "currentColor" }),
    },
  },
  "coins": {
    component: {
      render: () => h("path", { d: COINS_PATH, fill: "currentColor" }),
    },
  },
  "bank": {
    component: {
      render: () => h("path", { d: BANK_PATH, fill: "currentColor" }),
    },
  },
  "wallet-outline": {
    component: {
      render: () => h("path", { d: WALLET_OUTLINE_PATH, fill: "currentColor" }),
    },
  },
};

export const ICON_NAMES = Object.keys(ICON_MAP);
