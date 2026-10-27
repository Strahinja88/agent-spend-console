import { evaluate } from "@/lib/domain/evaluate"
import { activeMandate, committedSpend } from "@/lib/domain/spend"
import type {
  Agent,
  Chain,
  Decision,
  Mandate,
  Payment,
  PaymentRequest,
} from "@/lib/domain/types"
import { usdc } from "@/lib/format/amount"

import { createRng, type Rng } from "../prng"
import {
  AGENTS,
  FILLER,
  MANDATES,
  REJECT_REASONS,
  REVIEWERS,
  SCRIPTED,
  UNLISTED_VENDORS,
  type ScriptedRequest,
  type SeedTime,
} from "./fixtures"
import { TX_SLOTS, type TxSlot } from "./tx-slots"
import { unsignedVerdict } from "./verdict"

export type SeedEntry = {
  request: PaymentRequest
  decision: Decision
  payment: Payment
}

export type Seed = {
  anchor: string
  agents: Agent[]
  mandates: Mandate[]
  /** Chronological. Every decision is exactly what `evaluate` returns (design.md §2.4). */
  entries: SeedEntry[]
}

/** Fixed anchor used by tests and matching the sketches in docs/design.md. */
export const DEFAULT_ANCHOR = "2026-10-27T14:00:00.000Z"

const SEED = 20261027
const FILLER_DAYS = 30
const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/**
 * The anchor for a given "now": the latest 14:00 UTC that isn't after it, so
 * the demo always looks recent (D-008).
 */
export function seedAnchor(now: Date): string {
  const anchor = new Date(now)
  anchor.setUTCHours(14, 0, 0, 0)
  if (anchor.getTime() > now.getTime()) {
    anchor.setTime(anchor.getTime() - DAY)
  }
  return anchor.toISOString()
}

/** Turns [day, "HH:MM"] into an ISO timestamp relative to the anchor's UTC day. */
export function seedTime(anchor: string, [day, time]: SeedTime): string {
  const [hours = 0, minutes = 0] = time.split(":").map(Number)
  const date = new Date(anchor)
  date.setUTCHours(hours, minutes, 0, 0)
  return new Date(date.getTime() + day * DAY).toISOString()
}

type Candidate = Omit<PaymentRequest, "id"> & {
  scripted?: ScriptedRequest
  review?: ScriptedRequest["review"]
}

export function buildMandates(anchor: string): Mandate[] {
  return MANDATES.map(({ approvedAt, revokedAt, ...mandate }) => ({
    ...mandate,
    approvedAt: seedTime(anchor, approvedAt),
    ...(revokedAt && { revokedAt: seedTime(anchor, revokedAt) }),
  }))
}

function randomAmount(rng: Rng, [min, max]: [number, number]): bigint {
  const whole = rng.int(min, max)
  const cents = rng.chance(0.5) ? 0 : rng.int(1, 99)
  return usdc(`${whole}.${String(cents).padStart(2, "0")}`)
}

function fillerCandidates(
  rng: Rng,
  anchor: string,
  mandates: Mandate[],
  usedTimes: Set<number>,
): Candidate[] {
  // Agent-days with scripted requests stay hand-written, so their numbers hold
  const scriptedDays = new Set(SCRIPTED.map((s) => `${s.agentId}:${s.at[0]}`))
  const candidates: Candidate[] = []

  for (let day = -FILLER_DAYS; day <= -1; day++) {
    for (const agent of AGENTS) {
      const config = FILLER[agent.id]
      if (!config) continue
      const count = rng.int(...config.perDay)
      if (scriptedDays.has(`${agent.id}:${day}`)) continue

      for (let i = 0; i < count; i++) {
        let time = Date.parse(
          seedTime(anchor, [day, `${rng.int(7, 20)}:${rng.int(0, 59)}`]),
        )
        while (usedTimes.has(time)) time += MINUTE
        usedTimes.add(time)
        const createdAt = new Date(time).toISOString()

        const mandate = activeMandate(mandates, agent.id, createdAt)
        if (!mandate) continue // before the agent's first mandate

        const vendors = mandate.rules.flatMap((r) =>
          r.kind === "vendor_allowlist" ? r.vendors : [],
        )
        const chains = mandate.rules.flatMap((r) =>
          r.kind === "chain" ? r.chains : [],
        )
        const otherChain: Chain = chains.includes("base") ? "solana" : "base"

        candidates.push({
          agentId: agent.id,
          vendor: rng.chance(0.08)
            ? rng.pick(UNLISTED_VENDORS)
            : rng.pick(vendors),
          amount: randomAmount(rng, config.amount),
          chain: rng.chance(0.05) ? otherChain : rng.pick(chains),
          createdAt,
          // Every filler review is resolved before the anchor day
          review: {
            result: rng.chance(0.8) ? "approved" : "rejected",
            by: rng.pick(REVIEWERS),
            afterMinutes: rng.int(10, 240),
            reason: rng.pick(REJECT_REASONS),
          },
        })
      }
    }
  }
  return candidates
}

