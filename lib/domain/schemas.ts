import { z } from "zod"

// Amounts travel over JSON as integer strings ("120000000") and are bigint
// in the app. One codec covers both directions: the mock API encodes,
// the client decodes (docs/decisions.md D-010).
export const bigintString = z.codec(z.string().regex(/^-?\d+$/), z.bigint(), {
  decode: (text) => BigInt(text),
  encode: (value) => value.toString(),
})

const isoDateTime = z.iso.datetime()

export const chainSchema = z.enum(["base", "solana"])

export const agentSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.string(),
})

export const ruleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("limit"),
    amount: bigintString,
    period: z.enum(["tx", "day", "month"]),
  }),
  z.object({
    kind: z.literal("vendor_allowlist"),
    vendors: z.array(z.string()),
  }),
  z.object({ kind: z.literal("review_threshold"), amount: bigintString }),
  z.object({ kind: z.literal("chain"), chains: z.array(chainSchema) }),
])

// Mandates are immutable: revoked and replaced, never edited.
export const mandateSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  version: z.number().int().positive(),
  rules: z.array(ruleSchema),
  approvedBy: z.string(),
  approvedAt: isoDateTime,
  revokedAt: isoDateTime.optional(),
  supersededBy: z.string().optional(),
})

export const paymentRequestSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  vendor: z.string(),
  amount: bigintString,
  chain: chainSchema,
  createdAt: isoDateTime,
  memo: z.string().optional(),
})

/** The final list of (invented) reason codes. Order matches docs/design.md §2.1. */
export const reasonCodeSchema = z.enum([
  "CHAIN_NOT_ALLOWED",
  "VENDOR_NOT_ALLOWED",
  "LIMIT_TX_EXCEEDED",
  "LIMIT_DAILY_EXCEEDED",
  "LIMIT_MONTHLY_EXCEEDED",
  "REVIEW_THRESHOLD",
  "WITHIN_LIMITS",
])

export const outcomeSchema = z.enum(["allow", "deny", "review"])

export const decisionSchema = z.object({
  id: z.string(),
  requestId: z.string(),
  mandateId: z.string(),
  mandateVersion: z.number().int().positive(),
  outcome: outcomeSchema,
  reasonCode: reasonCodeSchema,
  reason: z.string(),
  matchedRule: ruleSchema.optional(),
  verdictJwt: z.string(),
  decidedAt: isoDateTime,
  reviewedBy: z.string().optional(),
  reviewedAt: isoDateTime.optional(),
  // Not in PLAN.md §3: the result of a review and the reject reason
  // (docs/design.md §2.2, docs/decisions.md D-009)
  reviewResult: z.enum(["approved", "rejected"]).optional(),
  reviewReason: z.string().optional(),
})

export const paymentStatusSchema = z.enum([
  "pending_approval",
  "approved",
  "rejected",
  "submitted",
  "confirmed",
  "failed",
])

export const paymentSchema = z.object({
  id: z.string(),
  decisionId: z.string(),
  chain: chainSchema,
  txHash: z.string().optional(),
  status: paymentStatusSchema,
  // true = demo data with no onchain transaction behind it (D-009)
  simulated: z.boolean(),
  // Not in PLAN.md §3: when it was sent to the chain (D-019)
  submittedAt: isoDateTime.optional(),
})
