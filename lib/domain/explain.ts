import { chainName } from "@/lib/format/chain"
import { formatAmount } from "@/lib/format/amount"
import { formatDateUtc, formatTimeUtc } from "@/lib/format/date"

import type { HardFailure } from "./evaluate"
import { chainList, joinList } from "./rule-sentence"
import { utcDayKey } from "./spend"
import type { Committed, Decision, PaymentRequest } from "./types"

/**
 * The plain-language core of a hard-rule failure, without a leading capital or
 * full stop, so callers can prefix it ("Denied: …", "Approving would break …").
 */
export function failureClause(
  { rule }: HardFailure,
  request: PaymentRequest,
  committed: Committed,
): string {
  const amount = formatAmount(request.amount)

  switch (rule.kind) {
    case "chain":
      return rule.chains.length === 0
        ? `no chains are allowed`
        : `payments on ${chainName(request.chain)} aren't allowed (${chainList(rule.chains)} only)`
    case "vendor_allowlist":
      return rule.vendors.length === 0
        ? `the vendor allowlist is empty`
        : `${request.vendor} isn't on the vendor allowlist (${joinList(rule.vendors)})`
    case "limit": {
      const limit = formatAmount(rule.amount)
      if (rule.period === "tx") {
        return `the per-payment limit is ${limit} and this request is ${amount}`
      }
      const [word, spent] =
        rule.period === "day"
          ? ["daily", committed.day]
          : ["monthly", committed.month]
      const that = rule.period === "day" ? "that day" : "that month"
      return `the ${word} limit is ${limit}, ${formatAmount(spent)} was already committed ${that} and this request is ${amount}`
    }
    case "review_threshold":
      throw new Error("A review threshold is not a hard rule")
  }
}

/**
 * What happened in review, for the decision detail (design.md §6.2b), e.g.
 * "Approved by M. Ilić at 12:14 UTC." Undefined for allow and deny, which
 * never go to review. The date is added when the review was on a later day.
 */
export function reviewSentence(
  decision: Pick<
    Decision,
    | "outcome"
    | "reviewResult"
    | "reviewedBy"
    | "reviewedAt"
    | "reviewReason"
    | "decidedAt"
  >,
): string | undefined {
  if (decision.outcome !== "review") return undefined
  const { reviewResult, reviewedBy, reviewedAt, reviewReason } = decision
  if (!reviewResult) return "Waiting for a reviewer."

  const verb = reviewResult === "approved" ? "Approved" : "Rejected"
  const by = reviewedBy ? ` by ${reviewedBy}` : ""
  const when = reviewedAt
    ? utcDayKey(reviewedAt) === utcDayKey(decision.decidedAt)
      ? ` at ${formatTimeUtc(reviewedAt)}`
      : ` on ${formatDateUtc(reviewedAt)} at ${formatTimeUtc(reviewedAt)}`
    : ""
  const reason =
    reviewResult === "rejected" && reviewReason ? `: “${reviewReason}”` : "."
  return `${verb}${by}${when}${reason}`
}
