import type { Page } from "@playwright/test"

import { expect, gotoReady, test } from "./fixtures"

// The mock API runs in the page's memory, not in a service worker (D-025).
// A hard reload or an idle browser used to cut the page off from it and send
// requests to Next.js, which answered with its 404 page (D-024).

test.skip(({ isMobile }) => isMobile, "same mock API for both projects")

/** Every request to /api that reached the network, and every 404. */
function watchNetwork(page: Page) {
  const apiRequests: string[] = []
  const notFound: string[] = []
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) apiRequests.push(r.url())
  })
  page.on("response", (r) => {
    if (r.status() === 404) notFound.push(r.url())
  })
  return { apiRequests, notFound }
}

/** Shift+Reload: the browser loads the page without any service worker. */
async function hardReload(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await Promise.all([
    page.waitForEvent("load"),
    cdp.send("Page.reload", { ignoreCache: true }),
  ])
}

function queue(page: Page) {
  return page.getByRole("table", { name: "Requests waiting for review" })
}

test("the API answers from memory: no network, no service worker, through a hard reload", async ({
  page,
}) => {
  const { apiRequests, notFound } = watchNetwork(page)

  await gotoReady(page, "/approvals")
  await expect(queue(page)).toBeVisible()
  await hardReload(page)
  await expect(queue(page)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)

  // Approve: sent when the undo toast closes on its own
  const row = queue(page).getByRole("row", {
    name: /Research Bot.*Weather API.*120\.00 USDC/,
  })
  await row.click()
  const panel = page.getByRole("complementary", {
    name: "Research Bot → Weather API",
  })
  await panel.getByRole("button", { name: /^Approve/ }).click()
  await page.mouse.move(0, 0) // a hovered toast never closes
  await expect(row).toHaveCount(0)

  // Another screen, reached in-app so the approval stays in memory
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Decisions" })
    .first()
    .click()
  await expect(page.getByRole("heading", { name: "Decisions" })).toBeVisible()
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 15_000,
  })
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "Approved after review · Demo reviewer" }),
  ).not.toHaveCount(0)

  expect(apiRequests).toEqual([])
  expect(notFound).toEqual([])
  expect(
    await page.evaluate(
      async () => (await navigator.serviceWorker.getRegistrations()).length,
    ),
  ).toBe(0)
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toHaveCount(0)
})
