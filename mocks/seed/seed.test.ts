// @vitest-environment node
import { describe, expect, it } from "vitest"

import { checkApprovalAt } from "@/lib/domain/approval-check"
import { isWaitingForReview } from "@/lib/domain/display-state"
import { evaluate, hardRuleFailures } from "@/lib/domain/evaluate"
import {
  decisionSchema,
  mandateSchema,
  paymentRequestSchema,
  paymentSchema,
} from "@/lib/domain/schemas"
import { activeMandate, committedSpend } from "@/lib/domain/spend"
import { addressKey } from "@/lib/format/address"
import { usdc } from "@/lib/format/amount"

import { DEFAULT_ANCHOR, generateSeed, seedAnchor } from "./generate"
import { TX_SLOTS } from "./tx-slots"

const seed = generateSeed()
const waiting = seed.entries.filter((e) => isWaitingForReview(e.decision))

describe("generateSeed", () => {
  it("is deterministic", () => {
    expect(generateSeed()).toEqual(seed)
  })

  it("has the shape PLAN.md §3 asks for", () => {
    expect(seed.agents).toHaveLength(6)
    expect(seed.entries.length).toBeGreaterThanOrEqual(170)
    expect(seed.entries.length).toBeLessThanOrEqual(230)
    expect(waiting).toHaveLength(12)

    const outcomes = new Set(seed.entries.map((e) => e.decision.reasonCode))
    expect([...outcomes].sort()).toEqual([
      "CHAIN_NOT_ALLOWED",
      "LIMIT_DAILY_EXCEEDED",
      "LIMIT_MONTHLY_EXCEEDED",
      "LIMIT_TX_EXCEEDED",
      "REVIEW_THRESHOLD",
      "VENDOR_NOT_ALLOWED",
      "WITHIN_LIMITS",
    ])
  })

  it("matches the domain schemas (encodes to valid wire data)", () => {
    for (const { request, decision, payment } of seed.entries) {
      expect(paymentRequestSchema.safeEncode(request).success).toBe(true)
      expect(decisionSchema.safeEncode(decision).success).toBe(true)
      expect(paymentSchema.safeEncode(payment).success).toBe(true)
    }
    for (const mandate of seed.mandates) {
      expect(mandateSchema.safeEncode(mandate).success).toBe(true)
    }
  })

  it("has unique ids and timestamps", () => {
    const ids = seed.entries.flatMap((e) => [
      e.request.id,
      e.decision.id,
      e.payment.id,
    ])
    expect(new Set(ids).size).toBe(ids.length)
    const times = seed.entries.map((e) => e.request.createdAt)
    expect(new Set(times).size).toBe(times.length)
  })

  // design.md §2.4: every stored decision is what the evaluator says
  it("stores exactly what the evaluator produces for every request", () => {
    for (const { request, decision } of seed.entries) {
      const mandate = activeMandate(
        seed.mandates,
        request.agentId,
        request.createdAt,
      )
      expect(mandate?.id).toBe(decision.mandateId)
      const result = evaluate(
        request,
        mandate!,
        committedSpend(seed.entries, request.agentId, request.createdAt),
      )
      expect({ id: request.id, ...result }).toEqual({
        id: request.id,
        outcome: decision.outcome,
        reasonCode: decision.reasonCode,
        reason: decision.reason,
        ...(decision.matchedRule && { matchedRule: decision.matchedRule }),
      })
    }
  })

  it("only queues requests that pass every hard rule and are above the threshold", () => {
    for (const { request, decision } of waiting) {
      const mandate = seed.mandates.find((m) => m.id === decision.mandateId)!
      const committed = committedSpend(
        seed.entries,
        request.agentId,
        request.createdAt,
      )
      expect(hardRuleFailures(request, mandate, committed)).toEqual([])
      expect(decision.reasonCode).toBe("REVIEW_THRESHOLD")
    }
  })

  it("keeps review fields consistent with the outcome", () => {
    for (const { decision, payment } of seed.entries) {
      if (decision.outcome !== "review")
        expect(decision.reviewResult).toBeUndefined()
      if (decision.reviewResult) {
        expect(decision.reviewedBy).toBeDefined()
        expect(Date.parse(decision.reviewedAt!)).toBeLessThan(
          Date.parse(DEFAULT_ANCHOR),
        )
      }
      if (decision.reviewResult === "rejected")
        expect(payment.status).toBe("rejected")
      if (isWaitingForReview(decision))
        expect(payment.status).toBe("pending_approval")
    }
  })

  it("reproduces the design.md sketches", () => {
    const find = (agentId: string, amount: string, day: string) =>
      seed.entries.find(
        (e) =>
          e.request.agentId === agentId &&
          e.request.amount === usdc(amount) &&
          e.request.createdAt.startsWith(day),
      )!

    // §6.2b: denied under v2, 430.00 already committed
    const denied = find("agt_ops", "120", "2026-10-18")
    expect(denied.decision.mandateVersion).toBe(2)
    expect(denied.decision.reason).toContain(
      "430.00 USDC was already committed",
    )

    // §6.1: 1,250.00 takes Ops Agent to 1,730.00 of 3,000.00 today
    const gpu = find("agt_ops", "1250", "2026-10-27")
    expect(isWaitingForReview(gpu.decision)).toBe(true)
    expect(
      committedSpend(seed.entries, "agt_ops", gpu.request.createdAt, {
        asOf: DEFAULT_ANCHOR,
      }).day,
    ).toBe(usdc("1730"))

    // §6.2b review outcomes
    expect(find("agt_travel", "420", "2026-10-27").decision.reviewedBy).toBe(
      "M. Ilić",
    )
    expect(find("agt_ops", "900", "2026-10-27").decision.reviewReason).toBe(
      "Duplicate of yesterday's GPU order.",
    )
  })

  it("has exactly one queue item with a limit warning (Support Bot under v2)", () => {
    const warned = waiting.filter(
      (e) =>
        !checkApprovalAt(e.request, seed.entries, seed.mandates, DEFAULT_ANCHOR)
          .ok,
    )
    expect(warned.map((e) => e.request.agentId)).toEqual(["agt_support"])
  })

  it("has payments in every state the timeline needs", () => {
    const statuses = new Set(seed.entries.map((e) => e.payment.status))
    expect(statuses).toEqual(
      new Set([
        "confirmed",
        "submitted",
        "failed",
        "rejected",
        "pending_approval",
      ]),
    )
  })
})

