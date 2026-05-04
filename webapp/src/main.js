import { createApp } from "vue";
import App from "./App.vue";
import router from "./router/index.js";

import { waitReady } from "./composables/useTelegram.js";
waitReady().then(() => {
  createApp(App).use(router).mount("#app");
});