function scriptedCandidates(
  anchor: string,
  usedTimes: Set<number>,
): Candidate[] {
  return SCRIPTED.map((scripted) => {
    const createdAt = seedTime(anchor, scripted.at)
    usedTimes.add(Date.parse(createdAt))
    return {
      agentId: scripted.agentId,
      vendor: scripted.vendor,
      amount: usdc(scripted.amount),
      chain: scripted.chain,
      createdAt,
      ...(scripted.memo && { memo: scripted.memo }),
      scripted,
      review: scripted.review,
    }
  })
}

/** Evaluates a new request against the mandate in force and the spend history. */
export function decide(
  request: PaymentRequest,
  mandates: Mandate[],
  history: { request: PaymentRequest; decision: Decision }[],
  decisionId: string,
): Decision {
  const mandate = activeMandate(mandates, request.agentId, request.createdAt)
  if (!mandate) {
    throw new Error(
      `No active mandate for ${request.agentId} at ${request.createdAt}`,
    )
  }
  const committed = committedSpend(history, request.agentId, request.createdAt)
  const { outcome, reasonCode, reason, matchedRule } = evaluate(
    request,
    mandate,
    committed,
  )
  const base = {
    id: decisionId,
    requestId: request.id,
    mandateId: mandate.id,
    mandateVersion: mandate.version,
    outcome,
    reasonCode,
    ...(matchedRule && { matchedRule }),
    decidedAt: request.createdAt,
  }
  return { ...base, reason, verdictJwt: unsignedVerdict(base, request) }
}

function paymentFor(
  decision: Decision,
  request: PaymentRequest,
  scripted: ScriptedRequest | undefined,
  id: string,
): Payment {
  const base = { id, decisionId: decision.id, chain: request.chain }

  if (decision.outcome === "deny" || decision.reviewResult === "rejected") {
    return { ...base, status: "rejected", simulated: true }
  }
  if (decision.outcome === "review" && !decision.reviewResult) {
    return { ...base, status: "pending_approval", simulated: true }
  }

  const option = scripted?.payment
  if (option && "slot" in option) {
    const slot: TxSlot = TX_SLOTS[option.slot]
    if (slot.chain !== request.chain) {
      throw new Error(
        `Slot ${option.slot} is on ${slot.chain}, request on ${request.chain}`,
      )
    }
    // Until phase 5 fills the hash, a slot payment is simulated like the rest
    return slot.txHash
      ? { ...base, status: "confirmed", txHash: slot.txHash, simulated: false }
      : { ...base, status: "confirmed", simulated: true }
  }
  return { ...base, status: option?.status ?? "confirmed", simulated: true }
}

/** Builds the whole seed. Same anchor in, same data out. */
export function generateSeed(anchor: string = DEFAULT_ANCHOR): Seed {
  const rng = createRng(SEED)
  const ids = createRng(SEED + 1)
  const mandates = buildMandates(anchor)

  const usedTimes = new Set<number>()
  const candidates = [
    ...scriptedCandidates(anchor, usedTimes),
    ...fillerCandidates(rng, anchor, mandates, usedTimes),
  ].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))

  const entries: SeedEntry[] = []
  for (const { scripted, review, ...fields } of candidates) {
    const request: PaymentRequest = { id: `req_${ids.hex(8)}`, ...fields }
    let decision = decide(request, mandates, entries, `dec_${ids.hex(8)}`)

    if (scripted && decision.reasonCode !== scripted.expect) {
      throw new Error(
        `Seed drift: ${scripted.agentId} ${scripted.amount} at ${request.createdAt} ` +
          `expected ${scripted.expect}, evaluator says ${decision.reasonCode}`,
      )
    }

    if (decision.outcome === "review" && review) {
      decision = {
        ...decision,
        reviewResult: review.result,
        reviewedBy: review.by,
        reviewedAt: new Date(
          Date.parse(request.createdAt) + review.afterMinutes * MINUTE,
        ).toISOString(),
        ...(review.result === "rejected" &&
          review.reason && { reviewReason: review.reason }),
      }
    }

    const payment = paymentFor(decision, request, scripted, `pay_${ids.hex(8)}`)
    entries.push({ request, decision, payment })
  }

  return { anchor, agents: AGENTS, mandates, entries }
}
