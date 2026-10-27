import type { ColumnDef } from "@tanstack/react-table"

import { Amount } from "@/components/data/amount"
import { RelativeTime } from "@/components/data/relative-time"
import { Badge } from "@/components/ui/badge"
import type { QueueItem } from "@/lib/api/contract"
import type { Decision } from "@/lib/domain/types"
import { formatAmount } from "@/lib/format/amount"
import { chainName } from "@/lib/format/chain"

/** Short form for the table: "Above 100.00 USDC review threshold". */
export function triggerText(decision: Decision): string {
  return decision.matchedRule?.kind === "review_threshold"
    ? `Above ${formatAmount(decision.matchedRule.amount)} review threshold`
    : decision.reason
}

const WIDE_ONLY = "hidden md:table-cell"

export function queueColumns(
  newIds: ReadonlySet<string>,
): ColumnDef<QueueItem>[] {
  return [
    {
      id: "agent",
      header: "Agent",
      accessorFn: (item) => item.agent.name,
      sortingFn: "text",
      cell: ({ row }) => (
        <span className="flex items-center gap-2 font-medium whitespace-nowrap">
          {row.original.agent.name}
          {newIds.has(row.id) && <Badge variant="secondary">New</Badge>}
        </span>
      ),
    },
    {
      id: "vendor",
      header: "Vendor",
      enableSorting: false,
      cell: ({ row }) => (
        <span className="flex flex-col">
          <span className="whitespace-nowrap">
            {row.original.request.vendor}
          </span>
          {/* Chain has its own column from md up */}
          <span className="text-xs text-muted-foreground md:hidden">
            {chainName(row.original.request.chain)}
          </span>
        </span>
      ),
    },
    {
      id: "amount",
      header: "Amount",
      accessorFn: (item) => item.request.amount,
      // "basic" compares with < and >, which is exact for bigint
      sortingFn: "basic",
      sortDescFirst: true,
      meta: { className: "text-right" },
      cell: ({ row }) => <Amount value={row.original.request.amount} />,
    },
    {
      id: "chain",
      header: "Chain",
      enableSorting: false,
      meta: { className: WIDE_ONLY },
      cell: ({ row }) => chainName(row.original.request.chain),
    },
    {
      id: "age",
      header: "Age",
      // Ascending age = newest first
      accessorFn: (item) => -Date.parse(item.request.createdAt),
      sortingFn: "basic",
      cell: ({ row }) => <RelativeTime iso={row.original.request.createdAt} />,
    },
    {
      id: "rule",
      header: "Trigger rule",
      enableSorting: false,
      meta: { className: `${WIDE_ONLY} text-muted-foreground` },
      cell: ({ row }) => triggerText(row.original.decision),
    },
  ]
}
