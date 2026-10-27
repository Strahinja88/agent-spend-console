import { describe, expect, it } from "vitest"

import { usdc } from "@/lib/format/amount"

import { evaluate } from "./evaluate"
import { nothingCommitted, opsMandateV2, request } from "./test-fixtures"

const mandate = opsMandateV2()

describe("evaluate", () => {
  it("allows a request within all limits and at or below the threshold", () => {
    const result = evaluate(
      request({ amount: usdc("100") }),
      mandate,
      nothingCommitted,
    )
    expect(result).toEqual({
      outcome: "allow",
      reasonCode: "WITHIN_LIMITS",
      reason:
        "Allowed: 100.00 USDC is within all limits and not above the 100.00 USDC review threshold.",
    })
  })

  it("sends a request strictly above the threshold to review", () => {
    const result = evaluate(
      request({ amount: usdc("100.000001") }),
      mandate,
      nothingCommitted,
    )
    expect(result.outcome).toBe("review")
    expect(result.reasonCode).toBe("REVIEW_THRESHOLD")
    expect(result.matchedRule).toEqual({
      kind: "review_threshold",
      amount: usdc("100"),
    })
    expect(result.reason).toBe(
      "Sent to review: 100.000001 USDC is above the 100.00 USDC review threshold and within all limits.",
    )
  })

  describe("hard rules", () => {
    it("denies a chain that isn't allowed", () => {
      const result = evaluate(
        request({ chain: "solana" }),
        opsMandateV2({ rules: [{ kind: "chain", chains: ["base"] }] }),
        nothingCommitted,
      )
      expect(result.outcome).toBe("deny")
      expect(result.reasonCode).toBe("CHAIN_NOT_ALLOWED")
      expect(result.reason).toBe(
        "Denied: payments on Solana aren't allowed (Base only).",
      )
    })

    it("denies a vendor that isn't on the allowlist", () => {
      const result = evaluate(
        request({ vendor: "Hotel Y" }),
        mandate,
        nothingCommitted,
      )
      expect(result.reasonCode).toBe("VENDOR_NOT_ALLOWED")
      expect(result.reason).toBe(
        "Denied: Hotel Y isn't on the vendor allowlist (Weather API and Cloud GPU).",
      )
    })

    it("treats the per-payment limit as inclusive", () => {
      expect(
        evaluate(request({ amount: usdc("200") }), mandate, nothingCommitted)
          .reasonCode,
      ).toBe("REVIEW_THRESHOLD")
      expect(
        evaluate(request({ amount: usdc("200.01") }), mandate, nothingCommitted)
          .reasonCode,
      ).toBe("LIMIT_TX_EXCEEDED")
    })

    it("treats the daily limit as inclusive of committed spend", () => {
      const committed = { day: usdc("430"), month: usdc("430") }
      expect(
        evaluate(request({ amount: usdc("70") }), mandate, committed).outcome,
      ).toBe("allow")
      const denied = evaluate(
        request({ amount: usdc("120") }),
        mandate,
        committed,
      )
      expect(denied.reasonCode).toBe("LIMIT_DAILY_EXCEEDED")
      expect(denied.matchedRule).toEqual({
        kind: "limit",
        amount: usdc("500"),
        period: "day",
      })
    })

    it("explains a daily deny like docs/design.md §6.2b", () => {
      const result = evaluate(request({ amount: usdc("120") }), mandate, {
        day: usdc("430"),
        month: usdc("430"),
      })
      expect(result.reason).toBe(
        "Denied: the daily limit is 500.00 USDC, 430.00 USDC was already committed that day and this request is 120.00 USDC." +
          " It's also above the 100.00 USDC review threshold, but a hard rule failed, so it was denied rather than sent to review.",
      )
    })

    it("checks the monthly limit", () => {
      const monthly = opsMandateV2({
        rules: [{ kind: "limit", amount: usdc("1500"), period: "month" }],
      })
      const result = evaluate(request({ amount: usdc("60") }), monthly, {
        day: 0n,
        month: usdc("1450"),
      })
      expect(result.reasonCode).toBe("LIMIT_MONTHLY_EXCEEDED")
      expect(result.reason).toBe(
        "Denied: the monthly limit is 1,500.00 USDC, 1,450.00 USDC was already committed that month and this request is 60.00 USDC.",
      )
    })

    it("reports the first failure in the fixed order", () => {
      // Breaks chain, vendor, tx and day at once: chain comes first
      const result = evaluate(
        request({ chain: "solana", vendor: "Hotel Y", amount: usdc("900") }),
        opsMandateV2({
          rules: [
            { kind: "limit", amount: usdc("500"), period: "day" },
            { kind: "limit", amount: usdc("200"), period: "tx" },
            { kind: "vendor_allowlist", vendors: ["Cloud GPU"] },
            { kind: "chain", chains: ["base"] },
          ],
        }),
        nothingCommitted,
      )
      expect(result.reasonCode).toBe("CHAIN_NOT_ALLOWED")
    })

    it("denies rather than reviews when a hard rule fails above the threshold", () => {
      // design.md §6.2a: 250 to Weather API for Research Bot
      const result = evaluate(
        request({ amount: usdc("250") }),
        mandate,
        nothingCommitted,
      )
      expect(result.outcome).toBe("deny")
      expect(result.reasonCode).toBe("LIMIT_TX_EXCEEDED")
    })
  })

  it("treats missing rule kinds as no constraint", () => {
    const result = evaluate(
      request({ amount: usdc("1000000"), vendor: "Anyone", chain: "solana" }),
      opsMandateV2({ rules: [] }),
      nothingCommitted,
    )
    expect(result).toEqual({
      outcome: "allow",
      reasonCode: "WITHIN_LIMITS",
      reason: "Allowed: 1,000,000.00 USDC is within all limits.",
    })
  })
})
