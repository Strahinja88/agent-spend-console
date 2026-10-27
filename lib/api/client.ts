import type { z } from "zod"

import { errorBody, type ApiErrorCode } from "./contract"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** "UNKNOWN" when the body isn't one of ours (e.g. a network proxy error page). */
    readonly code: ApiErrorCode | "UNKNOWN",
    message: string,
  ) {
    super(message)
    this.name = "ApiError"
  }
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
  const response = await fetch(resolve(path), {
    ...init,
    headers: { Accept: "application/json", ...init?.headers },
  })
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

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404
}
