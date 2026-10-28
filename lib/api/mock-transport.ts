import { configureMocks, type MockConfig } from "@/mocks/config"

import { setApiTransport } from "./client"

declare global {
  interface Window {
    /** Set by e2e tests before the page loads: no random failures, short latency (D-022). */
    __ASC_MOCK__?: Partial<
      Pick<MockConfig, "latencyMs" | "mutationFailureRate">
    >
  }
}

let mockApi: Promise<typeof import("@/mocks/api")> | undefined

function applyTestOverrides() {
  const overrides = window.__ASC_MOCK__
  if (!overrides) return
  const { latencyMs, mutationFailureRate } = overrides
  configureMocks({
    ...(latencyMs && { latencyMs }),
    ...(typeof mutationFailureRate === "number" && { mutationFailureRate }),
  })
}

// The seed and signing key load with the first request, not with the page
function loadMockApi() {
  mockApi ??= import("@/mocks/api").then((api) => {
    applyTestOverrides()
    return api
  })
  return mockApi
}

/**
 * Earlier builds ran the mock API in an MSW service worker. A returning
 * visitor may still have it installed; it would only pass requests through,
 * but there's no reason to keep it.
 */
function removeOldWorker() {
  navigator.serviceWorker
    ?.getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        const worker =
          registration.active ?? registration.waiting ?? registration.installing
        if (worker?.scriptURL.endsWith("/mockServiceWorker.js")) {
          void registration.unregister()
        }
      }
    })
    .catch(() => {})
}

/**
 * Sends every API request straight to the mock handlers in this page's
 * memory, with no network and no service worker (D-025). Requests and
 * responses are still real `Request`/`Response` objects, so bodies go
 * through JSON (bigints as strings) exactly as they would over HTTP.
 * Browser only; on the server it does nothing.
 */
export function installMockApi() {
  if (typeof window === "undefined") return
  setApiTransport(async (request) => {
    const { handleApiRequest } = await loadMockApi()
    return handleApiRequest(request)
  })
  removeOldWorker()
}
