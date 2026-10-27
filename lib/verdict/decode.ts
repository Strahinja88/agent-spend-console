import { base64url, decodeJwt, decodeProtectedHeader } from "jose"

import type { Outcome } from "@/lib/domain/types"

import { verdictPayloadSchema } from "./claims"

export type DecodedVerdict = {
  header: Record<string, unknown>
  payload: Record<string, unknown>
}

/** Header and payload as JSON, without checking the signature. */
export function decodeVerdict(jwt: string): DecodedVerdict {
  return { header: decodeProtectedHeader(jwt), payload: decodeJwt(jwt) }
}

export type TamperedVerdict = {
  jwt: string
  field: "outcome"
  from: Outcome
  to: Outcome
}

/**
 * The demo tamper (D-017): flips the outcome (deny or review → allow,
 * allow → deny) and re-encodes the payload, keeping the original header and
 * signature, so verification has to fail.
 */
export function tamperVerdict(jwt: string): TamperedVerdict {
  const [header, , signature] = jwt.split(".")
  const payload = verdictPayloadSchema.parse(decodeJwt(jwt))
  const to: Outcome = payload.outcome === "allow" ? "deny" : "allow"
  const tampered = base64url.encode(
    JSON.stringify({ ...decodeJwt(jwt), outcome: to }),
  )
  return {
    jwt: `${header}.${tampered}.${signature}`,
    field: "outcome",
    from: payload.outcome,
    to,
  }
}
