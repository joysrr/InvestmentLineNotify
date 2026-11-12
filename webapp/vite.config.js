import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import AutoImport from "unplugin-auto-import/vite";
import { ElementPlusResolver } from "unplugin-vue-components/resolvers";
import path from "path";

export default defineConfig(async ({ mode }) => {
  const isTest = process.env.VITEST || mode === "test";
  const elementPlusResolver = ElementPlusResolver({
    importStyle: isTest ? false : "css",
  });
  const { visualizer } = await import("rollup-plugin-visualizer");

  return {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [elementPlusResolver],
        dts: false,
      }),
      Components({
        resolvers: [elementPlusResolver],
        dts: false,
      }),
      {
        name: "html-transform",
        transformIndexHtml(html) {
          const isProd = mode === "production";
          const telegramScript = isProd
            ? '<script src="https://telegram.org/js/telegram-web-app.js"></script>'
            : `
      <script>
        // Dev mock - simulates Telegram WebApp environment
        window.Telegram = {
          WebApp: {
            initData: "query_id=dev&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22Test%22%2C%22last_name%22%3A%22User%22%2C%22username%22%3A%22testuser%22%2C%22language_code%22%3A%22zh-hant%22%7D&auth_date=" + Math.floor(Date.now()/1000) + "&hash=dev_mock_hash",
            initDataUnsafe: {
              query_id: "dev",
              user: { id: 123456789, first_name: "Test", last_name: "User", username: "testuser", language_code: "zh-hant" },
              auth_date: Math.floor(Date.now()/1000),
              hash: "dev_mock_hash"
            },
            ready: () => {},
            readyCallback: () => {},
            expand: () => {},
            openLink: (url) => window.open(url, "_blank"),
            close: () => {},
            MainButton: { setParams: () => {}, show: () => {}, hide: () => {}, enable: () => {}, disable: () => {} },
            BackButton: { show: () => {}, hide: () => {}, onClick: () => {}, offClick: () => {} },
            HapticFeedback: { impactOccurred: () => {}, notificationOccurred: () => {}, selectionChanged: () => {} },
            themeParams: {
              bg_color: "#ffffff",
              text_color: "#222222",
              hint_color: "#999999",
              link_color: "#2481cc",
              button_color: "#2481cc",
              button_text_color: "#ffffff",
              secondary_bg_color: "#f0f0f0"
            },
            version: "7.0",
            platform: "ios",
            colorScheme: "light",
            isExpanded: true,
            viewportHeight: window.innerHeight,
            viewportStableHeight: window.innerHeight,
            headerColor: "#ffffff",
            backgroundColor: "#ffffff",
            isClosingConfirmationEnabled: false,
            setHeaderColor: () => {},
            setBackgroundColor: () => {},
            enableClosingConfirmation: () => {},
            disableClosingConfirmation: () => {},
          }
        };
      </script>
    `;

          const debugScript = `
      <script src="https://cdn.jsdelivr.net/npm/eruda"></script>
      <script>eruda.init();</script>
    `;

          return html
            .replace("<!-- TELEGRAM_SDK_PLACEHOLDER -->", telegramScript)
            .replace("<!-- DEBUG_TOOL_PLACEHOLDER -->", debugScript);
        },
      },
      visualizer({
        filename: "dist/stats.html",
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
      ...(process.env.VITEST || mode === "test"
        ? [
            {
              name: "stub-element-plus-css",
              load(id) {
                if (id.includes("element-plus") && id.endsWith(".css")) {
                  return { code: "", map: { mappings: "" } };
                }
              },
            },
          ]
        : []),
    ],
    define: {
      "process.env": {},
      "process.env.NODE_ENV": JSON.stringify(mode),
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            "vendor-vue": ["vue", "vue-router"],
            "vendor-echarts": ["echarts", "vue-echarts"],
          },
        },
      },
    },
    chunkSizeWarningLimit: 500,
    resolve: {
      alias: [
        {
          find: /element-plus\/theme-chalk\/.*\.css$/,
          replacement: path.resolve(__dirname, "src/test/empty.css"),
        },
        {
          find: "@",
          replacement: path.resolve(__dirname, "./src"),
        },
      ],
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.js"],
      deps: {
        inline: [/element-plus/],
      },
      exclude: ["**/node_modules/**", "**/dist/**", "**/src/test/e2e/**"],
      coverage: {
        provider: "v8",
        thresholds: {
          lines: 75,
          functions: 60,
          branches: 60,
          statements: 75,
        },
      },
    },
  };
});
