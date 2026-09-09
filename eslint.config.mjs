import js from "@eslint/js";
import tseslint from "typescript-eslint";
import powerbi from "eslint-plugin-powerbi-visuals";

export default tseslint.config(
    { ignores: ["node_modules/**", ".tmp/**", "dist/**"] },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["src/**/*.ts"],
        plugins: { "powerbi-visuals": powerbi },
        rules: {
            ...powerbi.configs.recommended.rules,
            "@typescript-eslint/no-explicit-any": "error"
        }
    },
    {
        files: ["scripts/**/*.mjs"],
        languageOptions: {
            globals: {
                console: "readonly", process: "readonly", Buffer: "readonly",
                URL: "readonly", fetch: "readonly"
            }
        }
    }
);
