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
} else {
  app.mount("#app");
}

// Telegram SDK 初始化完成後呼叫 ready()（首屏渲染後觸發）
waitReady();
