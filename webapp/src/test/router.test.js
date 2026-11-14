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

  it("/strategy-status 應重定向至 /dashboard?panel=strategy-status", async () => {
    await router.push("/strategy-status");
    expect(router.currentRoute.value.path).toBe("/dashboard");
    expect(router.currentRoute.value.query.panel).toBe("strategy-status");
  });

  it("/radar 應重定向至 /insights?tab=radar", async () => {
    await router.push("/radar");
    expect(router.currentRoute.value.path).toBe("/insights");
    expect(router.currentRoute.value.query.tab).toBe("radar");
  });

  it("/macro 應重定向至 /insights?tab=macro", async () => {
    await router.push("/macro");
    expect(router.currentRoute.value.path).toBe("/insights");
    expect(router.currentRoute.value.query.tab).toBe("macro");
  });

  it("/technical 應重定向至 /chart?tab=technical", async () => {
    await router.push("/technical");
    expect(router.currentRoute.value.path).toBe("/chart");
    expect(router.currentRoute.value.query.tab).toBe("technical");
  });

  it("/theory 應重定向至 /account?panel=about", async () => {
    await router.push("/theory");
    expect(router.currentRoute.value.path).toBe("/account");
    expect(router.currentRoute.value.query.panel).toBe("about");
  });
});
