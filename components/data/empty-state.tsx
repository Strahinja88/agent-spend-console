import type { LucideIcon } from "lucide-react"

type EmptyStateProps = {
  icon: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border bg-surface px-6 py-12 text-center">
      <Icon aria-hidden className="size-8 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-md font-semibold">{title}</p>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
