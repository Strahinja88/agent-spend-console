import { describe, expect, it } from "vitest"

import { usdc } from "@/lib/format/amount"

import { ruleToSentence } from "./rule-sentence"
import type { Rule } from "./types"

describe("ruleToSentence", () => {
  it.each<[Rule, string]>([
    [
      { kind: "limit", amount: usdc("200"), period: "tx" },
      "Up to 200.00 USDC per payment.",
    ],
    [
      { kind: "limit", amount: usdc("3000"), period: "day" },
      "Up to 3,000.00 USDC per day.",
    ],
    [
      { kind: "limit", amount: usdc("1500"), period: "month" },
      "Up to 1,500.00 USDC per month.",
    ],
    [
      { kind: "vendor_allowlist", vendors: ["Weather API", "Cloud GPU"] },
      "Only Weather API and Cloud GPU.",
    ],
    [
      {
        kind: "vendor_allowlist",
        vendors: ["Weather API", "Cloud GPU", "Data Vendor"],
      },
      "Only Weather API, Cloud GPU and Data Vendor.",
    ],
    [{ kind: "vendor_allowlist", vendors: [] }, "No vendors are allowed."],
    [
      { kind: "review_threshold", amount: usdc("100") },
      "Payments above 100.00 USDC need review.",
    ],
    [{ kind: "chain", chains: ["base", "solana"] }, "Base and Solana only."],
    [{ kind: "chain", chains: ["base"] }, "Base only."],
    [{ kind: "chain", chains: [] }, "No chains are allowed."],
  ])("%o", (rule, expected) => {
    expect(ruleToSentence(rule)).toBe(expected)
  })
})
