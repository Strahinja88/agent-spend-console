import { act, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { describe, expect, it, vi } from "vitest"

import { configureMocks } from "@/mocks/config"
import { server } from "@/mocks/node"

import { ApprovalQueue } from "./approval-queue"
import { UNDO_MS } from "./constants"
import { SHORTCUTS_STORAGE_KEY } from "./use-shortcuts-setting"
import { mockClock, renderWithProviders, setupMockApi } from "./test-utils"

vi.mock("next/navigation", () => ({ usePathname: () => "/approvals" }))

const api = setupMockApi()

// The seed's queue at the test anchor (27 Oct 14:00 UTC), newest first:
// Research Bot → Weather API 120.00 is the newest, Ops Agent → Cloud GPU
// 1,250.00 needs the confirm dialog, Support Bot → SMS Gateway 250.00 has the
// limit warning (D-007).

function setup() {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  renderWithProviders(<ApprovalQueue />)
  return user
}

const table = () =>
  screen.getByRole("table", { name: "Requests waiting for review" })
const bodyRows = () => within(table()).getAllByRole("row").slice(1)
const row = (text: RegExp) => within(table()).getByRole("row", { name: text })
const queryRow = (text: RegExp) =>
  within(table()).queryByRole("row", { name: text })
const panel = () => screen.getByRole("complementary")

async function loaded() {
  await waitFor(() => expect(bodyRows()).toHaveLength(12))
}

/** Lets the undo toast run out, which is what sends a deferred approval. */
async function letUndoToastClose() {
  await act(() => vi.advanceTimersByTimeAsync(UNDO_MS + 100))
}

describe("ApprovalQueue: states", () => {
  it("shows skeleton rows, then the 12 waiting requests", async () => {
    setup()
    expect(table()).toHaveAttribute("aria-busy", "true")
    await loaded()
    expect(table()).toHaveAttribute("aria-busy", "false")
    expect(screen.getByText("12 waiting")).toBeInTheDocument()
    expect(row(/Weather API/)).toHaveTextContent(
      "Above 100.00 USDC review threshold",
    )
  })

  it("shows the empty state when nothing is waiting", async () => {
    server.use(http.get("*/api/approvals", () => HttpResponse.json([])))
    setup()
    expect(
      await screen.findByText("Nothing waiting for approval"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "View recent decisions" }),
    ).toHaveAttribute("href", "/decisions")
  })

  it("shows an error with Retry that recovers", async () => {
    server.use(
      http.get(
        "*/api/approvals",
        () =>
          HttpResponse.json(
            { code: "NOT_FOUND", message: "x" },
            { status: 500 },
          ),
        { once: true },
      ),
    )
    const user = setup()
    expect(
      await screen.findByText("Couldn't load approvals"),
    ).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Retry" }))
    await loaded()
  })
})

describe("ApprovalQueue: filters and sorting", () => {
  async function choose(
    user: ReturnType<typeof userEvent.setup>,
    label: string,
    option: string,
  ) {
    await user.click(screen.getByRole("combobox", { name: label }))
    await user.click(await screen.findByRole("option", { name: option }))
  }

  it("filters by chain and agent, with a no-results state", async () => {
    const user = setup()
    await loaded()

    await choose(user, "Chain", "Solana")
    expect(bodyRows()).toHaveLength(6)
    expect(screen.getByText("6 waiting")).toBeInTheDocument()

    await choose(user, "Agent", "Travel Agent") // Base only
    expect(screen.getByText("No results for these filters")).toBeInTheDocument()

    const clear = screen.getAllByRole("button", { name: "Clear filters" })
    await user.click(clear[0]!)
    expect(bodyRows()).toHaveLength(12)
  })

  it("sorts by amount, with aria-sort on the header", async () => {
    const user = setup()
    await loaded()

    const header = screen.getByRole("columnheader", { name: /Amount/ })
    expect(header).toHaveAttribute("aria-sort", "none")
    await user.click(within(header).getByRole("button"))

    expect(header).toHaveAttribute("aria-sort", "descending")
    expect(bodyRows()[0]).toHaveTextContent("1,250.00 USDC")
    expect(screen.getByRole("columnheader", { name: "Age" })).toHaveAttribute(
      "aria-sort",
      "none",
    )
  })
})

describe("ApprovalQueue: side panel", () => {
  it("explains the request in plain language", async () => {
    const user = setup()
    await loaded()

    await user.click(row(/Cloud GPU/))

    expect(row(/Cloud GPU/)).toHaveAttribute("aria-selected", "true")
    const body = within(panel())
    expect(body.getByText("Ops Agent → Cloud GPU")).toBeInTheDocument()
    expect(body.getByText(/Payments above/)).toHaveTextContent(
      "Payments above 100.00 USDC need review.Matched rule",
    )
    expect(body.getByRole("meter")).toHaveAttribute(
      "aria-valuetext",
      "1,730.00 USDC of 3,000.00 USDC committed today",
    )
    expect(
      body.getByText(/^Mandate v3 · approved by J. Perić/),
    ).toBeInTheDocument()
  })
})

