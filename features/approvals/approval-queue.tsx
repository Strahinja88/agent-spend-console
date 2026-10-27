"use client"

import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
} from "@tanstack/react-table"
import { Inbox, SearchX } from "lucide-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { DataTable } from "@/components/data/data-table"
import { EmptyState } from "@/components/data/empty-state"
import { ErrorState } from "@/components/data/error-state"
import { useNow } from "@/components/data/relative-time"
import { SidePanel } from "@/components/data/side-panel"
import { Button } from "@/components/ui/button"
import { useVisibleApprovals } from "@/lib/api/approvals"
import type { QueueItem } from "@/lib/api/contract"
import type { Agent } from "@/lib/domain/types"

import { ApproveDialog, needsConfirmation } from "./approve-dialog"
import { Kbd } from "./kbd"
import { KeyboardHelp, KeyboardHelpButton } from "./keyboard-help"
import { flushApprovals } from "./pending-approvals"
import { queueColumns } from "./queue-columns"
import { QueueFilters, type QueueFilter } from "./queue-filters"
import { shortcutFor } from "./queue-keys"
import { RejectForm } from "./reject-form"
import { ReviewPanelBody } from "./review-panel"
import { useNewArrivals } from "./use-new-arrivals"
import { useReviewActions } from "./use-review-actions"
import { useShortcutsSetting } from "./use-shortcuts-setting"

function formatUpdated(updatedAt: number, now: Date): string {
  const seconds = Math.max(0, Math.round((now.getTime() - updatedAt) / 1000))
  if (seconds < 5) return "Updated just now"
  if (seconds < 60) return `Updated ${seconds}s ago`
  return `Updated ${Math.floor(seconds / 60)} min ago`
}

