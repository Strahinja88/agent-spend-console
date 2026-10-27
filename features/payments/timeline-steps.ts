import type { StepStatus } from "@/components/data/timeline"
import type { PaymentDetail } from "@/lib/api/contract"
import { ChainError } from "@/lib/chain/errors"
import { isFinal, type OnchainTx, type UsdcTransfer } from "@/lib/chain/types"
import type { StatusKind } from "@/lib/domain/display-state"
import { formatAmount } from "@/lib/format/amount"
import { chainName } from "@/lib/format/chain"

// The payment timeline as data (design.md §6.3): which steps are done, and the
// sentence for each. The screen adds links, the tx hash and the onchain card.

/** What we know onchain, in the shape the timeline needs. */
export type OnchainView =
  /** Demo data, no transaction behind it (D-009): nothing to look up. */
  | { kind: "simulated" }
  | { kind: "loading" }
  | { kind: "error"; rateLimited: boolean }
  | { kind: "tx"; tx: OnchainTx }

export function onchainView(
  detail: PaymentDetail,
  query: { data?: OnchainTx; error: unknown },
): OnchainView {
  const { payment } = detail
  if (payment.simulated || !payment.txHash) return { kind: "simulated" }
  // Data wins over a failed background refetch: it's still true
  if (query.data) return { kind: "tx", tx: query.data }
  if (query.error) {
    return {
      kind: "error",
      rateLimited:
        query.error instanceof ChainError &&
        query.error.kind === "rate_limited",
    }
  }
  return { kind: "loading" }
}

export type StepKey =
  "requested" | "decision" | "approved" | "submitted" | "confirmed"

export type StepModel = {
  key: StepKey
  title: string
  status: StepStatus
  time?: string
  text: string
}

function approvalStep({ decision }: PaymentDetail): StepModel {
  const step = { key: "approved", title: "Approved" } as const
  if (decision.outcome === "deny") {
    return {
      ...step,
      status: "not_reached",
      text: "Not reached: the request was denied.",
    }
  }
  if (decision.outcome === "allow") {
    return {
      ...step,
      status: "done",
      time: decision.decidedAt,
      text: "Approved by the rules, no review needed.",
    }
  }
  const by = decision.reviewedBy ? ` by ${decision.reviewedBy}` : ""
  switch (decision.reviewResult) {
    case "approved":
      return {
        ...step,
        status: "done",
        time: decision.reviewedAt,
        text: `After review${by}.`,
      }
    case "rejected":
      return {
        ...step,
        status: "failed",
        time: decision.reviewedAt,
        text: decision.reviewReason
          ? `Rejected${by}: “${decision.reviewReason}”`
          : `Rejected${by}.`,
      }
    case undefined:
      return { ...step, status: "current", text: "Waiting for review." }
  }
}

function wasSent({ payment }: PaymentDetail): boolean {
  return ["submitted", "confirmed", "failed"].includes(payment.status)
}

function submittedStep(detail: PaymentDetail): StepModel {
  const { payment } = detail
  const step = { key: "submitted", title: "Submitted" } as const
  if (payment.status === "approved") {
    return {
      ...step,
      status: "not_reached",
      text: "Approved in this demo session. The demo doesn't send new payments onchain.",
    }
  }
  if (!wasSent(detail))
    return { ...step, status: "not_reached", text: "Not reached." }
  return {
    ...step,
    status: "done",
    time: payment.submittedAt,
    text:
      payment.simulated || !payment.txHash
        ? "Simulated payment, no onchain transaction."
        : `Sent to ${chainName(payment.chain, "full")}.`,
  }
}

function confirmedStep(detail: PaymentDetail, onchain: OnchainView): StepModel {
  const { payment } = detail
  const network = chainName(payment.chain, "full")
  const step = { key: "confirmed", title: "Confirmed onchain" } as const
  if (!wasSent(detail))
    return { ...step, status: "not_reached", text: "Not reached." }

  switch (onchain.kind) {
    case "simulated":
      switch (payment.status) {
        case "failed":
          return {
            ...step,
            status: "failed",
            text: "Simulated failure, no onchain transaction.",
          }
        case "submitted":
          return {
            ...step,
            status: "current",
            text: "Simulated payment waiting for confirmation.",
          }
        default:
          return {
            ...step,
            status: "done",
            text: "Simulated payment, no onchain transaction.",
          }
      }
    case "loading":
      return { ...step, status: "current", text: `Checking ${network}…` }
    case "error":
      return {
        ...step,
        status: "current",
        text: `Couldn't check ${network} right now.`,
      }
    case "tx":
      switch (onchain.tx.state) {
        case "pending":
          return {
            ...step,
            status: "current",
            text: "Waiting for confirmation.",
          }
        case "not_found":
          return {
            ...step,
            status: "current",
            text: `Transaction not found on ${network}.`,
          }
        case "failed":
          return { ...step, status: "failed", text: "Failed onchain." }
        case "confirmed":
          return {
            ...step,
            status: "done",
            text: isFinal(onchain.tx)
              ? `Confirmed on ${network}.`
              : `Confirmed on ${network}, waiting to be finalized.`,
          }
      }
  }
}

