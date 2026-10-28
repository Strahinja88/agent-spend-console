"use client"

import { useQuery } from "@tanstack/react-query"

import { isRetryableChainError } from "@/lib/chain/errors"
import { isFinal, isSettling, type OnchainTx } from "@/lib/chain/types"
import type { Chain, Payment } from "@/lib/domain/types"

import { fetchJson } from "./client"
import { paymentDetailResponse } from "./contract"
import { queryKeys } from "./query-keys"

/** How often an unsettled transaction (pending, or not yet finalized) is checked again. */
export const SETTLING_REFETCH_MS = 5_000
const BLOCK_NUMBER_REFETCH_MS = 30_000
const MAX_RETRIES = 3

export function usePayment(id: string) {
  return useQuery({
    queryKey: queryKeys.payment(id),
    queryFn: () =>
      fetchJson(
        `/api/payments/${encodeURIComponent(id)}`,
        paymentDetailResponse,
      ),
  })
}

// The chain clients load on first use, so viem and web3.js are only
// downloaded by a page that reads a real transaction (D-020).
async function fetchOnchainTx(chain: Chain, hash: string): Promise<OnchainTx> {
  if (chain === "base") {
    const { fetchBaseTx } = await import("@/lib/chain/base")
    return fetchBaseTx(hash)
  }
  const { fetchSolanaTx } = await import("@/lib/chain/solana")
  return fetchSolanaTx(hash)
}

/** Back off on rate limits and network errors: 1 s, 2 s, 4 s. */
const retryOptions = {
  retry: (count: number, error: unknown) =>
    isRetryableChainError(error) && count < MAX_RETRIES,
  retryDelay: (attempt: number) => 1_000 * 2 ** attempt,
}

/**
 * The onchain state of a payment's transaction (D-020):
 * - confirmed and failed transactions never change, so they're never refetched;
 * - pending ones (and Solana ones not yet finalized) are checked every 5 s;
 * - "not found" waits for Retry (or a window refocus), since public RPCs lag
 *   and polling one that doesn't know the hash wastes its rate limit.
 * Simulated payments and payments without a hash never call an RPC.
 */
export function useOnchainTx(payment: Payment) {
  const hash = payment.simulated ? undefined : payment.txHash
  return useQuery({
    queryKey: queryKeys.onchainTx(payment.chain, hash ?? ""),
    queryFn: () => fetchOnchainTx(payment.chain, hash ?? ""),
    enabled: hash !== undefined,
    staleTime: ({ state }) =>
      state.data && isFinal(state.data) ? Infinity : 0,
    refetchInterval: ({ state }) =>
      state.data && isSettling(state.data) ? SETTLING_REFETCH_MS : false,
    ...retryOptions,
  })
}

/**
 * The latest Base Sepolia block, for "N confirmations". Separate from the
 * receipt, so the receipt stays cached while the count keeps moving.
 */
export function useBaseBlockNumber(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.baseBlockNumber(),
    queryFn: async () => {
      const { fetchBaseBlockNumber } = await import("@/lib/chain/base")
      return fetchBaseBlockNumber()
    },
    enabled,
    staleTime: BLOCK_NUMBER_REFETCH_MS,
    refetchInterval: BLOCK_NUMBER_REFETCH_MS,
    ...retryOptions,
  })
}
