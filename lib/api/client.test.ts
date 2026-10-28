// @vitest-environment node
import { http } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { z, ZodError } from "zod"

import { bigintString } from "@/lib/domain/schemas"

import {
  ApiError,
  fetchJson,
  isNotFound,
  postJson,
  setApiTransport,
} from "./client"

const server = setupServer()
const schema = z.object({ amount: bigintString })

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
afterEach(() => {
  server.resetHandlers()
  setApiTransport((request) => fetch(request))
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

  it("doesn't read a 404 from outside our API as not found", async () => {
    server.use(
      http.get(
        "*/x",
        () =>
          new Response("<html>404</html>", {
            status: 404,
            headers: { "content-type": "text/html" },
          }),
      ),
    )
    const error = await fetchJson("/x", schema).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 404, code: "UNKNOWN" })
    expect(isNotFound(error)).toBe(false)
  })

  it("sends through the installed transport, with no network (D-025)", async () => {
    const seen: Request[] = []
    setApiTransport(async (request) => {
      seen.push(request)
      return Response.json({ amount: "9007199254740993" })
    })
    // onUnhandledFrame: "error" would fail any request that reached fetch
    expect(await postJson("/x", { reason: "no" }, schema)).toEqual({
      amount: 9_007_199_254_740_993n,
    })
    expect(seen).toHaveLength(1)
    expect(seen[0]?.method).toBe("POST")
    expect(seen[0]?.url).toBe("http://localhost/x")
    expect(await seen[0]?.json()).toEqual({ reason: "no" })
  })

  it("rejects a body that doesn't match the schema", async () => {
    server.use(http.get("*/x", () => Response.json({ amount: 120 })))
    await expect(fetchJson("/x", schema)).rejects.toBeInstanceOf(ZodError)
  })
})
