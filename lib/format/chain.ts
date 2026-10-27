import type { Chain } from "@/lib/domain/types"

const NAMES: Record<Chain, { full: string; short: string }> = {
  base: { full: "Base Sepolia", short: "Base" },
  solana: { full: "Solana Devnet", short: "Solana" },
}

/** Full network name in headers and timelines, short name in table cells. */
export function chainName(chain: Chain, form: "full" | "short" = "short") {
  return NAMES[chain][form]
}
