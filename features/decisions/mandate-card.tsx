import { ChevronRight, Info } from "lucide-react"

import { RuleSentence } from "@/components/data/rule-sentence"
import type { DecisionDetail } from "@/lib/api/contract"
import { isSameRule } from "@/lib/domain/rule-sentence"
import { formatDateUtc } from "@/lib/format/date"

import { Card } from "./card"

function replacedNote({ mandate, replacedBy }: DecisionDetail) {
  if (replacedBy) {
    return `Replaced by v${replacedBy.version} on ${formatDateUtc(replacedBy.approvedAt)}`
  }
  if (mandate.revokedAt) return `Revoked on ${formatDateUtc(mandate.revokedAt)}`
  return undefined
}

/** The mandate the request was checked against, rules as sentences, matched rule marked. */
export function MandateCard({ detail }: { detail: DecisionDetail }) {
  const { mandate, decision } = detail
  const note = replacedNote(detail)
  const { matchedRule } = decision

  return (
    <Card title={`Mandate v${mandate.version}`}>
      {note && (
        <p className="flex items-center gap-2 text-muted-foreground">
          <Info aria-hidden className="size-4 shrink-0" />
          {note}
        </p>
      )}
      <p className="text-muted-foreground">
        Approved by {mandate.approvedBy} · {formatDateUtc(mandate.approvedAt)}
      </p>

      <ul className="flex flex-col gap-2">
        {mandate.rules.map((rule, index) => {
          const matched =
            matchedRule !== undefined && isSameRule(rule, matchedRule)
          return (
            <li key={index} className="flex gap-2">
              {/* ▸ for the matched rule, a plain bullet otherwise */}
              {matched ? (
                <ChevronRight
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-foreground"
                />
              ) : (
                <span aria-hidden className="w-4 shrink-0 text-center">
                  •
                </span>
              )}
              <RuleSentence rule={rule} matched={matched} />
            </li>
          )
        })}
      </ul>
      {!matchedRule && (
        <p className="text-muted-foreground">
          No rule was triggered: the request was within every limit.
        </p>
      )}
    </Card>
  )
}
