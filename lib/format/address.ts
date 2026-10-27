// Middle truncation for addresses and hashes (docs/design.md §8.2):
// EVM keeps "0x" + 4 … 4, Solana base58 keeps 4 … 4.

export function truncateMiddle(value: string): string {
  const head = value.startsWith("0x") ? 6 : 4
  const tail = 4
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}
