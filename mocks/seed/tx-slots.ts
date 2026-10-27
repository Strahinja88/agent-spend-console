import type { Chain } from "@/lib/domain/types"

// Slots for real testnet transactions (PLAN.md §3), filled in phase 5.
// Each slot is attached to one confirmed seed payment. Send exactly the
// amount below on the testnet, from any wallet, then paste the hash here.
// Amounts are small so faucet USDC covers them.
//
// While `txHash` is null the payment is shown as simulated.

export type TxSlot = {
  chain: Chain
  txHash: string | null
  /** What the seed payment says: amount and vendor the transfer must match. */
  note: string
}

export const TX_SLOTS = {
  "base-1": {
    chain: "base",
    txHash: null,
    note: "Research Bot → Weather API, 2.50 USDC on Base Sepolia, the day before the anchor",
  },
  "base-2": {
    chain: "base",
    txHash: null,
    note: "Research Bot → Data Vendor, 4.00 USDC on Base Sepolia, anchor day",
  },
  "solana-1": {
    chain: "solana",
    txHash: null,
    note: "Research Bot → Weather API, 3.00 USDC on Solana devnet, the day before the anchor",
  },
} satisfies Record<string, TxSlot>

export type TxSlotKey = keyof typeof TX_SLOTS
