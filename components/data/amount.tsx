import { formatAmount, USDC_DECIMALS } from "@/lib/format/amount"
import { cn } from "@/lib/utils"

type AmountProps = {
  value: bigint
  decimals?: number
  unit?: string
  className?: string
}

/** "1,250.00 USDC" with tabular figures, so columns of amounts line up. */
export function Amount({
  value,
  decimals = USDC_DECIMALS,
  unit = "USDC",
  className,
}: AmountProps) {
  return (
    <span className={cn("whitespace-nowrap tabular-nums", className)}>
      {formatAmount(value, decimals, unit)}
    </span>
  )
}
