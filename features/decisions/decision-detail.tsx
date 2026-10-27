"use client"

import { SearchX } from "lucide-react"
import Link from "next/link"

import { EmptyState } from "@/components/data/empty-state"
import { ErrorState } from "@/components/data/error-state"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { isNotFound } from "@/lib/api/client"
import { useDecision } from "@/lib/api/decisions"

import { DecisionHeader } from "./decision-header"
import { ExplanationCard } from "./explanation-card"
import { MandateCard } from "./mandate-card"
import { VerdictPanel } from "./verdict-panel"

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-5/6" />
      <Skeleton className="h-3.5 w-2/3" />
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div aria-busy className="flex flex-col gap-6">
      <span className="sr-only">Loading decision</span>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <CardSkeleton />
      <div className="grid gap-6 md:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  )
}

export function DecisionDetail({ id }: { id: string }) {
  const query = useDecision(id)

  // A failed background refetch keeps the decision on screen
  if (!query.data) {
    if (!query.isError) return <DetailSkeleton />
    return isNotFound(query.error) ? (
      <EmptyState
        icon={SearchX}
        title="Decision not found"
        description="There's no decision with this id. The link may be wrong, or the demo data was reset."
        action={
          <Button variant="outline" asChild>
            <Link href="/decisions">Back to decisions</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState
        title="Couldn't load this decision"
        description="The request didn't go through."
        onRetry={() => void query.refetch()}
      />
    )
  }

  const detail = query.data
  return (
    <div className="flex flex-col gap-6">
      <DecisionHeader detail={detail} />
      <ExplanationCard decision={detail.decision} />
      {/* Explain, then prove (design.md §1): mandate and verdict side by side */}
      <div className="grid items-start gap-6 md:grid-cols-2">
        <MandateCard detail={detail} />
        {/* Keyed, so tamper state never carries over to another decision */}
        <VerdictPanel
          key={detail.decision.id}
          jwt={detail.decision.verdictJwt}
        />
      </div>
    </div>
  )
}
