module.exports = [
  {
    ignores: ["node_modules", "dist", "build"],

    languageOptions: {
      parser: require("@typescript-eslint/parser"),
      ecmaVersion: "latest",
      sourceType: "module",
    },

    plugins: {
      "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
      prettier: require("eslint-plugin-prettier"),
    },

    rules: {
      // Enforce prettier formatting
      "prettier/prettier": "error",
    },
  },
];
