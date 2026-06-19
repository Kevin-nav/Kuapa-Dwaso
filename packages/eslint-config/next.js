const nextPlugin = require("@next/eslint-plugin-next");
const react = require("./react.js");

module.exports = [
  ...react,
  nextPlugin.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@next/next/no-html-link-for-pages": "off"
    }
  }
];
