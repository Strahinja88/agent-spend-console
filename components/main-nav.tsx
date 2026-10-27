"use client"

import { Inbox, Scale, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

type NavItem = { href: string; label: string; icon: LucideIcon }

const NAV_ITEMS: NavItem[] = [
  { href: "/approvals", label: "Approvals", icon: Inbox },
  { href: "/decisions", label: "Decisions", icon: Scale },
]

export function MainNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`)
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
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
