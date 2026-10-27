import type { Agent, Chain, Mandate, ReasonCode } from "@/lib/domain/types"
import { usdc } from "@/lib/format/amount"

import { TX_SLOTS, type TxSlotKey } from "./tx-slots"

// Hand-written part of the seed: agents, mandates and the scripted requests
// behind every sketch in docs/design.md §6. Times are relative to the anchor
// (day 0 = the anchor's UTC day), see D-008.

/** Day offset from the anchor day plus a UTC time, e.g. [-9, "14:02"]. */
export type SeedTime = [day: number, time: `${number}:${number}`]

export const REVIEWERS = ["M. Ilić", "J. Perić"] as const

export const AGENTS: Agent[] = [
  { id: "agt_research", name: "Research Bot", owner: "Research team" },
  { id: "agt_ops", name: "Ops Agent", owner: "Operations" },
  { id: "agt_travel", name: "Travel Agent", owner: "People & Travel" },
  { id: "agt_support", name: "Support Bot", owner: "Customer Support" },
  { id: "agt_marketing", name: "Marketing Agent", owner: "Marketing" },
  { id: "agt_data", name: "Data Pipeline", owner: "Data Platform" },
]

type MandateFixture = Omit<Mandate, "approvedAt" | "revokedAt"> & {
  approvedAt: SeedTime
  revokedAt?: SeedTime
}

const BOTH: Chain[] = ["base", "solana"]

export const MANDATES: MandateFixture[] = [
  {
    id: "man_research_v1",
    agentId: "agt_research",
    version: 1,
    approvedBy: "M. Ilić",
    approvedAt: [-26, "09:00"],
    rules: [
      { kind: "limit", amount: usdc("200"), period: "tx" },
      { kind: "limit", amount: usdc("500"), period: "day" },
      { kind: "vendor_allowlist", vendors: ["Weather API", "Data Vendor"] },
      { kind: "review_threshold", amount: usdc("100") },
      { kind: "chain", chains: BOTH },
    ],
  },
  {
    id: "man_ops_v2",
    agentId: "agt_ops",
    version: 2,
    approvedBy: "M. Ilić",
    approvedAt: [-15, "09:00"],
    revokedAt: [-7, "10:00"],
    supersededBy: "man_ops_v3",
    rules: [
      { kind: "limit", amount: usdc("200"), period: "tx" },
      { kind: "limit", amount: usdc("500"), period: "day" },
      { kind: "vendor_allowlist", vendors: ["Weather API", "Cloud GPU"] },
      { kind: "review_threshold", amount: usdc("100") },
      { kind: "chain", chains: BOTH },
    ],
  },
  {
    id: "man_ops_v3",
    agentId: "agt_ops",
    version: 3,
    approvedBy: "J. Perić",
    approvedAt: [-7, "10:00"],
    rules: [
      { kind: "limit", amount: usdc("2000"), period: "tx" },
      { kind: "limit", amount: usdc("3000"), period: "day" },
      {
        kind: "vendor_allowlist",
        vendors: ["Weather API", "Cloud GPU", "Data Vendor"],
      },
      { kind: "review_threshold", amount: usdc("100") },
      { kind: "chain", chains: BOTH },
    ],
  },
  {
    id: "man_travel_v1",
    agentId: "agt_travel",
    version: 1,
    approvedBy: "J. Perić",
    approvedAt: [-26, "09:00"],
    rules: [
      { kind: "limit", amount: usdc("1500"), period: "tx" },
      { kind: "limit", amount: usdc("3000"), period: "day" },
      { kind: "vendor_allowlist", vendors: ["Airline X", "Hotel Y"] },
      { kind: "review_threshold", amount: usdc("250") },
      { kind: "chain", chains: ["base"] },
    ],
  },
  // Replaced on the anchor day with a lower daily limit while a v1 request
  // is still waiting: the approval limit warning (D-007)
  {
    id: "man_support_v1",
    agentId: "agt_support",
    version: 1,
    approvedBy: "J. Perić",
    approvedAt: [-30, "09:00"],
    revokedAt: [0, "11:00"],
    supersededBy: "man_support_v2",
    rules: [
      { kind: "limit", amount: usdc("300"), period: "tx" },
      { kind: "limit", amount: usdc("1000"), period: "day" },
      { kind: "vendor_allowlist", vendors: ["Helpdesk SaaS", "SMS Gateway"] },
      { kind: "review_threshold", amount: usdc("150") },
      { kind: "chain", chains: BOTH },
    ],
  },
  {
    id: "man_support_v2",
    agentId: "agt_support",
    version: 2,
    approvedBy: "M. Ilić",
    approvedAt: [0, "11:00"],
    rules: [
      { kind: "limit", amount: usdc("300"), period: "tx" },
      { kind: "limit", amount: usdc("400"), period: "day" },
      { kind: "vendor_allowlist", vendors: ["Helpdesk SaaS", "SMS Gateway"] },
      { kind: "review_threshold", amount: usdc("150") },
      { kind: "chain", chains: BOTH },
    ],
  },
  {
    id: "man_marketing_v1",
    agentId: "agt_marketing",
    version: 1,
    approvedBy: "M. Ilić",
    approvedAt: [-30, "09:00"],
    rules: [
      { kind: "limit", amount: usdc("500"), period: "tx" },
      { kind: "limit", amount: usdc("1500"), period: "day" },
      { kind: "vendor_allowlist", vendors: ["Ad Network", "Design Studio"] },
      { kind: "review_threshold", amount: usdc("300") },
      { kind: "chain", chains: ["solana"] },
    ],
  },
  // The only monthly limit, and no review threshold: everything is allow or deny
  {
    id: "man_data_v1",
    agentId: "agt_data",
    version: 1,
    approvedBy: "J. Perić",
    approvedAt: [-30, "09:00"],
    rules: [
      { kind: "limit", amount: usdc("100"), period: "tx" },
      { kind: "limit", amount: usdc("300"), period: "day" },
      { kind: "limit", amount: usdc("1500"), period: "month" },
      { kind: "vendor_allowlist", vendors: ["Data Vendor", "Cloud GPU"] },
      { kind: "chain", chains: ["base"] },
    ],
  },
]

