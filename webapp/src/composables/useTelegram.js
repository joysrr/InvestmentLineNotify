import { ref, onMounted, onUnmounted } from "vue";

/**
 * waitReady() resolves when Telegram.WebApp is fully initialised.
 * - If running outside Telegram (dev browser), resolves immediately.
 * - Calls tg.ready() so the loading indicator is dismissed.
 */
export function waitReady() {
  return new Promise((resolve) => {
    const tg = window.Telegram?.WebApp;
    if (!tg) {
      // Dev environment — no Telegram SDK, resolve straight away
      resolve();
      return;
    }
    // WebApp.initData is populated synchronously before DOMContentLoaded,
    // but expand() and theme vars may not be applied yet.
    // Calling ready() tells Telegram the app has loaded; it also fires
    // any queued internal callbacks that set initData on older clients.
    tg.ready();
    // Give the SDK one microtask to settle (covers edge-cases on iOS)
    Promise.resolve().then(resolve);
  });
}

// 模組級響應式狀態（跨元件共享）
export const viewportHeight = ref(
  typeof window !== "undefined"
    ? (window.Telegram?.WebApp?.viewportHeight ?? window.innerHeight)
    : 0,
);

export const colorScheme = ref(
  typeof window !== "undefined"
    ? (window.Telegram?.WebApp?.colorScheme ?? "light")
    : "light",
);

export function useTelegram() {
  const tg = window.Telegram?.WebApp;

  // 每次掛載時，根據當前 Telegram 狀態同步模組級 ref（跨元件共享單例）
  if (tg) {
    viewportHeight.value = tg.viewportHeight ?? 0;
    colorScheme.value = tg.colorScheme ?? "light";
  } else {
    viewportHeight.value = 0;
    colorScheme.value = "light";
  }

  const handleViewportChanged = (e) => {
    viewportHeight.value = e?.viewportHeight ?? tg?.viewportHeight ?? 0;
  };

  const handleThemeChanged = () => {
    colorScheme.value = tg?.colorScheme ?? "light";
  };

  onMounted(() => {
    tg?.onEvent?.("viewportChanged", handleViewportChanged);
    tg?.onEvent?.("themeChanged", handleThemeChanged);
  });

  onUnmounted(() => {
    tg?.offEvent?.("viewportChanged", handleViewportChanged);
    tg?.offEvent?.("themeChanged", handleThemeChanged);
  });

  // ── 既有能力（保留） ──
  const expand = () => tg?.expand();
  const backButton = tg?.BackButton;
  const openLink = (url) => {
    if (tg) {
      tg.openLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  // ── Phase 4 新增能力 ──
  // 1. Haptic 觸覺回饋
  const haptic = (type = "light") => {
    try {
      tg?.HapticFeedback?.impactOccurred(type);
    } catch (_e) {
      void _e;
    }
  };

  const hapticNotification = (type = "success") => {
    try {
      tg?.HapticFeedback?.notificationOccurred(type);
    } catch (_e) {
      void _e;
    }
  };

  // 2. 頂部色 / 背景色
  const setHeaderColor = (color) => {
    try {
      tg?.setHeaderColor?.(color);
    } catch (_e) {
      void _e;
    }
  };

  const setBackgroundColor = (color) => {
    try {
      tg?.setBackgroundColor?.(color);
    } catch (_e) {
      void _e;
    }
  };

  // 3. 關閉確認
  const enableClosingConfirmation = () => {
    try {
      tg?.enableClosingConfirmation?.();
    } catch (_e) {
      void _e;
    }
  };

  const disableClosingConfirmation = () => {
    try {
      tg?.disableClosingConfirmation?.();
    } catch (_e) {
      void _e;
    }
  };

  // 4. MainButton（暴露原始物件，由呼叫端管理）
  const mainButton = tg?.MainButton;

  return {
    // 既有
    tg,
    initData: tg?.initData ?? "",
    themeParams: tg?.themeParams ?? {},
    expand,
    openLink,
    backButton,
    // 新增
    haptic,
    hapticNotification,
    setHeaderColor,
    setBackgroundColor,
    enableClosingConfirmation,
    disableClosingConfirmation,
    mainButton,
    // 響應式
    viewportHeight,
    colorScheme,
  };
}
