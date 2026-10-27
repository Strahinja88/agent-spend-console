// Small builders shared by the lib/domain tests.
import { usdc } from "@/lib/format/amount"

import type { Decision, Mandate, PaymentRequest } from "./types"

/** Ops Agent v2 from docs/design.md §2.3. */
export function opsMandateV2(overrides: Partial<Mandate> = {}): Mandate {
  return {
    id: "man_ops_2",
    agentId: "agt_ops",
    version: 2,
    approvedBy: "M. Ilić",
    approvedAt: "2026-10-12T09:00:00.000Z",
    rules: [
      { kind: "limit", amount: usdc("200"), period: "tx" },
      { kind: "limit", amount: usdc("500"), period: "day" },
      { kind: "vendor_allowlist", vendors: ["Weather API", "Cloud GPU"] },
      { kind: "review_threshold", amount: usdc("100") },
      { kind: "chain", chains: ["base", "solana"] },
    ],
    ...overrides,
  }
}

export function request(
  overrides: Partial<PaymentRequest> = {},
): PaymentRequest {
  return {
    id: "req_1",
    agentId: "agt_ops",
    vendor: "Cloud GPU",
    amount: usdc("50"),
    chain: "base",
    createdAt: "2026-10-18T14:02:00.000Z",
    ...overrides,
  }
}

export function decision(overrides: Partial<Decision> = {}): Decision {
  return {
    id: "dec_1",
    requestId: "req_1",
    mandateId: "man_ops_2",
    mandateVersion: 2,
    outcome: "allow",
    reasonCode: "WITHIN_LIMITS",
    reason: "",
    verdictJwt: "",
    decidedAt: "2026-10-18T14:02:00.000Z",
    ...overrides,
  }
}

export const nothingCommitted = { day: 0n, month: 0n }
