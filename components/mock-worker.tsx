"use client"

import { useEffect } from "react"

import { worker } from "@/mocks/browser"

let starting: Promise<unknown> | undefined

/**
 * Starts the MSW service worker, then calls `onReady`. Browser only: loaded
 * through next/dynamic with ssr: false, because msw/browser has no Node build.
 */
export default function MockWorker({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    let active = true
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
