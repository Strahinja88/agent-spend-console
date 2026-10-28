import type { z } from "zod"

import { errorBody, type ApiErrorCode } from "./contract"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** "UNKNOWN" when the body isn't one of ours. */
    readonly code: ApiErrorCode | "UNKNOWN",
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
}

/** Sends one request and returns the response, like `fetch`. */
export type ApiTransport = (request: Request) => Promise<Response>

let transport: ApiTransport = (request) => fetch(request)

/**
 * Replaces `fetch` as the way requests are sent. The app installs the
 * in-memory mock API (D-025); tests keep `fetch`, which MSW intercepts.
 */
export function setApiTransport(next: ApiTransport) {
  transport = next
}

// Relative paths resolve against the page in the browser, and against a
// placeholder origin in Node tests (MSW matches any origin, see mocks/handlers.ts).
function resolve(path: string): string {
  return new URL(path, globalThis.location?.href ?? "http://localhost").href
}

/**
 * Fetches JSON and decodes it with `schema`, so amounts arrive as bigint.
 * Non-2xx responses throw ApiError; a body that doesn't match throws ZodError.
 */
export async function fetchJson<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<z.output<S>> {
  const response = await transport(
    new Request(resolve(path), {
      ...init,
      headers: { Accept: "application/json", ...init?.headers },
    }),
  )
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
