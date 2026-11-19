import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router/index.js";
import { waitReady } from "./composables/useTelegram.js";
import "./styles/tokens.css";
import "./shared-styles.css";
// Phase 4.4+ · EP 组件继承 M3 token（必须在 shared-styles 之后，覆盖 EP 默认蓝/白/灰）
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
  const message = sdkLoaded
    ? "登入憑證為空，請關閉後重新從 Telegram 開啟"
    : "Telegram SDK 載入失敗，請檢查網路後重試";
  root.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      justify-content:center;
      height:100vh;
      padding:24px;
      text-align:center;
      font-family:system-ui,-apple-system,sans-serif;
      color:var(--tg-theme-hint-color, var(--iln-hint-fallback));
      background:var(--tg-theme-bg-color, var(--iln-bg-light-fallback));
    ">
      <p style="font-size:var(--iln-font-base, 14px);line-height:1.5;">
        ${message}
      </p>
    </div>
  `;
}
