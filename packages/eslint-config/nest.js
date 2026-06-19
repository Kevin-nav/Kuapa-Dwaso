const base = require("./base.js");

module.exports = [
  ...base,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        {
          allowExpressions: true
        }
      ]
    }
  }
];
