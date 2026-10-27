import type { Page } from "@playwright/test"

import { expect, gotoReady, test } from "./fixtures"

// The mock API lives in a service worker, which a hard reload skips and the
// browser stops when idle. Either way requests used to reach Next.js and come
// back as its 404 page (D-024). Chromium only: both use the DevTools protocol.

test.beforeEach(({}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Desktop only: the long waits aren't worth repeating per viewport",
  )
})

/** Every 404 the page sees, and every /api answer that isn't JSON. */
function watchResponses(page: Page) {
  const notFound: string[] = []
  const notJson: string[] = []
  page.on("response", (r) => {
    if (r.status() === 404) notFound.push(r.url())
    const type = r.headers()["content-type"] ?? ""
    if (new URL(r.url()).pathname.startsWith("/api/") && !type.includes("json"))
      notJson.push(r.url())
  })
  return { notFound, notJson }
}

/** Shift+Reload: the browser loads the page without its service worker. */
async function hardReload(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  await Promise.all([
    page.waitForEvent("load"),
    cdp.send("Page.reload", { ignoreCache: true }),
  ])
  await expect
    .poll(() => page.evaluate(() => !!navigator.serviceWorker.controller), {
      timeout: 15_000,
    })
    .toBe(true)
}

/** Stops the service worker the way an idle browser does, losing its memory. */
async function stopServiceWorkers(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  // Stopping is asynchronous: wait until the worker reports it has stopped
  const stopped = new Promise<void>((resolve) =>
    cdp.on("ServiceWorker.workerVersionUpdated", ({ versions }) => {
      if (versions.some((v) => v.runningStatus === "stopped")) resolve()
    }),
  )
  await cdp.send("ServiceWorker.enable")
  await cdp.send("ServiceWorker.stopAllWorkers")
  await stopped
}

function queue(page: Page) {
  return page.getByRole("table", { name: "Requests waiting for review" })
}

async function expectQueueLoaded(page: Page) {
  await expect(queue(page)).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toHaveCount(0)
}

async function goToDecisions(page: Page) {
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Decisions" })
    .first()
    .click()
  await expect(page.getByRole("heading", { name: "Decisions" })).toBeVisible()
  // The skeleton is a table too: wait for the rows
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 15_000,
  })
}

test("hard reload, a minute idle, then approve, reject and navigate with no 404s", async ({
  page,
}) => {
  test.setTimeout(180_000)
  const { notFound, notJson } = watchResponses(page)

  await gotoReady(page, "/approvals")
  await hardReload(page)
  await expectQueueLoaded(page)

  await page.waitForTimeout(60_000)

  // Approve: sent when the undo toast closes on its own
  const approveRow = queue(page).getByRole("row", {
    name: /Research Bot.*Weather API.*120\.00 USDC/,
  })
  await approveRow.click()
  const panel = page.getByRole("complementary", {
    name: "Research Bot → Weather API",
  })
  const approved = page.waitForResponse(
    (r) => r.url().includes("/approve") && r.request().method() === "POST",
    { timeout: 15_000 },
  )
  await panel.getByRole("button", { name: /^Approve/ }).click()
  await page.mouse.move(0, 0) // a hovered toast never closes
  expect((await approved).ok()).toBe(true)
  await expect(approveRow).toHaveCount(0)

  // Reject the next request with a reason
  const rejectRow = queue(page).getByRole("row").nth(1)
  await rejectRow.click()
  const rejectPanel = page.getByRole("complementary", { name: / → / })
  await rejectPanel.getByRole("button", { name: "Reject" }).click()
  await rejectPanel
    .getByRole("textbox", { name: "Reason for rejecting" })
    .fill("Not in this month's budget")
  const rejected = page.waitForResponse(
    (r) => r.url().includes("/reject") && r.request().method() === "POST",
    { timeout: 15_000 },
  )
  await rejectPanel.getByRole("button", { name: "Confirm reject" }).click()
  expect((await rejected).ok()).toBe(true)
  await expect(page.getByText(/^Rejected · /)).toBeVisible()

  // Navigate through the app: list, a decision, its payment
  await goToDecisions(page)
  await page
    .getByRole("row")
    .filter({ hasText: "Approved after review · Demo reviewer" })
    .getByRole("link")
    .first()
    .click()
  await expect(
    page.getByRole("button", { name: "Verify signature" }),
  ).toBeVisible()
  await page.getByRole("link", { name: /View payment/ }).click()
  await expect(page.getByRole("region", { name: "Timeline" })).toBeVisible()

  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toHaveCount(0)
  expect(notFound).toEqual([])
  expect(notJson).toEqual([])
})

test("recovers when the browser stops the idle worker", async ({ page }) => {
  const { notJson } = watchResponses(page)

  await gotoReady(page, "/approvals")
  await expectQueueLoaded(page)

  await stopServiceWorkers(page)
  const decisions = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/decisions" &&
      !!r.headers()["content-type"]?.includes("json"),
  )
  await goToDecisions(page)

  // The first request after the stop reached Next.js; the retry got through
  expect((await decisions).ok()).toBe(true)
  expect(notJson).toContain(`${new URL(page.url()).origin}/api/decisions`)
  await expect(page.getByText(/^Couldn't load/)).toHaveCount(0)
  await expect(page.getByRole("row")).not.toHaveCount(0)
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toHaveCount(0)

  // And it stays connected for the next screen
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Approvals" })
    .first()
    .click()
  await expectQueueLoaded(page)
})
