import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Vercel CLI build output — gitignored, minified, not ours to lint.
    ".vercel/**",
    ".claude/**",
    "out/**",
    "build/**",
    "context/Click Design System/**",
    "design-samples/**",
    "public/concepts/**",
    "scripts/_seed_*.mjs",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
