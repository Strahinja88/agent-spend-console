import { screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http } from "msw"
import { describe, expect, it, vi } from "vitest"

import { server } from "@/mocks/node"

import { renderWithProviders, setupMockApi } from "../approvals/test-utils"
import { DecisionDetail } from "./decision-detail"
import { findSeeded } from "./test-utils"

vi.mock("next/navigation", () => ({ usePathname: () => "/decisions/x" }))

setupMockApi()

async function renderDetail(agentId: string, amount: string, day: string) {
  const { decision } = await findSeeded(agentId, amount, day)
  renderWithProviders(<DecisionDetail id={decision.id} />)
  return await screen.findByRole("heading", { level: 1 })
}

describe("DecisionDetail", () => {
  it("shows skeletons while loading", () => {
    renderWithProviders(<DecisionDetail id="dec_any" />)
    expect(screen.getByText("Loading decision")).toBeInTheDocument()
  })

  it("explains a denial under a mandate that has since been replaced", async () => {
    // design.md §6.2b
    const heading = await renderDetail("agt_ops", "120", "2026-10-18")
    expect(heading).toHaveTextContent("Denied120.00 USDC")

    const explanation = screen.getByRole("region", { name: "Explanation" })
    expect(explanation).toHaveTextContent(
      "Denied: the daily limit is 500.00 USDC, 430.00 USDC was already committed that day and this request is 120.00 USDC.",
    )
    expect(explanation).toHaveTextContent("Code: LIMIT_DAILY_EXCEEDED")

    const mandate = screen.getByRole("region", { name: "Mandate v2" })
    expect(mandate).toHaveTextContent("Replaced by v3 on 20 Oct")
    expect(mandate).toHaveTextContent("Approved by M. Ilić · 12 Oct")
    const matched = within(mandate).getByText("Matched rule").closest("li")
    expect(matched).toHaveTextContent("Up to 500.00 USDC per day.")
    expect(within(mandate).getAllByText("Matched rule")).toHaveLength(1)

    expect(screen.getByRole("link", { name: "View payment" })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/payments\/pay_/),
    )
  })

  it("shows the final state of an approved review", async () => {
    const heading = await renderDetail("agt_travel", "420", "2026-10-27")
    expect(heading).toHaveTextContent("Approved after review · M. Ilić")
    expect(
      screen.getByRole("region", { name: "Explanation" }),
    ).toHaveTextContent(
      /Sent to review: 420\.00 USDC is above the 250\.00 USDC review threshold and within all limits\.Approved by M\. Ilić at \d\d:\d\d UTC\./,
    )
  })

  it("shows who rejected a review and why", async () => {
    const heading = await renderDetail("agt_ops", "900", "2026-10-27")
    expect(heading).toHaveTextContent("Rejected after review")
    expect(
      screen.getByRole("region", { name: "Explanation" }),
    ).toHaveTextContent(
      /Rejected by J\. Perić at \d\d:\d\d UTC: “Duplicate of yesterday's GPU order\.”/,
    )
  })

  it("links a waiting request to the queue", async () => {
    const heading = await renderDetail("agt_ops", "1250", "2026-10-27")
    expect(heading).toHaveTextContent("Waiting for review")
    expect(
      screen.getByRole("link", { name: "Review in queue" }),
    ).toHaveAttribute("href", "/approvals")
    expect(screen.queryByRole("link", { name: "View payment" })).toBeNull()
    expect(
      screen.getByRole("region", { name: "Mandate v3" }),
    ).not.toHaveTextContent("Replaced")
  })

  it("says so when the decision doesn't exist", async () => {
    renderWithProviders(<DecisionDetail id="dec_nope" />)
    expect(await screen.findByText("Decision not found")).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Back to decisions" }),
    ).toHaveAttribute("href", "/decisions")
  })

  it("shows an error with Retry when loading fails", async () => {
    const { decision } = await findSeeded("agt_ops", "120", "2026-10-18")
    server.use(
      http.get(
        "*/api/decisions/:id",
        () =>
          Response.json(
            { code: "SIMULATED_FAILURE", message: "x" },
            { status: 500 },
          ),
        { once: true },
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<DecisionDetail id={decision.id} />)

    expect(
      await screen.findByText("Couldn't load this decision"),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "Denied",
    )
  })
})
