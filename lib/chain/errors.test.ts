import { describe, expect, it } from "vitest"

import { ChainError, toChainError } from "./errors"

describe("toChainError", () => {
  it("finds a rate limit anywhere in the cause chain", () => {
    const viemLike = new Error("HTTP request failed.", {
      cause: Object.assign(new Error("inner"), { status: 429 }),
    })
    expect(toChainError(viemLike).kind).toBe("rate_limited")
    expect(toChainError({ code: -32005, message: "limit" }).kind).toBe(
      "rate_limited",
    )
    expect(
      toChainError(new Error("429 Too Many Requests: slow down")).kind,
    ).toBe("rate_limited")
  })

  it("calls everything else unavailable and keeps the cause", () => {
    const cause = new TypeError("fetch failed")
    const error = toChainError(cause)
    expect(error).toBeInstanceOf(ChainError)
    expect(error.kind).toBe("unavailable")
    expect(error.cause).toBe(cause)
  })

  it("passes a ChainError through", () => {
    const error = new ChainError("rate_limited", "x")
    expect(toChainError(error)).toBe(error)
  })
})
