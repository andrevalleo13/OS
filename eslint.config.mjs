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
    "out/**",
    "build/**",
    "next-env.d.ts",
    "parse_schedule.js",
    "test-db.js",
    "scratch_test.ts",
    ".agents/**",
  ]),
  {
    rules: {
      // Runtime schemas protect server boundaries; visual adapters consume loose
      // Three.js, Recharts and AppleScript payloads internally.
      "@typescript-eslint/no-explicit-any": "off",
      // These widgets intentionally hydrate local/external state in effects.
      "react-hooks/set-state-in-effect": "off",
      // Album artwork comes from the local Music bridge and changes constantly.
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
