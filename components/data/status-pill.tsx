import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleX,
  type LucideIcon,
} from "lucide-react"

import type { StatusKind } from "@/lib/domain/display-state"
import { cn } from "@/lib/utils"

const STATUS: Record<StatusKind, { icon: LucideIcon; className: string }> = {
  allow: {
    icon: CircleCheck,
    className:
      "border-status-allow-border bg-status-allow-bg text-status-allow-fg",
  },
  review: {
    icon: CircleAlert,
    className:
      "border-status-review-border bg-status-review-bg text-status-review-fg",
  },
  deny: {
    icon: CircleX,
    className:
      "border-status-deny-border bg-status-deny-bg text-status-deny-fg",
  },
  pending: {
    icon: CircleDashed,
    className:
      "border-status-pending-border bg-status-pending-bg text-status-pending-fg",
  },
}

type StatusPillProps = {
  status: StatusKind
  label: string
  className?: string
}

/** Icon + label, never colour alone (design.md §4). The label carries the meaning. */
export function StatusPill({ status, label, className }: StatusPillProps) {
  const { icon: Icon, className: tone } = STATUS[status]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tone,
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {label}
    </span>
  )
}
