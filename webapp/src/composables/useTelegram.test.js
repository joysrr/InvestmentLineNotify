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

    describe("useTelegram Phase 5 new capabilities", () => {
      const buildTg5 = (overrides = {}) => ({
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
        viewportStableHeight: 750,
        colorScheme: "light",
        themeParams: { bg_color: "#ffffff" },
        safeAreaInset: { top: 0, bottom: 34, left: 0, right: 0 },
        ...overrides,
      });

      it("exposes viewportStableHeight reactive ref", () => {
        const tg = buildTg5();
        window.Telegram = { WebApp: tg };

        const telegram = useTelegram();

        expect(telegram.viewportStableHeight.value).toBe(750);
      });

      it("exposes safeAreaInset reactive ref", () => {
        const tg = buildTg5();
        window.Telegram = { WebApp: tg };

        const telegram = useTelegram();

        expect(telegram.safeAreaInset.value).toEqual({
          top: 0,
          bottom: 34,
          left: 0,
          right: 0,
        });
      });

      it("syncs viewportStableHeight from viewportChanged event payload", () => {
        const tg = buildTg5();
        window.Telegram = { WebApp: tg };

        const { value: telegram } = mountComposable(() => useTelegram());

        const onViewportChanged = tg.onEvent.mock.calls.find(
          (c) => c[0] === "viewportChanged",
        )[1];

        onViewportChanged({
          viewportHeight: 850,
          viewportStableHeight: 800,
        });

        expect(telegram.viewportStableHeight.value).toBe(800);
        expect(telegram.viewportHeight.value).toBe(850);
      });

      it("falls back to tg.viewportStableHeight when event lacks payload", () => {
        const tg = buildTg5();
        window.Telegram = { WebApp: tg };

        const { value: telegram } = mountComposable(() => useTelegram());

        const onViewportChanged = tg.onEvent.mock.calls.find(
          (c) => c[0] === "viewportChanged",
        )[1];

        onViewportChanged({});

        expect(telegram.viewportStableHeight.value).toBe(750);
      });

      it("registers safeAreaChanged on mount and unregisters on unmount", () => {
        const tg = buildTg5();
        window.Telegram = { WebApp: tg };

        const { wrapper } = mountComposable(() => useTelegram());

        expect(tg.onEvent).toHaveBeenCalledWith(
          "safeAreaChanged",
          expect.any(Function),
        );
        expect(tg.offEvent).not.toHaveBeenCalled();

        wrapper.unmount();

        expect(tg.offEvent).toHaveBeenCalledWith(
          "safeAreaChanged",
          expect.any(Function),
        );
      });

      it("reads safeAreaInset from Telegram on mount", () => {
        const tg = buildTg5();
        window.Telegram = { WebApp: tg };

        mountComposable(() => useTelegram());

        expect(tg.onEvent).toHaveBeenCalledWith(
          "safeAreaChanged",
          expect.any(Function),
        );
      });

      it("handleThemeChanged calls setHeaderColor and setBackgroundColor with bg_color", () => {
        const tg = buildTg5();
        window.Telegram = { WebApp: tg };

        mountComposable(() => useTelegram());

        const onThemeChanged = tg.onEvent.mock.calls.find(
          (c) => c[0] === "themeChanged",
        )[1];

        onThemeChanged();

        expect(tg.setHeaderColor).toHaveBeenCalledWith("#ffffff");
        expect(tg.setBackgroundColor).toHaveBeenCalledWith("#ffffff");
      });

      it("handleThemeChanged falls back to dark color when themeParams.bg_color absent", () => {
        const tg = buildTg5({ themeParams: {}, colorScheme: "dark" });
        window.Telegram = { WebApp: tg };

        mountComposable(() => useTelegram());

        const onThemeChanged = tg.onEvent.mock.calls.find(
          (c) => c[0] === "themeChanged",
        )[1];

        onThemeChanged();

        expect(tg.setHeaderColor).toHaveBeenCalledWith("#1a1a1a");
        expect(tg.setBackgroundColor).toHaveBeenCalledWith("#1a1a1a");
      });
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
