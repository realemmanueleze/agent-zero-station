import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@station/observability": fileURLToPath(
        new URL("./packages/observability/src/index.ts", import.meta.url),
      ),
      "@station/api": fileURLToPath(
        new URL("./packages/station/src/index.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["evals/suites/**/*.eval.ts"],
  },
});
