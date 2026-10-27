import type { Chain } from "@/lib/domain/types"

// Real testnet transactions behind a few seed payments (PLAN.md §3, D-019).
// Found with `node --no-warnings scripts/find-testnet-txs.ts` on 27 Oct 2026:
// recent USDC transfers between strangers' wallets on Base Sepolia and Solana
// devnet. The seed adopts each transfer's amount, and labels its two wallets
// as the agent's and the vendor's (a demo fiction, D-019).
//
// While `txHash` is null the payment is shown as simulated.

export type TxSlot =
  | {
      /** A confirmed USDC transfer. */
      kind: "transfer"
      chain: Chain
      txHash: string | null
      /** The onchain amount in USDC; the seed request uses it. */
      amount: string
      from: string
      to: string
      note: string
    }
  | {
      /** A USDC payment call that reverted onchain. */
      kind: "failed"
      chain: Chain
      txHash: string | null
      note: string
    }
  | {
      /** A well-formed hash that doesn't exist, for "Transaction not found". */
      kind: "missing"
      chain: Chain
      txHash: string
      note: string
    }

export const TX_SLOTS = {
  "base-1": {
    kind: "transfer",
    chain: "base",
    txHash:
      "0x2a948d15b0f2e549fcdccc4891a477a23db0c45babc6bd5da71b611d5adf5b71",
    amount: "2.00",
    from: "0x7B0922C719D7e29e555A4c0ddD842F7eF3F58cF7",
    to: "0x92043f2C69c062950a6736c26c851C2277B037B7",
    note: "Research Bot → Weather API on Base Sepolia, the day before the anchor (block 50,979,128)",
  },
  "base-2": {
    kind: "transfer",
    chain: "base",
    txHash:
      "0x9cf91e553304aac0fb034a67b5b1d19298f8d6d287868eb0f026a7befa4c0e70",
    amount: "1.00",
    from: "0xd61225713ae9Ba879ad6b95D3a2fcc84668D4293",
    to: "0xA849bbaD82F9edafDf9A5550CC874276138779d9",
    note: "Research Bot → Data Vendor on Base Sepolia, anchor day (block 50,978,949)",
  },
  "solana-1": {
    kind: "transfer",
    chain: "solana",
    txHash:
      "5dgvXs8Wrv1dX1ApZjmqGxoeP4vwYAM1W2Fu1ijnaFmo5Rh9tGJkNVjnEd5vmYuabQhQ8BnAddY76gqcxEzDiPno",
    amount: "1.00",
    from: "6ReP5NF6SrSgXnqhVUfn3Ytg9eofgEcYeRNEMV6oAnyF",
    to: "4bhPq9EZAqBJgt4eL5F6WPPD7caMDW7wug6J88RZsiSz",
    note: "Research Bot → Weather API on Solana devnet, the day before the anchor (slot 515,751,111)",
  },
  "base-failed": {
    kind: "failed",
    chain: "base",
    // No reverted USDC payment call in ~6,000 Base Sepolia blocks (27 Oct):
    // stays simulated. Fill in if a later scan finds one (D-019).
    txHash: null,
    note: "Ops Agent → Weather API 100.00 on Base Sepolia, anchor day: a reverted USDC call",
  },
  "base-missing": {
    kind: "missing",
    chain: "base",
    // Random, checked by the script to not exist on Base Sepolia
    txHash:
      "0x9f5f39619774e9a06cceb6cfba6d11219ff4a810e5c0847c50f9830fbc5dbdeb",
    note: "Ops Agent → Cloud GPU 100.00 on Base Sepolia, anchor day: submitted, never seen onchain",
  },
} satisfies Record<string, TxSlot>

export type TxSlotKey = keyof typeof TX_SLOTS
