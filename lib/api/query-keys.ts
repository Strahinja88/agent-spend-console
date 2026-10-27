import type { Outcome } from "@/lib/domain/types"

// One place for query keys, so every screen that reads the same data shares
// one cache entry (and one poll).

export type DecisionFilters = { outcome?: Outcome; agentId?: string }

export const queryKeys = {
  approvals: () => ["approvals"] as const,
  agents: () => ["agents"] as const,
  /** Prefix of every decisions list, for invalidation. */
  decisionLists: () => ["decisions"] as const,
  decisions: (filters: DecisionFilters) => ["decisions", filters] as const,
  /** Prefix of every decision detail, for invalidation. */
  decisionDetails: () => ["decision"] as const,
  decision: (id: string) => ["decision", id] as const,
  jwks: () => ["jwks"] as const,
}
