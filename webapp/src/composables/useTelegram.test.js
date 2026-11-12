import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { useTelegram, waitReady } from "./useTelegram.js";

afterEach(() => {
  delete window.Telegram;
  vi.restoreAllMocks();
});

describe("waitReady", () => {
  it("resolves immediately outside Telegram", async () => {
    await expect(waitReady()).resolves.toBeUndefined();
  });

  it("calls Telegram ready before resolving", async () => {
    const ready = vi.fn();
    window.Telegram = { WebApp: { ready } };

    await waitReady();

    expect(ready).toHaveBeenCalledOnce();
  });
});

describe("useTelegram", () => {
  it("exposes Telegram data and actions", () => {
    const openLink = vi.fn();
    const expand = vi.fn();
    const BackButton = { show: vi.fn() };
    window.Telegram = {
      WebApp: {
        initData: "init-data",
        themeParams: { bg_color: "#fff" },
        openLink,
        expand,
        BackButton,
      },
    };

    const telegram = useTelegram();

    expect(telegram.initData).toBe("init-data");
    expect(telegram.themeParams).toEqual({ bg_color: "#fff" });
    expect(telegram.backButton).toBe(BackButton);
    telegram.expand();
    telegram.openLink("https://example.com");
    expect(expand).toHaveBeenCalledOnce();
    expect(openLink).toHaveBeenCalledWith("https://example.com");
  });

  describe("useTelegram Phase 4 new capabilities", () => {
    const mountComposable = (factory) => {
      let value;
      const wrapper = mount(
        defineComponent({
          setup() {
            value = factory();
            return () => null;
          },
        }),
      );
      return { value, wrapper };
    };

    const buildTg = (overrides = {}) => ({
      HapticFeedback: {
        impactOccurred: vi.fn(),
        notificationOccurred: vi.fn(),
      },
      setHeaderColor: vi.fn(),
      setBackgroundColor: vi.fn(),
      enableClosingConfirmation: vi.fn(),
      disableClosingConfirmation: vi.fn(),
      MainButton: { show: vi.fn(), hide: vi.fn(), setText: vi.fn() },
      onEvent: vi.fn(),
      offEvent: vi.fn(),
      viewportHeight: 800,
      colorScheme: "light",
      ...overrides,
    });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    afterEach(() => {
      vi.restoreAllMocks();
      delete window.Telegram;
    });

    it("exposes haptic impact feedback", () => {
      window.Telegram = { WebApp: buildTg() };
      const { value } = mountComposable(() => useTelegram());
      value.haptic("light");
      expect(
        window.Telegram.WebApp.HapticFeedback.impactOccurred,
      ).toHaveBeenCalledWith("light");
    });

    it("exposes haptic notification feedback", () => {
      window.Telegram = { WebApp: buildTg() };
      const { value } = mountComposable(() => useTelegram());
      value.hapticNotification("success");
      expect(
        window.Telegram.WebApp.HapticFeedback.notificationOccurred,
      ).toHaveBeenCalledWith("success");
    });

    it("exposes setHeaderColor", () => {
      window.Telegram = { WebApp: buildTg() };
      const { value } = mountComposable(() => useTelegram());
      value.setHeaderColor("#2481cc");
      expect(window.Telegram.WebApp.setHeaderColor).toHaveBeenCalledWith(
        "#2481cc",
      );
    });

    it("exposes setBackgroundColor", () => {
      window.Telegram = { WebApp: buildTg() };
      const { value } = mountComposable(() => useTelegram());
      value.setBackgroundColor("#000000");
      expect(window.Telegram.WebApp.setBackgroundColor).toHaveBeenCalledWith(
        "#000000",
      );
    });

    it("exposes enableClosingConfirmation", () => {
      window.Telegram = { WebApp: buildTg() };
      const { value } = mountComposable(() => useTelegram());
      value.enableClosingConfirmation();
      expect(
        window.Telegram.WebApp.enableClosingConfirmation,
      ).toHaveBeenCalledTimes(1);
    });

    it("exposes disableClosingConfirmation", () => {
      window.Telegram = { WebApp: buildTg() };
      const { value } = mountComposable(() => useTelegram());
      value.disableClosingConfirmation();
      expect(
        window.Telegram.WebApp.disableClosingConfirmation,
      ).toHaveBeenCalledTimes(1);
    });

    it("exposes mainButton as the raw Telegram MainButton object", () => {
      const mainButton = { show: vi.fn(), hide: vi.fn() };
      window.Telegram = { WebApp: buildTg({ MainButton: mainButton }) };
      const { value } = mountComposable(() => useTelegram());
      expect(value.mainButton).toBe(mainButton);
    });

    it("exposes reactive viewportHeight from Telegram", () => {
      window.Telegram = { WebApp: buildTg({ viewportHeight: 812 }) };
      const { value } = mountComposable(() => useTelegram());
      expect(value.viewportHeight.value).toBe(812);
    });

    it("exposes reactive colorScheme from Telegram", () => {
      window.Telegram = { WebApp: buildTg({ colorScheme: "dark" }) };
      const { value } = mountComposable(() => useTelegram());
      expect(value.colorScheme.value).toBe("dark");
    });

    it("registers viewportChanged and themeChanged event listeners on mount", () => {
      window.Telegram = { WebApp: buildTg() };
      const { wrapper } = mountComposable(() => useTelegram());
      const tg = window.Telegram.WebApp;
      expect(tg.onEvent).toHaveBeenCalledWith(
        "viewportChanged",
        expect.any(Function),
      );
      expect(tg.onEvent).toHaveBeenCalledWith(
        "themeChanged",
        expect.any(Function),
      );
      wrapper.unmount();
      expect(tg.offEvent).toHaveBeenCalledWith(
        "viewportChanged",
        expect.any(Function),
      );
      expect(tg.offEvent).toHaveBeenCalledWith(
        "themeChanged",
        expect.any(Function),
      );
    });

    it("gracefully degrades when Telegram SDK is absent", () => {
      delete window.Telegram;
      const { value } = mountComposable(() => useTelegram());
      expect(() => value.haptic()).not.toThrow();
      expect(() => value.setHeaderColor("#2481cc")).not.toThrow();
      expect(() => value.enableClosingConfirmation()).not.toThrow();
      expect(value.mainButton).toBeUndefined();
      expect(value.viewportHeight.value).toBe(0);
      expect(value.colorScheme.value).toBe("light");
    });
  });

  it("falls back to window.open outside Telegram", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    const telegram = useTelegram();
    telegram.expand();
    telegram.openLink("https://example.com");

    expect(open).toHaveBeenCalledWith("https://example.com", "_blank");
    expect(telegram.initData).toBe("");
    expect(telegram.themeParams).toEqual({});
  });
});
