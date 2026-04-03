// eslint.config.js
// ESLint flat config (ESLint 9+)
// Key rule: src/renderer/ must NEVER import from src/core/ — use IPC instead (ADR-005)
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Architecture boundary: renderer layer must not directly import core layer.
    // Exceptions (Bun-free, safe to bundle in Vite):
    //   - src/core/i18n/types     — pure enum + types, no Bun APIs
    //   - src/core/i18n/format    — pure string formatting, no Bun APIs
    //   - src/core/i18n/dictionaries — static JSON data, no Bun APIs
    files: ["src/renderer/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "core/(?!i18n/(types|format|dictionaries))",
              message:
                "Renderer must not import from src/core/ — use IPC hooks instead (ADR-005). Exceptions: src/core/i18n/types, src/core/i18n/format, and src/core/i18n/dictionaries (all Bun-free).",
            },
          ],
        },
      ],
    },
  },
  {
    // Ignore generated files and build output
    ignores: [
      "node_modules/**",
      "dist/**",
      ".electrobun/**",
      "src/renderer/components/ui/**", // shadcn/ui managed components
    ],
  },
);
