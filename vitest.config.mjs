import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/test/**/*.test.mjs", "src/test/**/*.test.js"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/webapp/**", "**/src/test/e2e/**"],
    coverage: {
      provider: "v8",
      thresholds: {
        lines: 75,
        functions: 60,
        branches: 60,
        statements: 75,
      },
    },
    css: false,
  },
  // Ensure proper handling of .mjs files
  esbuild: {
    target: "node20",
    supported: {
      "top-level-await": true,
    },
  },
});