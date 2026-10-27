"use client"

import { X } from "lucide-react"
import { useId, useSyncExternalStore } from "react"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const DESKTOP = "(min-width: 768px)"

function subscribe(onChange: () => void) {
  if (typeof window.matchMedia !== "function") return () => {}
  const query = window.matchMedia(DESKTOP)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

/** True at md and up. Defaults to desktop where matchMedia isn't available (server, jsdom). */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribe,
    () =>
      typeof window.matchMedia !== "function" ||
      window.matchMedia(DESKTOP).matches,
    () => true,
  )
}

type SidePanelProps = {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}

/**
 * Desktop: a non-modal panel beside the table, so the table stays visible and
 * the queue's shortcuts keep working. Mobile: a modal full-screen sheet.
 */
export function SidePanel({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: SidePanelProps) {
  const isDesktop = useIsDesktop()
  const titleId = useId()

  if (!isDesktop) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-none">
          <SheetHeader className="border-b border-border">
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
          {footer && (
            <SheetFooter className="border-t border-border">
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    )
  }

  if (!open) return null

  return (
    <aside
      aria-labelledby={titleId}
      className="flex w-105 shrink-0 flex-col rounded-lg border border-border bg-surface shadow-panel"
    >
      <div className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id={titleId} className="text-md font-semibold">
            {title}
          </h2>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close panel"
          onClick={onClose}
        >
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
      {footer && (
        <div className="border-t border-border px-4 py-3">{footer}</div>
      )}
    </aside>
  )
}
