import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /*
       * Wallet brand marks are remote SVGs on third-party hosts. Routing them
       * through next/image would proxy those requests through our deploy and can
       * break the logos, which is not a trade this project needs to make.
       */
      "@next/next/no-img-element": "off",
      /*
       * Fonts are loaded once in the App Router root layout (src/app/layout.tsx),
       * which applies to every route. The rule assumes the legacy pages/ router.
       */
      "@next/next/no-page-custom-font": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
