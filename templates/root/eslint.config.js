const {
  defineConfig,
  globalIgnores,
} = require("eslint/config");

const nx = require("@nx/eslint-plugin");
const js = require("@eslint/js");

const {
  FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

module.exports = defineConfig([{
  plugins: {
    "@nx": nx,
  },
}, globalIgnores([
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/.nx/**",
  "**/cdk.out/**",
  "**/tmp/**"
]), {
  files: ["**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx"],

  rules: {
    "@nx/enforce-module-boundaries": ["error", {
      enforceBuildableLibDependency: true,
      allow: [],

      depConstraints: [{
        sourceTag: "*",
        onlyDependOnLibsWithTags: ["*"],
      }],
    }],
  },
}, {
  files: ["**/*.ts", "**/*.tsx"],
  extends: compat.extends("plugin:@nx/typescript"),

  rules: {
    "@typescript-eslint/no-explicit-any": "warn",

    "@typescript-eslint/no-unused-vars": ["warn", {
      argsIgnorePattern: "^_",
      varsIgnorePattern: "^_",
    }],
  },
}, {
  files: ["**/*.js", "**/*.jsx"],
  extends: compat.extends("plugin:@nx/javascript"),
  rules: {},
}]);
