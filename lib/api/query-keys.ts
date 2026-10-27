// One place for query keys, so every screen that reads the same data shares
// one cache entry (and one poll).

export const queryKeys = {
  approvals: () => ["approvals"] as const,
}
