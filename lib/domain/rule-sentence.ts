import { chainName } from "@/lib/format/chain"
import { formatAmount } from "@/lib/format/amount"

import type { Chain, Rule } from "./types"

// en-GB: "A, B and C" (no Oxford comma), matching docs/design.md
const list = new Intl.ListFormat("en-GB", { type: "conjunction" })

export function joinList(items: string[]): string {
  return list.format(items)
}

export function chainList(chains: Chain[]): string {
  return joinList(chains.map((chain) => chainName(chain)))
}

const PERIOD_WORD = { tx: "payment", day: "day", month: "month" } as const

/** One plain-language sentence per rule, e.g. "Up to 500.00 USDC per day." */
export function ruleToSentence(rule: Rule): string {
  switch (rule.kind) {
    case "limit":
      return `Up to ${formatAmount(rule.amount)} per ${PERIOD_WORD[rule.period]}.`
    case "vendor_allowlist":
      return rule.vendors.length === 0
        ? "No vendors are allowed."
        : `Only ${joinList(rule.vendors)}.`
    case "review_threshold":
      return `Payments above ${formatAmount(rule.amount)} need review.`
    case "chain":
      return rule.chains.length === 0
        ? "No chains are allowed."
        : `${chainList(rule.chains)} only.`
  }
}

/** Structural equality, to find a decision's matched rule in its mandate. */
export function isSameRule(a: Rule, b: Rule): boolean {
  switch (a.kind) {
    case "limit":
      return (
        b.kind === "limit" && a.period === b.period && a.amount === b.amount
      )
    case "review_threshold":
      return b.kind === "review_threshold" && a.amount === b.amount
    case "vendor_allowlist":
      return (
        b.kind === "vendor_allowlist" &&
        a.vendors.length === b.vendors.length &&
        a.vendors.every((vendor, i) => vendor === b.vendors[i])
      )
    case "chain":
      return (
        b.kind === "chain" &&
        a.chains.length === b.chains.length &&
        a.chains.every((chain, i) => chain === b.chains[i])
      )
  }
}
