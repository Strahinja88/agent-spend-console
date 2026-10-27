import { expect, gotoReady, test } from "./fixtures"

// The whole review path in one go: queue → approve → undo → approve →
// decision → verify signature → payment timeline. Mock state lives in the
// page (D-011), so after approving the test only uses in-app links.

test("approve, undo, approve again, then verify the decision and open its payment", async ({
  page,
}, testInfo) => {
  const mobile = testInfo.project.name === "mobile"
  await gotoReady(page, "/approvals")

  const queue = page.getByRole("table", { name: "Requests waiting for review" })
  const row = queue.getByRole("row", {
    name: /Research Bot.*Weather API.*120\.00 USDC/,
  })
  await row.click()

  // On mobile the panel is a modal sheet; on desktop a complementary region
  const panel = mobile
    ? page.getByRole("dialog", { name: "Research Bot → Weather API" })
    : page.getByRole("complementary", { name: "Research Bot → Weather API" })
  await expect(panel).toBeVisible()

  // Approve, then Undo: the row comes back
  await panel.getByRole("button", { name: /^Approve/ }).click()
  const toast = page.getByText("Approved · 120.00 USDC to Weather API")
  await expect(toast).toBeVisible()
  await expect(row).toHaveCount(0)
  await page.getByRole("button", { name: "Undo" }).click()
  if (mobile) {
    // The undone request is reselected, so its sheet opens again
    await expect(panel).toBeVisible()
  } else {
    await expect(row).toBeVisible()
    await expect(row).toHaveAttribute("aria-selected", "true")
  }

  // Approve again and let the toast close: that sends it
  const approved = page.waitForResponse(
    (r) => r.url().includes("/approve") && r.request().method() === "POST",
    { timeout: 15_000 },
  )
  await panel.getByRole("button", { name: /^Approve/ }).click()
  // The toast appears under the pointer where Approve was, and hovering
  // pauses it (sonner). Move away so it can close on its own.
  await page.mouse.move(0, 0)
  expect((await approved).ok()).toBe(true)
  await expect(toast).toHaveCount(0)
  await expect(row).toHaveCount(0)

  // Decisions, through the app's own navigation
  if (mobile) {
    if (await page.getByRole("dialog").isVisible())
      await page.keyboard.press("Escape")
    await page.getByRole("button", { name: "Open navigation" }).click()
  }
  await page
    .getByRole("navigation", { name: "Main" })
    .getByRole("link", { name: "Decisions" })
    .first()
    .click()
  await expect(page.getByRole("heading", { name: "Decisions" })).toBeVisible()

  const decisionRow = page
    .getByRole("row")
    .filter({ hasText: "Approved after review · Demo reviewer" })
  await expect(decisionRow).toHaveCount(1)
  await decisionRow
    .getByRole("link", { name: /Research Bot ?: 120\.00 USDC to Weather API/ })
    .click()

  // Decision detail: final state and a valid signature
  await expect(
    page.getByText("Approved after review · Demo reviewer").first(),
  ).toBeVisible()
  await page.getByRole("button", { name: "Verify signature" }).click()
  await expect(page.getByText(/Signature valid/)).toBeVisible()

  // Payment timeline: approved here, never sent onchain
  await page.getByRole("link", { name: /View payment/ }).click()
  const timeline = page.getByRole("region", { name: "Timeline" })
  await expect(timeline).toBeVisible()
  await expect(timeline).toContainText("by Demo reviewer")
  await expect(timeline).toContainText(
    "Approved in this demo session. The demo doesn't send new payments onchain.",
  )
})
