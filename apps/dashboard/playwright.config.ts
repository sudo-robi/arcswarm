import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  use: {
    baseURL: process.env.VITE_API_URL || "http://localhost:3001",
    headless: true,
    viewport: { width: 1280, height: 720 },
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: "pnpm dev",
    port: 3001,
    reuseExistingServer: !process.env.CI,
  },
});
