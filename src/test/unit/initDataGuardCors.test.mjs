import { describe, expect, it } from "vitest";
import { initDataGuard } from "../../api/middleware/initDataGuard.mjs";

describe("initDataGuard CORS & OPTIONS Preflight", () => {
  it("應自動放行 OPTIONS 預檢請求，不拋出 403", async () => {
    let responseCode = null;
    let responseBody = null;

    const mockRequest = {
      method: "OPTIONS",
      url: "/api/reports/snapshots?limit=1",
      headers: {},
      ip: "127.0.0.1",
    };

    const mockReply = {
      code(c) {
        responseCode = c;
        return this;
      },
      send(b) {
        responseBody = b;
        return this;
      },
    };

    await initDataGuard(mockRequest, mockReply);

    // OPTIONS 請求不應被 code(403) 拒絕
    expect(responseCode).toBeNull();
    expect(responseBody).toBeNull();
  });
});
