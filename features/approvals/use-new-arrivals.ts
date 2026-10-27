"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import type { QueueItem } from "@/lib/api/contract"

/**
 * Spots requests that arrive with a poll (design.md §6.1). The first load is
 * not "new". Returns the ids to badge and a sentence for the live region.
 * A badge clears when its row is selected.
 */
export function useNewArrivals(items: QueueItem[] | undefined) {
  const seen = useRef<Set<string> | null>(null)
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set())
  const [announcement, setAnnouncement] = useState("")

  useEffect(() => {
    if (!items) return
    const ids = items.map((item) => item.decision.id)
    if (!seen.current) {
      seen.current = new Set(ids)
      return
    }
    const arrived = ids.filter((id) => !seen.current?.has(id))
    if (arrived.length === 0) return

    for (const id of arrived) seen.current.add(id)
    setNewIds((current) => new Set([...current, ...arrived]))
    setAnnouncement(
      arrived.length === 1
        ? "1 new request waiting"
        : `${arrived.length} new requests waiting`,
    )
  }, [items])

  const clearNew = useCallback((id: string) => {
    setNewIds((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }, [])

  return { newIds, announcement, clearNew }
}
