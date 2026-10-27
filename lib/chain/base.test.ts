import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { server } from "@/mocks/node"
import {
  BASE_FROM,
  BASE_HASH,
  BASE_TO,
  baseRpc,
  type BaseScenario,
} from "@/mocks/rpc"

import { fetchBaseBlockNumber, fetchBaseTx } from "./base"
import { ChainError } from "./errors"

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function lookup(scenario: BaseScenario, hash: string = BASE_HASH) {
  server.use(baseRpc(scenario))
  return fetchBaseTx(hash)
}

describe("fetchBaseTx", () => {
  it("decodes the USDC transfer of a confirmed transaction", async () => {
    expect(await lookup({ kind: "confirmed" })).toEqual({
      state: "confirmed",
      inclusion: { chain: "base", blockNumber: 50_979_128n },
      blockTime: "2026-10-27T16:14:54.000Z",
      transfers: [{ amount: 2_000_000n, from: BASE_FROM, to: BASE_TO }],
    })
  })

  it("ignores Transfer logs from other tokens", async () => {
    const tx = await lookup({
      kind: "confirmed",
      logs: [
        {
          from: BASE_FROM,
          to: BASE_TO,
          value: 9n,
          token: "0x4200000000000000000000000000000000000006",
        },
        { from: BASE_FROM, to: BASE_TO, value: 1_500_000n },
      ],
    })
    expect(tx.state === "confirmed" && tx.transfers).toEqual([
      { amount: 1_500_000n, from: BASE_FROM, to: BASE_TO },
    ])
  })

  it("reports a reverted transaction as failed", async () => {
    expect(await lookup({ kind: "reverted" })).toMatchObject({
      state: "failed",
      reason: "The transaction reverted, so no USDC moved.",
      inclusion: { chain: "base", blockNumber: 50_979_128n },
    })
  })

  it("tells pending from not found when there is no receipt", async () => {
    expect(await lookup({ kind: "pending" })).toEqual({ state: "pending" })
    expect(await lookup({ kind: "not_found" })).toEqual({
      state: "not_found",
    })
  })

  it("treats a malformed hash as not found without calling the RPC", async () => {
    // No handler: an RPC call would fail the test (onUnhandledFrame: "error")
    expect(await fetchBaseTx("0x1234")).toEqual({ state: "not_found" })
  })

  it("turns HTTP 429 into a rate_limited ChainError", async () => {
    const error = await lookup({ kind: "rate_limited" }).catch((e) => e)
    expect(error).toBeInstanceOf(ChainError)
    expect(error).toMatchObject({ kind: "rate_limited" })
  })
})

describe("fetchBaseBlockNumber", () => {
  it("returns the latest block", async () => {
    server.use(baseRpc({ kind: "confirmed", latest: 50_979_200n }))
    expect(await fetchBaseBlockNumber()).toBe(50_979_200n)
  })
})
