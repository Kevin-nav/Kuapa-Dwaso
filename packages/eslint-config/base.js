const js = require("@eslint/js");
const tsParser = require("@typescript-eslint/parser");
const tsPlugin = require("@typescript-eslint/eslint-plugin");
const importPlugin = require("eslint-plugin-import");
const globals = require("globals");

const restrictedPatterns = [
  {
    group: ["apps/*"],
    message: "Apps should depend on shared packages, not on other apps."
  }
];

module.exports = [
  {
    ignores: ["dist/**", "build/**", ".next/**", ".turbo/**", "coverage/**", "node_modules/**"]
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.node
      },
      sourceType: "module"
    },
    rules: {
      "no-restricted-imports": ["error", { patterns: restrictedPatterns }]
    }
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.node
      },
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd()
      },
      sourceType: "module"
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      import: importPlugin
    },
    settings: {
      "import/resolver": {
        typescript: true,
        node: true
      }
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      "@typescript-eslint/consistent-type-imports": ["error", { prefer: "type-imports" }],
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ],
      "import/no-cycle": "error",
      "no-restricted-imports": ["error", { patterns: restrictedPatterns }]
    }
  }
];
