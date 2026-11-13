import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router/index.js";
import { waitReady } from "./composables/useTelegram.js";
import "./styles/tokens.css";
import "./shared-styles.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);

// mount 前預檢 Telegram initData，避免未授權者下載受保護 chunk
const initData = window.Telegram?.WebApp?.initData;
if (!initData && !import.meta.env.DEV) {
  console.warn("[Auth Guard] Telegram initData 不存在，阻斷 app mount");
  renderAuthFallback();
} else {
  app.mount("#app");
  waitReady();
}

/**
 * 未授權時的極簡提示畫面。
 * 不依賴 Vue 實例，因 App.vue 內的 AuthExpiredModal 在此情境下不會被 mount。
 */
function renderAuthFallback() {
  const root = document.getElementById("app");
  if (!root) return;
  root.innerHTML = `
    <div style="
      display:flex;
      align-items:center;
      justify-content:center;
      height:100vh;
      padding:24px;
      text-align:center;
      font-family:system-ui,-apple-system,sans-serif;
      color:var(--tg-theme-hint-color, #888);
      background:var(--tg-theme-bg-color, #fff);
    ">
      <p style="font-size:var(--iln-font-base, 14px);line-height:1.5;">
        請從 Telegram 內開啟此頁面
      </p>
    </div>
  `;
}
