import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router/index.js";
import { waitReady } from "./composables/useTelegram.js";
import "./styles/tokens.css";
import "./shared-styles.css";
// EP 元件繼承 M3 token（必須在 shared-styles 之後，覆蓋 EP 預設樣式）
import "./styles/element-plus-overrides.css";
import { installDevMock } from "./dev-mock/index.js";

// Mock API 僅在 DEV/test 且明確啟用時攔截 /api/；production 保持原有認證與 API。
installDevMock();

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// ── Boot observability bridge（觀測用，零副作用）──
// 供 scripts/agent/debug-bridge.mjs 探針讀取，定位 boot 卡在哪一階段。
if (typeof window !== "undefined") {
  window.__TELEGRAM_BRIDGE__ = {
    tModuleStart: typeof performance !== "undefined" ? performance.now() : 0,
    tModuleStartEpoch: Date.now(),
    sdkPresent: !!window.Telegram?.WebApp,
    sdkVersion: window.Telegram?.WebApp?.version ?? null,
    platform: window.Telegram?.WebApp?.platform ?? null,
    initDataLen: window.Telegram?.WebApp?.initData?.length ?? 0,
    bootBranch: null,
    tMountStart: null,
    tMountEnd: null,
    tReadyStart: null,
    tReadyResolved: null,
    lastFetchAt: null,
    lastFetchPath: null,
    lastFetchOk: null,
  };
}

// mount 前預檢 Telegram initData，避免未授權者下載受保護 chunk
const sdkLoaded = !!window.Telegram?.WebApp;
const initData = window.Telegram?.WebApp?.initData;
if (!initData && !import.meta.env.DEV) {
  const branch = sdkLoaded ? "fallback-no-initdata" : "fallback-no-sdk";
  console.warn("[Auth Guard] 阻斷 app mount", {
    sdkLoaded,
    initDataLen: initData?.length ?? 0,
  });
  window.__TELEGRAM_BRIDGE__.bootBranch = branch;
  renderAuthFallback(sdkLoaded);
} else {
  window.__TELEGRAM_BRIDGE__.bootBranch = "mounted";
  window.__TELEGRAM_BRIDGE__.tMountStart =
    typeof performance !== "undefined" ? performance.now() : 0;
  app.mount("#app");
  window.__TELEGRAM_BRIDGE__.tMountEnd =
    typeof performance !== "undefined" ? performance.now() : 0;
  window.__TELEGRAM_BRIDGE__.tReadyStart =
    typeof performance !== "undefined" ? performance.now() : 0;
  waitReady().then(() => {
    window.__TELEGRAM_BRIDGE__.tReadyResolved =
      typeof performance !== "undefined" ? performance.now() : 0;
  });
}

/**
 * 未授權時的極簡提示畫面。
 * 不依賴 Vue 實例，因 App.vue 內的 AuthExpiredModal 在此情境下不會被 mount。
 */
function renderAuthFallback(sdkLoaded = true) {
  const root = document.getElementById("app");
  if (!root) return;
  const title = sdkLoaded ? "需要 Telegram 登入憑證" : "無法載入 Telegram SDK";
  const message = sdkLoaded
    ? "登入憑證為空，請關閉後重新從 Telegram 開啟"
    : "Telegram SDK 載入失敗，請檢查網路後重試";
  root.innerHTML = `
    <div
      role="alert"
      style="
        box-sizing:border-box;
        display:flex;
        align-items:center;
        justify-content:center;
        min-height:100vh;
        min-height:100dvh;
        padding:var(--iln-space-6, 24px);
        font-family:system-ui,-apple-system,sans-serif;
        color:var(--iln-text, #1f2328);
        background:var(--iln-bg, #ffffff);
      "
    >
      <div
        style="
          max-width:360px;
          width:100%;
          padding:var(--iln-space-5, 20px);
          border-radius:var(--iln-radius-lg, 16px);
          background:var(--iln-surface, #f6f8fa);
          border:1px solid var(--iln-border-subtle, rgba(0, 0, 0, 0.08));
          text-align:center;
          box-shadow:var(--iln-shadow-1, 0 1px 3px rgba(0, 0, 0, 0.06));
        "
      >
        <p style="margin:0 0 var(--iln-space-2, 8px);font-size:var(--iln-font-base, 15px);font-weight:700;line-height:1.4;">
          ${title}
        </p>
        <p style="margin:0 0 var(--iln-space-4, 16px);font-size:var(--iln-font-sm, 13px);color:var(--iln-hint, #656d76);line-height:1.55;">
          ${message}
        </p>
        <button
          type="button"
          onclick="window.location.reload()"
          style="
            display:inline-flex;
            align-items:center;
            justify-content:center;
            min-height:36px;
            padding:0 var(--iln-space-4, 16px);
            border:none;
            border-radius:var(--iln-radius-full, 9999px);
            background:var(--iln-brand, #2481cc);
            color:var(--iln-text-on-brand, #ffffff);
            font-size:var(--iln-font-sm, 13px);
            font-weight:600;
            cursor:pointer;
          "
        >
          重新整理
        </button>
      </div>
    </div>
  `;
}
