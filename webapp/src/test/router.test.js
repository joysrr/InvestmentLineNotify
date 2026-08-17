// webapp/src/test/router.test.js
import { describe, it, expect } from "vitest";
import router from "../router/index.js";

describe("Router 策略設定整合與重定向", () => {
  it("/strategy 應重定向至 /strategy-config", async () => {
    await router.push("/strategy");
    expect(router.currentRoute.value.path).toBe("/strategy-config");
  });

  it("根路徑應重定向至 /dashboard", async () => {
    await router.push("/");
    expect(router.currentRoute.value.path).toBe("/dashboard");
  });

  it("未知路徑應重定向至 /dashboard", async () => {
    await router.push("/unknown-route");
    expect(router.currentRoute.value.path).toBe("/dashboard");
  });
});
