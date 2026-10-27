import type { ColumnDef } from "@tanstack/react-table"
import Link from "next/link"

import { Amount } from "@/components/data/amount"
import { RelativeTime } from "@/components/data/relative-time"
import { StatusPill } from "@/components/data/status-pill"
import type { DecisionListItem } from "@/lib/api/contract"
import { displayState } from "@/lib/domain/display-state"
import { formatAmount } from "@/lib/format/amount"

const WIDE_ONLY = "hidden md:table-cell"

/**
 * The row's link. A stretched `after:` box makes the whole row (it is
 * `relative`) clickable, while there is still one real <a> per row. The
 * hidden text tells link lists apart ("Ops Agent" alone repeats).
 */
function DecisionLink({ item }: { item: DecisionListItem }) {
  return (
    <Link
      href={`/decisions/${encodeURIComponent(item.decision.id)}`}
      className="font-medium after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
    >
      {item.agent.name}
      <span className="sr-only">
        : {formatAmount(item.request.amount)} to {item.request.vendor}
      </span>
    </Link>
  )
}

export const decisionColumns: ColumnDef<DecisionListItem>[] = [
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => {
      const { decision } = row.original
      const state = displayState(decision)
      return (
        <span className="flex flex-col items-start gap-0.5">
          <StatusPill status={state.status} label={state.label} />
          <span className="font-mono text-xs text-subtle-foreground">
            {decision.reasonCode}
          </span>
        </span>
      )
    },
  },
  {
    id: "agent",
    header: "Agent",
    meta: { className: WIDE_ONLY },
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        <DecisionLink item={row.original} />
      </span>
    ),
  },
  {
    id: "vendor",
    header: "Vendor",
    cell: ({ row }) => (
      <span className="flex flex-col">
        <span className="whitespace-nowrap">{row.original.request.vendor}</span>
        {/* Agent and time have their own columns from md up */}
        <span className="flex gap-1 text-xs text-muted-foreground md:hidden">
          <DecisionLink item={row.original} /> ·
          <RelativeTime iso={row.original.request.createdAt} />
        </span>
      </span>
    ),
  },
  {
    id: "amount",
    header: "Amount",
    meta: { className: "text-right" },
    cell: ({ row }) => <Amount value={row.original.request.amount} />,
  },
  {
    id: "when",
    header: "When",
    meta: { className: `${WIDE_ONLY} text-muted-foreground` },
    cell: ({ row }) => <RelativeTime iso={row.original.request.createdAt} />,
  },
]
