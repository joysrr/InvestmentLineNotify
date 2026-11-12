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

app.mount("#app");

// Telegram SDK 初始化完成後呼叫 ready()（首屏渲染後觸發）
waitReady();
