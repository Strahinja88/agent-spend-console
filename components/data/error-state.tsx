import { TriangleAlert } from "lucide-react"

import { Button } from "@/components/ui/button"

type ErrorStateProps = {
  title: string
  description?: string
  onRetry: () => void
}

/** A failed load, in plain words, with Retry. Never shows a raw error. */
export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg border border-status-deny-border bg-surface px-6 py-12 text-center"
    >
      <TriangleAlert aria-hidden className="size-8 text-status-deny-fg" />
      <div className="flex flex-col gap-1">
        <p className="text-md font-semibold">{title}</p>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <Button variant="outline" onClick={onRetry}>
        Retry
      </Button>
    </div>
  )
}
