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
    include: [
      "packages/**/*.test.ts",
      "tests/inventory.test.ts",
      "tests/tickets/**/*.test.ts",
    ],
    exclude: ["evals/**", "**/node_modules/**"],
  },
});
