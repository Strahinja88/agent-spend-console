import { describe, expect, it } from "vitest"

import { formatAmount, parseAmount, toDecimalString, usdc } from "./amount"

describe("formatAmount", () => {
  it.each([
    [0n, "0.00 USDC"],
    [1n, "0.000001 USDC"],
    [120_000_000n, "120.00 USDC"],
    [1_250_500_000n, "1,250.50 USDC"],
    [-120_000_000n, "-120.00 USDC"],
    [-1n, "-0.000001 USDC"],
  ])("formats %s", (value, expected) => {
    expect(formatAmount(value)).toBe(expected)
  })

  it("groups very large values exactly, without precision loss", () => {
    expect(formatAmount(10n ** 24n)).toBe("1,000,000,000,000,000,000.00 USDC")
    expect(formatAmount(10n ** 24n + 1n)).toBe(
      "1,000,000,000,000,000,000.000001 USDC",
    )
  })

  it("accepts other decimals and units", () => {
    expect(formatAmount(1_500n, 2, "EUR")).toBe("15.00 EUR")
  })
})

describe("toDecimalString", () => {
  it("has no grouping or unit", () => {
    expect(toDecimalString(1_250_500_000n)).toBe("1250.50")
  })
})

describe("parseAmount", () => {
  it.each([
    ["120", 120_000_000n],
    ["120.5", 120_500_000n],
    ["1,250.50", 1_250_500_000n],
    ["0.000001", 1n],
    ["-3", -3_000_000n],
  ])("parses %s", (text, expected) => {
    expect(parseAmount(text)).toBe(expected)
  })

  it("round-trips with toDecimalString", () => {
    expect(parseAmount(toDecimalString(987_654_321n))).toBe(987_654_321n)
  })

  it.each(["", "abc", "1.2.3", "1e6", "0.0000001"])("rejects %j", (text) => {
    expect(() => parseAmount(text)).toThrow()
  })

  it("has a usdc() shorthand", () => {
    expect(usdc("100.00")).toBe(100_000_000n)
  })
})
