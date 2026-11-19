import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mount } from "@vue/test-utils";
import OfflineBanner from "../components/common/OfflineBanner.vue";
import { networkStatus } from "../composables/useNetworkStatus.js";

const setNavigatorOnline = (value) => {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
    writable: true,
  });
};

beforeEach(() => {
  // Reset network status to online before each test
  networkStatus.status.value = "online";
  networkStatus.isOnline.value = true;
  networkStatus.isWeakNetwork.value = false;
  setNavigatorOnline(true);
  // Clear any teleported notifications from previous tests
  document.body
    .querySelectorAll(".el-notification")
    .forEach((el) => el.remove());
});

afterEach(() => {
  setNavigatorOnline(true);
  document.body
    .querySelectorAll(".el-notification")
    .forEach((el) => el.remove());
});

const getNotification = () => document.body.querySelector(".el-notification");

describe("OfflineBanner", () => {
  it("線上時不顯示橫條", () => {
    networkStatus.status.value = "online";
    const wrapper = mount(OfflineBanner);
    expect(getNotification()).toBeNull();
    wrapper.unmount();
  });

  it("離線時顯示離線標題與訊息", async () => {
    networkStatus.status.value = "offline";
    const wrapper = mount(OfflineBanner);
    await wrapper.vm.$nextTick();
    const el = getNotification();
    expect(el).not.toBeNull();
    expect(el.textContent).toContain("網路已離線");
    expect(el.textContent).toContain("目前無網路連線");
    wrapper.unmount();
  });

  it("弱網時顯示弱網標題與訊息", async () => {
    networkStatus.status.value = "weak";
    const wrapper = mount(OfflineBanner);
    await wrapper.vm.$nextTick();
    const el = getNotification();
    expect(el).not.toBeNull();
    expect(el.textContent).toContain("網路較慢");
    expect(el.textContent).toContain("弱網環境");
    wrapper.unmount();
  });

  it("點擊重試發出 retry 事件並隱藏橫條", async () => {
    networkStatus.status.value = "offline";
    const wrapper = mount(OfflineBanner, {
      global: {
        stubs: {
          ElNotification: { template: "<div><slot /></div>" },
          ElButton: {
            emits: ["click"],
            template: "<button @click=\"$emit('click')\"><slot /></button>",
          },
        },
      },
    });
    await wrapper.vm.$nextTick();

    wrapper.vm.handleRetry();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted("retry")).toBeTruthy();
    expect(getNotification()).toBeNull();
    wrapper.unmount();
  });
});
