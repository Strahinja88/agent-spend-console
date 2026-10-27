// Approvals waiting out their undo window (design.md §6.1). Module-level, so a
// pending approval outlives the queue: navigating away flushes it, and its
// toast can still close after the queue has unmounted.
//
// Every path that sends goes through commitApproval, which removes the entry
// first, so a flush followed by the toast closing never sends twice.

type PendingApproval = {
  send: () => void
  /** Closes the undo toast without cancelling. */
  dismiss: () => void
}

const pending = new Map<string, PendingApproval>()

export function deferApproval(decisionId: string, approval: PendingApproval) {
  pending.set(decisionId, approval)
}

/** Undo. Returns false if the approval was already sent. */
export function cancelApproval(decisionId: string): boolean {
  return pending.delete(decisionId)
}

/** Sends now if still pending; otherwise does nothing. */
export function commitApproval(decisionId: string) {
  const approval = pending.get(decisionId)
  if (!approval) return
  pending.delete(decisionId)
  approval.send()
}

/** Sends every pending approval now and closes their toasts (leaving the queue). */
export function flushApprovals() {
  for (const [decisionId, approval] of [...pending]) {
    commitApproval(decisionId)
    approval.dismiss()
  }
}

export function isApprovalPending(decisionId: string): boolean {
  return pending.has(decisionId)
}

/** Tests only: forget pending approvals without sending them. */
export function resetPendingApprovals() {
  pending.clear()
}
