import type { Page } from "@playwright/test"

import {
  decisionId,
  expect,
  gotoReady,
  paymentIdForSlot,
  test,
} from "./fixtures"

// 375px checks (PLAN.md §5: queue and decision detail usable on mobile).

test.skip(({ isMobile }) => !isMobile, "mobile only")

async function expectNoHorizontalScroll(page: Page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)
}

test("no page scrolls sideways at 375px", async ({ page }) => {
  const pages = [
    "/approvals",
    "/decisions",
    `/decisions/${decisionId((e) => e.decision.reasonCode === "LIMIT_DAILY_EXCEEDED")}`,
    `/payments/${paymentIdForSlot("base-1")}`,
    `/payments/${paymentIdForSlot("solana-1")}`,
  ]
  for (const path of pages) {
    await gotoReady(page, path)
    await expect(page.locator("main")).not.toBeEmpty()
    await expectNoHorizontalScroll(page)
  }
})

test("navigation opens as a sheet", async ({ page }) => {
  await gotoReady(page, "/approvals")
  await page.getByRole("button", { name: "Open navigation" }).click()
  const sheet = page.getByRole("dialog", { name: "Agent Spend Console" })
  await expect(sheet.getByRole("link", { name: "Decisions" })).toBeVisible()
  await sheet.getByRole("link", { name: "Decisions" }).click()
  await expect(page.getByRole("heading", { name: "Decisions" })).toBeVisible()
  await expect(sheet).toHaveCount(0)
})

test("a queue row opens a full-screen sheet with the actions in view", async ({
  page,
}) => {
  await gotoReady(page, "/approvals")
  await page
    .getByRole("row", { name: /Research Bot.*Weather API.*120\.00 USDC/ })
    .click()
  const sheet = page.getByRole("dialog", { name: "Research Bot → Weather API" })
  await expect(sheet).toBeVisible()
  const box = await sheet.boundingBox()
  expect(box?.width).toBe(375)
  await expect(sheet.getByRole("button", { name: /^Approve/ })).toBeInViewport()
  await expect(sheet.getByRole("button", { name: /^Reject/ })).toBeInViewport()
})

test("decision detail code blocks scroll inside their box", async ({
  page,
}) => {
  const id = decisionId((e) => e.decision.reasonCode === "LIMIT_DAILY_EXCEEDED")
  await gotoReady(page, `/decisions/${id}`)
  await expect(
    page.getByRole("button", { name: "Verify signature" }),
  ).toBeVisible()
  await expectNoHorizontalScroll(page)
  const pre = page.locator("pre").first()
  const overflowX = await pre.evaluate((el) => getComputedStyle(el).overflowX)
  expect(["auto", "scroll"]).toContain(overflowX)
})
