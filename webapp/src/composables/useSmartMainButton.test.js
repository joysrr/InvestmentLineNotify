import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { defineComponent } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import { mount } from "@vue/test-utils";
import { useSmartMainButton } from "./useSmartMainButton.js";

afterEach(() => {
  delete window.Telegram;
  vi.restoreAllMocks();
});

const routes = [
  { path: "/dashboard", component: { template: "<div />" } },
  { path: "/insights", component: { template: "<div />" } },
  { path: "/chart", component: { template: "<div />" } },
  { path: "/account", component: { template: "<div />" } },
];

const mountComposable = (factory) => {
  let value;
  const router = createRouter({
    history: createWebHistory(),
    routes,
  });
  mount(
    defineComponent({
      setup() {
        value = factory();
        return () => null;
      },
    }),
    { global: { plugins: [router] } },
  );
  return { value, router };
};

const buildTg = (overrides = {}) => ({
  MainButton: {
    show: vi.fn(),
    hide: vi.fn(),
    setText: vi.fn(),
    setColor: vi.fn(),
    setTextColor: vi.fn(),
    onClick: vi.fn(),
    offClick: vi.fn(),
    setParams: vi.fn(),
    ...overrides.mainButton,
  },
  ...overrides,
});

describe("useSmartMainButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("dashboard 顯示「查看報表」並導向 insights radar", () => {
    window.Telegram = { WebApp: buildTg() };
    const { value } = mountComposable(() => useSmartMainButton());

    expect(value.config.value.text).toBe("查看報表");
    expect(value.config.value.to).toBe("/insights?tab=radar");
    expect(window.Telegram.WebApp.MainButton.setText).toHaveBeenCalledWith(
      value.config.value.text,
    );
    expect(window.Telegram.WebApp.MainButton.show).toHaveBeenCalled();
    expect(window.Telegram.WebApp.MainButton.onClick).toHaveBeenCalled();
  });

  it("insights 顯示「查看雷達」並再次顯示 MainButton", async () => {
    window.Telegram = { WebApp: buildTg() };
    const { value, router } = mountComposable(() => useSmartMainButton());

    expect(value.config.value.text).toBe("查看報表");
    await router.push("/insights");
    await router.isReady();
    await nextTick();

    expect(value.config.value.text).toBe("查看雷達");
    expect(value.config.value.to).toBe("/insights?tab=radar");
    expect(window.Telegram.WebApp.MainButton.setText).toHaveBeenLastCalledWith(
      value.config.value.text,
    );
    expect(window.Telegram.WebApp.MainButton.show).toHaveBeenLastCalledWith();
  });

  it("chart 顯示「分析圖表」並導向 /chart", async () => {
    window.Telegram = { WebApp: buildTg() };
    const { value, router } = mountComposable(() => useSmartMainButton());

    await router.push("/chart");
    await router.isReady();
    await nextTick();

    expect(value.config.value.text).toBe("分析圖表");
    expect(value.config.value.to).toBe("/chart");
  });

  it("account 顯示「帳戶設定」並導向 /account", async () => {
    window.Telegram = { WebApp: buildTg() };
    const { value, router } = mountComposable(() => useSmartMainButton());

    await router.push("/account");
    await router.isReady();
    await nextTick();

    expect(value.config.value.text).toBe("帳戶設定");
    expect(value.config.value.to).toBe("/account");
  });

  it("點擊 MainButton 觸發輕微觸覺並導向 config.to", () => {
    const impact = vi.fn();
    window.Telegram = {
      WebApp: buildTg({ HapticFeedback: { impactOccurred: impact } }),
    };
    const { value, router } = mountComposable(() => useSmartMainButton());
    const pushSpy = vi.spyOn(router, "push");

    const handler = window.Telegram.WebApp.MainButton.onClick.mock.calls[0][0];
    handler();

    expect(impact).toHaveBeenCalledWith("light");
    expect(pushSpy).toHaveBeenCalledWith(value.config.value.to);
  });

  it("是 no-op 在非 Telegram 環境（dev browser）", () => {
    delete window.Telegram;
    const { value } = mountComposable(() => useSmartMainButton());

    expect(() => value.config.value).not.toThrow();
    expect(value.config.value.text).toBe("查看報表");
  });
});
