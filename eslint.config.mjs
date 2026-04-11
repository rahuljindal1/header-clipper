import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettierConfig,
    {
        ignores: ["dist/", "node_modules/", "mock.js", "webpack.config.js"],
    },
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": "warn",
            "@typescript-eslint/explicit-member-accessibility": [
                "error",
                { accessibility: "explicit", overrides: { constructors: "no-public" } },
            ],
        },
    },
);
