// @vitest-environment node
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest"

import { ApiError, fetchJson, postJson } from "@/lib/api/client"
import {
  agentsResponse,
  approvalsResponse,
  decisionDetailResponse,
  decisionsResponse,
  mandatesResponse,
  paymentDetailResponse,
  reviewResponse,
} from "@/lib/api/contract"
import { usdc } from "@/lib/format/amount"

import { configureMocks, mockConfig } from "./config"
import { resetDb } from "./db"
import { server } from "./node"
import { DEFAULT_ANCHOR } from "./seed/generate"

const anchor = Date.parse(DEFAULT_ANCHOR)
let clock = anchor
const defaults = { ...mockConfig }

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
beforeEach(() => {
  clock = anchor
  configureMocks({
    latencyMs: [0, 0],
    mutationFailureRate: 0,
    now: () => clock,
  })
  resetDb()
})
afterEach(() => server.resetHandlers())
afterAll(() => {
  server.close()
  configureMocks(defaults)
})

const queue = () => fetchJson("/api/approvals", approvalsResponse)

async function expectApiError(
  promise: Promise<unknown>,
  status: number,
  code: string,
) {
  const error = await promise.catch((e: unknown) => e)
  expect(error).toBeInstanceOf(ApiError)
  expect(error).toMatchObject({ status, code })
}

describe("read endpoints", () => {
  it("returns agents and mandates", async () => {
    expect(await fetchJson("/api/agents", agentsResponse)).toHaveLength(6)
    const ops = await fetchJson(
      "/api/mandates?agentId=agt_ops",
      mandatesResponse,
    )
    expect(ops.map((m) => m.version)).toEqual([2, 3])
    expect(ops[1]?.rules[0]).toEqual({
      kind: "limit",
      amount: usdc("2000"),
      period: "tx",
    })
  })

  it("returns the queue with bigint amounts, committed spend and limit warnings", async () => {
    const items = await queue()
    expect(items).toHaveLength(12)

    const gpu = items.find((i) => i.request.amount === usdc("1250"))!
    expect(gpu.agent.name).toBe("Ops Agent")
    expect(gpu.mandate.version).toBe(3)
    expect(gpu.committed.day).toBe(usdc("1730"))
    expect(gpu.limitWarning).toEqual({ ok: true })

    const support = items.find((i) => i.agent.id === "agt_support")!
    expect(support.limitWarning.ok).toBe(false)
  })

  it("filters decisions by outcome and agent, newest first", async () => {
    const denied = await fetchJson(
      "/api/decisions?outcome=deny&agentId=agt_research",
      decisionsResponse,
    )
    expect(denied.length).toBeGreaterThan(0)
    expect(denied.every((d) => d.decision.outcome === "deny")).toBe(true)
    expect(denied.every((d) => d.agent.id === "agt_research")).toBe(true)
    const times = denied.map((d) => Date.parse(d.request.createdAt))
    expect(times).toEqual([...times].sort((a, b) => b - a))

    await expectApiError(
      fetchJson("/api/decisions?outcome=maybe", decisionsResponse),
      400,
      "INVALID_REQUEST",
    )
  })

  it("returns decision and payment detail, or 404", async () => {
    const [first] = await queue()
    const detail = await fetchJson(
      `/api/decisions/${first!.decision.id}`,
      decisionDetailResponse,
    )
    expect(detail.payment.status).toBe("pending_approval")

    const payment = await fetchJson(
      `/api/payments/${detail.payment.id}`,
      paymentDetailResponse,
    )
    expect(payment.decision.id).toBe(first!.decision.id)

    await expectApiError(
      fetchJson("/api/decisions/dec_nope", decisionDetailResponse),
      404,
      "NOT_FOUND",
    )
  })
})

describe("approve", () => {
  it("approves a waiting request and removes it from the queue", async () => {
    const [item] = await queue()
    const result = await postJson(
      `/api/decisions/${item!.decision.id}/approve`,
      {},
      reviewResponse,
    )
    expect(result.decision.reviewResult).toBe("approved")
    expect(result.decision.reviewedBy).toBe("Demo reviewer")
    expect(result.payment.status).toBe("approved")
    expect(await queue()).toHaveLength(11)

    await expectApiError(
      postJson(
        `/api/decisions/${item!.decision.id}/approve`,
        {},
        reviewResponse,
      ),
      409,
      "NOT_WAITING",
    )
  })

  it("refuses a limit breach unless it's acknowledged", async () => {
    const support = (await queue()).find((i) => i.agent.id === "agt_support")!
    const url = `/api/decisions/${support.decision.id}/approve`

    await expectApiError(
      postJson(url, {}, reviewResponse),
      409,
      "LIMIT_WARNING",
    )
    const result = await postJson(
      url,
      { acknowledgeLimitWarning: true },
      reviewResponse,
    )
    expect(result.decision.reviewResult).toBe("approved")
  })

  it("leaves state unchanged on a simulated failure", async () => {
    configureMocks({ mutationFailureRate: 1 })
    const [item] = await queue()
    await expectApiError(
      postJson(
        `/api/decisions/${item!.decision.id}/approve`,
        {},
        reviewResponse,
      ),
      500,
      "SIMULATED_FAILURE",
    )
    expect(await queue()).toHaveLength(12)
  })
})

describe("reject", () => {
  it("requires a reason", async () => {
    const [item] = await queue()
    const url = `/api/decisions/${item!.decision.id}/reject`
    await expectApiError(
      postJson(url, { reason: "   " }, reviewResponse),
      400,
      "INVALID_REQUEST",
    )

    const result = await postJson(
      url,
      { reason: "Not needed." },
      reviewResponse,
    )
    expect(result.decision.reviewResult).toBe("rejected")
    expect(result.decision.reviewReason).toBe("Not needed.")
    expect(result.payment.status).toBe("rejected")
  })

  it("releases the reserved amount from committed spend", async () => {
    const items = await queue()
    const gpu = items.find((i) => i.request.amount === usdc("1250"))!
    await postJson(
      `/api/decisions/${gpu.decision.id}/reject`,
      { reason: "No." },
      reviewResponse,
    )

    const ops = (await queue()).find((i) => i.request.amount === usdc("180"))!
    expect(ops.committed.day).toBe(usdc("480"))
  })
})

describe("held-back requests", () => {
  it("arrive in the queue after 30 s, 90 s and 180 s", async () => {
    expect(await queue()).toHaveLength(12)
    clock = anchor + 30_000
    expect(await queue()).toHaveLength(13)
    clock = anchor + 180_000
    const items = await queue()
    expect(items).toHaveLength(15)
    expect(
      items.filter((i) => i.request.id.startsWith("req_new")),
    ).toHaveLength(3)
  })
})
