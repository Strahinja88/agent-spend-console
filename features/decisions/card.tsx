import { cn } from "@/lib/utils"

type CardProps = {
  title: string
  children: React.ReactNode
  className?: string
}

/** A titled section of the decision detail page. */
export function Card({ title, children, className }: CardProps) {
  return (
    <section
      aria-label={title}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-4 md:p-5",
        className,
      )}
    >
      <h2 className="text-md font-semibold">{title}</h2>
      {children}
    </section>
  )
}
