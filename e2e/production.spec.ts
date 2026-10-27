import { expect, test } from "./fixtures"

// e2e runs against `next build && next start`, so this checks what Vercel
// will serve: the MSW worker script, from the site root (D-011).

test.skip(({ isMobile }) => isMobile, "same server for both projects")

test("serves the MSW service worker from the site root", async ({
  request,
}) => {
  const response = await request.get("/mockServiceWorker.js")
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("javascript")
  expect(await response.text()).toContain("PACKAGE_VERSION")
})

test("the mock API answers through the service worker", async ({ page }) => {
  const approvals = page.waitForResponse((r) =>
    r.url().endsWith("/api/approvals"),
  )
  await page.goto("/approvals")
  const response = await approvals
  expect(response.ok()).toBe(true)
  expect(response.fromServiceWorker()).toBe(true)
})
