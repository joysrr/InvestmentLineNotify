import { describe, expect, it } from "vitest";
import { apiFetch } from "../../api/index.js";

describe("apiFetch URL normalization", () => {
  it("當 path 已包含完整 URL 時不應重複拼接 BASE", async () => {
    // 透過 mock fetch 測試產出的 URL 結構
    const originalFetch = global.fetch;
    let requestedUrl = null;

    global.fetch = async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        json: async () => ({ status: "ok" }),
      };
    };

    try {
      await apiFetch("https://joysrr.duckdns.org/api/reports?limit=1");
      expect(requestedUrl).toBe(
        "https://joysrr.duckdns.org/api/reports?limit=1",
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
