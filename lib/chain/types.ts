// What the payment timeline needs to know about a transaction, the same shape
// for both chains. Produced by lib/chain/base.ts and lib/chain/solana.ts.

/** One USDC movement, in minor units (6 decimals). */
export type UsdcTransfer = { amount: bigint; from: string; to: string }

/** Where the transaction landed. */
export type Inclusion =
  | { chain: "base"; blockNumber: bigint }
  | {
      chain: "solana"
      slot: number
      /** "confirmed" = voted on by a supermajority; "finalized" = can't be rolled back. */
      finality: "confirmed" | "finalized"
    }

type Included = {
  inclusion: Inclusion
  /** ISO time of the block, when the RPC reports one. */
  blockTime?: string
}

export type OnchainTx =
  /** Known to the network, not in a block yet. */
  | { state: "pending" }
  /** The RPC doesn't know it (yet: testnet RPCs can lag). */
  | { state: "not_found" }
  /** In a block and succeeded. `transfers` are the USDC movements in it. */
  | ({ state: "confirmed"; transfers: UsdcTransfer[] } & Included)
  /** In a block, but reverted: nothing moved. */
  | ({ state: "failed"; reason: string } & Included)

/**
 * Nothing about this transaction can change any more: cache it for good
 * (D-020). A Solana transaction that's only "confirmed" still has to finalize.
 */
export function isFinal(tx: OnchainTx): boolean {
  if (tx.state === "failed") return true
  if (tx.state !== "confirmed") return false
  return tx.inclusion.chain === "base" || tx.inclusion.finality === "finalized"
}

/** Still moving on its own, so it's worth checking again soon. */
export function isSettling(tx: OnchainTx): boolean {
  return tx.state === "pending" || (tx.state === "confirmed" && !isFinal(tx))
}
