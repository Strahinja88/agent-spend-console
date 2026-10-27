import { z } from "zod"

import {
  chainSchema,
  outcomeSchema,
  reasonCodeSchema,
} from "@/lib/domain/schemas"
import type { Decision, PaymentRequest } from "@/lib/domain/types"

// A verdict is the rule decision, signed when it's made. The review result is
// a later human action and isn't part of it (D-016).

export const VERDICT_ALG = "ES256"
export const VERDICT_ISSUER = "agent-spend-console/demo"

export const verdictPayloadSchema = z.object({
  iss: z.literal(VERDICT_ISSUER),
  iat: z.number().int(),
  decisionId: z.string(),
  requestId: z.string(),
  agentId: z.string(),
  vendor: z.string(),
  /** Minor units as a string, like on the wire (D-010). */
  amount: z.string().regex(/^\d+$/),
  chain: chainSchema,
  mandateId: z.string(),
  mandateVersion: z.number().int().positive(),
  outcome: outcomeSchema,
  reasonCode: reasonCodeSchema,
})

export type VerdictPayload = z.output<typeof verdictPayloadSchema>

/** The claims signed for a decision. `iss` and `iat` are set by the signer. */
export type VerdictClaims = Omit<VerdictPayload, "iss" | "iat">

export function verdictClaims(
  decision: Pick<
    Decision,
    "id" | "mandateId" | "mandateVersion" | "outcome" | "reasonCode"
  >,
  request: PaymentRequest,
): VerdictClaims {
  return {
    decisionId: decision.id,
    requestId: request.id,
    agentId: request.agentId,
    vendor: request.vendor,
    amount: request.amount.toString(),
    chain: request.chain,
    mandateId: decision.mandateId,
    mandateVersion: decision.mandateVersion,
    outcome: decision.outcome,
    reasonCode: decision.reasonCode,
  }
}
