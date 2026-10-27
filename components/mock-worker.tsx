"use client"

import { useEffect } from "react"

import { setApiRecovery } from "@/lib/api/client"
import { reactivateWorker, worker } from "@/mocks/browser"
import { configureMocks, type MockConfig } from "@/mocks/config"

declare global {
  interface Window {
    /** Set by e2e tests before the page loads: no random failures, short latency (D-022). */
    __ASC_MOCK__?: Partial<
      Pick<MockConfig, "latencyMs" | "mutationFailureRate">
    >
  }
}

const RELOAD_KEY = "asc:mock-reload"

let starting: Promise<boolean> | undefined
let recovering: Promise<boolean> | undefined

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
 * Reloads the page so the worker controls it, at most once until a load
 * succeeds: if a reload doesn't help, the next one won't either. Returns
 * whether it reloaded.
 */
function reloadOnce(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false
    sessionStorage.setItem(RELOAD_KEY, "1")
  } catch {
    return false // No storage, no loop guard: don't reload
  }
  location.reload()
  return true
}

function clearReloadGuard() {
  try {
    sessionStorage.removeItem(RELOAD_KEY)
  } catch {
    // Nothing to clear
  }
}

/** A worker that just activated claims the page; give it a moment to land. */
function waitForController(timeoutMs: number): Promise<boolean> {
  const sw = navigator.serviceWorker
  if (sw.controller) return Promise.resolve(true)
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(!!sw.controller), timeoutMs)
    sw.addEventListener(
      "controllerchange",
      () => {
        clearTimeout(timer)
        resolve(true)
      },
      { once: true },
    )
  })
}

/**
 * Starts the worker and resolves true when the app may render. Resolves
 * false while a reload is on its way. A hard reload (Shift+Reload) skips
 * service workers, so the page has no controller and MSW can't see its
 * requests: reload once into the worker (D-024).
 */
async function start(): Promise<boolean> {
  try {
    await worker.start({ onUnhandledFrame: "bypass", quiet: true })
  } catch {
    // No worker: render anyway, so screens show their error state
    return true
  }
  if (await waitForController(1_000)) {
    clearReloadGuard()
    return true
  }
  return !reloadOnce()
}

/**
 * Called by the fetch layer when an /api request got a non-JSON answer.
 * The worker is running but has forgotten this page (the browser stopped it
 * while idle), or the page lost its controller. Concurrent failures share one
 * attempt.
 */
function recoverMockApi(): Promise<boolean> {
  recovering ??= reconnect().finally(() => {
    recovering = undefined
  })
  return recovering
}

async function reconnect(): Promise<boolean> {
  if (navigator.serviceWorker?.controller) return reactivateWorker()
  reloadOnce()
  return false
}

/**
 * Starts the MSW service worker, then calls `onReady`. Browser only: loaded
 * through next/dynamic with ssr: false, because msw/browser has no Node build.
 */
export default function MockWorker({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    let active = true
    applyTestOverrides()
    setApiRecovery(recoverMockApi)
    starting ??= start()
    void starting.then((ready) => {
      if (ready && active) onReady()
    })
    return () => {
      active = false
    }
  }, [onReady])

  return null
}
