import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    hookTimeout: 30_000,
    include: ["e2e/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
