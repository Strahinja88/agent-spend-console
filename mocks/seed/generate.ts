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
import { addressKey } from "@/lib/format/address"
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
  /** Wallet names for the real testnet transfers, by `addressKey` (D-019). */
  addressLabels: Record<string, string>
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
  return {
    id: decisionId,
    requestId: request.id,
    mandateId: mandate.id,
    mandateVersion: mandate.version,
    outcome,
    reasonCode,
    reason,
    ...(matchedRule && { matchedRule }),
    // Signing is async (WebCrypto), so the mock db signs it (mocks/db.ts)
    verdictJwt: "",
    decidedAt: request.createdAt,
  }
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

  // Sent a minute after it was approved (by the rules or by a reviewer)
  const approvedAt = decision.reviewedAt ?? decision.decidedAt
  const sent = {
    ...base,
    submittedAt: new Date(Date.parse(approvedAt) + MINUTE).toISOString(),
  }

  const key = scripted?.payment?.slot
  if (!key) return { ...sent, status: "confirmed", simulated: true }

  const slot: TxSlot = TX_SLOTS[key]
  if (slot.chain !== request.chain) {
    throw new Error(
      `Slot ${key} is on ${slot.chain}, request on ${request.chain}`,
    )
  }
  // The status the mock reports; the page reads the real one from the chain
  const status = SLOT_STATUS[slot.kind]
  // Without a hash, a slot payment is simulated like the rest
  return slot.txHash
    ? { ...sent, status, txHash: slot.txHash, simulated: false }
    : { ...sent, status, simulated: true }
}

const SLOT_STATUS = {
  transfer: "confirmed",
  failed: "failed",
  missing: "submitted",
} as const satisfies Record<TxSlot["kind"], Payment["status"]>

/**
 * Names for the wallets in real transfers, so the timeline can say "Weather
 * API wallet" (D-019). Keys are normalised (`addressKey`).
 */
function addressLabels(
  entries: SeedEntry[],
  scripted: Map<string, ScriptedRequest>,
) {
  const labels: Record<string, string> = {}
  for (const { request } of entries) {
    const key = scripted.get(request.id)?.payment?.slot
    const slot = key && TX_SLOTS[key]
    if (!slot || slot.kind !== "transfer" || !slot.txHash) continue
    const agent = AGENTS.find((a) => a.id === request.agentId)
    if (agent) labels[addressKey(slot.from)] = `${agent.name} wallet`
    labels[addressKey(slot.to)] = `${request.vendor} wallet`
  }
  return labels
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
  const scriptedById = new Map<string, ScriptedRequest>()
  for (const { scripted, review, ...fields } of candidates) {
    const request: PaymentRequest = { id: `req_${ids.hex(8)}`, ...fields }
    if (scripted) scriptedById.set(request.id, scripted)
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

  return {
    anchor,
    agents: AGENTS,
    mandates,
    entries,
    addressLabels: addressLabels(entries, scriptedById),
  }
}
