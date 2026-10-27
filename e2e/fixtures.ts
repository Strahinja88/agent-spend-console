import AxeBuilder from "@axe-core/playwright"
import { test as base, expect, type Page } from "@playwright/test"
import { getResponse } from "msw"

import { RPC_URLS } from "@/lib/chain/config"
import { baseRpc, solanaRpc } from "@/mocks/rpc"
import { generateSeed } from "@/mocks/seed/generate"
import { TX_SLOTS } from "@/mocks/seed/tx-slots"

// Shared e2e setup (D-022):
// - the mock API never fails at random and answers fast,
// - testnet RPCs are answered from the same JSON-RPC fixtures as the unit
//   tests (mocks/rpc.ts), so no e2e test depends on the public testnet,
// - axe, failing on serious and critical violations.

type Options = {
  /** Answer RPC calls from fixtures (default) or let them reach the testnet. */
  liveRpc: boolean
}

export const test = base.extend<Options>({
  liveRpc: [false, { option: true }],
  context: async ({ context, liveRpc }, use) => {
    await context.addInitScript(() => {
      window.__ASC_MOCK__ = { mutationFailureRate: 0, latencyMs: [50, 150] }
    })
    if (!liveRpc) {
      const handlers = [
        baseRpc({ kind: "confirmed" }),
        solanaRpc({ kind: "confirmed" }),
      ]
      for (const url of Object.values(RPC_URLS)) {
        await context.route(`${url}/**`, (route) => fakeRpc(route, handlers))
        await context.route(url, (route) => fakeRpc(route, handlers))
      }
    }
    await use(context)
  },
})

export { expect }

type Route = Parameters<Parameters<Page["route"]>[1]>[0]

/**
 * Answers one RPC request with MSW's handlers. Base's not-found hash isn't in
 * the fixtures' scenario, so it gets the not-found scenario.
 */
async function fakeRpc(
  route: Route,
  handlers: Parameters<typeof getResponse>[0],
) {
  const req = route.request()
  if (req.method() === "OPTIONS") {
    return route.fulfill({ status: 204, headers: corsHeaders })
  }
  const body = req.postData() ?? ""
  const scenario = body.includes(TX_SLOTS["base-missing"].txHash)
    ? [baseRpc({ kind: "not_found" })]
    : handlers
  const response = await getResponse(
    scenario,
    new Request(req.url(), { method: "POST", body, headers: req.headers() }),
  )
  if (!response) return route.abort()
  return route.fulfill({
    status: response.status,
    headers: { ...corsHeaders, "content-type": "application/json" },
    body: await response.text(),
  })
}

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "POST, OPTIONS",
}

/** Seed ids are the same on every load (D-008), so tests can look them up. */
const seed = generateSeed()

export function paymentIdForSlot(slot: keyof typeof TX_SLOTS): string {
  const hash = TX_SLOTS[slot].txHash
  const entry = seed.entries.find((e) => hash && e.payment?.txHash === hash)
  if (!entry?.payment) throw new Error(`No seed payment for slot ${slot}`)
  return entry.payment.id
}

export function simulatedPaymentId(): string {
  const entry = seed.entries.find(
    (e) => e.payment?.simulated && e.payment.status === "confirmed",
  )
  if (!entry?.payment) throw new Error("No simulated confirmed payment")
  return entry.payment.id
}

export function decisionId(
  predicate: (entry: (typeof seed.entries)[number]) => boolean,
): string {
  const entry = seed.entries.find(predicate)
  if (!entry) throw new Error("No matching seed decision")
  return entry.decision.id
}

/** Waits for the mock API and the first data to arrive. */
export async function gotoReady(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, {
    timeout: 15_000,
  })
}

export async function setTheme(page: Page, theme: "light" | "dark") {
  await page.evaluate((t) => localStorage.setItem("theme", t), theme)
}

/** Runs axe on the page as it is now and fails on serious/critical issues. */
export async function expectNoSeriousA11yViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  )
  const report = serious
    .map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help}\n` +
        v.nodes
          .slice(0, 5)
          .map((n) => `  - ${n.target.join(" ")}: ${n.failureSummary}`)
          .join("\n"),
    )
    .join("\n")
  expect(serious, `${label}\n${report}`).toEqual([])
}
