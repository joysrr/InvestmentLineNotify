// webapp/src/components/common/AuthExpiredModal.test.js
import { describe, it, expect, beforeEach } from "vitest";
import { mount } from "@vue/test-utils";
import AuthExpiredModal from "./AuthExpiredModal.vue";
import {
  triggerAuthExpired,
  resetAuthExpired,
} from "../../composables/useAuthExpired.js";

describe("AuthExpiredModal.vue", () => {
  beforeEach(() => {
    resetAuthExpired();
  });

  it("預設狀態不渲染 Modal", () => {
    const wrapper = mount(AuthExpiredModal);
    expect(wrapper.find("[data-testid=auth-expired-modal]").exists()).toBe(
      false,
    );
  });

  it("觸發 AuthExpired 時渲染 Modal 視窗", async () => {
    const wrapper = mount(AuthExpiredModal);
    triggerAuthExpired();
    await wrapper.vm.$nextTick();

    expect(wrapper.find("[data-testid=auth-expired-modal]").exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain("登入憑證已過期");
  });
});
