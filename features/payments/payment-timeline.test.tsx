import { act, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ChainError } from "@/lib/chain/errors"
import type { OnchainTx } from "@/lib/chain/types"
import { usdc } from "@/lib/format/amount"
import { server } from "@/mocks/node"
import { generateSeed, type SeedEntry } from "@/mocks/seed/generate"
import { TX_SLOTS, type TxSlotKey } from "@/mocks/seed/tx-slots"

import { renderWithProviders, setupMockApi } from "../approvals/test-utils"
import { PaymentTimeline } from "./payment-timeline"

vi.mock("next/navigation", () => ({ usePathname: () => "/payments/x" }))

// The chain clients are replaced with fixtures, so this UI test never loads
// viem or web3.js. Their RPC calls and decoding are covered by the unit tests
// in lib/chain (base.test.ts, solana.test.ts).
const chain = vi.hoisted(() => ({
  fetchBaseTx: vi.fn(),
  fetchBaseBlockNumber: vi.fn(),
  fetchSolanaTx: vi.fn(),
}))
vi.mock("@/lib/chain/base", () => ({
  fetchBaseTx: chain.fetchBaseTx,
  fetchBaseBlockNumber: chain.fetchBaseBlockNumber,
}))
vi.mock("@/lib/chain/solana", () => ({ fetchSolanaTx: chain.fetchSolanaTx }))
// Fails loudly if anything here still pulls in a chain library
vi.mock("viem", () => {
  throw new Error("viem must not load in the payment timeline test")
})
vi.mock("@solana/web3.js", () => {
  throw new Error("@solana/web3.js must not load in the payment timeline test")
})

setupMockApi()

// The mock API serves this same seed (fixed anchor in tests)
const seed = generateSeed()

const base1 = TX_SLOTS["base-1"]
const solana1 = TX_SLOTS["solana-1"]
const BLOCK = 50_979_128n

const baseConfirmed: OnchainTx = {
  state: "confirmed",
  inclusion: { chain: "base", blockNumber: BLOCK },
  blockTime: "2026-10-27T16:14:54.000Z",
  transfers: [{ amount: usdc(base1.amount), from: base1.from, to: base1.to }],
}

const solanaFinalized: OnchainTx = {
  state: "confirmed",
  inclusion: { chain: "solana", slot: 515_751_111, finality: "finalized" },
  blockTime: "2026-10-27T16:20:16.000Z",
  transfers: [
    { amount: usdc(solana1.amount), from: solana1.from, to: solana1.to },
  ],
}

const baseReverted: OnchainTx = {
  state: "failed",
  reason: "The transaction reverted, so no USDC moved.",
  inclusion: { chain: "base", blockNumber: BLOCK },
  blockTime: "2026-10-27T16:14:54.000Z",
}

beforeEach(() => {
  chain.fetchBaseTx.mockReset()
  chain.fetchSolanaTx.mockReset()
  chain.fetchBaseBlockNumber.mockReset().mockResolvedValue(BLOCK + 41n)
})

const chainCalls = () =>
  chain.fetchBaseTx.mock.calls.length + chain.fetchSolanaTx.mock.calls.length

function paymentId(find: (e: SeedEntry) => boolean): string {
  const entry = seed.entries.find(find)
  if (!entry) throw new Error("No such seed entry")
  return entry.payment.id
}

const slotPayment = (slot: TxSlotKey) =>
  paymentId((e) => e.payment.txHash === TX_SLOTS[slot].txHash)

async function renderPayment(id: string) {
  renderWithProviders(<PaymentTimeline id={id} />)
  return await screen.findByRole("heading", { level: 1 })
}

function step(name: string) {
  const steps = within(screen.getByRole("list", { name: "Payment steps" }))
  const title = steps.getByRole("heading", {
    level: 3,
    name: new RegExp(`^${name}`),
  })
  const item = title.closest("li")
  if (!item) throw new Error(`No step ${name}`)
  return item
}

