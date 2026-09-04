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
      "@station/packs": fileURLToPath(
        new URL("./packages/packs/src/index.ts", import.meta.url),
      ),
      "@station/loop": fileURLToPath(
        new URL("./packages/loop/src/index.ts", import.meta.url),
      ),
      "@station/channels": fileURLToPath(
        new URL("./packages/channels/src/index.ts", import.meta.url),
      ),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: ["evals/suites/**/*.eval.ts"],
  },
});