export type ScriptedRequest = {
  agentId: string
  vendor: string
  amount: string
  chain: Chain
  at: SeedTime
  memo?: string
  /** The evaluator must produce this, or seed generation throws. */
  expect: ReasonCode
  /** Review outcome for a REVIEW_THRESHOLD request; omitted = still waiting. */
  review?: {
    result: "approved" | "rejected"
    by: string
    afterMinutes: number
    reason?: string
  }
  /** A real (or deliberately missing) testnet transaction behind the payment. */
  payment?: { slot: TxSlotKey }
}

export const SCRIPTED: ScriptedRequest[] = [
  // design.md §6.2b: Ops Agent v2, 430.00 committed, then 120.00 is denied
  {
    agentId: "agt_ops",
    vendor: "Weather API",
    amount: "80",
    chain: "base",
    at: [-9, "09:10"],
    expect: "WITHIN_LIMITS",
  },
  {
    agentId: "agt_ops",
    vendor: "Cloud GPU",
    amount: "95",
    chain: "solana",
    at: [-9, "10:30"],
    expect: "WITHIN_LIMITS",
  },
  {
    agentId: "agt_ops",
    vendor: "Weather API",
    amount: "75",
    chain: "base",
    at: [-9, "11:45"],
    expect: "WITHIN_LIMITS",
  },
  {
    agentId: "agt_ops",
    vendor: "Cloud GPU",
    amount: "180",
    chain: "base",
    at: [-9, "12:20"],
    expect: "REVIEW_THRESHOLD",
    review: { result: "approved", by: "M. Ilić", afterMinutes: 25 },
  },
  {
    agentId: "agt_ops",
    vendor: "Cloud GPU",
    amount: "120",
    chain: "base",
    at: [-9, "14:02"],
    expect: "LIMIT_DAILY_EXCEEDED",
  },

  // The day before the anchor: two real-tx slots, §6.3's approved 120.00 and §6.2a's denied 250.00
  {
    agentId: "agt_research",
    vendor: "Weather API",
    amount: TX_SLOTS["base-1"].amount,
    chain: "base",
    at: [-1, "10:12"],
    expect: "WITHIN_LIMITS",
    payment: { slot: "base-1" },
  },
  {
    agentId: "agt_research",
    vendor: "Weather API",
    amount: TX_SLOTS["solana-1"].amount,
    chain: "solana",
    at: [-1, "11:30"],
    expect: "WITHIN_LIMITS",
    payment: { slot: "solana-1" },
  },
  {
    agentId: "agt_research",
    vendor: "Weather API",
    amount: "120",
    chain: "base",
    at: [-1, "13:58"],
    expect: "REVIEW_THRESHOLD",
    review: { result: "approved", by: "M. Ilić", afterMinutes: 3 },
  },
  {
    agentId: "agt_research",
    vendor: "Weather API",
    amount: "250",
    chain: "base",
    at: [-1, "15:10"],
    expect: "LIMIT_TX_EXCEEDED",
  },

  // Anchor day. Ops Agent v3: 300.00 allowed (100.00 is not above the threshold),
  // a rejected 900.00, then 180.00 and 1,250.00 waiting (1,730.00 committed)
  {
    agentId: "agt_ops",
    vendor: "Cloud GPU",
    amount: "100",
    chain: "solana",
    at: [0, "08:15"],
    expect: "WITHIN_LIMITS",
  },
  {
    agentId: "agt_ops",
    vendor: "Cloud GPU",
    amount: "900",
    chain: "base",
    at: [0, "09:02"],
    expect: "REVIEW_THRESHOLD",
    review: {
      result: "rejected",
      by: "J. Perić",
      afterMinutes: 29,
      reason: "Duplicate of yesterday's GPU order.",
    },
  },
  {
    agentId: "agt_ops",
    vendor: "Weather API",
    amount: "100",
    chain: "base",
    at: [0, "09:40"],
    expect: "WITHIN_LIMITS",
    payment: { slot: "base-failed" },
  },
  {
    agentId: "agt_ops",
    vendor: "Cloud GPU",
    amount: "100",
    chain: "base",
    at: [0, "11:05"],
    expect: "WITHIN_LIMITS",
    payment: { slot: "base-missing" },
  },
  {
    agentId: "agt_ops",
    vendor: "Data Vendor",
    amount: "180",
    chain: "base",
    at: [0, "13:48"],
    expect: "REVIEW_THRESHOLD",
  },
  {
    agentId: "agt_ops",
    vendor: "Cloud GPU",
    amount: "1250",
    chain: "solana",
    at: [0, "13:52"],
    memo: "GPU hours, batch 7",
    expect: "REVIEW_THRESHOLD",
  },

  // Research Bot: a real-tx slot, 150.00 and 120.00 waiting (all within 500.00 committed)
  {
    agentId: "agt_research",
    vendor: "Data Vendor",
    amount: TX_SLOTS["base-2"].amount,
    chain: "base",
    at: [0, "09:05"],
    expect: "WITHIN_LIMITS",
    payment: { slot: "base-2" },
  },
  {
    agentId: "agt_research",
    vendor: "Data Vendor",
    amount: "150",
    chain: "solana",
    at: [0, "10:15"],
    expect: "REVIEW_THRESHOLD",
  },
  {
    agentId: "agt_research",
    vendor: "Weather API",
    amount: "80",
    chain: "base",
    at: [0, "13:00"],
    expect: "WITHIN_LIMITS",
  },
  {
    agentId: "agt_research",
    vendor: "Weather API",
    amount: "120",
    chain: "base",
    at: [0, "13:57"],
    expect: "REVIEW_THRESHOLD",
  },

  // Travel Agent: 420.00 approved by M. Ilić, three waiting (2,260.00 committed)
  {
    agentId: "agt_travel",
    vendor: "Airline X",
    amount: "300",
    chain: "base",
    at: [0, "10:40"],
    expect: "REVIEW_THRESHOLD",
  },
  {
    agentId: "agt_travel",
    vendor: "Hotel Y",
    amount: "900",
    chain: "base",
    at: [0, "11:50"],
    expect: "REVIEW_THRESHOLD",
  },
  {
    agentId: "agt_travel",
    vendor: "Hotel Y",
    amount: "420",
    chain: "base",
    at: [0, "12:10"],
    expect: "REVIEW_THRESHOLD",
    review: { result: "approved", by: "M. Ilić", afterMinutes: 4 },
  },
  {
    agentId: "agt_travel",
    vendor: "Airline X",
    amount: "640",
    chain: "base",
    at: [0, "13:35"],
    memo: "Conference flights, 3 people",
    expect: "REVIEW_THRESHOLD",
  },

  // Support Bot: 250.00 waits under v1; v2 (11:00) lowers the daily limit to 400.00
  {
    agentId: "agt_support",
    vendor: "Helpdesk SaaS",
    amount: "120",
    chain: "base",
    at: [0, "08:05"],
    expect: "WITHIN_LIMITS",
  },
  {
    agentId: "agt_support",
    vendor: "SMS Gateway",
    amount: "90",
    chain: "solana",
    at: [0, "08:40"],
    expect: "WITHIN_LIMITS",
  },
  {
    agentId: "agt_support",
    vendor: "SMS Gateway",
    amount: "250",
    chain: "base",
    at: [0, "10:20"],
    expect: "REVIEW_THRESHOLD",
  },

  // Marketing Agent: four waiting (1,460.00 of 1,500.00 committed)
  {
    agentId: "agt_marketing",
    vendor: "Ad Network",
    amount: "320",
    chain: "solana",
    at: [0, "09:15"],
    expect: "REVIEW_THRESHOLD",
  },
  {
    agentId: "agt_marketing",
    vendor: "Ad Network",
    amount: "450",
    chain: "solana",
    at: [0, "11:30"],
    expect: "REVIEW_THRESHOLD",
  },
  {
    agentId: "agt_marketing",
    vendor: "Design Studio",
    amount: "380",
    chain: "solana",
    at: [0, "12:45"],
    expect: "REVIEW_THRESHOLD",
  },
  {
    agentId: "agt_marketing",
    vendor: "Design Studio",
    amount: "310",
    chain: "solana",
    at: [0, "13:10"],
    memo: "Launch banner set",
    expect: "REVIEW_THRESHOLD",
  },
]

