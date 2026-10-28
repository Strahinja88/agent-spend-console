import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render } from "@testing-library/react"
import { toast, Toaster } from "sonner"
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"
import { resetReviewOverlay } from "@/lib/api/review-overlay"
import { configureMocks, mockConfig } from "@/mocks/config"
import { resetDb } from "@/mocks/db"
import { server } from "@/mocks/node"
import { DEFAULT_ANCHOR } from "@/mocks/seed/generate"

import { resetPendingApprovals } from "./pending-approvals"

export const anchor = Date.parse(DEFAULT_ANCHOR)

/** The mock API's clock. Move it forward to release held-back requests. */
export const mockClock = { now: anchor }

type Call = { method: string; path: string; body: unknown }

/**
 * MSW with the fixed anchor, no latency and no random failures, plus a log of
 * every API call the screen makes.
 */
export function setupMockApi() {
  const calls: Call[] = []
  const defaults = { ...mockConfig }

  beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
  beforeEach(() => {
    mockClock.now = anchor
    configureMocks({
      latencyMs: [0, 0],
      mutationFailureRate: 0,
      now: () => mockClock.now,
    })
    resetDb()
    resetReviewOverlay()
    resetPendingApprovals()
    // Sonner keeps toasts in module state; without this they reappear in the next test
    toast.dismiss()
    calls.length = 0

    const realFetch = globalThis.fetch
    // lib/api sends a Request; read its body from a copy
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const request = new Request(input, init)
      const body = await request.clone().text()
      calls.push({
        method: request.method,
        path: new URL(request.url).pathname,
        body: body ? JSON.parse(body) : undefined,
      })
      return realFetch(request)
    })
  })
  afterEach(() => {
    server.resetHandlers()
    vi.restoreAllMocks()
    vi.useRealTimers()
  })
  afterAll(() => {
    server.close()
    configureMocks(defaults)
  })

  return {
    calls,
    posts: (pathEnd: string) =>
      calls.filter((c) => c.method === "POST" && c.path.endsWith(pathEnd)),
    gets: (path: string) =>
      calls.filter((c) => c.method === "GET" && c.path === path),
  }
}

export function renderWithProviders(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {ui}
        <Toaster theme="light" />
      </TooltipProvider>
    </QueryClientProvider>,
  )
}
