// Money is bigint minor units end to end. Never Number, parseFloat or / 1e6
// (docs/design.md §8.1).

export const USDC_DECIMALS = 6

function splitAmount(value: bigint, decimals: number) {
  const sign = value < 0n ? "-" : ""
  const abs = value < 0n ? -value : value
  const base = 10n ** BigInt(decimals)
  const whole = abs / base // bigint division truncates
  const fraction = (abs % base)
    .toString()
    .padStart(decimals, "0") // 1n with 6 decimals → "000001"
    .replace(/0+$/, "") // trim trailing zeros…
    .padEnd(2, "0") // …but keep at least 2
  return { sign, whole, fraction }
}

export function toDecimalString(
  value: bigint,
  decimals = USDC_DECIMALS,
): string {
  const { sign, whole, fraction } = splitAmount(value, decimals)
  return `${sign}${whole}.${fraction}`
}

const grouping = new Intl.NumberFormat("en-US") // format() accepts bigint exactly

export function formatAmount(
  value: bigint,
  decimals = USDC_DECIMALS,
  unit = "USDC",
): string {
  const { sign, whole, fraction } = splitAmount(value, decimals)
  return `${sign}${grouping.format(whole)}.${fraction} ${unit}`
}

/** "1,250.50" or "120" → minor units. Throws on anything that isn't an exact decimal. */
export function parseAmount(text: string, decimals = USDC_DECIMALS): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text.replaceAll(",", ""))
  if (!match) throw new Error(`Not an amount: "${text}"`)
  const [, sign, whole = "0", fraction = ""] = match
  if (fraction.length > decimals) {
    throw new Error(`"${text}" has more than ${decimals} decimals`)
  }
  const minor =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0")
  return sign === "-" ? -minor : minor
}

/** Shorthand for whole-or-decimal USDC amounts in fixtures and tests. */
export function usdc(text: string): bigint {
  return parseAmount(text, USDC_DECIMALS)
}
