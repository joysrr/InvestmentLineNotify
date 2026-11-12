import { ref, computed, onMounted, onUnmounted } from "vue";

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
    // 記錄 SDK 版本，供下游判斷能力可用性（6.9 起支援 enableClosingConfirmation）
    if (
      typeof tg.isVersionAtLeast === "function" &&
      !tg.isVersionAtLeast("6.9")
    ) {
      console.warn(
        "[useTelegram] SDK 版本 < 6.9，closing confirmation 與部分 haptic 不可用",
      );
    }
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

export const viewportStableHeight = ref(
  typeof window !== "undefined"
    ? (window.Telegram?.WebApp?.viewportStableHeight ?? window.innerHeight)
    : 0,
);

export const safeAreaInset = ref({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
});

export const colorScheme = ref(
  typeof window !== "undefined"
    ? (window.Telegram?.WebApp?.colorScheme ?? "light")
    : "light",
);

// Phase 5 A1-2：深色模式判斷，讓下游元件不必自己比對 colorScheme === "dark"
export const isDark = computed(() => colorScheme.value === "dark");

export function useTelegram() {
  const tg = window.Telegram?.WebApp;

  // 每次掛載時，根據當前 Telegram 狀態同步模組級 ref（跨元件共享單例）
  if (tg) {
    viewportHeight.value = tg.viewportHeight ?? 0;
    viewportStableHeight.value =
      tg.viewportStableHeight ?? viewportHeight.value;
    colorScheme.value = tg.colorScheme ?? "light";
    safeAreaInset.value = {
      top: tg.safeAreaInset?.top ?? 0,
      bottom: tg.safeAreaInset?.bottom ?? 0,
      left: tg.safeAreaInset?.left ?? 0,
      right: tg.safeAreaInset?.right ?? 0,
    };
  } else {
    viewportHeight.value = 0;
    viewportStableHeight.value = 0;
    colorScheme.value = "light";
    safeAreaInset.value = { top: 0, bottom: 0, left: 0, right: 0 };
  }

  const handleViewportChanged = (e) => {
    viewportHeight.value = e?.viewportHeight ?? tg?.viewportHeight ?? 0;
    viewportStableHeight.value =
      e?.viewportStableHeight ??
      tg?.viewportStableHeight ??
      viewportHeight.value;
  };

  const handleSafeAreaChanged = () => {
    safeAreaInset.value = {
      top: tg?.safeAreaInset?.top ?? 0,
      bottom: tg?.safeAreaInset?.bottom ?? 0,
      left: tg?.safeAreaInset?.left ?? 0,
      right: tg?.safeAreaInset?.right ?? 0,
    };
  };

  const handleThemeChanged = () => {
    colorScheme.value = tg?.colorScheme ?? "light";
    const rawBg = tg?.themeParams?.bg_color;
    const bg = rawBg
      ? rawBg.startsWith("#")
        ? rawBg
        : `#${rawBg}`
      : colorScheme.value === "dark"
        ? "#1a1a1a"
        : "#ffffff";
    setHeaderColor(bg);
    setBackgroundColor(bg);
  };

  onMounted(() => {
    tg?.onEvent?.("viewportChanged", handleViewportChanged);
    tg?.onEvent?.("themeChanged", handleThemeChanged);
    tg?.onEvent?.("safeAreaChanged", handleSafeAreaChanged);
    handleSafeAreaChanged();
    handleThemeChanged(); // 初始主動套用主題色
  });

  onUnmounted(() => {
    tg?.offEvent?.("viewportChanged", handleViewportChanged);
    tg?.offEvent?.("themeChanged", handleThemeChanged);
    tg?.offEvent?.("safeAreaChanged", handleSafeAreaChanged);
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
    viewportStableHeight,
    safeAreaInset,
    colorScheme,
    isDark,
  };
}
