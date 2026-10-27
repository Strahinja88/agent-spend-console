"use client"

import {
  flexRender,
  type Header,
  type Row,
  type RowData,
  type Table,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Applied to both the header and the cells, e.g. "text-right" or "hidden md:table-cell". */
    className?: string
  }
}

type DataTableProps<T> = {
  table: Table<T>
  /** Accessible name of the table. */
  label: string
  selectedId?: string
  onRowSelect?: (row: Row<T>) => void
  /** Shows skeleton rows at real row height. */
  loading?: boolean
  /** Shown instead of the table when there are no rows (and not loading). */
  empty?: React.ReactNode
  /** Shown instead of the table when set. */
  error?: React.ReactNode
  /** Extra classes for every data row, e.g. "relative" for a stretched link. */
  rowClassName?: string
  className?: string
}

const SKELETON_ROWS = 8

/**
 * A semantic, dense table (design.md §4). Rows are selectable with click,
 * Enter or Space; the selected row is the one in the tab order (roving
 * tabindex), so Tab lands on it and moving the selection moves focus.
 */
export function DataTable<T>({
  table,
  label,
  selectedId,
  onRowSelect,
  loading = false,
  empty,
  error,
  rowClassName,
  className,
}: DataTableProps<T>) {
  if (error) return <>{error}</>

  const rows = table.getRowModel().rows
  if (!loading && rows.length === 0 && empty) return <>{empty}</>

  const focusableId =
    rows.find((row) => row.id === selectedId)?.id ?? rows[0]?.id
  const columns = table.getVisibleLeafColumns()

  return (
    <div
      className={cn(
        "overflow-auto rounded-lg border border-border bg-surface",
        className,
      )}
    >
      <table aria-label={label} aria-busy={loading} className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-surface-sunken">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <HeaderCell key={header.id} header={header} />
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={i} className="h-9 border-t border-border">
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={cn("px-3", column.columnDef.meta?.className)}
                    >
                      <Skeleton className="h-3.5 w-full max-w-28" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => {
                const selected = row.id === selectedId
                return (
                  <tr
                    key={row.id}
                    data-row-id={row.id}
                    tabIndex={onRowSelect && row.id === focusableId ? 0 : -1}
                    aria-selected={onRowSelect ? selected : undefined}
                    onClick={onRowSelect && (() => onRowSelect(row))}
                    onKeyDown={
                      onRowSelect &&
                      ((event) => {
                        if (event.target !== event.currentTarget) return
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onRowSelect(row)
                        }
                      })
                    }
                    className={cn(
                      "h-9 border-t border-border outline-offset-[-2px]",
                      rowClassName,
                      onRowSelect &&
                        "cursor-pointer hover:bg-surface-sunken focus-visible:outline-2 focus-visible:outline-ring",
                      // Not colour alone: a left bar and aria-selected too
                      selected &&
                        "bg-brand-muted shadow-[inset_2px_0_0_var(--brand)] hover:bg-brand-muted",
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-3 py-1.5",
                          cell.column.columnDef.meta?.className,
                        )}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
        </tbody>
      </table>
    </div>
  )
}

function HeaderCell<T>({ header }: { header: Header<T, unknown> }) {
  const { column } = header
  const sorted = column.getIsSorted()
  const content = header.isPlaceholder
    ? null
    : flexRender(column.columnDef.header, header.getContext())
  const SortIcon =
    sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown

  return (
    <th
      scope="col"
      aria-sort={
        column.getCanSort()
          ? sorted === "asc"
            ? "ascending"
            : sorted === "desc"
              ? "descending"
              : "none"
          : undefined
      }
      className={cn(
        "h-9 px-3 text-left font-medium whitespace-nowrap text-muted-foreground",
        column.columnDef.meta?.className,
      )}
    >
      {column.getCanSort() ? (
        <button
          type="button"
          onClick={column.getToggleSortingHandler()}
          className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 hover:text-foreground"
        >
          {content}
          <SortIcon aria-hidden className="size-3.5" />
        </button>
      ) : (
        content
      )}
    </th>
  )
}
