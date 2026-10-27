import type { Chain } from "@/lib/domain/types"

// Testnet constants. Imports nothing chain-specific, so any page can use it
// without pulling in viem or @solana/web3.js (those load lazily, D-020).

/** Circle's testnet USDC (PLAN.md §2, checked against developers.circle.com). */
export const BASE_USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
export const SOLANA_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"

/**
 * Read-only testnet RPC endpoints. `.env.local` can point at a keyed provider;
 * the public endpoints work but rate-limit. Written out in full so Next.js
 * inlines them into the browser bundle.
 */
export const RPC_URLS: Record<Chain, string> = {
  base:
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
  solana:
    process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL ||
    "https://api.devnet.solana.com",
}

export function explorerTxUrl(chain: Chain, hash: string): string {
  const id = encodeURIComponent(hash)
  return chain === "base"
    ? `https://sepolia.basescan.org/tx/${id}`
    : `https://explorer.solana.com/tx/${id}?cluster=devnet`
}

export function explorerAddressUrl(chain: Chain, address: string): string {
  const id = encodeURIComponent(address)
  return chain === "base"
    ? `https://sepolia.basescan.org/address/${id}`
    : `https://explorer.solana.com/address/${id}?cluster=devnet`
}
