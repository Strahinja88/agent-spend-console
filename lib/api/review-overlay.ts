"use client"

import { useSyncExternalStore } from "react"

// Decisions the reviewer has approved or rejected but the server may still list
// as waiting: during the undo window, while the request is in flight, and until
// the next fetch catches up. The queue and the sidebar count both read this, so
// they agree and update together (D-012, D-014).
//
// Module-level rather than React state so it survives the queue unmounting
// (e.g. navigating away while an approval is still pending).

let hidden: ReadonlySet<string> = new Set()
const listeners = new Set<() => void>()

function set(next: ReadonlySet<string>) {
  hidden = next
  for (const listener of listeners) listener()
}

export function hideDecision(id: string) {
  if (hidden.has(id)) return
  set(new Set(hidden).add(id))
}

export function restoreDecision(id: string) {
  if (!hidden.has(id)) return
  const next = new Set(hidden)
  next.delete(id)
  set(next)
}

/** Drops ids the server no longer lists: there's nothing left to hide. */
export function pruneHidden(listedIds: Iterable<string>) {
  const listed = new Set(listedIds)
  const next = new Set([...hidden].filter((id) => listed.has(id)))
  if (next.size !== hidden.size) set(next)
}

export function hiddenDecisions(): ReadonlySet<string> {
  return hidden
}

/** Tests only. */
export function resetReviewOverlay() {
  set(new Set())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useHiddenDecisions(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, hiddenDecisions, hiddenDecisions)
}
