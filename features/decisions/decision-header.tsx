import { ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"

import { Amount } from "@/components/data/amount"
import { RelativeTime } from "@/components/data/relative-time"
import { StatusPill } from "@/components/data/status-pill"
import { Button } from "@/components/ui/button"
import type { DecisionDetail } from "@/lib/api/contract"
import { displayState, isWaitingForReview } from "@/lib/domain/display-state"
import { chainName } from "@/lib/format/chain"
import { formatDateTimeUtc } from "@/lib/format/date"

/** Outcome, amount, who paid whom and when, and where to go next (design.md §6.2b). */
export function DecisionHeader({ detail }: { detail: DecisionDetail }) {
  const { decision, request, agent, payment } = detail
  const state = displayState(decision)

  return (
    <header className="flex flex-col gap-3">
      <Link
        href="/decisions"
        className="inline-flex w-fit items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-4" />
        Decisions
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusPill
              status={state.status}
              label={state.label}
              className="text-sm"
            />
            <Amount value={request.amount} className="text-xl font-semibold" />
          </h1>
          <p className="text-muted-foreground">
            {agent.name} → {request.vendor} · {chainName(request.chain)} ·{" "}
            <time dateTime={request.createdAt}>
              {formatDateTimeUtc(request.createdAt)}
            </time>{" "}
            (<RelativeTime iso={request.createdAt} />)
          </p>
          {request.memo && <p>Memo: “{request.memo}”</p>}
        </div>

        {isWaitingForReview(decision) ? (
          <Button variant="outline" asChild>
            <Link href="/approvals">
              Review in queue
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" asChild>
            <Link href={`/payments/${encodeURIComponent(payment.id)}`}>
              View payment
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        )}
      </div>
    </header>
  )
}
