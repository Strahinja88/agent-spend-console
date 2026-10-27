import { formatAmount } from "@/lib/format/amount"

import { failureClause } from "./explain"
import type {
  Committed,
  Mandate,
  Outcome,
  PaymentRequest,
  ReasonCode,
  Rule,
  RuleOf,
} from "./types"

export type HardFailure = { reasonCode: ReasonCode; rule: Rule }

export type Evaluation = {
  outcome: Outcome
  reasonCode: ReasonCode
  reason: string
  matchedRule?: Rule
}

type HardCheck = {
  reasonCode: ReasonCode
  fails: (rule: Rule, request: PaymentRequest, committed: Committed) => boolean
}

// Fixed order from docs/design.md §2.1: the first failure gives the reason code.
// Limits are inclusive, so only "greater than" fails.
const HARD_CHECKS: HardCheck[] = [
  {
    reasonCode: "CHAIN_NOT_ALLOWED",
    fails: (rule, request) =>
      rule.kind === "chain" && !rule.chains.includes(request.chain),
  },
  {
    reasonCode: "VENDOR_NOT_ALLOWED",
    fails: (rule, request) =>
      rule.kind === "vendor_allowlist" &&
      !rule.vendors.includes(request.vendor),
  },
  {
    reasonCode: "LIMIT_TX_EXCEEDED",
    fails: (rule, request) =>
      rule.kind === "limit" &&
      rule.period === "tx" &&
      request.amount > rule.amount,
  },
  {
    reasonCode: "LIMIT_DAILY_EXCEEDED",
    fails: (rule, request, committed) =>
      rule.kind === "limit" &&
      rule.period === "day" &&
      committed.day + request.amount > rule.amount,
  },
  {
    reasonCode: "LIMIT_MONTHLY_EXCEEDED",
    fails: (rule, request, committed) =>
      rule.kind === "limit" &&
      rule.period === "month" &&
      committed.month + request.amount > rule.amount,
  },
]

/** Every hard rule the request breaks, in evaluation order. */
export function hardRuleFailures(
  request: PaymentRequest,
  mandate: Mandate,
  committed: Committed,
): HardFailure[] {
  return HARD_CHECKS.flatMap((check) =>
    mandate.rules
      .filter((rule) => check.fails(rule, request, committed))
      .map((rule) => ({ reasonCode: check.reasonCode, rule })),
  )
}

function reviewThreshold(mandate: Mandate) {
  return mandate.rules.find(
    (rule): rule is RuleOf<"review_threshold"> =>
      rule.kind === "review_threshold",
  )
}

/**
 * deny > review > allow (docs/design.md §2.1). Pure: `committed` is the spend
 * already committed in the request's UTC day and month, without this request.
 * A rule kind missing from the mandate doesn't constrain anything.
 */
export function evaluate(
  request: PaymentRequest,
  mandate: Mandate,
  committed: Committed,
): Evaluation {
  const amount = formatAmount(request.amount)
  const threshold = reviewThreshold(mandate)
  const aboveThreshold =
    threshold !== undefined && request.amount > threshold.amount

  const [failure] = hardRuleFailures(request, mandate, committed)
  if (failure) {
    const note = aboveThreshold
      ? ` It's also above the ${formatAmount(threshold.amount)} review threshold, but a hard rule failed, so it was denied rather than sent to review.`
      : ""
    return {
      outcome: "deny",
      reasonCode: failure.reasonCode,
      reason: `Denied: ${failureClause(failure, request, committed)}.${note}`,
      matchedRule: failure.rule,
    }
  }

  if (aboveThreshold) {
    return {
      outcome: "review",
      reasonCode: "REVIEW_THRESHOLD",
      reason: `Sent to review: ${amount} is above the ${formatAmount(threshold.amount)} review threshold and within all limits.`,
      matchedRule: threshold,
    }
  }

  return {
    outcome: "allow",
    reasonCode: "WITHIN_LIMITS",
    reason: threshold
      ? `Allowed: ${amount} is within all limits and not above the ${formatAmount(threshold.amount)} review threshold.`
      : `Allowed: ${amount} is within all limits.`,
  }
}
