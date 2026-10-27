"use client"

import dynamic from "next/dynamic"
import { useCallback, useState } from "react"

import { ApiReadyContext, useApiReady } from "@/lib/api/api-ready"

// The mock API is the demo's only backend, so it runs in every build,
// production included (D-011).
const MockWorker = dynamic(() => import("./mock-worker"), { ssr: false })

export function MockProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const onReady = useCallback(() => setReady(true), [])

  return (
    <ApiReadyContext value={ready}>
      <MockWorker onReady={onReady} />
      {children}
    </ApiReadyContext>
  )
}

/**
 * Mounts the page only once the mock API is up, so no screen can send a
 * request the worker doesn't see (D-024). The shell around it renders
 * straight away; its waiting count is held back by `useApiReady`.
 */
export function MockReady({ children }: { children: React.ReactNode }) {
  if (useApiReady()) return children
  return (
    <p role="status" aria-busy="true" className="text-sm text-muted-foreground">
      Starting the demo API…
    </p>
  )
}
