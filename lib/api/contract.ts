import { z } from "zod"

import {
  agentSchema,
  bigintString,
  decisionSchema,
  mandateSchema,
  outcomeSchema,
  paymentRequestSchema,
  paymentSchema,
  reasonCodeSchema,
} from "@/lib/domain/schemas"

// One schema per endpoint, shared by the mock API (encode) and the client
// (decode), so both sides agree on the wire format. Amounts are strings on
// the wire and bigint in the app (D-010).

export const committedSchema = z.object({
  day: bigintString,
  month: bigintString,
})

export const approvalCheckSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true) }),
  z.object({
    ok: z.literal(false),
    breaches: z.array(
      z.object({
        code: z.union([reasonCodeSchema, z.literal("NO_ACTIVE_MANDATE")]),
        sentence: z.string(),
      }),
    ),
  }),
])

/** GET /api/agents */
export const agentsResponse = z.array(agentSchema)

/** GET /api/mandates?agentId= */
export const mandatesResponse = z.array(mandateSchema)

/** GET /api/approvals: requests waiting for review, oldest first. */
export const queueItemSchema = z.object({
  decision: decisionSchema,
  request: paymentRequestSchema,
  agent: agentSchema,
  /** The mandate the request was evaluated under. */
  mandate: mandateSchema,
  /** Spend committed now in the request's UTC day and month, including this request (D-006). */
  committed: committedSchema,
  /** Result of re-checking against the agent's current mandate (D-007). */
  limitWarning: approvalCheckSchema,
})
export const approvalsResponse = z.array(queueItemSchema)

/** GET /api/decisions?outcome=&agentId=: newest first. */
export const decisionsQuery = z.object({
  outcome: outcomeSchema.optional(),
  agentId: z.string().optional(),
})
export const decisionListItemSchema = z.object({
  decision: decisionSchema,
  request: paymentRequestSchema,
  agent: agentSchema,
})
export const decisionsResponse = z.array(decisionListItemSchema)

/** GET /api/decisions/:id */
export const decisionDetailResponse = z.object({
  decision: decisionSchema,
  request: paymentRequestSchema,
  agent: agentSchema,
  /** The mandate the request was evaluated under. */
  mandate: mandateSchema,
  /** The mandate that replaced it, if it has been replaced since. */
  replacedBy: mandateSchema.optional(),
  payment: paymentSchema,
})

/**
 * A public EC P-256 key. Zod drops unknown fields, so a private `d` can never
 * pass through this schema.
 */
export const jwkSchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string(),
  y: z.string(),
  kid: z.string(),
  alg: z.literal("ES256"),
  use: z.literal("sig"),
})

/** GET /api/jwks: the keys verdicts are signed with (D-015). */
export const jwksResponse = z.object({ keys: z.array(jwkSchema) })

/** GET /api/payments/:id */
export const paymentDetailResponse = z.object({
  payment: paymentSchema,
  decision: decisionSchema,
  request: paymentRequestSchema,
  agent: agentSchema,
  /** Known wallet names by `addressKey`, for the onchain card (D-019). */
  addressLabels: z.record(z.string(), z.string()),
})

/** POST /api/decisions/:id/approve */
export const approveBody = z.object({
  /** Required to approve when `limitWarning` is not ok; otherwise 409 LIMIT_WARNING. */
  acknowledgeLimitWarning: z.boolean().optional(),
})

/** POST /api/decisions/:id/reject */
export const rejectBody = z.object({
  reason: z.string().trim().min(1, "A reason is required to reject"),
})

/** Response of both review mutations. */
export const reviewResponse = z.object({
  decision: decisionSchema,
  payment: paymentSchema,
})

export const apiErrorCodeSchema = z.enum([
  "NOT_FOUND",
  "INVALID_REQUEST",
  "NOT_WAITING",
  "LIMIT_WARNING",
  "SIMULATED_FAILURE",
])

export const errorBody = z.object({
  code: apiErrorCodeSchema,
  message: z.string(),
})

export type QueueItem = z.output<typeof queueItemSchema>
export type DecisionListItem = z.output<typeof decisionListItemSchema>
export type DecisionDetail = z.output<typeof decisionDetailResponse>
export type PaymentDetail = z.output<typeof paymentDetailResponse>
export type Jwk = z.output<typeof jwkSchema>
export type Jwks = z.output<typeof jwksResponse>
export type ApiErrorCode = z.output<typeof apiErrorCodeSchema>
