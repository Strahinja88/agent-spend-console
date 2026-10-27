import { describe, expect, it } from "vitest"

import { bigintString, paymentRequestSchema, ruleSchema } from "./schemas"

describe("bigintString", () => {
  it("decodes integer strings to bigint and encodes back", () => {
    expect(bigintString.decode("120000000")).toBe(120_000_000n)
    expect(bigintString.encode(10n ** 24n)).toBe("1000000000000000000000000")
  })

  it.each(["1.5", "1e6", "", " 1"])("rejects %j", (text) => {
    expect(bigintString.safeParse(text).success).toBe(false)
  })

  it("rejects JSON numbers, so amounts never pass through a float", () => {
    expect(bigintString.safeParse(120000000).success).toBe(false)
  })
})

describe("wire round trip", () => {
  it("survives JSON.stringify / JSON.parse with exact amounts", () => {
    const request = {
      id: "req_1",
      agentId: "agt_1",
      vendor: "Weather API",
      amount: 9_007_199_254_740_993n, // > Number.MAX_SAFE_INTEGER
      chain: "base" as const,
      createdAt: "2026-10-27T13:57:00.000Z",
    }
    const wire = JSON.parse(
      JSON.stringify(paymentRequestSchema.encode(request)),
    )
    expect(wire.amount).toBe("9007199254740993")
    expect(paymentRequestSchema.decode(wire)).toEqual(request)
  })

  it("decodes nested rule amounts", () => {
    expect(
      ruleSchema.decode({ kind: "limit", amount: "500000000", period: "day" }),
    ).toEqual({ kind: "limit", amount: 500_000_000n, period: "day" })
  })
})
