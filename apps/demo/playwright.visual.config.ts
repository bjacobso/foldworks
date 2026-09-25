import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./visual",
  outputDir: "../../test-results/visual",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "../../playwright-report/visual" }]],
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.001,
      scale: "css",
    },
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:4175",
    colorScheme: "light",
    locale: "en-US",
    reducedMotion: "reduce",
    timezoneId: "UTC",
    viewport: { width: 1440, height: 1000 },
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  webServer: {
    command: "pnpm build && pnpm exec vite preview --host 127.0.0.1 --port 4175 --strictPort",
    url: "http://127.0.0.1:4175",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
