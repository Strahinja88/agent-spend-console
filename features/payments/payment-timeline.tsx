"use client"

import { ChevronLeft, ChevronRight, SearchX } from "lucide-react"
import Link from "next/link"

import { Address } from "@/components/data/address"
import { EmptyState } from "@/components/data/empty-state"
import { ErrorState } from "@/components/data/error-state"
import { RelativeTime } from "@/components/data/relative-time"
import { StatusPill } from "@/components/data/status-pill"
import { Timeline, type TimelineStepData } from "@/components/data/timeline"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isNotFound } from "@/lib/api/client"
import type { PaymentDetail } from "@/lib/api/contract"
import { useOnchainTx, usePayment } from "@/lib/api/payments"
import { explorerTxUrl } from "@/lib/chain/config"

import { OnchainCard } from "./onchain-card"
import {
  onchainView,
  paymentSummary,
  timelineSteps,
  type OnchainView,
  type StepModel,
} from "./timeline-steps"

function TimelineSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <span className="sr-only">Loading payment</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-4 md:p-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-5 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3.5 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const linkClass =
  "inline-flex w-fit items-center gap-0.5 text-brand underline-offset-4 hover:underline"

function StepBody({
  step,
  detail,
  onchain,
  retry,
}: {
  step: StepModel
  detail: PaymentDetail
  onchain: OnchainView
  retry: { onRetry: () => void; retrying: boolean }
}) {
  const { payment, decision } = detail
  const text = <p>{step.text}</p>

  switch (step.key) {
    case "decision":
      return (
        <div className="flex flex-col gap-1">
          {text}
          <Link
            href={`/decisions/${encodeURIComponent(decision.id)}`}
            className={linkClass}
          >
            View decision
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
      )
    case "approved":
      return step.status === "current" ? (
        <div className="flex flex-col gap-1">
          {text}
          <Link href="/approvals" className={linkClass}>
            Review in queue
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </div>
      ) : (
        text
      )
    case "submitted":
      return step.status === "done" && !payment.simulated && payment.txHash ? (
        <div className="flex flex-col gap-1">
          {text}
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground">Transaction</span>
            <Address
              value={payment.txHash}
              kind="transaction hash"
              explorerHref={explorerTxUrl(payment.chain, payment.txHash)}
            />
          </span>
        </div>
      ) : (
        text
      )
    case "confirmed":
      return step.status !== "not_reached" && onchain.kind !== "simulated" ? (
        <div className="flex flex-col gap-2">
          {text}
          <OnchainCard detail={detail} onchain={onchain} {...retry} />
        </div>
      ) : (
        text
      )
    default:
      return text
  }
}

function PaymentView({ detail }: { detail: PaymentDetail }) {
  const { payment, decision } = detail
  const tx = useOnchainTx(payment)
  const onchain = onchainView(detail, tx)
  const summary = paymentSummary(detail, onchain)
  const retry = {
    onRetry: () => void tx.refetch(),
    retrying: tx.isFetching,
  }

  const steps: TimelineStepData[] = timelineSteps(detail, onchain).map(
    (step) => ({
      ...step,
      children: (
        <StepBody step={step} detail={detail} onchain={onchain} retry={retry} />
      ),
    }),
  )

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Link
          href={`/decisions/${encodeURIComponent(decision.id)}`}
          className="inline-flex w-fit items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Decision
        </Link>
        <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-lg font-semibold">
          Payment <span className="font-mono text-base">{payment.id}</span>
          <StatusPill
            status={summary.status}
            label={summary.label}
            className="text-sm"
          />
        </h1>
        <p className="text-muted-foreground">
          {/* Announced when the chain answers or the state changes. The
              relative time stays outside, or every minute would be read out. */}
          <span aria-live="polite">{summary.sentence}</span>
          {summary.time && (
            <>
              {" · "}
              <RelativeTime iso={summary.time} />
            </>
          )}
        </p>
      </header>

      <section
        aria-label="Timeline"
        className="rounded-lg border border-border bg-surface p-4 md:p-5"
      >
        <Timeline steps={steps} label="Payment steps" />
      </section>
    </div>
  )
}

/** `/payments/[id]`: from request to onchain confirmation (design.md §6.3). */
export function PaymentTimeline({ id }: { id: string }) {
  const query = usePayment(id)

  // A failed background refetch keeps the payment on screen
  if (!query.data) {
    if (!query.isError) return <TimelineSkeleton />
    return isNotFound(query.error) ? (
      <EmptyState
        icon={SearchX}
        title="Payment not found"
        description="There's no payment with this id. The link may be wrong, or the demo data was reset."
        action={
          <Button variant="outline" asChild>
            <Link href="/decisions">Back to decisions</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState
        title="Couldn't load this payment"
        description="The request didn't go through."
        onRetry={() => void query.refetch()}
      />
    )
  }

  return <PaymentView detail={query.data} />
}
