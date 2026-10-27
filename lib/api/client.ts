import type { z } from "zod"

import { errorBody, type ApiErrorCode } from "./contract"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /**
     * "UNKNOWN" when the body isn't one of ours; "API_UNAVAILABLE" when the
     * response isn't JSON at all, i.e. the mock API didn't answer (D-024).
     */
    readonly code: ApiErrorCode | "UNKNOWN" | "API_UNAVAILABLE",
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/** Reconnects the mock API; resolves true if it's worth sending the request again. */
type Recovery = () => Promise<boolean>

let recover: Recovery | undefined

/** Set by the browser mock worker, so a request that missed it can try again (D-024). */
export function setApiRecovery(fn: Recovery | undefined) {
  recover = fn
}

// Relative paths resolve against the page in the browser, and against a
// placeholder origin in Node tests (MSW matches any origin, see mocks/handlers.ts).
function resolve(path: string): string {
  return new URL(path, globalThis.location?.href ?? "http://localhost").href
}

// Every answer from the mock API is JSON, errors included. Anything else
// (Next.js's HTML 404 page) means the request went past the mock.
function isJson(response: Response): boolean {
  return !!response.headers.get("content-type")?.includes("application/json")
}

/**
 * Fetches JSON and decodes it with `schema`, so amounts arrive as bigint.
 * Non-2xx responses throw ApiError; a body that doesn't match throws ZodError.
 * A non-JSON response reconnects the mock API and is sent once more; if that
 * fails too it throws API_UNAVAILABLE, never a 404.
 */
export async function fetchJson<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.output<S>> {
  const send = () =>
    fetch(resolve(path), {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    })

  let response = await send()
  // Safe to repeat a mutation: it never reached the mock, so nothing changed
  if (!isJson(response) && recover && (await recover())) {
    response = await send()
  }
  if (!isJson(response)) {
    throw new ApiError(503, "API_UNAVAILABLE", "The demo API isn't responding.")
  }

  const body: unknown = await response.json().catch(() => undefined)

  if (!response.ok) {
    const error = errorBody.safeParse(body)
    throw error.success
      ? new ApiError(response.status, error.data.code, error.data.message)
      : new ApiError(response.status, "UNKNOWN", response.statusText)
  }
  return schema.parse(body)
}

/** POST a JSON body (no bigints in request bodies today). */
export function postJson<S extends z.ZodType>(
  path: string,
  body: unknown,
  schema: S,
): Promise<z.output<S>> {
  return fetchJson(path, schema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

/** Only our API's own NOT_FOUND counts: a 404 from anywhere else is an outage. */
export function isNotFound(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 404 &&
    error.code === "NOT_FOUND"
  )
}
