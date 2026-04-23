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

export function useTelegram() {
  const tg = window.Telegram?.WebApp;

  return {
    tg,
    initData: tg?.initData ?? "",
    themeParams: tg?.themeParams ?? {},
    expand: () => tg?.expand(),
    openLink: (url) => {
      if (tg) {
        tg.openLink(url);
      } else {
        window.open(url, "_blank");
      }
    },
    backButton: tg?.BackButton,
  };
}
