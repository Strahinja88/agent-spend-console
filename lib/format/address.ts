// Middle truncation for addresses and hashes (docs/design.md §8.2):
// EVM keeps "0x" + 4 … 4, Solana base58 keeps 4 … 4.

export function truncateMiddle(value: string): string {
  const head = value.startsWith("0x") ? 6 : 4
  const tail = 4
  if (value.length <= head + tail + 1) return value
  return `${value.slice(0, head)}…${value.slice(-tail)}`
}

/**
 * A lookup key for an address: EVM addresses are case-insensitive (the case is
 * only a checksum), base58 is case-sensitive and stays as it is.
 */
export function addressKey(address: string): string {
  return address.startsWith("0x") ? address.toLowerCase() : address
}
