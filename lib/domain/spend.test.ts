import { describe, expect, it } from "vitest"

import { usdc } from "@/lib/format/amount"

import { activeMandate, committedSpend, utcDayKey } from "./spend"
import { decision, opsMandateV2, request } from "./test-fixtures"
import type { HistoryEntry } from "./types"

function entry(
  id: string,
  createdAt: string,
  amount: string,
  decisionOverrides: Parameters<typeof decision>[0] = {},
): HistoryEntry {
  return {
    request: request({ id, createdAt, amount: usdc(amount) }),
    decision: decision({ requestId: id, ...decisionOverrides }),
  }
}

describe("utcDayKey", () => {
  it("uses the UTC calendar day", () => {
    expect(utcDayKey("2026-10-27T23:30:00-02:00")).toBe("2026-10-28")
  })
})

describe("activeMandate", () => {
  const v2 = opsMandateV2({
    revokedAt: "2026-10-20T10:00:00.000Z",
    supersededBy: "man_ops_3",
  })
  const v3 = opsMandateV2({
    id: "man_ops_3",
    version: 3,
    approvedAt: "2026-10-20T10:00:00.000Z",
  })
  const mandates = [v2, v3]

  it("picks the mandate in force at the time", () => {
    expect(
      activeMandate(mandates, "agt_ops", "2026-10-11T00:00:00Z"),
    ).toBeUndefined()
    expect(
      activeMandate(mandates, "agt_ops", "2026-10-18T14:02:00Z")?.version,
    ).toBe(2)
    expect(
      activeMandate(mandates, "agt_ops", "2026-10-20T10:00:00Z")?.version,
    ).toBe(3)
    expect(
      activeMandate(mandates, "agt_other", "2026-10-25T00:00:00Z"),
    ).toBeUndefined()
  })
})

describe("committedSpend", () => {
  const at = "2026-10-18T14:02:00.000Z"

  it("counts allowed, approved and waiting requests earlier the same day", () => {
    const history = [
      entry("a", "2026-10-18T09:00:00.000Z", "80"),
      entry("b", "2026-10-18T10:00:00.000Z", "150", {
        outcome: "review",
        reviewResult: "approved",
        reviewedAt: "2026-10-18T10:05:00.000Z",
      }),
      entry("c", "2026-10-18T11:00:00.000Z", "200", { outcome: "review" }),
      entry("d", "2026-10-18T12:00:00.000Z", "999", { outcome: "deny" }),
    ]
    expect(committedSpend(history, "agt_ops", at)).toEqual({
      day: usdc("430"),
      month: usdc("430"),
    })
  })

  it("releases a rejected request from the moment it was rejected", () => {
    const history = [
      entry("a", "2026-10-18T09:00:00.000Z", "900", {
        outcome: "review",
        reviewResult: "rejected",
        reviewedAt: "2026-10-18T09:31:00.000Z",
      }),
    ]
    const before = committedSpend(
      history,
      "agt_ops",
      "2026-10-18T09:20:00.000Z",
    )
    const after = committedSpend(history, "agt_ops", "2026-10-18T09:40:00.000Z")
    expect(before.day).toBe(usdc("900"))
    expect(after.day).toBe(0n)
  })

  it("splits day and month, ignores other agents and later requests", () => {
    const history = [
      entry("a", "2026-10-02T09:00:00.000Z", "100"),
      entry("b", "2026-09-30T23:59:00.000Z", "100"), // previous month
      entry("c", "2026-10-18T14:02:00.000Z", "100"), // same instant: not before
      entry("d", "2026-10-18T15:00:00.000Z", "100"), // later
      {
        request: request({ id: "e", agentId: "agt_x", amount: usdc("100") }),
        decision: decision(),
      },
    ]
    expect(committedSpend(history, "agt_ops", at)).toEqual({
      day: 0n,
      month: usdc("100"),
    })
  })

  it("can count up to a later point in time and leave one request out", () => {
    const history = [
      entry("a", "2026-10-18T09:00:00.000Z", "80"),
      entry("b", "2026-10-18T15:00:00.000Z", "50", { outcome: "review" }),
      entry("c", "2026-10-18T16:00:00.000Z", "20"),
    ]
    expect(
      committedSpend(history, "agt_ops", "2026-10-18T15:00:00.000Z", {
        asOf: "2026-10-19T08:00:00.000Z",
        excludeRequestId: "b",
      }).day,
    ).toBe(usdc("100"))
  })
})
