import { defineConfig, devices } from "@playwright/test"

// e2e runs against a production build on its own port and build folder, so it
// never touches a running dev server or its .next (D-022).
const PORT = 3100

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /screenshots\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "mobile",
      testIgnore: /screenshots\.spec\.ts/,
      // 375px wide, Chromium with touch (Playwright's iPhone presets are WebKit)
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      // Only on request: `pnpm screenshots`
      name: "screenshots",
      testMatch: /screenshots\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: `pnpm build && pnpm start -p ${PORT}`,
    env: { NEXT_DIST_DIR: ".next-e2e" },
    url: `http://localhost:${PORT}/approvals`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
})
