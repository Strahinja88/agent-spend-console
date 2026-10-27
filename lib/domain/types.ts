import type { z } from "zod"

import type {
  agentSchema,
  chainSchema,
  decisionSchema,
  mandateSchema,
  outcomeSchema,
  paymentRequestSchema,
  paymentSchema,
  paymentStatusSchema,
  reasonCodeSchema,
  ruleSchema,
} from "./schemas"

// Types come from the schemas (z.output = after decoding, so amounts are bigint).
export type Chain = z.output<typeof chainSchema>
export type Agent = z.output<typeof agentSchema>
export type Rule = z.output<typeof ruleSchema>
export type Mandate = z.output<typeof mandateSchema>
export type PaymentRequest = z.output<typeof paymentRequestSchema>
export type ReasonCode = z.output<typeof reasonCodeSchema>
export type Outcome = z.output<typeof outcomeSchema>
export type Decision = z.output<typeof decisionSchema>
export type PaymentStatus = z.output<typeof paymentStatusSchema>
export type Payment = z.output<typeof paymentSchema>

export type RuleOf<K extends Rule["kind"]> = Extract<Rule, { kind: K }>

/** Spend already committed in the request's UTC day and month (design.md §2.1). */
export type Committed = { day: bigint; month: bigint }

/** A request together with the decision made for it: the unit of spend history. */
export type HistoryEntry = { request: PaymentRequest; decision: Decision }
