import type { Committed, Decision, HistoryEntry, Mandate } from "./types"

// Periods are UTC calendar days and months (docs/design.md §2.1).
export function utcDayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10)
}

export function utcMonthKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 7)
}

/** The agent's mandate in force at `at`: approved by then and not yet revoked. */
export function activeMandate(
  mandates: Mandate[],
  agentId: string,
  at: string,
): Mandate | undefined {
  const time = Date.parse(at)
  return mandates
    .filter(
      (m) =>
        m.agentId === agentId &&
        Date.parse(m.approvedAt) <= time &&
        (m.revokedAt === undefined || Date.parse(m.revokedAt) > time),
    )
    .sort((a, b) => b.version - a.version)[0]
}

/**
 * Whether a decision reserves its amount at time `asOf` (D-006): allowed,
 * approved after review, or still waiting. A rejection releases the amount
 * from the moment it was made.
 */
export function countsAsCommitted(decision: Decision, asOf: number): boolean {
  if (decision.outcome === "allow") return true
  if (decision.outcome === "deny") return false
  const rejected =
    decision.reviewResult === "rejected" &&
    decision.reviewedAt !== undefined &&
    Date.parse(decision.reviewedAt) <= asOf
  return !rejected
}

type SpendOptions = {
  /** Point in time to count from. Defaults to `period`. Only requests strictly before it count. */
  asOf?: string
  /** Leave one request out, e.g. the one being approved. */
  excludeRequestId?: string
}

/**
 * Spend committed by an agent in the UTC day and month that contain `period`.
 * For evaluation `period` is the request's createdAt and nothing else is
 * needed. The approval check passes `asOf: now` to see the current state.
 */
export function committedSpend(
  history: HistoryEntry[],
  agentId: string,
  period: string,
  { asOf = period, excludeRequestId }: SpendOptions = {},
): Committed {
  const day = utcDayKey(period)
  const month = utcMonthKey(period)
  const cutoff = Date.parse(asOf)
  const committed: Committed = { day: 0n, month: 0n }

  for (const { request, decision } of history) {
    if (request.agentId !== agentId || request.id === excludeRequestId) continue
    if (Date.parse(request.createdAt) >= cutoff) continue
    if (utcMonthKey(request.createdAt) !== month) continue
    if (!countsAsCommitted(decision, cutoff)) continue

    committed.month += request.amount
    if (utcDayKey(request.createdAt) === day) committed.day += request.amount
  }
  return committed
}
