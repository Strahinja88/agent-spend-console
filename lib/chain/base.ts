import {
  createPublicClient,
  erc20Abi,
  http,
  isAddressEqual,
  isHash,
  parseEventLogs,
  TransactionNotFoundError,
  TransactionReceiptNotFoundError,
} from "viem"
import { baseSepolia } from "viem/chains"

import { BASE_USDC, RPC_URLS } from "./config"
import { toChainError } from "./errors"
import type { OnchainTx } from "./types"

// Base Sepolia, read-only (PLAN.md §2). Loaded with a dynamic import from the
// payment page only, so viem stays out of every other route (D-020).

function createClient() {
  return createPublicClient({
    chain: baseSepolia,
    // No retries here: TanStack Query retries with backoff (D-020)
    transport: http(RPC_URLS.base, { retryCount: 0, timeout: 10_000 }),
  })
}

let client: ReturnType<typeof createClient> | undefined

function getClient() {
  client ??= createClient()
  return client
}

/** null when the RPC answers "not found"; anything else is a real error. */
function orNull(...notFound: (abstract new (...args: never) => Error)[]) {
  return (error: unknown) => {
    if (notFound.some((type) => error instanceof type)) return null
    throw error
  }
}

/**
 * The receipt, its USDC `Transfer` logs and the block time. A missing receipt
 * is "pending" if the node knows the transaction, otherwise "not found".
 */
export async function fetchBaseTx(hash: string): Promise<OnchainTx> {
  if (!isHash(hash)) return { state: "not_found" }
  const rpc = getClient()

  try {
    const receipt = await rpc
      .getTransactionReceipt({ hash })
      .catch(orNull(TransactionReceiptNotFoundError))
    if (!receipt) {
      const tx = await rpc
        .getTransaction({ hash })
        .catch(orNull(TransactionNotFoundError))
      return { state: tx ? "pending" : "not_found" }
    }

    const block = await rpc.getBlock({ blockNumber: receipt.blockNumber })
    const included = {
      inclusion: { chain: "base", blockNumber: receipt.blockNumber },
      blockTime: new Date(Number(block.timestamp) * 1000).toISOString(),
    } as const

    if (receipt.status === "reverted") {
      // A receipt has no revert reason; replaying the call to get one would
      // be another RPC round trip for a demo
      return {
        state: "failed",
        reason: "The transaction reverted, so no USDC moved.",
        ...included,
      }
    }

    // Only logs emitted by the USDC contract: any token can emit "Transfer"
    const transfers = parseEventLogs({
      abi: erc20Abi,
      eventName: "Transfer",
      logs: receipt.logs.filter((log) =>
        isAddressEqual(log.address, BASE_USDC),
      ),
    }).map(({ args }) => ({ amount: args.value, from: args.from, to: args.to }))

    return { state: "confirmed", transfers, ...included }
  } catch (error) {
    throw toChainError(error)
  }
}

/** The latest block, for "N confirmations". Fetched separately so the receipt can stay cached. */
export async function fetchBaseBlockNumber(): Promise<bigint> {
  try {
    return await getClient().getBlockNumber({ cacheTime: 0 })
  } catch (error) {
    throw toChainError(error)
  }
}
