import { MainNav } from "@/components/main-nav"
import { MobileNav } from "@/components/mobile-nav"
import { ThemeToggle } from "@/components/theme-toggle"

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#content"
        className="sr-only rounded-md bg-surface-raised px-3 py-2 shadow-dialog focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50"
      >
        Skip to content
      </a>

      <aside className="hidden w-55 shrink-0 flex-col border-r border-border bg-surface md:flex">
        <p className="px-5 py-4 font-semibold">Agent Spend Console</p>
        <MainNav />
        <p className="mt-auto border-t border-border px-5 py-3 text-xs text-subtle-foreground">
          Demo · testnet only
        </p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border bg-surface px-4 md:px-6">
          <MobileNav />
          <p className="font-semibold md:hidden">Agent Spend Console</p>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>
        <main
          id="content"
          tabIndex={-1}
          className="flex-1 px-4 py-6 focus:outline-none md:px-6"
        >
          {children}
        </main>
      </div>
    </div>
  )
}
