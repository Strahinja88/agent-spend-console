"use client"

import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ChevronLeft, ChevronRight, Scale, SearchX } from "lucide-react"

import { DataTable } from "@/components/data/data-table"
import { EmptyState } from "@/components/data/empty-state"
import { ErrorState } from "@/components/data/error-state"
import { Button } from "@/components/ui/button"
import { useAgents, useDecisions } from "@/lib/api/decisions"

import { decisionColumns } from "./decision-columns"
import { DecisionFilters } from "./decision-filters"
import { useDecisionFilters } from "./use-decision-filters"

export const PAGE_SIZE = 25

export function DecisionsList() {
  const [filters, setFilters] = useDecisionFilters()
  const query = useDecisions(filters)
  const agents = useAgents()

  const table = useReactTable({
    data: query.data ?? [],
    columns: decisionColumns,
    getRowId: (item) => item.decision.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    // New data (another filter) goes back to page 1
    autoResetPageIndex: true,
    initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZE } },
  })

  const loadError = query.isError && !query.data
  const filtersActive =
    filters.outcome !== undefined || filters.agentId !== undefined
  const total = query.data?.length ?? 0
  const pageCount = table.getPageCount()

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-lg font-semibold">Decisions</h1>
        {query.data && (
          <p className="ml-auto text-muted-foreground tabular-nums">
            {total === 1 ? "1 decision" : `${total} decisions`}
          </p>
        )}
      </div>

      {!loadError && (
        <DecisionFilters
          agents={agents.data ?? []}
          filters={filters}
          onChange={setFilters}
        />
      )}

      <DataTable
        table={table}
        label="Decisions"
        loading={query.isPending}
        rowClassName="relative hover:bg-surface-sunken"
        error={
          loadError && (
            <ErrorState
              title="Couldn't load decisions"
              description="The request didn't go through."
              onRetry={() => void query.refetch()}
            />
          )
        }
        empty={
          filtersActive ? (
            <EmptyState
              icon={SearchX}
              title="No results for these filters"
              action={
                <Button variant="outline" onClick={() => setFilters({})}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Scale}
              title="No decisions yet"
              description="Every allow, review and deny decision will be listed here."
            />
          )
        }
      />

      {pageCount > 1 && (
        <nav
          aria-label="Pages"
          className="flex items-center justify-end gap-2 text-muted-foreground"
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft aria-hidden />
            Previous
          </Button>
          <p className="tabular-nums" aria-live="polite">
            Page {table.getState().pagination.pageIndex + 1} of {pageCount}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight aria-hidden />
          </Button>
        </nav>
      )}
    </div>
  )
}
