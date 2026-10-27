"use client"

import { useQueryClient, type QueryClient } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { toast } from "sonner"

import { approveDecision, rejectDecision } from "@/lib/api/approvals"
import { ApiError } from "@/lib/api/client"
import type { QueueItem } from "@/lib/api/contract"
import { queryKeys } from "@/lib/api/query-keys"
import { hideDecision, restoreDecision } from "@/lib/api/review-overlay"
import { formatAmount } from "@/lib/format/amount"

import { ERROR_TOAST_MS, UNDO_MS } from "./constants"
import {
  cancelApproval,
  commitApproval,
  deferApproval,
} from "./pending-approvals"

/** What the queue does when rows leave or come back. */
export type ReviewHandlers = {
  /** A row is about to be hidden: move the selection on. */
  onHide: (decisionId: string) => void
  /** A row is back (Undo or rollback): reselect it. */
  onRestore: (decisionId: string) => void
  /** The server says approving now breaks the current mandate: show the dialog. */
  onLimitWarning: (decisionId: string) => void
}

function summary(item: QueueItem): string {
  return `${formatAmount(item.request.amount)} to ${item.request.vendor}`
}

/**
 * Approve and reject with optimistic removal (D-012). A row is hidden through
 * the shared review overlay as soon as the reviewer acts, and restored if the
 * request fails. Requests and toasts don't depend on the queue staying mounted;
 * the handlers are dropped when it unmounts.
 */
export function useReviewActions(handlers: ReviewHandlers) {
  const queryClient = useQueryClient()
  const handlersRef = useRef<ReviewHandlers | null>(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  })
  useEffect(
    () => () => {
      handlersRef.current = null
    },
    [],
  )

  const context: ActionContext = {
    queryClient,
    handlers: () => handlersRef.current,
  }

  return {
    /** ≤ 1,000 USDC with no limit warning: hide now, send when the undo toast closes on its own. */
    approveWithUndo: (item: QueueItem) => approveWithUndo(context, item),
    /** Confirmed in the dialog: send now. */
    approveNow: (item: QueueItem, acknowledgeLimitWarning: boolean) =>
      approveNow(context, item, acknowledgeLimitWarning),
    reject: (item: QueueItem, reason: string) => reject(context, item, reason),
  }
}

type ActionContext = {
  queryClient: QueryClient
  handlers: () => ReviewHandlers | null
}

function hide({ handlers }: ActionContext, item: QueueItem) {
  handlers()?.onHide(item.decision.id)
  hideDecision(item.decision.id)
}

function restore({ handlers }: ActionContext, item: QueueItem) {
  restoreDecision(item.decision.id)
  handlers()?.onRestore(item.decision.id)
}

function refresh({ queryClient }: ActionContext) {
  // Decision lists, details and payments show the review result, so they go
  // stale too. Only the ones on screen refetch now; the rest when next shown.
  void queryClient.invalidateQueries({ queryKey: queryKeys.decisionLists() })
  void queryClient.invalidateQueries({
    queryKey: queryKeys.decisionDetails(),
  })
  void queryClient.invalidateQueries({ queryKey: queryKeys.payments() })
  return queryClient.invalidateQueries({ queryKey: queryKeys.approvals() })
}

function approveWithUndo(context: ActionContext, item: QueueItem) {
  const id = item.decision.id
  hide(context, item)

  // Sonner pauses the timer on hover and focus, so pausing also delays the send.
  // Undo cancels; any other way the toast closes sends.
  const toastId = toast.success(`Approved · ${summary(item)}`, {
    duration: UNDO_MS,
    action: {
      label: "Undo",
      onClick: () => {
        if (cancelApproval(id)) restore(context, item)
      },
    },
    onAutoClose: () => commitApproval(id),
    onDismiss: () => commitApproval(id),
  })

  deferApproval(id, {
    send: () => void sendApproval(context, item, false),
    dismiss: () => toast.dismiss(toastId),
  })
}

function approveNow(
  context: ActionContext,
  item: QueueItem,
  acknowledgeLimitWarning: boolean,
) {
  hide(context, item)
  void sendApproval(context, item, acknowledgeLimitWarning, () =>
    toast.success(`Approved · ${summary(item)}`),
  )
}

async function sendApproval(
  context: ActionContext,
  item: QueueItem,
  acknowledgeLimitWarning: boolean,
  onSuccess?: () => void,
) {
  try {
    await approveDecision(item.decision.id, acknowledgeLimitWarning)
    onSuccess?.()
    void refresh(context)
  } catch (error) {
    await handleFailure(context, item, "approve", error, () => {
      hide(context, item)
      void sendApproval(context, item, acknowledgeLimitWarning, () =>
        toast.success(`Approved · ${summary(item)}`),
      )
    })
  }
}

function reject(context: ActionContext, item: QueueItem, reason: string) {
  hide(context, item)
  void sendRejection(context, item, reason)
}

async function sendRejection(
  context: ActionContext,
  item: QueueItem,
  reason: string,
) {
  try {
    await rejectDecision(item.decision.id, reason)
    toast.success(`Rejected · ${summary(item)}`)
    void refresh(context)
  } catch (error) {
    await handleFailure(context, item, "reject", error, () => {
      hide(context, item)
      void sendRejection(context, item, reason)
    })
  }
}

async function handleFailure(
  context: ActionContext,
  item: QueueItem,
  verb: "approve" | "reject",
  error: unknown,
  retry: () => void,
) {
  if (error instanceof ApiError && error.code === "NOT_WAITING") {
    // Someone else got there first: the row is gone for good, nothing to roll back.
    toast.info(`Already reviewed · ${summary(item)}`, {
      description: "Another reviewer decided on this request.",
    })
    void refresh(context)
    return
  }

  restoreDecision(item.decision.id)

  if (error instanceof ApiError && error.code === "LIMIT_WARNING") {
    // The current mandate changed after this screen loaded (D-007). Refetch so
    // the dialog shows the new breaches, then ask again.
    await refresh(context)
    context.handlers()?.onLimitWarning(item.decision.id)
    return
  }

  context.handlers()?.onRestore(item.decision.id)
  toast.error(`Couldn't ${verb} ${summary(item)}`, {
    description: `Nothing was ${verb === "approve" ? "approved" : "rejected"}. Try again.`,
    duration: ERROR_TOAST_MS,
    action: { label: "Retry", onClick: retry },
  })
}
