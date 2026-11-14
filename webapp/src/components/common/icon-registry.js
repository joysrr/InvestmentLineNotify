// 圖標路徑常數與 ICON_MAP 純資料模組
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
  "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 10s4.477 10 10 10zM12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM2 12h20M12 2v20";
export const X_CIRCLE_PATH =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 9.17L13 16.17l-4.17-4.17L8.83 11l4.17-4.17L13 7.83l4.17 4.17z";
export const CHEVRON_DOWN_PATH = "M6 9l6 6 6-6";
export const ARROW_UP_PATH = "M12 2l-4 4v6h4v4h4v-4h4V6l-4-4z";
export const ARROW_DOWN_PATH = "M12 22l4-4v-6h-4v-4h-4v4h-4v6l4 4z";
export const MINUS_PATH = "M18 6H6v2h12V6z";
export const SETTINGS_PATH =
  "M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0 .59-.22l2.39-.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z";
export const SEARCH_PATH =
  "M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z";
export const INFO_PATH =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z";
export const NEWS_PATH =
  "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z";
export const WALLET_PATH =
  "M21 7.28V5c0-1.1-.9-2-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14c1.1 0 2-.9 2-2v-2.28A2 2 0 0 0 22 15V9a2 2 0 0 0-1-1.72zM20 9v6h-7V9h7zM5 19V5h14v2h-6c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h6v2H5z";

export const ICON_MAP = {
  "check-circle": {
    component: { template: `<path d="${CHECK_PATH}" fill="currentColor"/>` },
  },
  ok: {
    component: { template: `<path d="${CHECK_PATH}" fill="currentColor"/>` },
  },
  danger: {
    component: { template: `<path d="${DANGER_PATH}" fill="currentColor"/>` },
  },
  warn: {
    component: { template: `<path d="${WARN_PATH}" fill="currentColor"/>` },
  },
  "alert-triangle": {
    component: { template: `<path d="${WARN_PATH}" fill="currentColor"/>` },
  },
  neutral: {
    component: { template: `<path d="${NEUTRAL_PATH}" fill="currentColor"/>` },
  },
  chart: {
    component: { template: `<path d="${CHART_PATH}" fill="currentColor"/>` },
  },
  shield: {
    component: { template: `<path d="${SHIELD_PATH}" fill="currentColor"/>` },
  },
  trigger: {
    component: { template: `<path d="${TRIGGER_PATH}" fill="currentColor"/>` },
  },
  radar: {
    component: { template: `<path d="${RADAR_PATH}" fill="currentColor"/>` },
  },
  "x-circle": {
    component: { template: `<path d="${X_CIRCLE_PATH}" fill="currentColor"/>` },
  },
  "chevron-down": {
    component: {
      template: `<path d="${CHEVRON_DOWN_PATH}" fill="currentColor"/>`,
    },
  },
  "arrow-up": {
    component: { template: `<path d="${ARROW_UP_PATH}" fill="currentColor"/>` },
  },
  "arrow-down": {
    component: {
      template: `<path d="${ARROW_DOWN_PATH}" fill="currentColor"/>`,
    },
  },
  minus: {
    component: { template: `<path d="${MINUS_PATH}" fill="currentColor"/>` },
  },
  settings: {
    component: { template: `<path d="${SETTINGS_PATH}" fill="currentColor"/>` },
  },
  search: {
    component: { template: `<path d="${SEARCH_PATH}" fill="currentColor"/>` },
  },
  info: {
    component: { template: `<path d="${INFO_PATH}" fill="currentColor"/>` },
  },
  news: {
    component: { template: `<path d="${NEWS_PATH}" fill="currentColor"/>` },
  },
  wallet: {
    component: { template: `<path d="${WALLET_PATH}" fill="currentColor"/>` },
  },
};

export const ICON_NAMES = Object.keys(ICON_MAP);
