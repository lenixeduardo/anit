import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ["scripts/**/*.cjs", "scripts/**/*.js"], rules: { "@typescript-eslint/no-require-imports": "off", "@next/next/no-assign-module-variable": "off" } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/auth-client.js", // generated/minified vendor auth bundle
  ]),
]);

export default eslintConfig;
