import { focusManager } from "@tanstack/react-query"
import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it, vi } from "vitest"

import { MainNav } from "@/components/main-nav"
import { ApprovalQueue } from "@/features/approvals/approval-queue"
import { UNDO_MS } from "@/features/approvals/constants"
import {
  renderWithProviders,
  setupMockApi,
} from "@/features/approvals/test-utils"
import { POLL_MS } from "@/lib/api/approvals"
import { configureMocks } from "@/mocks/config"
import { server } from "@/mocks/node"

vi.mock("next/navigation", () => ({ usePathname: () => "/approvals" }))

const api = setupMockApi()

afterEach(() => focusManager.setFocused(undefined))

function setup(ui: React.ReactNode) {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderWithProviders(ui)
  return user
}

const approvalsLink = () =>
  within(screen.getByRole("navigation", { name: "Main" })).getByRole("link", {
    name: /^Approvals/,
  })

describe("MainNav: waiting count", () => {
  it("labels the link with the count", async () => {
    setup(<MainNav />)
    await waitFor(() =>
      expect(approvalsLink()).toHaveAccessibleName("Approvals, 12 waiting"),
    )
  })

  it("updates optimistically on approve, and goes back up on Undo", async () => {
    const user = setup(
      <>
        <MainNav />
        <ApprovalQueue />
      </>,
    )
    await waitFor(() =>
      expect(approvalsLink()).toHaveAccessibleName("Approvals, 12 waiting"),
    )

    await user.click(screen.getByRole("row", { name: /Weather API/ }))
    await user.click(
      within(screen.getByRole("complementary")).getByRole("button", {
        name: "Approve",
      }),
    )
    // Before anything is sent
    expect(approvalsLink()).toHaveAccessibleName("Approvals, 11 waiting")
    expect(api.posts("/approve")).toHaveLength(0)

    await user.click(await screen.findByRole("button", { name: "Undo" }))
    expect(approvalsLink()).toHaveAccessibleName("Approvals, 12 waiting")
  })

  it("goes back up when the request fails", async () => {
    configureMocks({ mutationFailureRate: 1 })
    const user = setup(
      <>
        <MainNav />
        <ApprovalQueue />
      </>,
    )
    await waitFor(() =>
      expect(approvalsLink()).toHaveAccessibleName("Approvals, 12 waiting"),
    )

    await user.click(screen.getByRole("row", { name: /Weather API/ }))
    await user.keyboard("a")
    expect(approvalsLink()).toHaveAccessibleName("Approvals, 11 waiting")

    await act(() => vi.advanceTimersByTimeAsync(UNDO_MS + 100))
    await waitFor(() =>
      expect(approvalsLink()).toHaveAccessibleName("Approvals, 12 waiting"),
    )
  })

  it("shares one request per poll with the queue", async () => {
    setup(
      <>
        <MainNav />
        <ApprovalQueue />
      </>,
    )
    await waitFor(() => expect(api.gets("/api/approvals")).toHaveLength(1))

    await act(() => vi.advanceTimersByTimeAsync(POLL_MS))
    await waitFor(() => expect(api.gets("/api/approvals")).toHaveLength(2))
  })

  it("doesn't poll while the tab is hidden", async () => {
    setup(<MainNav />)
    await waitFor(() => expect(api.gets("/api/approvals")).toHaveLength(1))

    act(() => focusManager.setFocused(false))
    await act(() => vi.advanceTimersByTimeAsync(POLL_MS * 3))
    expect(api.gets("/api/approvals")).toHaveLength(1)
  })

  it("shows no count when nothing is waiting", async () => {
    server.use(http.get("*/api/approvals", () => HttpResponse.json([])))
    setup(<MainNav />)
    await waitFor(() => expect(api.gets("/api/approvals")).toHaveLength(1))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(approvalsLink()).toHaveAccessibleName("Approvals")
  })

  it("shows no count when loading fails", async () => {
    server.use(
      http.get("*/api/approvals", () =>
        HttpResponse.json({ code: "NOT_FOUND", message: "x" }, { status: 500 }),
      ),
    )
    setup(<MainNav />)
    await waitFor(() => expect(api.gets("/api/approvals")).toHaveLength(1))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(approvalsLink()).toHaveAccessibleName("Approvals")
  })
})
