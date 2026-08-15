// webapp/src/test/router.test.js
import { describe, it, expect } from "vitest";
import router from "../router/index.js";

describe("Router 策略設定整合與重定向", () => {
  it("/strategy 應重定向至 /strategy-config", async () => {
    router.push("/strategy");
    await router.isReady();
    expect(router.currentRoute.value.path).toBe("/strategy-config");
  });
});