describe("ApprovalQueue: approve up to 1,000.00 USDC", () => {
  it("hides the row at once and sends only when the undo toast closes", async () => {
    const user = setup()
    await loaded()

    await user.click(row(/Weather API/))
    await user.click(within(panel()).getByRole("button", { name: "Approve" }))

    expect(queryRow(/Weather API/)).not.toBeInTheDocument()
    expect(
      await screen.findByText("Approved · 120.00 USDC to Weather API"),
    ).toBeInTheDocument()
    // The selection moved to the next row
    expect(bodyRows()[0]).toHaveAttribute("aria-selected", "true")
    expect(api.posts("/approve")).toHaveLength(0)

    await letUndoToastClose()

    await waitFor(() => expect(api.posts("/approve")).toHaveLength(1))
    await waitFor(() => expect(bodyRows()).toHaveLength(11))
    expect(queryRow(/Weather API/)).not.toBeInTheDocument()
  })

  it("Undo brings the row back, reselects it and sends nothing", async () => {
    const user = setup()
    await loaded()

    await user.click(row(/Weather API/))
    await user.click(within(panel()).getByRole("button", { name: "Approve" }))
    await user.click(await screen.findByRole("button", { name: "Undo" }))

    expect(row(/Weather API/)).toHaveAttribute("aria-selected", "true")
    expect(row(/Weather API/)).toHaveFocus()
    await letUndoToastClose()
    expect(api.posts("/approve")).toHaveLength(0)
    expect(bodyRows()).toHaveLength(12)
  })

  it("rolls back with an error toast when the request fails, and Retry sends again", async () => {
    configureMocks({ mutationFailureRate: 1 })
    const user = setup()
    await loaded()

    await user.click(row(/Weather API/))
    await user.click(within(panel()).getByRole("button", { name: "Approve" }))
    await letUndoToastClose()

    expect(
      await screen.findByText("Couldn't approve 120.00 USDC to Weather API"),
    ).toBeInTheDocument()
    expect(row(/Weather API/)).toHaveAttribute("aria-selected", "true")

    configureMocks({ mutationFailureRate: 0 })
    await user.click(screen.getByRole("button", { name: "Retry" }))

    await waitFor(() => expect(api.posts("/approve")).toHaveLength(2))
    await waitFor(() => expect(queryRow(/Weather API/)).not.toBeInTheDocument())
  })
})

describe("ApprovalQueue: approve above 1,000.00 USDC", () => {
  it("asks for confirmation with Cancel focused, then sends immediately", async () => {
    const user = setup()
    await loaded()

    await user.click(row(/Cloud GPU/))
    await user.click(within(panel()).getByRole("button", { name: "Approve" }))

    const dialog = screen.getByRole("alertdialog", {
      name: "Approve 1,250.00 USDC?",
    })
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus()
    expect(dialog).toHaveTextContent("This is above 1,000.00 USDC.")

    await user.click(within(dialog).getByRole("button", { name: "Approve" }))

    await waitFor(() => expect(api.posts("/approve")).toHaveLength(1))
    expect(api.posts("/approve")[0]?.body).toEqual({})
    expect(queryRow(/Cloud GPU/)).not.toBeInTheDocument()
  })

  it("rolls back when the confirmed request fails", async () => {
    configureMocks({ mutationFailureRate: 1 })
    const user = setup()
    await loaded()

    await user.click(row(/Cloud GPU/))
    await user.click(within(panel()).getByRole("button", { name: "Approve" }))
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", {
        name: "Approve",
      }),
    )

    expect(
      await screen.findByText("Couldn't approve 1,250.00 USDC to Cloud GPU"),
    ).toBeInTheDocument()
    expect(row(/Cloud GPU/)).toHaveAttribute("aria-selected", "true")
  })
})

describe("ApprovalQueue: limit warning", () => {
  it("shows the breach and always goes through the dialog, Cancel first", async () => {
    const user = setup()
    await loaded()

    await user.click(row(/SMS Gateway/))
    expect(
      within(panel()).getByRole("note", { name: "Limit warning" }),
    ).toHaveTextContent(/Approving would break the current mandate \(v2\)/)

    await user.keyboard("a")
    const dialog = screen.getByRole("alertdialog")
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus()
    expect(screen.queryByText(/^Approved ·/)).not.toBeInTheDocument()

    // An accidental Enter cancels
    await user.keyboard("{Enter}")
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    expect(api.posts("/approve")).toHaveLength(0)

    await user.click(within(panel()).getByRole("button", { name: "Approve" }))
    await user.click(screen.getByRole("button", { name: "Approve anyway" }))

    await waitFor(() => expect(api.posts("/approve")).toHaveLength(1))
    expect(api.posts("/approve")[0]?.body).toEqual({
      acknowledgeLimitWarning: true,
    })
  })
})

