import { describe, expect, it } from "vitest"

import { formatAbsolute, formatRelative } from "./date"

const now = new Date("2026-10-27T14:00:00Z")

describe("formatRelative", () => {
  it.each([
    ["2026-10-27T13:59:30Z", "just now"],
    ["2026-10-27T14:00:05Z", "just now"], // slightly in the future
    ["2026-10-27T13:57:00Z", "3 min ago"],
    ["2026-10-27T13:00:00Z", "1 h ago"],
    ["2026-10-26T14:30:00Z", "23 h ago"],
    ["2026-10-26T14:00:00Z", "1 day ago"],
    ["2026-10-25T09:00:00Z", "2 days ago"],
    ["2026-10-18T14:02:00Z", "18 Oct"],
    ["2025-12-31T10:00:00Z", "31 Dec 2025"],
  ])("%s → %s", (iso, expected) => {
    expect(formatRelative(iso, now)).toBe(expected)
  })
})

describe("formatAbsolute", () => {
  it("shows UTC and local time", () => {
    expect(formatAbsolute("2026-10-27T13:02:00Z", "Europe/Belgrade")).toBe(
      "2026-10-27 13:02 UTC · 14:02 CET",
    )
  })

  it("adds the local date when it differs from the UTC date", () => {
    expect(formatAbsolute("2026-10-27T23:30:00Z", "Europe/Belgrade")).toBe(
      "2026-10-27 23:30 UTC · 2026-10-28 00:30 CET",
    )
  })

  it("works for UTC itself", () => {
    expect(formatAbsolute("2026-10-27T13:02:00Z", "UTC")).toBe(
      "2026-10-27 13:02 UTC · 13:02 UTC",
    )
  })
})