describe("seedAnchor", () => {
  it("is the latest 14:00 UTC at or before now", () => {
    expect(seedAnchor(new Date("2026-11-03T15:30:00Z"))).toBe(
      "2026-11-03T14:00:00.000Z",
    )
    expect(seedAnchor(new Date("2026-11-03T14:00:00Z"))).toBe(
      "2026-11-03T14:00:00.000Z",
    )
    expect(seedAnchor(new Date("2026-11-03T09:00:00Z"))).toBe(
      "2026-11-02T14:00:00.000Z",
    )
  })

  it("keeps every scripted expectation valid on other anchors", () => {
    // generateSeed throws on drift; month boundaries move with the anchor
    for (const day of [
      "2026-11-01",
      "2026-12-31",
      "2027-03-01",
      "2027-06-15",
    ]) {
      expect(() => generateSeed(`${day}T14:00:00.000Z`)).not.toThrow()
    }
  })
})

describe("tx slots (D-019)", () => {
  const sent = seed.entries.filter((e) => !e.payment.simulated)

  it("attach well-formed hashes to the payments that use them", () => {
    for (const slot of Object.values(TX_SLOTS)) {
      if (!slot.txHash) continue
      expect(slot.txHash).toMatch(
        slot.chain === "base"
          ? /^0x[0-9a-f]{64}$/
          : /^[1-9A-HJ-NP-Za-km-z]{86,88}$/,
      )
      const entry = sent.find((e) => e.payment.txHash === slot.txHash)
      expect(entry?.payment.chain).toBe(slot.chain)
    }
  })

  it("use the onchain amount of each real transfer, kept small", () => {
    for (const slot of Object.values(TX_SLOTS)) {
      if (slot.kind !== "transfer" || !slot.txHash) continue
      const entry = sent.find((e) => e.payment.txHash === slot.txHash)
      expect(entry?.request.amount).toBe(usdc(slot.amount))
      expect(entry?.payment.status).toBe("confirmed")
      expect(usdc(slot.amount)).toBeLessThan(usdc("10"))
    }
  })

  it("report a failed and a submitted payment for the error demos", () => {
    const missing = sent.find(
      (e) => e.payment.txHash === TX_SLOTS["base-missing"].txHash,
    )
    expect(missing?.payment.status).toBe("submitted")
    const failed = TX_SLOTS["base-failed"]
    if (failed.txHash) {
      const entry = sent.find((e) => e.payment.txHash === failed.txHash)
      expect(entry?.payment.status).toBe("failed")
    }
  })

  it("name the wallets of real transfers after the agent and vendor", () => {
    const slot = TX_SLOTS["base-1"]
    expect(seed.addressLabels[addressKey(slot.from)]).toBe(
      "Research Bot wallet",
    )
    expect(seed.addressLabels[addressKey(slot.to)]).toBe("Weather API wallet")
  })
})
