import { delay, http } from "msw"
import type { z } from "zod"

import {
  agentsResponse,
  approvalsResponse,
  approveBody,
  decisionDetailResponse,
  decisionsQuery,
  decisionsResponse,
  jwksResponse,
  mandatesResponse,
  paymentDetailResponse,
  rejectBody,
  reviewResponse,
  type ApiErrorCode,
} from "@/lib/api/contract"
import { isWaitingForReview } from "@/lib/domain/display-state"

import { mockConfig } from "./config"
import {
  approvalCheck,
  committedNow,
  findAgent,
  findByDecision,
  findByPayment,
  findMandate,
  getDb,
  recordReview,
  waitingEntries,
} from "./db"

// "*" matches any origin, so the same handlers serve the browser worker
// (relative URLs) and Node tests (http://localhost).
const API = "*/api"

async function latency() {
  const [min, max] = mockConfig.latencyMs
  if (max > 0) await delay(min + Math.random() * (max - min))
}

/** ~10% of mutations fail before touching any state, to exercise rollback. */
function simulatedFailure(): boolean {
  return Math.random() < mockConfig.mutationFailureRate
}

/** Encodes through the contract schema, so bigints go out as strings. */
function send<S extends z.ZodType>(schema: S, data: z.output<S>) {
  return Response.json(schema.encode(data))
}

function fail(status: number, code: ApiErrorCode, message: string) {
  return Response.json({ code, message }, { status })
}

async function readJson(request: Request): Promise<unknown> {
  return request.json().catch(() => ({}))
}

export const handlers = [
  http.get(`${API}/agents`, async () => {
    await latency()
    return send(agentsResponse, (await getDb()).agents)
  }),

  http.get(`${API}/mandates`, async ({ request }) => {
    await latency()
    const agentId = new URL(request.url).searchParams.get("agentId")
    const { mandates } = await getDb()
    return send(
      mandatesResponse,
      agentId ? mandates.filter((m) => m.agentId === agentId) : mandates,
    )
  }),

  http.get(`${API}/approvals`, async () => {
    await latency()
    const db = await getDb()
    return send(
      approvalsResponse,
      waitingEntries(db).map(({ request, decision }) => ({
        decision,
        request,
        agent: findAgent(db, request.agentId),
        mandate: findMandate(db, decision.mandateId),
        committed: committedNow(db, request),
        limitWarning: approvalCheck(db, request),
      })),
    )
  }),

  http.get(`${API}/decisions`, async ({ request }) => {
    await latency()
    const params = Object.fromEntries(new URL(request.url).searchParams)
    const query = decisionsQuery.safeParse(params)
    if (!query.success) {
      return fail(400, "INVALID_REQUEST", "Unknown outcome filter.")
    }
    const { outcome, agentId } = query.data
    const db = await getDb()
    const items = db.entries
      .filter(
        (e) =>
          (!outcome || e.decision.outcome === outcome) &&
          (!agentId || e.request.agentId === agentId),
      )
      .map(({ request, decision }) => ({
        decision,
        request,
        agent: findAgent(db, request.agentId),
      }))
      .reverse()
    return send(decisionsResponse, items)
  }),

  http.get(`${API}/decisions/:id`, async ({ params }) => {
    await latency()
    const db = await getDb()
    const entry = findByDecision(db, String(params.id))
    if (!entry) return fail(404, "NOT_FOUND", "Decision not found.")
    const mandate = findMandate(db, entry.decision.mandateId)
    return send(decisionDetailResponse, {
      ...entry,
      agent: findAgent(db, entry.request.agentId),
      mandate,
      ...(mandate.supersededBy && {
        replacedBy: findMandate(db, mandate.supersededBy),
      }),
    })
  }),

  http.get(`${API}/jwks`, async () => {
    await latency()
    return send(jwksResponse, { keys: [(await getDb()).key.publicJwk] })
  }),

  http.get(`${API}/payments/:id`, async ({ params }) => {
    await latency()
    const db = await getDb()
    const entry = findByPayment(db, String(params.id))
    if (!entry) return fail(404, "NOT_FOUND", "Payment not found.")
    return send(paymentDetailResponse, {
      ...entry,
      agent: findAgent(db, entry.request.agentId),
    })
  }),

  http.post(`${API}/decisions/:id/approve`, async ({ params, request }) => {
    await latency()
    const db = await getDb()
    const entry = findByDecision(db, String(params.id))
    if (!entry) return fail(404, "NOT_FOUND", "Decision not found.")
    if (!isWaitingForReview(entry.decision)) {
      return fail(409, "NOT_WAITING", "This request has already been reviewed.")
    }
    const body = approveBody.safeParse(await readJson(request))
    if (!body.success)
      return fail(400, "INVALID_REQUEST", "Invalid request body.")

    const check = approvalCheck(db, entry.request)
    if (!check.ok && !body.data.acknowledgeLimitWarning) {
      return fail(
        409,
        "LIMIT_WARNING",
        check.breaches.map((b) => b.sentence).join(" "),
      )
    }
    if (simulatedFailure()) {
      return fail(
        500,
        "SIMULATED_FAILURE",
        "Simulated server error. Try again.",
      )
    }
    return send(reviewResponse, recordReview(db, entry, "approved"))
  }),

  http.post(`${API}/decisions/:id/reject`, async ({ params, request }) => {
    await latency()
    const db = await getDb()
    const entry = findByDecision(db, String(params.id))
    if (!entry) return fail(404, "NOT_FOUND", "Decision not found.")
    if (!isWaitingForReview(entry.decision)) {
      return fail(409, "NOT_WAITING", "This request has already been reviewed.")
    }
    const body = rejectBody.safeParse(await readJson(request))
    if (!body.success) {
      return fail(400, "INVALID_REQUEST", "A reason is required to reject.")
    }
    if (simulatedFailure()) {
      return fail(
        500,
        "SIMULATED_FAILURE",
        "Simulated server error. Try again.",
      )
    }
    return send(
      reviewResponse,
      recordReview(db, entry, "rejected", body.data.reason),
    )
  }),
]
