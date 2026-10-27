import { cn } from "@/lib/utils"

/** A key cap. Decorative next to buttons (they carry aria-keyshortcuts). */
export function Kbd({
  children,
  className,
  ...props
}: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-surface-sunken px-1 font-mono text-xs text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  )
}