function uniqueAgents(items: QueueItem[]): Agent[] {
  const byId = new Map(items.map((item) => [item.agent.id, item.agent]))
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function ApprovalQueue() {
  const { query, items } = useVisibleApprovals()
  const [filter, setFilter] = useState<QueueFilter>({})
  const [sorting, setSorting] = useState<SortingState>([
    { id: "age", desc: false },
  ])
  const [selectedId, setSelectedId] = useState<string>()
  const [panelOpen, setPanelOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [confirmId, setConfirmId] = useState<string>()
  const [helpOpen, setHelpOpen] = useState(false)
  const [shortcutsEnabled, setShortcutsEnabled] = useShortcutsSetting()
  const { newIds, announcement, clearNew } = useNewArrivals(items)
  const sectionRef = useRef<HTMLElement>(null)
  const now = useNow(5_000)

  const filtered = useMemo(
    () =>
      items?.filter(
        (item) =>
          (!filter.agentId || item.agent.id === filter.agentId) &&
          (!filter.chain || item.request.chain === filter.chain),
      ) ?? [],
    [items, filter],
  )
  const columns = useMemo(() => queueColumns(newIds), [newIds])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getRowId: (item) => item.decision.id,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })
  const rows = table.getRowModel().rows
  const rowIds = rows.map((row) => row.id)
  const rowIdsRef = useRef(rowIds)
  rowIdsRef.current = rowIds

  const selected = filtered.find((item) => item.decision.id === selectedId)
  const confirmItem = items?.find((item) => item.decision.id === confirmId)

  // Focus follows the selection when asked (keyboard moves, after approve/reject/undo)
  const [focusRequest, setFocusRequest] = useState<{ id?: string }>()
  useEffect(() => {
    if (!focusRequest) return
    const row = focusRequest.id
      ? sectionRef.current?.querySelector<HTMLElement>(
          `tr[data-row-id="${CSS.escape(focusRequest.id)}"]`,
        )
      : undefined
    if (row) {
      row.focus({ preventScroll: true })
      // Focus leaving a toast (e.g. after Undo) makes sonner return it to
      // where it was before the toast. That happens once, so a second call wins.
      if (document.activeElement !== row) row.focus({ preventScroll: true })
      row.scrollIntoView({ block: "nearest" })
    } else {
      // Nothing left to focus: stay inside the queue so Esc and ? still work
      sectionRef.current?.focus()
    }
  }, [focusRequest])

  const select = useCallback(
    (id: string | undefined, { focus = true } = {}) => {
      setSelectedId(id)
      setPanelOpen(id !== undefined)
      setRejecting(false)
      if (id) clearNew(id)
      if (focus) setFocusRequest({ id })
    },
    [clearNew],
  )

  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId

  const actions = useReviewActions({
    onHide: (id) => {
      if (id !== selectedIdRef.current) return
      const ids = rowIdsRef.current
      const index = ids.indexOf(id)
      select(ids[index + 1] ?? ids[index - 1])
    },
    onRestore: (id) => select(id),
    onLimitWarning: (id) => {
      select(id, { focus: false })
      setConfirmId(id)
    },
  })
  // Leaving the page sends pending approvals now (design.md §6.1)
  useEffect(() => () => flushApprovals(), [])

  function approve(item: QueueItem) {
    if (needsConfirmation(item)) setConfirmId(item.decision.id)
    else actions.approveWithUndo(item)
  }

  function startReject() {
    if (!selected) return
    setPanelOpen(true)
    setRejecting(true)
  }

  function move(step: 1 | -1) {
    if (rowIds.length === 0) return
    const index = selectedId ? rowIds.indexOf(selectedId) : -1
    const next =
      index === -1
        ? step === 1
          ? 0
          : rowIds.length - 1
        : Math.min(rowIds.length - 1, Math.max(0, index + step))
    select(rowIds[next])
  }

  function escape() {
    if (rejecting) {
      setRejecting(false)
      setFocusRequest({ id: selectedId })
    } else if (panelOpen) {
      setPanelOpen(false)
      setFocusRequest({ id: selectedId })
    } else if (selectedId) {
      setSelectedId(undefined)
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    const action = shortcutFor(event.nativeEvent, shortcutsEnabled)
    if (!action) return
    if (action === "escape" && !rejecting && !panelOpen && !selectedId) return
    event.preventDefault()

    switch (action) {
      case "next":
        return move(1)
      case "previous":
        return move(-1)
      case "approve":
        return selected && approve(selected)
      case "reject":
        return startReject()
      case "help":
        return setHelpOpen(true)
      case "escape":
        return escape()
    }
  }

  const loading = query.isPending
  const loadError = query.isError && !query.data
  const filtersActive =
    filter.agentId !== undefined || filter.chain !== undefined

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-lg font-semibold">Approvals</h1>
        <div className="ml-auto flex items-center gap-3">
          {query.data && (
            <p className="text-xs text-subtle-foreground">
              {query.isError
                ? "Couldn't refresh. Retrying."
                : formatUpdated(query.dataUpdatedAt, now)}
            </p>
          )}
          <KeyboardHelpButton onClick={() => setHelpOpen(true)} />
        </div>
      </div>

      {!loadError && (
        <QueueFilters
          agents={uniqueAgents(items ?? [])}
          filter={filter}
          onChange={setFilter}
          count={filtered.length}
        />
      )}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <section
        ref={sectionRef}
        aria-label="Approval queue"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className="flex items-start gap-4 focus:outline-none"
      >
        <DataTable
          table={table}
          label="Requests waiting for review"
          selectedId={selectedId}
          onRowSelect={(row) => select(row.id)}
          loading={loading}
          className="min-w-0 flex-1"
          error={
            loadError && (
              <div className="flex-1">
                <ErrorState
                  title="Couldn't load approvals"
                  description="The request didn't go through. Your queue hasn't changed."
                  onRetry={() => void query.refetch()}
                />
              </div>
            )
          }
          empty={
            <div className="flex-1">
              {filtersActive ? (
                <EmptyState
                  icon={SearchX}
                  title="No results for these filters"
                  action={
                    <Button variant="outline" onClick={() => setFilter({})}>
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Inbox}
                  title="Nothing waiting for approval"
                  description="New requests that need a review will show up here."
                  action={
                    <Button variant="outline" asChild>
                      <Link href="/decisions">View recent decisions</Link>
                    </Button>
                  }
                />
              )}
            </div>
          }
        />

        {selected && (
          <SidePanel
            open={panelOpen}
            onClose={() => {
              setPanelOpen(false)
              setFocusRequest({ id: selectedId })
            }}
            title={`${selected.agent.name} → ${selected.request.vendor}`}
            description="Review request"
            footer={
              rejecting ? (
                <RejectForm
                  onCancel={() => setRejecting(false)}
                  onConfirm={(reason) => actions.reject(selected, reason)}
                />
              ) : (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="destructive"
                    aria-keyshortcuts="r"
                    onClick={startReject}
                  >
                    Reject
                    <Kbd
                      aria-hidden
                      className="border-transparent bg-transparent text-current"
                    >
                      r
                    </Kbd>
                  </Button>
                  <Button
                    aria-keyshortcuts="a"
                    onClick={() => approve(selected)}
                  >
                    Approve
                    <Kbd
                      aria-hidden
                      className="border-transparent bg-transparent text-current"
                    >
                      a
                    </Kbd>
                  </Button>
                </div>
              )
            }
          >
            <ReviewPanelBody item={selected} />
          </SidePanel>
        )}
      </section>

      <ApproveDialog
        item={confirmItem}
        onCancel={() => {
          setConfirmId(undefined)
          setFocusRequest({ id: selectedId })
        }}
        onConfirm={(item, acknowledge) => {
          setConfirmId(undefined)
          actions.approveNow(item, acknowledge)
        }}
      />

      <KeyboardHelp
        open={helpOpen}
        onOpenChange={setHelpOpen}
        enabled={shortcutsEnabled}
        onEnabledChange={setShortcutsEnabled}
      />
    </div>
  )
}
