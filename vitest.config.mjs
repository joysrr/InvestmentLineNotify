import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/test/**/*.test.mjs",
      "src/test/**/*.test.js",
      "src/modules/**/*.test.mjs",
      "src/modules/**/*.test.js",
      "src/api/**/*.test.mjs",
      "src/api/**/*.test.js",
    ],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/webapp/**",
      "**/src/test/e2e/**",
    ],
    setupFiles: ["./src/test/setup.mjs"],
    testTimeout: 60000,
    hookTimeout: 20000,
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },
    css: false,
  },
  // Force esbuild to avoid oxc issues
  esbuild: {
    target: "node20",
    supported: {
      "top-level-await": true,
    },
  },
  // Disable oxc
  transformMode: {
    web: [/\.[jt]sx?$/],
  },
});
