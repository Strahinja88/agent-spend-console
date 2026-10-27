"use client"

import { Inbox, Scale, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { useWaitingCount } from "@/lib/api/approvals"
import { cn } from "@/lib/utils"

type NavItem = { href: string; label: string; icon: LucideIcon }

const NAV_ITEMS: NavItem[] = [
  { href: "/approvals", label: "Approvals", icon: Inbox },
  { href: "/decisions", label: "Decisions", icon: Scale },
]

export function MainNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()
  // Same query as the queue, so no extra requests (D-014)
  const waiting = useWaitingCount()

  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
          const count =
            href === "/approvals" && waiting !== undefined && waiting > 0
              ? waiting
              : undefined
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-muted-foreground transition-colors duration-(--duration-fast) hover:bg-surface-sunken hover:text-foreground",
                  active && "bg-brand-muted font-semibold text-brand",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {label}
                {count !== undefined && (
                  <>
                    <span className="sr-only">, {count} waiting</span>
                    <span
                      aria-hidden
                      className="ml-auto rounded-sm bg-surface-sunken px-1.5 text-xs font-medium text-foreground tabular-nums"
                    >
                      {count}
                    </span>
                  </>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
