import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@stylexjs/stylex": resolve(
        import.meta.dirname,
        "../../apps/demo/src/test/stylex-stub.ts",
      ),
    },
  },
});
