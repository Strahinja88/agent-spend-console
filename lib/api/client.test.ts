// @vitest-environment node
import { http } from "msw"
import { setupServer } from "msw/node"
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { z, ZodError } from "zod"

import { bigintString } from "@/lib/domain/schemas"

import { ApiError, fetchJson, isNotFound, setApiRecovery } from "./client"

const server = setupServer()
const schema = z.object({ amount: bigintString })

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
afterEach(() => {
  server.resetHandlers()
  setApiRecovery(undefined)
})
afterAll(() => server.close())

describe("fetchJson", () => {
  it("decodes amounts to bigint", async () => {
    server.use(
      http.get("*/x", () => Response.json({ amount: "9007199254740993" })),
    )
    expect(await fetchJson("/x", schema)).toEqual({
      amount: 9_007_199_254_740_993n,
    })
  })

  it("throws ApiError with our error code", async () => {
    server.use(
      http.get("*/x", () =>
        Response.json(
          { code: "NOT_FOUND", message: "Decision not found." },
          { status: 404 },
        ),
      ),
    )
    await expect(fetchJson("/x", schema)).rejects.toEqual(
      new ApiError(404, "NOT_FOUND", "Decision not found."),
    )
  })

  it("falls back to UNKNOWN for foreign JSON error bodies", async () => {
    server.use(
      http.get("*/x", () => Response.json({ error: "busy" }, { status: 502 })),
    )
    const error = await fetchJson("/x", schema).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 502, code: "UNKNOWN" })
  })

  // Next.js's HTML 404 page: the request went past the mock API (D-024)
  const nextNotFound = () =>
    new Response("<html>404</html>", {
      status: 404,
      headers: { "content-type": "text/html" },
    })

  it("treats a non-JSON answer as the API being unavailable, not a 404", async () => {
    server.use(http.get("*/x", nextNotFound))
    const error = await fetchJson("/x", schema).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 503, code: "API_UNAVAILABLE" })
    expect(isNotFound(error)).toBe(false)
  })

  it("reconnects and sends once more after a non-JSON answer", async () => {
    let calls = 0
    server.use(
      http.get("*/x", () =>
        ++calls === 1 ? nextNotFound() : Response.json({ amount: "1" }),
      ),
    )
    const recover = vi.fn(async () => true)
    setApiRecovery(recover)
    expect(await fetchJson("/x", schema)).toEqual({ amount: 1n })
    expect(recover).toHaveBeenCalledOnce()
    expect(calls).toBe(2)
  })

  it("doesn't send again when reconnecting fails", async () => {
    let calls = 0
    server.use(
      http.get("*/x", () => {
        calls++
        return nextNotFound()
      }),
    )
    setApiRecovery(async () => false)
    const error = await fetchJson("/x", schema).catch((e: unknown) => e)
    expect(error).toMatchObject({ code: "API_UNAVAILABLE" })
    expect(calls).toBe(1)
  })

  it("rejects a body that doesn't match the schema", async () => {
    server.use(http.get("*/x", () => Response.json({ amount: 120 })))
    await expect(fetchJson("/x", schema)).rejects.toBeInstanceOf(ZodError)
  })
})
