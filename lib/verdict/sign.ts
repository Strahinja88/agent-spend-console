import {
  calculateJwkThumbprint,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose"

import { jwkSchema, type Jwk } from "@/lib/api/contract"

import { VERDICT_ALG, VERDICT_ISSUER, type VerdictClaims } from "./claims"

// Signing happens in the mock API only. The private key is generated in
// memory on each page load and never exported (D-015).

export type VerdictKey = {
  privateKey: CryptoKey
  /** Public half, ready for a JWKS. */
  publicJwk: Jwk
}

export async function createVerdictKey(): Promise<VerdictKey> {
  const { privateKey, publicKey } = await generateKeyPair(VERDICT_ALG)
  const jwk = await exportJWK(publicKey)
  // The kid is derived from the key (RFC 7638), so a verdict signed by a key
  // from another page load fails as "unknown key", not as a bad signature.
  const kid = await calculateJwkThumbprint(jwk)
  return {
    privateKey,
    publicJwk: jwkSchema.parse({ ...jwk, kid, alg: VERDICT_ALG, use: "sig" }),
  }
}

/** ES256 JWT over the claims. No `exp`: a verdict is a historical record (D-016). */
export function signVerdict(
  claims: VerdictClaims,
  issuedAt: string,
  key: VerdictKey,
): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({
      alg: VERDICT_ALG,
      kid: key.publicJwk.kid,
      typ: "JWT",
    })
    .setIssuer(VERDICT_ISSUER)
    .setIssuedAt(Math.floor(Date.parse(issuedAt) / 1000))
    .sign(key.privateKey)
}
