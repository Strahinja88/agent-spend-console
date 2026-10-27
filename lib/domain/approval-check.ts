import { hardRuleFailures } from "./evaluate"
import { failureClause } from "./explain"
import { activeMandate, committedSpend } from "./spend"
import type {
  Committed,
  HistoryEntry,
  Mandate,
  PaymentRequest,
  ReasonCode,
} from "./types"

export type ApprovalWarningCode = ReasonCode | "NO_ACTIVE_MANDATE"

export type ApprovalCheck =
  | { ok: true }
  | { ok: false; breaches: { code: ApprovalWarningCode; sentence: string }[] }

/**
 * Re-checks a waiting request against the agent's *current* mandate before it
 * is approved (D-007). Committed spend reserves waiting requests (D-006), so
 * the mandate the request was evaluated under can't be broken by approving.
 * But that mandate may since have been replaced with lower limits, or revoked.
 *
 * `committed` must leave the request itself out.
 */
export function checkApproval(
  request: PaymentRequest,
  currentMandate: Mandate | undefined,
  committed: Committed,
): ApprovalCheck {
  if (!currentMandate) {
    return {
      ok: false,
      breaches: [
        {
          code: "NO_ACTIVE_MANDATE",
          sentence:
            "The agent's mandate has been revoked and nothing has replaced it, so no mandate covers this payment.",
        },
      ],
    }
  }

  const failures = hardRuleFailures(request, currentMandate, committed)
  if (failures.length === 0) return { ok: true }

  return {
    ok: false,
    breaches: failures.map((failure) => ({
      code: failure.reasonCode,
      sentence: `Approving would break the current mandate (v${currentMandate.version}): ${failureClause(failure, request, committed)}.`,
    })),
  }
}

/** checkApproval with the current mandate and spend looked up from history. */
export function checkApprovalAt(
  request: PaymentRequest,
  history: HistoryEntry[],
  mandates: Mandate[],
  now: string,
): ApprovalCheck {
  return checkApproval(
    request,
    activeMandate(mandates, request.agentId, now),
    committedSpend(history, request.agentId, request.createdAt, {
      asOf: now,
      excludeRequestId: request.id,
    }),
  )
}
