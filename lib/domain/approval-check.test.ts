import { describe, expect, it } from "vitest"

import { usdc } from "@/lib/format/amount"

import { checkApproval, checkApprovalAt } from "./approval-check"
import { decision, opsMandateV2, request } from "./test-fixtures"

describe("checkApproval", () => {
  const waiting = request({ amount: usdc("150") })

  it("passes when the current mandate still covers the request", () => {
    expect(
      checkApproval(waiting, opsMandateV2(), {
        day: usdc("300"),
        month: usdc("300"),
      }),
    ).toEqual({ ok: true })
  })

  it("warns about every limit the current mandate would break", () => {
    const lowered = opsMandateV2({
      version: 3,
      rules: [
        { kind: "limit", amount: usdc("100"), period: "tx" },
        { kind: "limit", amount: usdc("400"), period: "day" },
      ],
    })
    expect(
      checkApproval(waiting, lowered, { day: usdc("300"), month: usdc("300") }),
    ).toEqual({
      ok: false,
      breaches: [
        {
          code: "LIMIT_TX_EXCEEDED",
          sentence:
            "Approving would break the current mandate (v3): the per-payment limit is 100.00 USDC and this request is 150.00 USDC.",
        },
        {
          code: "LIMIT_DAILY_EXCEEDED",
          sentence:
            "Approving would break the current mandate (v3): the daily limit is 400.00 USDC, 300.00 USDC was already committed that day and this request is 150.00 USDC.",
        },
      ],
    })
  })

  it("warns when the agent has no active mandate", () => {
    const result = checkApproval(waiting, undefined, { day: 0n, month: 0n })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.breaches[0]?.code).toBe("NO_ACTIVE_MANDATE")
  })
})

describe("checkApprovalAt", () => {
  it("uses the mandate in force now and spend committed since, minus the request", () => {
    const v1 = opsMandateV2({
      version: 1,
      revokedAt: "2026-10-18T12:00:00.000Z",
    })
    const v2 = opsMandateV2({
      id: "man_ops_next",
      version: 2,
      approvedAt: "2026-10-18T12:00:00.000Z",
      rules: [{ kind: "limit", amount: usdc("400"), period: "day" }],
    })
    const earlier = request({
      id: "r1",
      createdAt: "2026-10-18T08:00:00.000Z",
      amount: usdc("210"),
    })
    const pending = request({
      id: "r2",
      createdAt: "2026-10-18T10:00:00.000Z",
      amount: usdc("250"),
    })
    const history = [
      { request: earlier, decision: decision({ requestId: "r1" }) },
      {
        request: pending,
        decision: decision({ requestId: "r2", outcome: "review" }),
      },
    ]

    const result = checkApprovalAt(
      pending,
      history,
      [v1, v2],
      "2026-10-18T13:00:00.000Z",
    )
    expect(result.ok).toBe(false)
    expect(!result.ok && result.breaches.map((b) => b.code)).toEqual([
      "LIMIT_DAILY_EXCEEDED",
    ])
  })
})
