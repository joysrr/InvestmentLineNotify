// webapp/src/composables/useAuthExpired.test.js
import { describe, it, expect, beforeEach } from "vitest";
import {
  useAuthExpired,
  triggerAuthExpired,
  resetAuthExpired,
} from "./useAuthExpired.js";

describe("useAuthExpired Composable", () => {
  beforeEach(() => {
    resetAuthExpired();
  });

  it("預設 isAuthExpired 為 false", () => {
    const { isAuthExpired } = useAuthExpired();
    expect(isAuthExpired.value).toBe(false);
  });

  it("觸發 triggerAuthExpired 後 isAuthExpired 變為 true", () => {
    const { isAuthExpired } = useAuthExpired();
    triggerAuthExpired();
    expect(isAuthExpired.value).toBe(true);
  });

  it("重置 resetAuthExpired 後 isAuthExpired 恢復為 false", () => {
    const { isAuthExpired } = useAuthExpired();
    triggerAuthExpired();
    resetAuthExpired();
    expect(isAuthExpired.value).toBe(false);
  });
});
