import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";

export default [
  js.configs.recommended,
  ...pluginVue.configs["flat/recommended"],
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
        ...globals.es2021,
        // Vue 3 <script setup> compiler macros
        defineProps: "readonly",
        defineEmits: "readonly",
        defineExpose: "readonly",
        withDefaults: "readonly",
      },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      // Vue SFC formatting rules — downgrade to warn (project-wide style, not errors)
      "vue/max-attributes-per-line": "warn",
      "vue/singleline-html-element-content-newline": "warn",
      "vue/html-closing-bracket-newline": "warn",
      "vue/html-self-closing": "warn",
      "vue/html-indent": "warn",
    },
  },
  {
    files: ["**/*.test.mjs", "**/*.test.ts", "**/test/**/*.mjs", "**/test/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    ignores: ["node_modules/", "dist/", "webapp/dist/", ".agents/", "scratch/"],
  },
];
