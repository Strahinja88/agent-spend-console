import type { Page } from "@playwright/test"

import {
  decisionId,
  expect,
  gotoReady,
  paymentIdForSlot,
  test,
} from "./fixtures"

// README screenshots: `pnpm screenshots` writes docs/screenshots/*.png.
// The payment shot reads the real Base Sepolia transaction (live RPC).

const DIR = "docs/screenshots"

test.use({ liveRpc: true })

async function shoot(page: Page, name: string) {
  await page.mouse.move(0, 0)
  await page.screenshot({ path: `${DIR}/${name}.png`, animations: "disabled" })
}

const deniedDecision = () =>
  decisionId((e) => e.decision.reasonCode === "LIMIT_DAILY_EXCEEDED")

async function openQueuePanel(page: Page) {
  await gotoReady(page, "/approvals")
  await page
    .getByRole("row", { name: /Ops Agent.*Cloud GPU.*1,250\.00 USDC/ })
    .click()
}

for (const theme of ["light", "dark"] as const) {
  test(`approval queue (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme })
    await openQueuePanel(page)
    await expect(
      page.getByRole("complementary", { name: "Ops Agent → Cloud GPU" }),
    ).toBeVisible()
    await shoot(page, `approvals-${theme}`)
  })
}

test("decision detail, verified and tampered", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await gotoReady(page, `/decisions/${deniedDecision()}`)
  await page.getByRole("button", { name: "Verify signature" }).click()
  await expect(page.getByText(/Signature valid/)).toBeVisible()
  await shoot(page, "decision-verified")

  await page.getByRole("switch", { name: "Tamper with payload" }).click()
  await page.getByRole("button", { name: "Verify signature" }).click()
  await expect(page.getByText(/Signature invalid/)).toBeVisible()
  await page.getByText(/Signature invalid/).scrollIntoViewIfNeeded()
  await shoot(page, "decision-tampered")
})

test("payment timeline with a real Base Sepolia transfer", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await gotoReady(page, `/payments/${paymentIdForSlot("base-1")}`)
  await expect(page.getByText("Matches the approved amount")).toBeVisible({
    timeout: 30_000,
  })
  await shoot(page, "payment-base")
})

test.describe("mobile", () => {
  test.use({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  })

  test("approval queue sheet at 375px", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" })
    await gotoReady(page, "/approvals")
    await shoot(page, "approvals-mobile")
    await page
      .getByRole("row", { name: /Research Bot.*Weather API.*120\.00 USDC/ })
      .click()
    await expect(
      page.getByRole("dialog", { name: "Research Bot → Weather API" }),
    ).toBeVisible()
    await shoot(page, "approvals-mobile-sheet")
  })
})