/** Released into the queue this many seconds after the mock starts (so polling has news). */
export type HeldBackRequest = Pick<
  ScriptedRequest,
  "agentId" | "vendor" | "amount" | "chain" | "memo"
> & { afterSeconds: number }

export const HELD_BACK: HeldBackRequest[] = [
  {
    agentId: "agt_research",
    vendor: "Weather API",
    amount: "110",
    chain: "base",
    afterSeconds: 30,
  },
  {
    agentId: "agt_travel",
    vendor: "Airline X",
    amount: "480",
    chain: "base",
    afterSeconds: 90,
    memo: "Return flight change",
  },
  {
    agentId: "agt_ops",
    vendor: "Cloud GPU",
    amount: "220",
    chain: "base",
    afterSeconds: 180,
  },
]

/** Random-but-seeded traffic for the days before the anchor. */
export const FILLER: Record<
  string,
  { perDay: [number, number]; amount: [number, number] }
> = {
  agt_research: { perDay: [0, 2], amount: [5, 240] },
  agt_ops: { perDay: [0, 2], amount: [20, 400] },
  agt_travel: { perDay: [0, 1], amount: [80, 1700] },
  agt_support: { perDay: [0, 2], amount: [10, 320] },
  agt_marketing: { perDay: [0, 1], amount: [50, 600] },
  agt_data: { perDay: [1, 3], amount: [5, 110] },
}

/** Vendors no mandate allows, so the filler produces some VENDOR_NOT_ALLOWED. */
export const UNLISTED_VENDORS = ["Hotel Z", "Print Shop", "Crypto Exchange"]

export const REJECT_REASONS = [
  "Not in this quarter's budget.",
  "Duplicate of an earlier request.",
  "Vendor invoice doesn't match.",
  "Please split into smaller orders.",
]
