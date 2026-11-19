import { routeApi } from "./scenarios.js";

export function installMockRouter({
  scenario = "rich",
  weakNetwork = false,
} = {}) {
  if (typeof window === "undefined" || typeof window.fetch !== "function")
    return () => {};
  const originalFetch = window.fetch.bind(window);
  window.__ILN_MOCK_SCENARIO__ = scenario;
  window.__ILN_MOCK_API__ = true;
  window.fetch = async (input, options = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    const parsed = new URL(url, window.location.origin);
    if (parsed.pathname.startsWith("/api/")) {
      return routeApi(parsed.pathname, options, {
        scenario,
        isWeakNetwork: weakNetwork || scenario === "weak-network",
      });
    }
    return originalFetch(input, options);
  };
  return () => {
    window.fetch = originalFetch;
    delete window.__ILN_MOCK_API__;
  };
}

export default installMockRouter;
