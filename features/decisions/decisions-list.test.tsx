import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { server } from "@/mocks/node"

import { renderWithProviders, setupMockApi } from "../approvals/test-utils"
import { DecisionsList } from "./decisions-list"

// An in-memory URL, so filters round-trip through useSearchParams like in the app
const nav = vi.hoisted(() => {
  let search = ""
  let params = new URLSearchParams()
  const listeners = new Set<() => void>()
  return {
    get search() {
      return search
    },
    set(next: string) {
      search = next
      params = new URLSearchParams(next)
      listeners.forEach((listener) => listener())
    },
    params: () => params,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
})

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react")
  return {
    usePathname: () => "/decisions",
    useSearchParams: () => useSyncExternalStore(nav.subscribe, nav.params),
    useRouter: () => ({
      replace: (url: string) => nav.set(url.split("?")[1] ?? ""),
    }),
  }
})

const api = setupMockApi()

beforeEach(() => nav.set(""))

function table() {
  return screen.getByRole("table", { name: "Decisions" })
}

async function waitForRows() {
  await waitFor(() => expect(table()).toHaveAttribute("aria-busy", "false"))
  return within(table()).getAllByRole("row").slice(1)
}

describe("DecisionsList", () => {
  it("shows skeleton rows while loading", () => {
    renderWithProviders(<DecisionsList />)
    expect(table()).toHaveAttribute("aria-busy", "true")
  })

  it("lists decisions newest first, 25 per page, each linking to its detail", async () => {
    const user = userEvent.setup()
    renderWithProviders(<DecisionsList />)
    const rows = await waitForRows()
    expect(rows).toHaveLength(25)

    // Desktop and mobile layouts each hold one link (one is hidden by CSS)
    const [link] = within(rows[0]!).getAllByRole("link")
    expect(link).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/decisions\/dec_/),
    )
    expect(link).toHaveAccessibleName(/: [\d,]+\.\d+ USDC to /)

    expect(screen.getByText(/^Page 1 of \d+$/)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Next" }))
    expect(screen.getByText(/^Page 2 of \d+$/)).toBeInTheDocument()
  })

  it("filters by outcome on the server and keeps the filter in the URL", async () => {
    const user = userEvent.setup()
    renderWithProviders(<DecisionsList />)
    await waitForRows()

    await user.click(screen.getByRole("radio", { name: "Denied" }))
    expect(nav.search).toBe("outcome=deny")
    await waitFor(() =>
      expect(within(table()).queryByText("Allowed")).toBeNull(),
    )
    expect(within(table()).getAllByText("Denied").length).toBeGreaterThan(0)
    expect(screen.getByRole("radio", { name: "Denied" })).toHaveAttribute(
      "aria-checked",
      "true",
    )
    expect(api.gets("/api/decisions")).toHaveLength(2)
  })

  it("reads filters from the URL, and Clear filters resets them", async () => {
    // Data Pipeline has no review threshold, so nothing was sent to review
    nav.set("outcome=review&agent=agt_data")
    const user = userEvent.setup()
    renderWithProviders(<DecisionsList />)

    expect(
      await screen.findByText("No results for these filters"),
    ).toBeInTheDocument()
    const [clear] = screen.getAllByRole("button", { name: "Clear filters" })
    await user.click(clear!)

    expect(nav.search).toBe("")
    expect(await waitForRows()).toHaveLength(25)
  })

  it("shows an empty state when there are no decisions", async () => {
    server.use(http.get("*/api/decisions", () => Response.json([])))
    renderWithProviders(<DecisionsList />)
    expect(await screen.findByText("No decisions yet")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clear filters" })).toBeNull()
  })

  it("shows an error with Retry when loading fails", async () => {
    server.use(
      http.get(
        "*/api/decisions",
        () =>
          Response.json(
            { code: "SIMULATED_FAILURE", message: "x" },
            { status: 500 },
          ),
        { once: true },
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<DecisionsList />)

    expect(
      await screen.findByText("Couldn't load decisions"),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(await waitForRows()).toHaveLength(25)
  })
})
