import { describe, expect, it } from "vitest"

import type { PaymentDetail } from "@/lib/api/contract"
import { ChainError } from "@/lib/chain/errors"
import type { OnchainTx } from "@/lib/chain/types"
import { usdc } from "@/lib/format/amount"
import { generateSeed, type SeedEntry } from "@/mocks/seed/generate"
import { TX_SLOTS } from "@/mocks/seed/tx-slots"

import {
  amountCheck,
  onchainView,
  paymentSummary,
  timelineSteps,
  type OnchainView,
} from "./timeline-steps"

const seed = generateSeed()

function detail(find: (e: SeedEntry) => boolean): PaymentDetail {
  const entry = seed.entries.find(find)
  if (!entry) throw new Error("No such seed entry")
  const agent = seed.agents.find((a) => a.id === entry.request.agentId)
  if (!agent) throw new Error("No agent")
  return { ...entry, agent, addressLabels: seed.addressLabels }
}

const real = detail((e) => e.payment.txHash === TX_SLOTS["base-1"].txHash)
const statuses = (d: PaymentDetail, view: OnchainView) =>
  timelineSteps(d, view).map((s) => s.status)

const confirmed: OnchainTx = {
  state: "confirmed",
  inclusion: { chain: "base", blockNumber: 1n },
  blockTime: "2026-10-27T16:14:54.000Z",
  transfers: [{ amount: usdc("2.00"), from: "0xa", to: "0xb" }],
}

describe("timelineSteps", () => {
  it("stops at the decision when the rules deny", () => {
    const denied = detail((e) => e.decision.outcome === "deny")
    expect(statuses(denied, { kind: "simulated" })).toEqual([
      "done",
      "failed",
      "not_reached",
      "not_reached",
      "not_reached",
    ])
    expect(paymentSummary(denied, { kind: "simulated" })).toMatchObject({
      status: "deny",
      label: "Not paid",
    })
  })

  it("shows who rejected a review and why", () => {
    const rejected = detail((e) => e.decision.reviewResult === "rejected")
    const [, , approved] = timelineSteps(rejected, { kind: "simulated" })
    expect(approved).toMatchObject({
      status: "failed",
      time: rejected.decision.reviewedAt,
    })
    expect(approved?.text).toMatch(/^Rejected by .+: “.+”$/)
  })

  it("waits for review without reaching the later steps", () => {
    const waiting = detail(
      (e) => e.decision.outcome === "review" && !e.decision.reviewResult,
    )
    expect(statuses(waiting, { kind: "simulated" })).toEqual([
      "done",
      "done",
      "current",
      "not_reached",
      "not_reached",
    ])
  })

  it("says a simulated payment has no onchain transaction", () => {
    const simulated = detail(
      (e) => e.payment.simulated && e.payment.status === "confirmed",
    )
    const steps = timelineSteps(simulated, { kind: "simulated" })
    expect(steps.map((s) => s.status)).toEqual([
      "done",
      "done",
      "done",
      "done",
      "done",
    ])
    expect(steps[4]?.text).toBe("Simulated payment, no onchain transaction.")
    expect(steps[3]?.time).toBe(simulated.payment.submittedAt)
  })

  it("follows the chain for a real transaction", () => {
    expect(statuses(real, { kind: "loading" }).at(-1)).toBe("current")
    expect(statuses(real, { kind: "tx", tx: confirmed }).at(-1)).toBe("done")
    expect(
      statuses(real, {
        kind: "tx",
        tx: { ...confirmed, state: "failed", reason: "x" },
      }).at(-1),
    ).toBe("failed")
    expect(
      timelineSteps(real, { kind: "tx", tx: { state: "not_found" } }).at(-1)
        ?.text,
    ).toBe("Transaction not found on Base Sepolia.")
  })

  it("keeps a Solana transaction that isn't finalized apart", () => {
    const [, , , , step] = timelineSteps(real, {
      kind: "tx",
      tx: {
        ...confirmed,
        inclusion: { chain: "solana", slot: 1, finality: "confirmed" },
      },
    })
    expect(step?.text).toMatch(/waiting to be finalized/)
  })
})

describe("paymentSummary", () => {
  it("states what was sent, to whom, as of the block time", () => {
    expect(paymentSummary(real, { kind: "tx", tx: confirmed })).toEqual({
      status: "allow",
      label: "Confirmed",
      sentence: "Confirmed on Base Sepolia · 2.00 USDC sent to Weather API",
      time: "2026-10-27T16:14:54.000Z",
    })
  })
})

describe("onchainView", () => {
  it("never looks up a simulated payment", () => {
    const simulated = detail((e) => e.payment.simulated)
    expect(onchainView(simulated, { error: null })).toEqual({
      kind: "simulated",
    })
  })

  it("keeps data over a failed refetch, and spots rate limits", () => {
    const busy = new ChainError("rate_limited", "x")
    expect(onchainView(real, { data: confirmed, error: busy })).toEqual({
      kind: "tx",
      tx: confirmed,
    })
    expect(onchainView(real, { error: busy })).toEqual({
      kind: "error",
      rateLimited: true,
    })
  })
})

describe("amountCheck", () => {
  it("compares the first transfer with the approved amount", () => {
    const t = (amount: bigint) => [{ amount, from: "a", to: "b" }]
    expect(amountCheck(usdc("2"), t(usdc("2")))).toBe("match")
    expect(amountCheck(usdc("2"), t(usdc("2.01")))).toBe("mismatch")
    expect(amountCheck(usdc("2"), [])).toBe("none")
  })
})
