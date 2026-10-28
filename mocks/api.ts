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

// The mock API as plain Request → Response functions, with no MSW in them.
// The browser calls `handleApiRequest` directly (D-025); tests reach it
// through MSW (mocks/handlers.ts).

type Params = Record<string, string>
type Handler = (request: Request, params: Params) => Promise<Response>
type Route = { method: string; pattern: string; handler: Handler }

async function latency() {
  const [min, max] = mockConfig.latencyMs
  if (max <= 0) return
  const ms = min + Math.random() * (max - min)
  await new Promise((resolve) => setTimeout(resolve, ms))
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

const routes: Route[] = [
  {
    method: "GET",
    pattern: "/api/agents",
    handler: async () => send(agentsResponse, (await getDb()).agents),
  },

  {
    method: "GET",
    pattern: "/api/mandates",
    handler: async (request) => {
      const agentId = new URL(request.url).searchParams.get("agentId")
      const { mandates } = await getDb()
      return send(
        mandatesResponse,
        agentId ? mandates.filter((m) => m.agentId === agentId) : mandates,
      )
    },
  },

  {
    method: "GET",
    pattern: "/api/approvals",
    handler: async () => {
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
    },
  },

  {
    method: "GET",
    pattern: "/api/decisions",
    handler: async (request) => {
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
    },
  },

  {
    method: "GET",
    pattern: "/api/decisions/:id",
    handler: async (_request, params) => {
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
    },
  },

  {
    method: "GET",
    pattern: "/api/jwks",
    handler: async () =>
      send(jwksResponse, { keys: [(await getDb()).key.publicJwk] }),
  },

  {
    method: "GET",
    pattern: "/api/payments/:id",
    handler: async (_request, params) => {
      const db = await getDb()
      const entry = findByPayment(db, String(params.id))
      if (!entry) return fail(404, "NOT_FOUND", "Payment not found.")
      return send(paymentDetailResponse, {
        ...entry,
        agent: findAgent(db, entry.request.agentId),
        addressLabels: db.addressLabels,
      })
    },
  },

  {
    method: "POST",
    pattern: "/api/decisions/:id/approve",
    handler: async (request, params) => {
      const db = await getDb()
      const entry = findByDecision(db, String(params.id))
      if (!entry) return fail(404, "NOT_FOUND", "Decision not found.")
      if (!isWaitingForReview(entry.decision)) {
        return fail(
          409,
          "NOT_WAITING",
          "This request has already been reviewed.",
        )
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
    },
  },

  {
    method: "POST",
    pattern: "/api/decisions/:id/reject",
    handler: async (request, params) => {
      const db = await getDb()
      const entry = findByDecision(db, String(params.id))
      if (!entry) return fail(404, "NOT_FOUND", "Decision not found.")
      if (!isWaitingForReview(entry.decision)) {
        return fail(
          409,
          "NOT_WAITING",
          "This request has already been reviewed.",
        )
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
    },
  },
]

/** Matches "/api/decisions/:id" against a path; undefined if it doesn't fit. */
function match(pattern: string, path: string): Params | undefined {
  const want = pattern.split("/")
  const got = path.split("/")
  if (want.length !== got.length) return undefined
  const params: Params = {}
  for (const [i, part] of want.entries()) {
    if (part.startsWith(":"))
      params[part.slice(1)] = decodeURIComponent(got[i] ?? "")
    else if (part !== got[i]) return undefined
  }
  return params
}

/** True if some route answers this method and path. */
export function hasRoute(method: string, path: string): boolean {
  return routes.some((r) => r.method === method && match(r.pattern, path))
}

/**
 * Answers one /api request, any origin. Every answer is JSON, errors
 * included; an unknown route is our own 404 NOT_FOUND.
 */
export async function handleApiRequest(request: Request): Promise<Response> {
  await latency()
  const path = new URL(request.url).pathname
  for (const route of routes) {
    if (route.method !== request.method) continue
    const params = match(route.pattern, path)
    if (params) return route.handler(request, params)
  }
  return fail(404, "NOT_FOUND", "No such API route.")
}
