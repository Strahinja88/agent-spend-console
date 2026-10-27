import {
  decisionId,
  expect,
  expectNoSeriousA11yViolations,
  gotoReady,
  paymentIdForSlot,
  simulatedPaymentId,
  test,
} from "./fixtures"

// axe on every page and its main states, in light and dark, at desktop width
// and 375px (the two Playwright projects). Fails on serious/critical issues.

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      // next-themes follows the system preference by default
      await page.emulateMedia({ colorScheme: theme })
    })

    test("approval queue: panel, shortcuts help, confirm dialog", async ({
      page,
      isMobile,
    }) => {
      await gotoReady(page, "/approvals")
      await expectNoSeriousA11yViolations(page, "queue")

      await page
        .getByRole("row", { name: /Ops Agent.*Cloud GPU.*1,250\.00 USDC/ })
        .click()
      const name = "Ops Agent → Cloud GPU"
      const panel = isMobile
        ? page.getByRole("dialog", { name })
        : page.getByRole("complementary", { name })
      await expect(panel).toBeVisible()
      await expectNoSeriousA11yViolations(page, "queue with panel")

      await panel.getByRole("button", { name: /^Approve/ }).click()
      await expect(page.getByRole("alertdialog")).toBeVisible()
      await expectNoSeriousA11yViolations(page, "approve dialog")
      await page.keyboard.press("Escape")

      if (isMobile) await page.keyboard.press("Escape")
      await expect(page.getByRole("alertdialog")).toHaveCount(0)
      await page.getByRole("button", { name: "Shortcuts" }).click()
      await expect(
        page.getByRole("dialog", { name: "Keyboard shortcuts" }),
      ).toBeVisible()
      await expectNoSeriousA11yViolations(page, "keyboard help")
    })

    test("decisions list, and with no results", async ({ page }) => {
      await gotoReady(page, "/decisions")
      await expectNoSeriousA11yViolations(page, "decisions")

      // Data Pipeline has no review threshold, so nothing is sent to review
      await gotoReady(page, "/decisions?outcome=review&agent=agt_data")
      await expect(page.getByText("No results for these filters")).toBeVisible()
      await expectNoSeriousA11yViolations(page, "decisions, no results")
    })

    test("decision detail: verified, then tampered", async ({ page }) => {
      const id = decisionId(
        (e) => e.decision.reasonCode === "LIMIT_DAILY_EXCEEDED",
      )
      await gotoReady(page, `/decisions/${id}`)
      await page.getByRole("button", { name: "Verify signature" }).click()
      await expect(page.getByText(/Signature valid/)).toBeVisible()
      await expectNoSeriousA11yViolations(page, "decision, verified")

      await page.getByRole("switch", { name: "Tamper with payload" }).click()
      await page.getByRole("button", { name: "Verify signature" }).click()
      await expect(page.getByText(/Signature invalid/)).toBeVisible()
      await expectNoSeriousA11yViolations(page, "decision, tampered")

      await gotoReady(page, "/decisions/dec_missing")
      await expect(page.getByText("Decision not found")).toBeVisible()
      await expectNoSeriousA11yViolations(page, "decision not found")
    })

    test("payment timelines: simulated, Base, Solana, not found", async ({
      page,
    }) => {
      // Six pages in one test; under a full parallel run it can pass 30 s
      test.slow()
      await gotoReady(page, `/payments/${simulatedPaymentId()}`)
      await expect(page.getByRole("region", { name: "Timeline" })).toBeVisible()
      await expectNoSeriousA11yViolations(page, "simulated payment")

      for (const slot of ["base-1", "solana-1"] as const) {
        await gotoReady(page, `/payments/${paymentIdForSlot(slot)}`)
        await expect(
          page.getByText("Matches the approved amount"),
        ).toBeVisible()
        await expectNoSeriousA11yViolations(page, `payment ${slot}`)
      }

      await gotoReady(page, `/payments/${paymentIdForSlot("base-missing")}`)
      await expect(
        page.getByText(/Transaction not found/).first(),
      ).toBeVisible()
      await expectNoSeriousA11yViolations(page, "payment, tx not found")

      await gotoReady(page, "/payments/pay_missing")
      await expect(page.getByText("Payment not found")).toBeVisible()
      await expectNoSeriousA11yViolations(page, "payment not found")
    })

    test("404 page", async ({ page }) => {
      await page.goto("/no-such-page")
      await expect(
        page.getByRole("heading", { name: "Page not found" }),
      ).toBeVisible()
      await expectNoSeriousA11yViolations(page, "404")
    })
  })
}
