import { describe, expect, it } from "vitest"

import { displayState } from "./display-state"

describe("displayState", () => {
  it.each([
    [{ outcome: "allow" as const }, { status: "allow", label: "Allowed" }],
    [{ outcome: "deny" as const }, { status: "deny", label: "Denied" }],
    [
      { outcome: "review" as const },
      { status: "review", label: "Waiting for review" },
    ],
    [
      {
        outcome: "review" as const,
        reviewResult: "approved" as const,
        reviewedBy: "M. Ilić",
      },
      { status: "allow", label: "Approved after review · M. Ilić" },
    ],
    [
      {
        outcome: "review" as const,
        reviewResult: "rejected" as const,
        reviewedBy: "J. Perić",
      },
      { status: "deny", label: "Rejected after review" },
    ],
  ])("%o", (decision, expected) => {
    expect(displayState(decision)).toEqual(expected)
  })
})
