module.exports = {
  extends: ["./base.js"],
  rules: {
    "@typescript-eslint/explicit-function-return-type": [
      "warn",
      {
        "allowExpressions": true
      }
    ]
  }
};

