import { calculateJwkThumbprint } from "jose"
import { beforeAll, describe, expect, it } from "vitest"

import type { Jwks } from "@/lib/api/contract"
import { decision, request } from "@/lib/domain/test-fixtures"
import { usdc } from "@/lib/format/amount"

import { verdictClaims, VERDICT_ISSUER } from "./claims"
import { decodeVerdict, tamperVerdict } from "./decode"
import { createVerdictKey, signVerdict, type VerdictKey } from "./sign"
import { verifyVerdict } from "./verify"

const denied = decision({
  outcome: "deny",
  reasonCode: "LIMIT_DAILY_EXCEEDED",
})
const claims = verdictClaims(denied, request({ amount: usdc("120") }))

let key: VerdictKey
let jwks: Jwks
let jwt: string

beforeAll(async () => {
  key = await createVerdictKey()
  jwks = { keys: [key.publicJwk] }
  jwt = await signVerdict(claims, denied.decidedAt, key)
})

function base64urlJson(value: unknown): string {
  return btoa(JSON.stringify(value))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

describe("createVerdictKey", () => {
  it("uses the RFC 7638 thumbprint of the public key as kid", async () => {
    const { kid, ...jwk } = key.publicJwk
    expect(kid).toBe(await calculateJwkThumbprint(jwk))
    expect(key.publicJwk).toMatchObject({
      kty: "EC",
      crv: "P-256",
      alg: "ES256",
      use: "sig",
    })
    expect(key.publicJwk).not.toHaveProperty("d")
  })

  it("gives every key its own kid", async () => {
    const other = await createVerdictKey()
    expect(other.publicJwk.kid).not.toBe(key.publicJwk.kid)
  })
})

describe("verifyVerdict", () => {
  it("accepts a verdict signed with a key in the JWKS", async () => {
    expect(await verifyVerdict(jwt, jwks)).toEqual({
      ok: true,
      kid: key.publicJwk.kid,
      alg: "ES256",
    })
  })

  it("rejects a tampered payload as a signature mismatch", async () => {
    expect(await verifyVerdict(tamperVerdict(jwt).jwt, jwks)).toEqual({
      ok: false,
      reason: "signature",
      message: "payload does not match signature",
    })
  })

  it("reports a key from another page load as unknown, not as a bad signature", async () => {
    const earlierLoad = await createVerdictKey()
    const old = await signVerdict(claims, denied.decidedAt, earlierLoad)
    const result = await verifyVerdict(old, jwks)
    expect(result).toMatchObject({ ok: false, reason: "unknown_key" })
    expect(result.ok || result.message).toMatch(/^unknown key/)
  })

  it("rejects a forged signature under a known kid", async () => {
    // Same kid as the real key, signed by a different one
    const forger = await createVerdictKey()
    const forged = await signVerdict(claims, denied.decidedAt, {
      ...forger,
      publicJwk: { ...forger.publicJwk, kid: key.publicJwk.kid },
    })
    expect(await verifyVerdict(forged, jwks)).toMatchObject({
      ok: false,
      reason: "signature",
    })
  })

  it("rejects unsigned and malformed tokens", async () => {
    const unsigned = `${base64urlJson({ alg: "none", typ: "JWT" })}.${base64urlJson({ ...claims, iss: VERDICT_ISSUER })}.`
    for (const token of [unsigned, "", "not.a.jwt", "abc"]) {
      expect(await verifyVerdict(token, jwks)).toMatchObject({
        ok: false,
        reason: "malformed",
      })
    }
  })
})

describe("decodeVerdict", () => {
  it("returns the header and the signed claims", () => {
    const { header, payload } = decodeVerdict(jwt)
    expect(header).toEqual({ alg: "ES256", kid: key.publicJwk.kid, typ: "JWT" })
    expect(payload).toEqual({
      ...claims,
      iss: VERDICT_ISSUER,
      iat: Math.floor(Date.parse(denied.decidedAt) / 1000),
    })
    expect(payload.amount).toBe("120000000")
  })
})

describe("tamperVerdict", () => {
  it("flips only the outcome and keeps the header and signature", () => {
    const tampered = tamperVerdict(jwt)
    expect(tampered).toMatchObject({
      field: "outcome",
      from: "deny",
      to: "allow",
    })

    const [header, payload, signature] = jwt.split(".")
    const parts = tampered.jwt.split(".")
    expect(parts[0]).toBe(header)
    expect(parts[1]).not.toBe(payload)
    expect(parts[2]).toBe(signature)
    expect(decodeVerdict(tampered.jwt).payload).toEqual({
      ...decodeVerdict(jwt).payload,
      outcome: "allow",
    })
  })

  it("turns an allow into a deny", async () => {
    const allowed = await signVerdict(
      { ...claims, outcome: "allow", reasonCode: "WITHIN_LIMITS" },
      denied.decidedAt,
      key,
    )
    expect(tamperVerdict(allowed)).toMatchObject({ from: "allow", to: "deny" })
  })
})
