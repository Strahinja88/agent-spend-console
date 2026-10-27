import type { Chain, Outcome } from "@/lib/domain/types"

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
  /** Prefix of every payment detail, for invalidation. */
  payments: () => ["payment"] as const,
  payment: (id: string) => ["payment", id] as const,
  /** Onchain reads, keyed by what they read, not by payment (D-020). */
  onchainTx: (chain: Chain, hash: string) =>
    ["chain", chain, "tx", hash] as const,
  baseBlockNumber: () => ["chain", "base", "blockNumber"] as const,
}
