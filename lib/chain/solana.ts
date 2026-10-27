import {
  Connection,
  type ParsedTransactionWithMeta,
  type TokenBalance,
  type TransactionError,
} from "@solana/web3.js"

import { RPC_URLS, SOLANA_USDC_MINT } from "./config"
import { toChainError } from "./errors"
import type { OnchainTx, UsdcTransfer } from "./types"

// Solana devnet, read-only (PLAN.md §2). Loaded with a dynamic import from the
// payment page only, so web3.js stays out of every other route (D-020).

let connection: Connection | undefined

function getConnection(): Connection {
  connection ??= new Connection(RPC_URLS.solana, {
    commitment: "confirmed",
    // No retries here: TanStack Query retries with backoff (D-020)
    disableRetryOnRateLimit: true,
    // The platform fetch everywhere. Under Node, web3.js would otherwise use
    // its own node-fetch with a keep-alive agent, which MSW can't see in tests.
    fetch: (input, init) => globalThis.fetch(input, init),
  })
  return connection
}

// A signature is 64 bytes in base58: 87 or 88 characters
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{86,88}$/

/**
 * USDC movements as balance changes per owner (wallet), from the token
 * balances before and after. This covers `transfer` and `transferChecked`
 * alike, and gives wallets rather than token accounts.
 */
export function usdcTransfers(tx: ParsedTransactionWithMeta): UsdcTransfer[] {
  const delta = new Map<string, bigint>()
  const add = (balances: TokenBalance[] | null | undefined, sign: bigint) => {
    for (const b of balances ?? []) {
      if (b.mint !== SOLANA_USDC_MINT || !b.owner) continue
      const amount = BigInt(b.uiTokenAmount.amount)
      delta.set(b.owner, (delta.get(b.owner) ?? 0n) + sign * amount)
    }
  }
  add(tx.meta?.preTokenBalances, -1n)
  add(tx.meta?.postTokenBalances, 1n)

  const senders = [...delta].filter(([, d]) => d < 0n)
  const receivers = [...delta].filter(([, d]) => d > 0n)
  // One sender paying one receiver is the case a payment produces. Anything
  // else (mints, burns, multi-party swaps) is shown as no plain transfer.
  const [sender] = senders
  const [receiver] = receivers
  if (senders.length !== 1 || receivers.length !== 1 || !sender || !receiver) {
    return []
  }
  if (-sender[1] !== receiver[1]) return []
  return [{ amount: receiver[1], from: sender[0], to: receiver[0] }]
}

/** "Instruction 2 failed: custom program error 1", from `meta.err`. */
export function describeSolanaError(err: TransactionError): string {
  if (typeof err === "string") return `The transaction failed: ${err}.`
  if (typeof err === "object" && err && "InstructionError" in err) {
    const [index, detail] = (err as { InstructionError: [number, unknown] })
      .InstructionError
    const what =
      typeof detail === "string"
        ? detail
        : typeof detail === "object" && detail && "Custom" in detail
          ? `custom program error ${String(detail.Custom)}`
          : JSON.stringify(detail)
    return `Instruction ${index + 1} failed: ${what}. No USDC moved.`
  }
  return `The transaction failed: ${JSON.stringify(err)}.`
}

/**
 * Status first (it knows "processed" and "finalized"), then the parsed
 * transaction for slot, time, error and token balances.
 */
export async function fetchSolanaTx(signature: string): Promise<OnchainTx> {
  if (!SIGNATURE.test(signature)) return { state: "not_found" }
  const rpc = getConnection()

  try {
    const { value: status } = await rpc.getSignatureStatus(signature, {
      searchTransactionHistory: true,
    })
    if (!status) return { state: "not_found" }
    const finality = status.confirmationStatus
    if (finality !== "confirmed" && finality !== "finalized") {
      return { state: "pending" }
    }

    const tx = await rpc.getParsedTransaction(signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    })
    // Known to the status cache but not served yet: try again shortly
    if (!tx?.meta) return { state: "pending" }

    const included = {
      inclusion: { chain: "solana", slot: tx.slot, finality },
      ...(tx.blockTime && {
        blockTime: new Date(tx.blockTime * 1000).toISOString(),
      }),
    } as const

    if (tx.meta.err) {
      return {
        state: "failed",
        reason: describeSolanaError(tx.meta.err),
        ...included,
      }
    }
    return { state: "confirmed", transfers: usdcTransfers(tx), ...included }
  } catch (error) {
    throw toChainError(error)
  }
}