describe("PaymentTimeline", () => {
  it("shows a skeleton while loading", () => {
    renderWithProviders(<PaymentTimeline id="pay_any" />)
    expect(screen.getByText("Loading payment")).toBeInTheDocument()
  })

  it("shows a confirmed Base transfer with labels, confirmations and the amount check", async () => {
    chain.fetchBaseTx.mockResolvedValue(baseConfirmed)
    const heading = await renderPayment(slotPayment("base-1"))

    expect(
      await screen.findByText(
        /Confirmed on Base Sepolia · 2\.00 USDC sent to Weather API/,
      ),
    ).toBeInTheDocument()
    expect(heading).toHaveTextContent("Confirmed")
    expect(chain.fetchBaseTx).toHaveBeenCalledWith(base1.txHash)

    const confirmed = step("Confirmed onchain")
    expect(confirmed).toHaveTextContent("Done")
    expect(confirmed).toHaveTextContent("Matches the approved amount")
    expect(confirmed).toHaveTextContent("Research Bot wallet")
    expect(confirmed).toHaveTextContent("Weather API wallet")
    expect(confirmed).toHaveTextContent("Base Sepolia (testnet)")
    expect(
      await within(confirmed).findByText("50,979,128 · 42 confirmations"),
    ).toBeInTheDocument()
    expect(
      within(confirmed).getByRole("link", { name: /View on block explorer/ }),
    ).toHaveAttribute("href", `https://sepolia.basescan.org/tx/${base1.txHash}`)

    expect(step("Submitted")).toHaveTextContent(base1.txHash)
    expect(step("Approved")).toHaveTextContent("Approved by the rules")
  })

  it("shows a finalized Solana transfer by slot", async () => {
    chain.fetchSolanaTx.mockResolvedValue(solanaFinalized)
    await renderPayment(slotPayment("solana-1"))

    const confirmed = step("Confirmed onchain")
    expect(
      await within(confirmed).findByText("515,751,111 · Finalized"),
    ).toBeInTheDocument()
    expect(confirmed).toHaveTextContent("1.00 USDC")
    expect(confirmed).toHaveTextContent("Matches the approved amount")
    expect(confirmed).toHaveTextContent("Research Bot wallet")
    expect(chain.fetchSolanaTx).toHaveBeenCalledWith(solana1.txHash)
    expect(chain.fetchBaseBlockNumber).not.toHaveBeenCalled()
  })

  it("shows a reverted transaction as failed with the reason", async () => {
    chain.fetchBaseTx.mockResolvedValue(baseReverted)
    const heading = await renderPayment(slotPayment("base-missing"))

    expect(
      await screen.findByText("The transaction reverted, so no USDC moved."),
    ).toBeInTheDocument()
    expect(heading).toHaveTextContent("Failed")
    expect(step("Confirmed onchain")).toHaveTextContent("Failed onchain.")
  })

  it("offers Retry when the transaction isn't found, and looks again", async () => {
    chain.fetchBaseTx.mockResolvedValue({ state: "not_found" })
    const user = userEvent.setup()
    await renderPayment(slotPayment("base-missing"))

    expect(
      await screen.findByText("Transaction not found on Base Sepolia."),
    ).toBeInTheDocument()
    expect(chain.fetchBaseTx).toHaveBeenCalledTimes(1)

    chain.fetchBaseTx.mockResolvedValue({ state: "pending" })
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(
      await screen.findByText(/waiting for confirmation\. Checking again/i),
    ).toBeInTheDocument()
    expect(chain.fetchBaseTx).toHaveBeenCalledTimes(2)
  })

  it("keeps checking a pending transaction until it's confirmed", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    chain.fetchBaseTx.mockResolvedValue({ state: "pending" })
    await renderPayment(slotPayment("base-1"))
    expect(
      await screen.findByText(
        /Submitted on Base Sepolia · waiting for confirmation/,
      ),
    ).toBeInTheDocument()

    chain.fetchBaseTx.mockResolvedValue(baseConfirmed)
    await act(() => vi.advanceTimersByTimeAsync(5_000))
    expect(
      await screen.findByText(/Confirmed on Base Sepolia · 2\.00 USDC/),
    ).toBeInTheDocument()
  })

  it("explains a rate-limited RPC after retrying, with Retry", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    chain.fetchBaseTx.mockRejectedValue(
      new ChainError("rate_limited", "The RPC is rate-limiting requests."),
    )
    await renderPayment(slotPayment("base-1"))

    // Three retries with backoff: 1 s, 2 s, 4 s
    await act(() => vi.advanceTimersByTimeAsync(8_000))
    expect(
      await screen.findByText(
        /The public Base Sepolia RPC is limiting requests right now\./,
      ),
    ).toBeInTheDocument()
    expect(chain.fetchBaseTx).toHaveBeenCalledTimes(4)
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })

  it("never calls an RPC for a simulated payment", async () => {
    const id = paymentId(
      (e) =>
        e.request.agentId === "agt_research" &&
        e.decision.reviewResult === "approved" &&
        e.payment.simulated,
    )
    const heading = await renderPayment(id)

    expect(heading).toHaveTextContent("Confirmed (simulated)")
    expect(step("Confirmed onchain")).toHaveTextContent(
      "Simulated payment, no onchain transaction.",
    )
    expect(step("Approved")).toHaveTextContent(/After review by /)
    expect(chainCalls()).toBe(0)
  })

  it("greys out the steps a waiting request hasn't reached", async () => {
    const id = paymentId(
      (e) => e.decision.outcome === "review" && !e.decision.reviewResult,
    )
    const heading = await renderPayment(id)

    expect(heading).toHaveTextContent("Waiting for review")
    expect(step("Approved")).toHaveTextContent("In progress")
    expect(
      within(step("Approved")).getByRole("link", { name: "Review in queue" }),
    ).toHaveAttribute("href", "/approvals")
    expect(step("Submitted")).toHaveTextContent("Not reached")
    expect(step("Confirmed onchain")).toHaveTextContent("Not reached")
    expect(chainCalls()).toBe(0)
  })

  it("says so when the payment doesn't exist", async () => {
    renderWithProviders(<PaymentTimeline id="pay_nope" />)
    expect(await screen.findByText("Payment not found")).toBeInTheDocument()
  })

  it("shows an error with Retry when the payment can't be loaded", async () => {
    server.use(
      http.get(
        "*/api/payments/:id",
        () =>
          Response.json(
            { code: "SIMULATED_FAILURE", message: "x" },
            { status: 500 },
          ),
        { once: true },
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(
      <PaymentTimeline id={paymentId((e) => e.payment.simulated)} />,
    )

    expect(
      await screen.findByText("Couldn't load this payment"),
    ).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Retry" }))
    expect(
      await screen.findByRole("list", { name: "Payment steps" }),
    ).toBeInTheDocument()
  })
})
