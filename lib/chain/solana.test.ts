import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"

import { server } from "@/mocks/node"
import {
  otherTokenPayment,
  SOLANA_FROM,
  SOLANA_SIGNATURE,
  SOLANA_SLOT,
  SOLANA_TO,
  solanaPayment,
  solanaRpc,
  type SolanaScenario,
} from "@/mocks/rpc"

import { ChainError } from "./errors"
import { describeSolanaError, fetchSolanaTx } from "./solana"

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function lookup(scenario: SolanaScenario) {
  server.use(solanaRpc(scenario))
  return fetchSolanaTx(SOLANA_SIGNATURE)
}

describe("fetchSolanaTx", () => {
  it("reads the USDC amount, owners, slot and finality", async () => {
    expect(
      await lookup({ kind: "confirmed", balances: solanaPayment(3_000_000n) }),
    ).toEqual({
      state: "confirmed",
      inclusion: { chain: "solana", slot: SOLANA_SLOT, finality: "finalized" },
      blockTime: "2026-10-27T16:20:16.000Z",
      transfers: [{ amount: 3_000_000n, from: SOLANA_FROM, to: SOLANA_TO }],
    })
  })

  it("keeps a confirmed but not yet finalized transaction apart", async () => {
    const tx = await lookup({ kind: "confirmed", finality: "confirmed" })
    expect(tx).toMatchObject({
      state: "confirmed",
      inclusion: { finality: "confirmed" },
    })
  })

  it("finds no USDC transfer when another token moved", async () => {
    const tx = await lookup({ kind: "confirmed", balances: otherTokenPayment })
    expect(tx).toMatchObject({ state: "confirmed", transfers: [] })
  })

  it("explains a failed transaction", async () => {
    expect(await lookup({ kind: "failed" })).toMatchObject({
      state: "failed",
      reason: "Instruction 1 failed: custom program error 1. No USDC moved.",
      inclusion: { chain: "solana", slot: SOLANA_SLOT },
    })
  })

  it("reports processed as pending and an unknown signature as not found", async () => {
    expect(await lookup({ kind: "pending" })).toEqual({ state: "pending" })
    expect(await lookup({ kind: "not_found" })).toEqual({
      state: "not_found",
    })
  })

  it("treats a malformed signature as not found without calling the RPC", async () => {
    expect(await fetchSolanaTx("not-a-signature")).toEqual({
      state: "not_found",
    })
  })

  it("turns HTTP 429 into a rate_limited ChainError", async () => {
    const error = await lookup({ kind: "rate_limited" }).catch((e) => e)
    expect(error).toBeInstanceOf(ChainError)
    expect(error).toMatchObject({ kind: "rate_limited" })
  })
})

describe("describeSolanaError", () => {
  it("names a plain error", () => {
    expect(describeSolanaError("AccountInUse")).toBe(
      "The transaction failed: AccountInUse.",
    )
    expect(
      describeSolanaError({ InstructionError: [1, "InvalidAccountData"] }),
    ).toBe("Instruction 2 failed: InvalidAccountData. No USDC moved.")
  })
})
