import { setupWorker } from "msw/browser"

import { handlers } from "./handlers"

/** MSW in the browser, started by components/mock-worker.tsx. */
export const worker = setupWorker(...handlers)

/**
 * Asks the worker to mock this page again. The worker keeps the pages it
 * mocks in memory only, so when the browser stops it while idle it forgets
 * this page and lets requests through to Next.js (D-024). Resolves false if
 * the page has no worker or it doesn't answer in time.
 */
export function reactivateWorker(timeoutMs = 3_000): Promise<boolean> {
  const controller = navigator.serviceWorker?.controller
  if (!controller) return Promise.resolve(false)

  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      clearTimeout(timer)
      navigator.serviceWorker.removeEventListener("message", onMessage)
      resolve(ok)
    }
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "MOCKING_ENABLED") return
      // The worker waits for a reply on this port; answer so it can settle
      event.ports[0]?.postMessage({})
      finish(true)
    }
    const timer = setTimeout(() => finish(false), timeoutMs)
    navigator.serviceWorker.addEventListener("message", onMessage)
    // The same message worker.start() sends; the worker treats it as idempotent
    controller.postMessage("MOCK_ACTIVATE")
  })
}
