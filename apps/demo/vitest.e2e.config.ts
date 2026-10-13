import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Vitest 5 counts pending Playwright reads within the polling deadline.
    expect: { poll: { timeout: 5_000 } },
    hookTimeout: 30_000,
    include: ["e2e/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
