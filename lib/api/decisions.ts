"use client"

import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { useApiReady } from "./api-ready"
import { fetchJson } from "./client"
import {
  agentsResponse,
  decisionDetailResponse,
  decisionsResponse,
  jwksResponse,
} from "./contract"
import { queryKeys, type DecisionFilters } from "./query-keys"

function decisionsPath({ outcome, agentId }: DecisionFilters): string {
  const params = new URLSearchParams()
  if (outcome) params.set("outcome", outcome)
  if (agentId) params.set("agentId", agentId)
  const query = params.toString()
  return query ? `/api/decisions?${query}` : "/api/decisions"
}

/**
 * Decisions, newest first, filtered on the server. The previous result stays
 * on screen while a new filter loads, so switching filters doesn't flash
 * skeletons.
 */
export function useDecisions(filters: DecisionFilters) {
  const ready = useApiReady()
  return useQuery({
    queryKey: queryKeys.decisions(filters),
    queryFn: () => fetchJson(decisionsPath(filters), decisionsResponse),
    enabled: ready,
    placeholderData: keepPreviousData,
  })
}

export function useDecision(id: string) {
  const ready = useApiReady()
  return useQuery({
    queryKey: queryKeys.decision(id),
    queryFn: () =>
      fetchJson(
        `/api/decisions/${encodeURIComponent(id)}`,
        decisionDetailResponse,
      ),
    enabled: ready,
  })
}

export function useAgents() {
  const ready = useApiReady()
  return useQuery({
    queryKey: queryKeys.agents(),
    queryFn: () => fetchJson("/api/agents", agentsResponse),
    enabled: ready,
    staleTime: Infinity,
  })
}

/** The verdict signing keys. They only change on a page load (D-015). */
export function useJwks() {
  const ready = useApiReady()
  return useQuery({
    queryKey: queryKeys.jwks(),
    queryFn: () => fetchJson("/api/jwks", jwksResponse),
    enabled: ready,
    staleTime: Infinity,
  })
}
