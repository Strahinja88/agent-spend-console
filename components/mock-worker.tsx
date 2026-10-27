"use client"

import { useEffect } from "react"

import { worker } from "@/mocks/browser"
import { configureMocks, type MockConfig } from "@/mocks/config"

declare global {
  interface Window {
    /** Set by e2e tests before the page loads: no random failures, short latency (D-022). */
    __ASC_MOCK__?: Partial<
      Pick<MockConfig, "latencyMs" | "mutationFailureRate">
    >
  }
}

let starting: Promise<unknown> | undefined

function applyTestOverrides() {
  const overrides = window.__ASC_MOCK__
  if (!overrides) return
  const { latencyMs, mutationFailureRate } = overrides
  configureMocks({
    ...(latencyMs && { latencyMs }),
    ...(typeof mutationFailureRate === "number" && { mutationFailureRate }),
  })
}

/**
 * Starts the MSW service worker, then calls `onReady`. Browser only: loaded
 * through next/dynamic with ssr: false, because msw/browser has no Node build.
 */
export default function MockWorker({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    let active = true
    applyTestOverrides()
    starting ??= worker.start({ onUnhandledFrame: "bypass", quiet: true })
    // If the worker can't start, let queries run anyway so screens show their
    // error state instead of loading forever.
    starting
      .catch(() => undefined)
      .finally(() => {
        if (active) onReady()
      })
    return () => {
      active = false
    }
  }, [onReady])

  return null
}
