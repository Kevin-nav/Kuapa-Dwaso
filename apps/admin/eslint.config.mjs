import nextConfig from "@kuapa-dwaso/eslint-config/next";

export default [
  ...nextConfig,
  {
    files: ["app/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
