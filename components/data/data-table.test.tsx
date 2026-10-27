import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { DataTable } from "./data-table"

type Item = { id: string; name: string; amount: number }

const columns: ColumnDef<Item>[] = [
  { accessorKey: "name", header: "Name", enableSorting: false },
  {
    accessorKey: "amount",
    header: "Amount",
    meta: { className: "text-right" },
  },
]

const data: Item[] = [
  { id: "a", name: "Alpha", amount: 2 },
  { id: "b", name: "Beta", amount: 1 },
]

function Harness(props: {
  selectedId?: string
  onRowSelect?: (id: string) => void
  loading?: boolean
  rows?: Item[]
}) {
  const table = useReactTable({
    data: props.rows ?? data,
    columns,
    getRowId: (item) => item.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  return (
    <DataTable<Item>
      table={table}
      label="Things"
      selectedId={props.selectedId}
      onRowSelect={props.onRowSelect && ((row) => props.onRowSelect?.(row.id))}
      loading={props.loading}
      empty={<p>Nothing here</p>}
    />
  )
}

describe("DataTable", () => {
  it("uses column headers with aria-sort only where sortable", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    expect(
      screen.getByRole("columnheader", { name: "Name" }),
    ).not.toHaveAttribute("aria-sort")
    const amount = screen.getByRole("columnheader", { name: /Amount/ })
    expect(amount).toHaveAttribute("aria-sort", "none")

    await user.click(within(amount).getByRole("button"))
    // TanStack sorts numbers descending first
    expect(amount).toHaveAttribute("aria-sort", "descending")
  })

  it("marks the selected row and puts only it in the tab order", () => {
    render(<Harness selectedId="b" onRowSelect={() => {}} />)
    const [, alpha, beta] = screen.getAllByRole("row")
    expect(beta).toHaveAttribute("aria-selected", "true")
    expect(beta).toHaveAttribute("tabindex", "0")
    expect(alpha).toHaveAttribute("aria-selected", "false")
    expect(alpha).toHaveAttribute("tabindex", "-1")
  })

  it("selects with click, Enter and Space", async () => {
    const user = userEvent.setup()
    const onRowSelect = vi.fn()
    render(<Harness onRowSelect={onRowSelect} />)
    const [, alpha, beta] = screen.getAllByRole("row")

    await user.click(beta!)
    alpha!.focus()
    await user.keyboard("{Enter}")
    await user.keyboard(" ")
    expect(onRowSelect.mock.calls).toEqual([["b"], ["a"], ["a"]])
  })

  it("shows skeleton rows while loading and the empty slot when there are no rows", () => {
    const { rerender } = render(<Harness loading rows={[]} />)
    expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true")
    expect(screen.getAllByRole("row")).toHaveLength(9) // header + 8

    rerender(<Harness rows={[]} />)
    expect(screen.getByText("Nothing here")).toBeInTheDocument()
  })
})
