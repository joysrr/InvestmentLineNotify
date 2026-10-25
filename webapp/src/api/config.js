/**
 * API 配置集中化
 * 所有 API 端點路徑、基礎 URL 統一管理
 * 未來換域名/版本/代理只需改這裡
 */

// 環境變數優先，Vite 建置時注入
export const API_BASE = import.meta.env.VITE_API_BASE || "";

// API 版本前綴
export const API_VERSION = "/api";

// 端點路徑映射 (無版本前綴，由 buildUrl 自動加上)
export const ENDPOINTS = {
  // 報表
  reports: {
    list: "/reports",
    weekly: "/reports/weekly",
    monthly: "/reports/monthly",
    signals: (date) => `/report/${date}/signals`,
    snapshots: {
      list: "/reports/snapshots",
      weekly: "/reports/snapshots/weekly",
      monthly: "/reports/snapshots/monthly",
    },
  },

  // 新聞
  news: "/news",
  reportNews: "/report/news",

  // 社群情緒
  socialSentiment: "/social-sentiment",

  // 資料證據報告
  dataEvidenceReport: "/data-evidence-report",

  // Replay Evidence
  replayEvidence: "/replay-evidence",

  // 狀態
  status: "/status",

  // 策略設定
  strategyConfig: "/strategy-config",

  // 快照
  snapshots: {
    list: "/snapshots",
    save: "/snapshots",
  },
}; // as const removed for JS compatibility

/**
 * 組合完整 API URL
 * @param endpoint 端點路徑 (需以 / 開頭，不含 /api)
 * @returns 完整 URL (含 BASE + /api + endpoint)
 */
export function buildUrl(endpoint) {
  return `${API_BASE}${API_VERSION}${endpoint}`;
}

/**
 * 建立帶查詢參數的 URL
 */
export function buildUrlWithQuery(endpoint, params = {}) {
  const url = buildUrl(endpoint);
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `${url}?${query}` : url;
}

export default {
  API_BASE,
  API_VERSION,
  ENDPOINTS,
  buildUrl,
  buildUrlWithQuery,
};
