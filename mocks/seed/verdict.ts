import type { Decision, PaymentRequest } from "@/lib/domain/types"

// Phase 2 placeholder: a JWT-shaped string with alg "none" and no signature.
// Phase 4 replaces it with an ES256 verdict signed by jose.

function base64url(text: string): string {
  let binary = ""
  for (const byte of new TextEncoder().encode(text)) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export function unsignedVerdict(
  decision: Omit<Decision, "verdictJwt" | "reason">,
  request: PaymentRequest,
): string {
  const header = { alg: "none", typ: "JWT" }
  const payload = {
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
    iat: Math.floor(Date.parse(decision.decidedAt) / 1000),
  }
  return `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}.`
}
