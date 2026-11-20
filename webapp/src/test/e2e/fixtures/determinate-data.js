/**
 * 六頁 390x844 E2E 測試的確定資料 fixture。
 *
 * 所有頁面依賴的 API 端點皆以固定回應攔截，避免環境資料變動導致測試結果不重複。
 * 固定值皆為與契約相容的資料，不模擬非真實的業務邏輯，僅保證頁面可正常渲染。
 */
export const DETERMINATE_FIXTURES = {
  // GET /api/status — 主頁 /dashboard 使用
  "/api/status": {
    data: {
      lastRun: "2026-01-01T00:00:00.000Z",
      sources: {
        yahoo: { status: "SUCCESS" },
        twse: { status: "SUCCESS" },
      },
      status: "healthy",
    },
  },
  // GET /api/reports?limit=N — 主頁 /dashboard 與 /account 皆使用；回傳 array
  "/api/reports": [
    {
      date: "2026-01-01",
      twVix: 15.5,
      usVix: 14.8,
      cnnFearGreed: 55,
      pbPr: 1.2,
      maintenanceRatio: 120,
    },
  ],
  // GET /api/news — 新聞頁 /news 使用
  "/api/news": {
    news: [
      {
        title: "固定測試新聞標題",
        url: "https://example.com/fixture-news-1",
        source: "Fixture",
        publishedAt: "2026-01-01T00:00:00.000Z",
        sentiment: "neutral",
      },
      {
        title: "另一條固定測試新聞",
        url: "https://example.com/fixture-news-2",
        source: "Fixture",
        publishedAt: "2026-01-01T01:00:00.000Z",
        sentiment: "positive",
      },
    ],
  },
  // GET /api/portfolio-health — 主頁 /dashboard 使用
  "/api/portfolio-health": {
    status: "healthy",
    maintenanceRatio: 120,
    leverage: 1,
  },
  // GET /api/strategy-config/meta — 策略設定頁 /strategy-config 使用
  "/api/strategy-config/meta": {
    success: true,
    meta: {
      groups: [],
      sections: [],
    },
  },
  // POST /api/strategy-config/validate — 策略設定頁頁面載入時驗證
  "/api/strategy-config/validate": {
    valid: true,
    errors: [],
  },
};
