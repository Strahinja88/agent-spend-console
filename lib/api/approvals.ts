"use client"

import { useQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { fetchJson, postJson } from "./client"
import { approvalsResponse, reviewResponse, type QueueItem } from "./contract"
import { queryKeys } from "./query-keys"
import { pruneHidden, useHiddenDecisions } from "./review-overlay"

export const POLL_MS = 10_000

export async function fetchApprovals(): Promise<QueueItem[]> {
  const items = await fetchJson("/api/approvals", approvalsResponse)
  pruneHidden(items.map((item) => item.decision.id))
  return items
}

export function approveDecision(
  decisionId: string,
  acknowledgeLimitWarning = false,
) {
  return postJson(
    `/api/decisions/${encodeURIComponent(decisionId)}/approve`,
    acknowledgeLimitWarning ? { acknowledgeLimitWarning } : {},
    reviewResponse,
  )
}

export function rejectDecision(decisionId: string, reason: string) {
  return postJson(
    `/api/decisions/${encodeURIComponent(decisionId)}/reject`,
    { reason },
    reviewResponse,
  )
}

/**
 * Requests waiting for review. The queue and the sidebar count share this
 * query, so there is one request per poll. No polling while the tab is hidden.
 */
export function useApprovals() {
  return useQuery({
    queryKey: queryKeys.approvals(),
    queryFn: fetchApprovals,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  })
}

/** The approvals query with optimistically reviewed items left out. */
export function useVisibleApprovals() {
  const query = useApprovals()
  const hidden = useHiddenDecisions()
  const items = useMemo(
    () => query.data?.filter((item) => !hidden.has(item.decision.id)),
    [query.data, hidden],
  )
  return { query, items }
}

/** Number still waiting, or undefined while loading or after an error. */
export function useWaitingCount(): number | undefined {
  const { query, items } = useVisibleApprovals()
  return query.isError ? undefined : items?.length
}
