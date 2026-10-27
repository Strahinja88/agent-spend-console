import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { StatusPill } from "./status-pill"

describe("StatusPill", () => {
  it("shows the label as text, with a decorative icon", () => {
    const { container } = render(
      <StatusPill status="allow" label="Approved after review · M. Ilić" />,
    )
    expect(
      screen.getByText("Approved after review · M. Ilić"),
    ).toBeInTheDocument()
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    )
  })
})
