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
      "@station/runtime": fileURLToPath(
        new URL("./packages/runtime/src/index.ts", import.meta.url),
      ),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: [
      "packages/**/*.test.ts",
      "apps/cockpit/**/*.test.ts",
      "tests/inventory.test.ts",
      "tests/tickets/**/*.test.ts",
    ],
    exclude: ["evals/**", "**/node_modules/**"],
  },
});