/**
 * Requested → Decision → Approved → Submitted → Confirmed onchain. Times come
 * from the seed; the block time is shown in the onchain card instead (D-021).
 */
export function timelineSteps(
  detail: PaymentDetail,
  onchain: OnchainView,
): StepModel[] {
  const { request, decision, agent } = detail
  return [
    {
      key: "requested",
      title: "Requested",
      status: "done",
      time: request.createdAt,
      text: `${agent.name} asked to pay ${formatAmount(request.amount)} to ${request.vendor}.`,
    },
    {
      key: "decision",
      title: "Decision",
      status: decision.outcome === "deny" ? "failed" : "done",
      time: decision.decidedAt,
      text: decision.reason,
    },
    approvalStep(detail),
    submittedStep(detail),
    confirmedStep(detail, onchain),
  ]
}

export type PaymentSummary = {
  status: StatusKind
  label: string
  sentence: string
  /** Block time, shown as "3 min ago" after the sentence. */
  time?: string
}

/** The header: a pill and one plain-language sentence (design.md §6.3). */
export function paymentSummary(
  detail: PaymentDetail,
  onchain: OnchainView,
): PaymentSummary {
  const { payment, decision, request } = detail
  const network = chainName(payment.chain, "full")
  const amount = formatAmount(request.amount)

  if (decision.outcome === "deny") {
    return {
      status: "deny",
      label: "Not paid",
      sentence: "Denied by the rules, so no payment was made.",
    }
  }
  if (decision.reviewResult === "rejected") {
    return {
      status: "deny",
      label: "Not paid",
      sentence: "Rejected after review, so no payment was made.",
    }
  }
  if (decision.outcome === "review" && !decision.reviewResult) {
    return {
      status: "review",
      label: "Waiting for review",
      sentence: "Nothing is sent until a reviewer approves it.",
    }
  }
  if (!wasSent(detail)) {
    return {
      status: "pending",
      label: "Approved",
      sentence:
        "Approved in this demo session. The demo doesn't send new payments onchain.",
    }
  }

  switch (onchain.kind) {
    case "simulated":
      switch (payment.status) {
        case "failed":
          return {
            status: "deny",
            label: "Failed (simulated)",
            sentence: `Simulated failure · ${amount} to ${request.vendor} · no onchain transaction`,
          }
        case "submitted":
          return {
            status: "pending",
            label: "Submitted (simulated)",
            sentence: `Simulated payment · ${amount} to ${request.vendor} · no onchain transaction`,
          }
        default:
          return {
            status: "allow",
            label: "Confirmed (simulated)",
            sentence: `Simulated payment · ${amount} to ${request.vendor} · no onchain transaction`,
          }
      }
    case "loading":
      return {
        status: "pending",
        label: "Checking",
        sentence: `Checking ${network}…`,
      }
    case "error":
      return {
        status: "pending",
        label: "Status unknown",
        sentence: `Couldn't reach ${network} to check this payment.`,
      }
    case "tx": {
      const { tx } = onchain
      switch (tx.state) {
        case "pending":
          return {
            status: "pending",
            label: "Pending",
            sentence: `Submitted on ${network} · waiting for confirmation`,
          }
        case "not_found":
          return {
            status: "pending",
            label: "Not found",
            sentence: `Not found on ${network} yet`,
          }
        case "failed":
          return {
            status: "deny",
            label: "Failed",
            sentence: `Failed on ${network} · no USDC was sent`,
            time: tx.blockTime,
          }
        case "confirmed": {
          const [transfer] = tx.transfers
          return {
            status: "allow",
            label: "Confirmed",
            sentence: transfer
              ? `Confirmed on ${network} · ${formatAmount(transfer.amount)} sent to ${request.vendor}`
              : `Confirmed on ${network} · no USDC transfer in this transaction`,
            time: tx.blockTime,
          }
        }
      }
    }
  }
}

/** Whether the onchain transfer moved exactly what was approved. */
export function amountCheck(
  approved: bigint,
  transfers: UsdcTransfer[],
): "match" | "mismatch" | "none" {
  const [transfer] = transfers
  if (!transfer) return "none"
  return transfer.amount === approved ? "match" : "mismatch"
}
