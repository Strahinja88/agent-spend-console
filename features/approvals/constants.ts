import { usdc } from "@/lib/format/amount"

/** Approvals above this need a confirm dialog instead of the undo toast (design.md §6.1). */
export const CONFIRM_ABOVE = usdc("1000")

/** How long the "Approved · Undo" toast waits before the approval is sent. */
export const UNDO_MS = 5_000

/** Error toasts stay longer, so Retry is easy to reach. */
export const ERROR_TOAST_MS = 10_000
