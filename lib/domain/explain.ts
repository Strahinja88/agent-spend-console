import { chainName } from "@/lib/format/chain"
import { formatAmount } from "@/lib/format/amount"

import type { HardFailure } from "./evaluate"
import { chainList, joinList } from "./rule-sentence"
import type { Committed, PaymentRequest } from "./types"

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
