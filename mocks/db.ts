import {
  checkApprovalAt,
  type ApprovalCheck,
} from "@/lib/domain/approval-check"
import { isWaitingForReview } from "@/lib/domain/display-state"
import { committedSpend } from "@/lib/domain/spend"
import type {
  Agent,
  Committed,
  Decision,
  Mandate,
  Payment,
  PaymentRequest,
} from "@/lib/domain/types"
import { usdc } from "@/lib/format/amount"

import { mockConfig } from "./config"
import { HELD_BACK, type HeldBackRequest } from "./seed/fixtures"
import {
  decide,
  generateSeed,
  seedAnchor,
  type SeedEntry,
} from "./seed/generate"

// In-memory state behind the mock API. Lives in the page, so a reload starts
// over from the seed. Approve/reject change it; nothing else does, apart from
// the held-back requests that arrive a little after start.

export const DEMO_REVIEWER = "Demo reviewer"

type MockDb = {
  agents: Agent[]
  mandates: Mandate[]
  entries: SeedEntry[]
  startedAt: number
  heldBack: HeldBackRequest[]
  nextId: number
}

let db: MockDb | undefined

function createDb(): MockDb {
  const now = mockConfig.now()
  const seed = generateSeed(seedAnchor(new Date(now)))
  return {
    agents: seed.agents,
    mandates: seed.mandates,
    entries: [...seed.entries],
    startedAt: now,
    heldBack: [...HELD_BACK],
    nextId: 1,
  }
}

/** Adds held-back requests whose time has come, evaluated like any other request. */
function releaseHeldBack(state: MockDb) {
  const due = state.heldBack.filter(
    (h) => state.startedAt + h.afterSeconds * 1000 <= mockConfig.now(),
  )
  for (const held of due) {
    const n = state.nextId++
    const request: PaymentRequest = {
      id: `req_new${n}`,
      agentId: held.agentId,
      vendor: held.vendor,
      amount: usdc(held.amount),
      chain: held.chain,
      createdAt: new Date(
        state.startedAt + held.afterSeconds * 1000,
      ).toISOString(),
      ...(held.memo && { memo: held.memo }),
    }
    const decision = decide(
      request,
      state.mandates,
      state.entries,
      `dec_new${n}`,
    )
    state.entries.push({
      request,
      decision,
      payment: {
        id: `pay_new${n}`,
        decisionId: decision.id,
        chain: request.chain,
        status:
          decision.outcome === "review" ? "pending_approval" : "confirmed",
        simulated: true,
      },
    })
  }
  state.heldBack = state.heldBack.filter((h) => !due.includes(h))
}

export function getDb(): MockDb {
  db ??= createDb()
  releaseHeldBack(db)
  return db
}

/** Back to a fresh seed (tests, or a "reset demo" action later). */
export function resetDb() {
  db = undefined
}

export function nowIso(): string {
  return new Date(mockConfig.now()).toISOString()
}

export function findAgent(state: MockDb, id: string): Agent {
  const agent = state.agents.find((a) => a.id === id)
  if (!agent) throw new Error(`Unknown agent ${id}`)
  return agent
}

export function findMandate(state: MockDb, id: string): Mandate {
  const mandate = state.mandates.find((m) => m.id === id)
  if (!mandate) throw new Error(`Unknown mandate ${id}`)
  return mandate
}

export function findByDecision(state: MockDb, decisionId: string) {
  return state.entries.find((e) => e.decision.id === decisionId)
}

export function findByPayment(state: MockDb, paymentId: string) {
  return state.entries.find((e) => e.payment.id === paymentId)
}

export function waitingEntries(state: MockDb): SeedEntry[] {
  return state.entries.filter((e) => isWaitingForReview(e.decision))
}

/** Spend committed now in the request's day and month, including the request itself. */
export function committedNow(
  state: MockDb,
  request: PaymentRequest,
): Committed {
  return committedSpend(state.entries, request.agentId, request.createdAt, {
    asOf: nowIso(),
  })
}

export function approvalCheck(
  state: MockDb,
  request: PaymentRequest,
): ApprovalCheck {
  return checkApprovalAt(request, state.entries, state.mandates, nowIso())
}

/** Records a review result on a waiting decision and moves its payment on. */
export function recordReview(
  state: MockDb,
  entry: SeedEntry,
  result: "approved" | "rejected",
  reason?: string,
): { decision: Decision; payment: Payment } {
  const decision: Decision = {
    ...entry.decision,
    reviewResult: result,
    reviewedBy: DEMO_REVIEWER,
    reviewedAt: nowIso(),
    ...(reason && { reviewReason: reason }),
  }
  const payment: Payment = {
    ...entry.payment,
    status: result === "approved" ? "approved" : "rejected",
  }
  const index = state.entries.indexOf(entry)
  state.entries[index] = { ...entry, decision, payment }
  return { decision, payment }
}