describe("ApprovalQueue: reject", () => {
  it("needs a reason, then sends immediately", async () => {
    const user = setup()
    await loaded()

    await user.click(row(/Weather API/))
    await user.click(within(panel()).getByRole("button", { name: "Reject" }))

    const reason = screen.getByLabelText("Reason for rejecting")
    expect(reason).toHaveFocus()
    const confirm = screen.getByRole("button", { name: "Confirm reject" })
    expect(confirm).toBeDisabled()

    await user.type(reason, "   ")
    expect(confirm).toBeDisabled()
    await user.type(reason, "Duplicate order")
    await user.click(confirm)

    expect(queryRow(/Weather API/)).not.toBeInTheDocument()
    await waitFor(() => expect(api.posts("/reject")).toHaveLength(1))
    expect(api.posts("/reject")[0]?.body).toEqual({ reason: "Duplicate order" })
  })

  it("rolls back when the request fails", async () => {
    configureMocks({ mutationFailureRate: 1 })
    const user = setup()
    await loaded()

    await user.click(row(/Weather API/))
    await user.click(within(panel()).getByRole("button", { name: "Reject" }))
    await user.type(screen.getByLabelText("Reason for rejecting"), "No")
    await user.click(screen.getByRole("button", { name: "Confirm reject" }))

    expect(
      await screen.findByText("Couldn't reject 120.00 USDC to Weather API"),
    ).toBeInTheDocument()
    expect(row(/Weather API/)).toHaveAttribute("aria-selected", "true")
  })
})

describe("ApprovalQueue: keyboard", () => {
  async function focusFirstRow(user: ReturnType<typeof userEvent.setup>) {
    for (let i = 0; i < 30; i++) {
      await user.tab()
      if (document.activeElement?.tagName === "TR") return
    }
    throw new Error("Tab never reached a table row")
  }

  it("approves with the keyboard only", async () => {
    const user = setup()
    await loaded()

    await focusFirstRow(user)
    await user.keyboard("j")
    expect(row(/Weather API/)).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("complementary")).toBeInTheDocument()

    await user.keyboard("a")
    expect(queryRow(/Weather API/)).not.toBeInTheDocument()
    // Focus moved to the next row, so the next shortcut still works
    expect(bodyRows()[0]).toHaveFocus()

    await letUndoToastClose()
    await waitFor(() => expect(api.posts("/approve")).toHaveLength(1))

    await user.keyboard("j")
    expect(bodyRows()[1]).toHaveAttribute("aria-selected", "true")
    await user.keyboard("k")
    expect(bodyRows()[0]).toHaveAttribute("aria-selected", "true")
  })

  it("r opens the reason field; Esc closes it, then the panel, then the selection", async () => {
    const user = setup()
    await loaded()

    await focusFirstRow(user)
    await user.keyboard("j")
    await user.keyboard("r")
    expect(screen.getByLabelText("Reason for rejecting")).toHaveFocus()

    // Typing a shortcut letter in the field just types it
    await user.keyboard("a")
    expect(screen.getByLabelText("Reason for rejecting")).toHaveValue("a")
    expect(api.posts("/approve")).toHaveLength(0)

    await user.keyboard("{Escape}")
    expect(
      screen.queryByLabelText("Reason for rejecting"),
    ).not.toBeInTheDocument()
    expect(row(/Weather API/)).toHaveFocus()

    await user.keyboard("{Escape}")
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument()
    expect(row(/Weather API/)).toHaveAttribute("aria-selected", "true")

    await user.keyboard("{Escape}")
    expect(row(/Weather API/)).toHaveAttribute("aria-selected", "false")
  })

  it("ignores shortcuts outside the queue", async () => {
    const user = setup()
    await loaded()

    screen.getByRole("button", { name: "Shortcuts" }).focus()
    await user.keyboard("j")
    expect(
      bodyRows().every((r) => r.getAttribute("aria-selected") === "false"),
    ).toBe(true)
  })

  it("? opens help, where shortcuts can be switched off (and stay off)", async () => {
    const user = setup()
    await loaded()

    await focusFirstRow(user)
    await user.keyboard("?")
    const help = screen.getByRole("dialog", { name: "Keyboard shortcuts" })
    await user.click(
      within(help).getByRole("switch", { name: "Keyboard shortcuts" }),
    )
    expect(within(help).getByText(/Shortcuts are off/)).toBeInTheDocument()
    expect(localStorage.getItem(SHORTCUTS_STORAGE_KEY)).toBe("false")
    await user.keyboard("{Escape}")

    row(/Weather API/).focus()
    await user.keyboard("j?")
    expect(row(/Weather API/)).toHaveAttribute("aria-selected", "false")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    localStorage.removeItem(SHORTCUTS_STORAGE_KEY)
  })
})

describe("ApprovalQueue: polling", () => {
  it("announces new requests without moving the selection", async () => {
    const user = setup()
    await loaded()
    await user.click(row(/Cloud GPU/))

    mockClock.now += 30_000 // releases the first held-back request
    await act(() => vi.advanceTimersByTimeAsync(10_000))

    await waitFor(() => expect(bodyRows()).toHaveLength(13))
    expect(screen.getByText("1 new request waiting")).toBeInTheDocument()
    expect(within(bodyRows()[0]!).getByText("New")).toBeInTheDocument()
    expect(row(/Cloud GPU/)).toHaveAttribute("aria-selected", "true")
  })
})
