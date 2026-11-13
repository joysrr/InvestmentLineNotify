module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: ["eslint:recommended", "plugin:vue/vue3-recommended"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
  },
  plugins: ["vue"],
  rules: {
    "vue/script-setup-uses-vars": "error",
  },
  overrides: [
    {
      files: ["**/*.test.js", "**/*.test.mjs", "**/*.spec.js"],
      rules: {
        "no-unused-vars": "off",
      },
    },
  ],
};
