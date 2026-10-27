"use client"

import dynamic from "next/dynamic"
import { useCallback, useState } from "react"

import { ApiReadyContext } from "@/lib/api/api-ready"

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
