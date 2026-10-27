import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { usdc } from "@/lib/format/amount"

import { SpendBar } from "./spend-bar"

describe("SpendBar", () => {
  it("states the numbers in text and on the meter", () => {
    render(
      <SpendBar
        committed={usdc("1730")}
        limit={usdc("3000")}
        periodLabel="today"
        note="(including this request)"
      />,
    )
    const meter = screen.getByRole("meter", { name: "Committed today" })
    expect(meter).toHaveAttribute("aria-valuenow", "57")
    expect(meter).toHaveAttribute(
      "aria-valuetext",
      "1,730.00 USDC of 3,000.00 USDC committed today",
    )
    expect(
      screen.getByText(/1,730.00 USDC of 3,000.00 USDC committed today/),
    ).toHaveTextContent("(including this request)")
  })

  it("caps the bar at 100% when over the limit", () => {
    render(
      <SpendBar
        committed={usdc("600")}
        limit={usdc("400")}
        periodLabel="today"
      />,
    )
    expect(screen.getByRole("meter")).toHaveAttribute("aria-valuenow", "100")
  })
})
