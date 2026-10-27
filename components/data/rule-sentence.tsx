import { ruleToSentence } from "@/lib/domain/rule-sentence"
import type { Rule } from "@/lib/domain/types"
import { formatAmount } from "@/lib/format/amount"

type RuleSentenceProps = {
  rule: Rule
  matched?: boolean
}

/** A rule as one sentence, with its key amount emphasised. */
export function RuleSentence({ rule, matched = false }: RuleSentenceProps) {
  const sentence = ruleToSentence(rule)
  const key =
    rule.kind === "limit" || rule.kind === "review_threshold"
      ? formatAmount(rule.amount)
      : undefined
  const [before, after] = key ? sentence.split(key) : [sentence]

  return (
    <span className={matched ? "font-semibold" : undefined}>
      {before}
      {key && <strong className="font-semibold tabular-nums">{key}</strong>}
      {after}
      {matched && (
        <span className="ml-2 text-xs font-medium text-muted-foreground">
          Matched rule
        </span>
      )}
    </span>
  )
}
