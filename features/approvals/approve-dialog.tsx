"use client"

import { CircleAlert } from "lucide-react"
import { useRef } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import type { QueueItem } from "@/lib/api/contract"
import { formatAmount } from "@/lib/format/amount"
import { chainName } from "@/lib/format/chain"

import { CONFIRM_ABOVE } from "./constants"

/** Approving needs this dialog: above 1,000.00 USDC, or with a limit warning (D-013). */
export function needsConfirmation(item: QueueItem): boolean {
  return item.request.amount > CONFIRM_ABOVE || !item.limitWarning.ok
}

type ApproveDialogProps = {
  item: QueueItem | undefined
  onConfirm: (item: QueueItem, acknowledgeLimitWarning: boolean) => void
  onCancel: () => void
}

export function ApproveDialog({
  item,
  onConfirm,
  onCancel,
}: ApproveDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const warning = item && !item.limitWarning.ok ? item.limitWarning : undefined

  return (
    <AlertDialog
      open={item !== undefined}
      onOpenChange={(open) => !open && onCancel()}
    >
      {item && (
        <AlertDialogContent
          // Cancel, not the approve button, gets focus, so an accidental Enter
          // never approves. Set explicitly rather than relying on Radix's default.
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            cancelRef.current?.focus()
          }}
          // The queue moves focus itself after the dialog closes
          onCloseAutoFocus={(event) => event.preventDefault()}
          className="sm:max-w-md"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              Approve {formatAmount(item.request.amount)}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2">
                <p>
                  {item.agent.name} → {item.request.vendor} on{" "}
                  {chainName(item.request.chain, "full")}.
                </p>
                {item.request.amount > CONFIRM_ABOVE && (
                  <p>This is above {formatAmount(CONFIRM_ABOVE)}.</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {warning && (
            <div className="flex gap-2 rounded-md border border-status-review-border bg-status-review-bg p-3 text-status-review-fg">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col gap-1">
                <p className="font-semibold">Limit warning</p>
                <ul className="flex flex-col gap-1">
                  {warning.breaches.map((breach) => (
                    <li key={breach.code}>{breach.sentence}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel ref={cancelRef}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => onConfirm(item, warning !== undefined)}
            >
              {warning ? "Approve anyway" : "Approve"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  )
}
