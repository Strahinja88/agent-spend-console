import type { Decision } from "./types"

export type StatusKind = "allow" | "review" | "deny" | "pending"

export type DisplayState = { status: StatusKind; label: string }

/** What lists and headers show: the rule outcome plus any review result (design.md §2.2). */
export function displayState(
  decision: Pick<Decision, "outcome" | "reviewResult" | "reviewedBy">,
): DisplayState {
  switch (decision.outcome) {
    case "allow":
      return { status: "allow", label: "Allowed" }
    case "deny":
      return { status: "deny", label: "Denied" }
    case "review":
      if (decision.reviewResult === "approved") {
        return {
          status: "allow",
          label: decision.reviewedBy
            ? `Approved after review · ${decision.reviewedBy}`
            : "Approved after review",
        }
      }
      if (decision.reviewResult === "rejected") {
        return { status: "deny", label: "Rejected after review" }
      }
      return { status: "review", label: "Waiting for review" }
  }
}

export function isWaitingForReview(decision: Decision): boolean {
  return decision.outcome === "review" && decision.reviewResult === undefined
}
