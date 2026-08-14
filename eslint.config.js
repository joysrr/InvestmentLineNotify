import js from "@eslint/js";
import globals from "globals";
import pluginVue from "eslint-plugin-vue";

export default [
  js.configs.recommended,
  ...pluginVue.configs["flat/essential"],
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
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^(err|e|error|ex)$",
          ignoreRestSiblings: true
        },
      ],
      "no-console": "off",
      "vue/multi-word-component-names": "off",
    },
  },
  {
    // Webapp SFCs - relax unused vars checking for UI imports/components
    files: ["webapp/src/**/*.vue", "webapp/src/**/*.js"],
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^(props|emit|_)",
          caughtErrorsIgnorePattern: "^(err|e|error|ex)$",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    // Fastify route handlers — convention is (request, reply) but reply may be unused
    files: ["src/api/**/*.mjs", "src/api/**/*.js"],
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^(request|reply|_)$" },
      ],
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
    rules: {
      // Test files: allow unused vars in mock factories and test utilities
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true }],
    },
  },
  {
    ignores: ["node_modules/", "dist/", "webapp/dist/", ".agents/", "scratch/"],
  },
];
