import { formatAmount } from "@/lib/format/amount"
import { cn } from "@/lib/utils"

type SpendBarProps = {
  committed: bigint
  limit: bigint
  /** Completes the sentence: "today", "on 26 Oct", "this month". */
  periodLabel: string
  /** Appended to the sentence, e.g. "(including this request)". */
  note?: string
}

/** Committed spend against a limit. The sentence is always visible; the bar only repeats it. */
export function SpendBar({
  committed,
  limit,
  periodLabel,
  note,
}: SpendBarProps) {
  const text = `${formatAmount(committed)} of ${formatAmount(limit)} committed ${periodLabel}`
  // A whole-number percentage for the bar width: a ratio, not money, so Number is fine here.
  const percent =
    limit > 0n ? Math.min(100, Number((committed * 100n) / limit)) : 100

  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="meter"
        aria-label={`Committed ${periodLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={text}
        className="h-2 overflow-hidden rounded-sm bg-surface-sunken ring-1 ring-border-strong ring-inset"
      >
        <div
          className={cn(
            "h-full",
            percent >= 90 ? "bg-status-review-fg" : "bg-brand",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="tabular-nums">
        {text}
        {note && <span className="text-muted-foreground"> {note}</span>}
      </p>
    </div>
  )
}
