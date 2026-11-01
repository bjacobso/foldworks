import { defineConfig, devices } from "@playwright/test";

const port = 5181;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "*.pw.ts",
  outputDir: "../../test-results/forma",
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "../../playwright-report/forma" }]],
  timeout: 30_000,
  workers: 2,
  expect: { timeout: 8_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}/forma/`,
    trace: "retain-on-failure",
  },
  webServer: {
    // Exercise the production bundle assembled into the deployed Foldworks site.
    command: `pnpm --filter @foldworks/demo build && pnpm --filter @foldworks/demo exec vite preview --host 127.0.0.1 --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}/forma/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 950 } },
    },
  ],
});
