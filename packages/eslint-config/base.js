const restrictedPatterns = [
  {
    group: ["apps/*"],
    message: "Apps should depend on shared packages, not on other apps."
  },
  {
    group: ["@agriculture/dashboard-ui", "@agriculture/dashboard-ui/*"],
    message: "Dashboard UI must not be imported by public-only surfaces."
  }
];

module.exports = {
  root: true,
  ignorePatterns: ["dist", "build", ".next", ".turbo", "coverage", "node_modules"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript"
  ],
  rules: {
    "@typescript-eslint/consistent-type-imports": ["error", { "prefer": "type-imports" }],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ],
    "import/no-cycle": "error",
    "no-restricted-imports": ["error", { "patterns": restrictedPatterns }]
  }
};

