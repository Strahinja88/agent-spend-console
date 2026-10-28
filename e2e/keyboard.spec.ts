import type { Locator, Page } from "@playwright/test"

import { expect, gotoReady, test } from "./fixtures"

// The approve flow with the keyboard only: no clicks anywhere (PLAN.md §8).
// Desktop only; the queue's single-key shortcuts are a desktop feature.

test.skip(({ isMobile }) => isMobile, "keyboard walkthrough is desktop only")

const focused = (page: Page) => page.locator(":focus")

/** A visible focus indicator: an outline or a ring (box-shadow). */
async function expectFocusRing(page: Page) {
  const style = await focused(page).evaluate((el) => {
    const s = getComputedStyle(el)
    return {
      outline: s.outlineStyle,
      width: s.outlineWidth,
      shadow: s.boxShadow,
    }
  })
  const outline = style.outline !== "none" && style.width !== "0px"
  const ring = style.shadow !== "none"
  expect(outline || ring, JSON.stringify(style)).toBe(true)
}

/** Presses Tab until `target` has focus. */
async function tabTo(page: Page, target: Locator, max = 20) {
  for (let i = 0; i < max; i++) {
    if (await target.evaluate((el) => el === document.activeElement)) return
    await page.keyboard.press("Tab")
  }
  await expect(target).toBeFocused()
}

/** Presses j until the selected row matches `name`. */
async function selectWithJ(page: Page, queue: Locator, name: RegExp) {
  const row = queue.getByRole("row", { name })
  for (let i = 0; i < 15; i++) {
    if ((await row.getAttribute("aria-selected")) === "true") return row
    await page.keyboard.press("j")
  }
  await expect(row).toHaveAttribute("aria-selected", "true")
  return row
}

test("approve flow works with the keyboard only", async ({ page }) => {
  await gotoReady(page, "/approvals")
  const queue = page.getByRole("table", { name: "Requests waiting for review" })

  // Skip link first, then into the queue
  await page.keyboard.press("Tab")
  const skip = page.getByRole("link", { name: "Skip to content" })
  await expect(skip).toBeFocused()
  await expect(skip).toBeVisible()
  await page.keyboard.press("Enter")
  await expect(page.locator("main")).toBeFocused()

  const firstRow = queue.getByRole("row").nth(1)
  await tabTo(page, firstRow)
  await expectFocusRing(page)

  // j opens the panel for the row; focus stays in the table
  const row = await selectWithJ(
    page,
    queue,
    /Research Bot.*Weather API.*120\.00 USDC/,
  )
  await expect(row).toBeFocused()
  await expectFocusRing(page)
  await expect(
    page.getByRole("complementary", { name: "Research Bot → Weather API" }),
  ).toBeVisible()

  // a approves with an undo toast; the selection moves on
  await page.keyboard.press("a")
  await expect(
    page.getByText("Approved · 120.00 USDC to Weather API"),
  ).toBeVisible()
  await expect(row).toHaveCount(0)

  // Undo is reachable by keyboard: sonner's Alt+T moves focus to the toasts
  await page.keyboard.press("Alt+T")
  const undo = page.getByRole("button", { name: "Undo" })
  await tabTo(page, undo, 5)
  await expectFocusRing(page)
  await page.keyboard.press("Enter")
  await expect(row).toBeFocused()
  await expect(row).toHaveAttribute("aria-selected", "true")

  // a again; the toast closing on its own sends it
  await page.keyboard.press("a")
  await expect(
    page.getByText("Approved · 120.00 USDC to Weather API"),
  ).toHaveCount(0, { timeout: 15_000 })
  await expect(page.getByText(/^Couldn't approve/)).toHaveCount(0)
  await expect(row).toHaveCount(0)
  await expect(focused(page)).toHaveAttribute("aria-selected", "true")

  // Above 1,000.00 USDC: confirm dialog with Cancel focused; Esc cancels
  const big = await selectWithJ(
    page,
    queue,
    /Ops Agent.*Cloud GPU.*1,250\.00 USDC/,
  )
  await page.keyboard.press("a")
  const dialog = page.getByRole("alertdialog")
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused()
  await expectFocusRing(page)
  await page.keyboard.press("Escape")
  await expect(dialog).toHaveCount(0)
  await expect(big).toBeFocused()

  // r opens the reason field; Confirm reject waits for a reason
  await page.keyboard.press("r")
  const reason = page.getByRole("textbox", { name: "Reason for rejecting" })
  await expect(reason).toBeFocused()
  const confirm = page.getByRole("button", { name: "Confirm reject" })
  await expect(confirm).toBeDisabled()
  await page.keyboard.type("Not this week")
  await expect(confirm).toBeEnabled()
  await page.keyboard.press("Escape")
  await expect(reason).toHaveCount(0)
  await expect(big).toBeFocused()

  // Esc closes the panel and keeps focus on the row
  await page.keyboard.press("Escape")
  await expect(
    page.getByRole("complementary", { name: /Ops Agent/ }),
  ).toHaveCount(0)
  await expect(big).toBeFocused()
  await expectFocusRing(page)
})

// Every Tab stop on every page shows a focus indicator (WCAG 2.4.7). Caught a
// real bug: shadcn's `outline-none` turned off Tailwind's focus outline.
test("every Tab stop has a visible focus indicator", async ({ page }) => {
  const pages = ["/approvals", "/decisions", "/no-such-page"]
  for (const path of pages) {
    await gotoReady(page, path)
    const seen = new Set<string>()
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab")
      // Past the last stop, focus leaves the page (no element, or body)
      const key = await page.evaluate(() => {
        const el = document.activeElement
        if (!el || el === document.body) return null
        return `${el.tagName}:${el.textContent?.slice(0, 40)}:${el.getAttribute("aria-label")}`
      })
      if (!key || seen.has(key)) break
      seen.add(key)
      await expectFocusRing(page)
    }
    expect(seen.size, path).toBeGreaterThan(2)
  }
})
