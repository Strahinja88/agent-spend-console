import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render as rtlRender, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { AppShell } from "@/components/app-shell"
import { ApiReadyContext } from "@/lib/api/api-ready"

vi.mock("next/navigation", () => ({
  usePathname: () => "/approvals",
}))

// The sidebar reads the approvals query; keep it idle here (no API in this test)
function render(ui: React.ReactNode) {
  return rtlRender(
    <QueryClientProvider client={new QueryClient()}>
      <ApiReadyContext value={false}>{ui}</ApiReadyContext>
    </QueryClientProvider>,
  )
}

describe("AppShell", () => {
  it("renders a skip link to the main content", () => {
    render(<AppShell>page</AppShell>)

    expect(
      screen.getByRole("link", { name: "Skip to content" }),
    ).toHaveAttribute("href", "#content")
    expect(screen.getByRole("main")).toHaveAttribute("id", "content")
  })

  it("marks the current page in the main navigation", () => {
    render(<AppShell>page</AppShell>)

    const nav = screen.getByRole("navigation", { name: "Main" })
    expect(
      within(nav).getByRole("link", { name: "Approvals" }),
    ).toHaveAttribute("aria-current", "page")
    expect(
      within(nav).getByRole("link", { name: "Decisions" }),
    ).not.toHaveAttribute("aria-current")
  })

  it("labels its icon buttons", () => {
    render(<AppShell>page</AppShell>)

    expect(
      screen.getByRole("button", { name: "Change theme" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toBeInTheDocument()
  })
})
