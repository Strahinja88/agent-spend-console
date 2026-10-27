"use client"

import { Keyboard } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

import { Kbd } from "./kbd"

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["j", "k"], action: "Next / previous request" },
  { keys: ["a"], action: "Approve" },
  { keys: ["r"], action: "Reject" },
  { keys: ["?"], action: "Show this help" },
  { keys: ["Esc"], action: "Close panel / dialog" },
]

type KeyboardHelpProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  enabled: boolean
  onEnabledChange: (enabled: boolean) => void
}

/** The visible way into keyboard help, so it works with shortcuts switched off. */
export function KeyboardHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Keyboard aria-hidden />
      Shortcuts
    </Button>
  )
}

export function KeyboardHelp({
  open,
  onOpenChange,
  enabled,
  onEnabledChange,
}: KeyboardHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Single-key shortcuts work only while focus is in the approval queue.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
          <Label htmlFor="shortcuts-enabled">Keyboard shortcuts</Label>
          <Switch
            id="shortcuts-enabled"
            checked={enabled}
            onCheckedChange={onEnabledChange}
          />
        </div>

        {!enabled && (
          <p className="text-muted-foreground">
            Shortcuts are off. Esc still closes the panel.
          </p>
        )}

        <dl
          className={cn(
            "grid grid-cols-[auto_1fr] gap-x-4 gap-y-2",
            // Dimmed with a token colour rather than opacity, so it stays AA
            !enabled && "text-muted-foreground",
          )}
        >
          {SHORTCUTS.map(({ keys, action }) => (
            <div key={action} className="contents">
              <dt className="flex items-center gap-1">
                {keys.map((key, i) => (
                  <span key={key} className="flex items-center gap-1">
                    {i > 0 && <span className="text-muted-foreground">/</span>}
                    <Kbd>{key}</Kbd>
                  </span>
                ))}
              </dt>
              <dd>{action}</dd>
            </div>
          ))}
        </dl>
      </DialogContent>
    </Dialog>
  )
}
