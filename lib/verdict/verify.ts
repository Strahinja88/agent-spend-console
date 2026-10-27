import { createLocalJWKSet, errors, jwtVerify } from "jose"

import type { Jwks } from "@/lib/api/contract"

import { VERDICT_ALG, VERDICT_ISSUER } from "./claims"

export type VerifyFailure = "signature" | "unknown_key" | "malformed"

export type VerifyResult =
  | { ok: true; kid: string; alg: string }
  | { ok: false; reason: VerifyFailure; message: string }

const MESSAGES: Record<VerifyFailure, string> = {
  signature: "payload does not match signature",
  unknown_key:
    "unknown key. It was signed with a key that isn't in the current key set, for example one from an earlier page load",
  malformed: "not a valid signed verdict",
}

function failure(reason: VerifyFailure): VerifyResult {
  return { ok: false, reason, message: MESSAGES[reason] }
}

/**
 * Checks an ES256 verdict against a local JWKS. Never throws: every failure
 * comes back as a reason plus a plain-language message for the panel.
 */
export async function verifyVerdict(
  jwt: string,
  jwks: Jwks,
): Promise<VerifyResult> {
  try {
    const { protectedHeader } = await jwtVerify(jwt, createLocalJWKSet(jwks), {
      algorithms: [VERDICT_ALG],
      issuer: VERDICT_ISSUER,
    })
    return {
      ok: true,
      kid: protectedHeader.kid ?? "",
      alg: protectedHeader.alg,
    }
  } catch (error) {
    if (error instanceof errors.JWSSignatureVerificationFailed) {
      return failure("signature")
    }
    if (error instanceof errors.JWKSNoMatchingKey) {
      return failure("unknown_key")
    }
    // alg "none", bad encoding, wrong issuer: not one of our verdicts
    return failure("malformed")
  }
}
