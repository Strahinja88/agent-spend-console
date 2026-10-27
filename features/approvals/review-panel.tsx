import { CircleAlert, CircleCheck } from "lucide-react"

import { Amount } from "@/components/data/amount"
import { RelativeTime } from "@/components/data/relative-time"
import { RuleSentence } from "@/components/data/rule-sentence"
import { SpendBar } from "@/components/data/spend-bar"
import type { QueueItem } from "@/lib/api/contract"
import { utcDayKey, utcMonthKey } from "@/lib/domain/spend"
import type { Rule, RuleOf } from "@/lib/domain/types"
import { chainName } from "@/lib/format/chain"

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
})
const monthFormat = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  timeZone: "UTC",
})

function limitFor(rules: Rule[], period: "day" | "month") {
  return rules.find(
    (rule): rule is RuleOf<"limit"> =>
      rule.kind === "limit" && rule.period === period,
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

/** The body of the side panel: what, why, how much is committed, under which mandate. */
export function ReviewPanelBody({
  item,
  now = new Date(),
}: {
  item: QueueItem
  now?: Date
}) {
  const { request, decision, mandate, committed, limitWarning } = item
  const dayLimit = limitFor(mandate.rules, "day")
  const monthLimit = limitFor(mandate.rules, "month")
  const nowIso = now.toISOString()
  const created = new Date(request.createdAt)

  return (
    <div className="flex flex-col gap-6 text-sm">
      <div className="flex flex-col gap-1">
        <p className="text-md font-semibold">
          <Amount value={request.amount} /> · {chainName(request.chain)}
        </p>
        <p className="text-muted-foreground">
          Requested <RelativeTime iso={request.createdAt} />
        </p>
        {request.memo && <p>Memo: “{request.memo}”</p>}
      </div>

      <Section title="Why it needs review">
        <ul className="flex flex-col gap-2">
          {decision.matchedRule && (
            <li className="flex gap-2">
              <CircleAlert
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-status-review-fg"
              />
              <RuleSentence rule={decision.matchedRule} matched />
            </li>
          )}
          <li className="flex gap-2">
            <CircleCheck
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-status-allow-fg"
            />
            <span>
              Within all limits of mandate v{mandate.version}, the one it was
              checked against.
            </span>
          </li>
        </ul>
        {!limitWarning.ok && (
          <div
            role="note"
            aria-label="Limit warning"
            className="flex gap-2 rounded-md border border-status-review-border bg-status-review-bg p-3 text-status-review-fg"
          >
            <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="font-semibold">Limit warning</p>
              <ul className="flex flex-col gap-1">
                {limitWarning.breaches.map((breach) => (
                  <li key={breach.code}>{breach.sentence}</li>
                ))}
              </ul>
              <p>Approving asks you to confirm.</p>
            </div>
          </div>
        )}
      </Section>

      {(dayLimit || monthLimit) && (
        <Section title="Committed spend">
          {dayLimit && (
            <SpendBar
              committed={committed.day}
              limit={dayLimit.amount}
              periodLabel={
                utcDayKey(request.createdAt) === utcDayKey(nowIso)
                  ? "today"
                  : `on ${dayFormat.format(created)}`
              }
              note="(including this request)"
            />
          )}
          {monthLimit && (
            <SpendBar
              committed={committed.month}
              limit={monthLimit.amount}
              periodLabel={
                utcMonthKey(request.createdAt) === utcMonthKey(nowIso)
                  ? "this month"
                  : `in ${monthFormat.format(created)}`
              }
              note="(including this request)"
            />
          )}
        </Section>
      )}

      <Section title="Mandate">
        <p>
          Mandate v{mandate.version} · approved by {mandate.approvedBy},{" "}
          {dayFormat.format(new Date(mandate.approvedAt))}
        </p>
        {mandate.revokedAt && (
          <p className="text-muted-foreground">
            {mandate.supersededBy ? "Replaced" : "Revoked"} on{" "}
            {dayFormat.format(new Date(mandate.revokedAt))}, after this request
            was made.
          </p>
        )}
      </Section>
    </div>
  )
}
