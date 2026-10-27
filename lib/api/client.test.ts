// @vitest-environment node
import { http } from "msw"
import { setupServer } from "msw/node"
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest"
import { z, ZodError } from "zod"

import { bigintString } from "@/lib/domain/schemas"

import { ApiError, fetchJson } from "./client"

const server = setupServer()
const schema = z.object({ amount: bigintString })

beforeAll(() => server.listen({ onUnhandledFrame: "error" }))
afterEach(() => server.resetHandlers())
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

  it("falls back to UNKNOWN for foreign error bodies", async () => {
    server.use(
      http.get(
        "*/x",
        () => new Response("<html>Bad gateway</html>", { status: 502 }),
      ),
    )
    const error = await fetchJson("/x", schema).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 502, code: "UNKNOWN" })
  })

  it("rejects a body that doesn't match the schema", async () => {
    server.use(http.get("*/x", () => Response.json({ amount: 120 })))
    await expect(fetchJson("/x", schema)).rejects.toBeInstanceOf(ZodError)
  })
})
