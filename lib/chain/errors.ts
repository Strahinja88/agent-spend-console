// RPC failures in two kinds the UI can explain without showing raw RPC text.
// Retries happen in TanStack Query, not in viem or web3.js (D-020).

export type ChainErrorKind = "rate_limited" | "unavailable"

export class ChainError extends Error {
  constructor(
    readonly kind: ChainErrorKind,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = "ChainError"
  }
}

// HTTP 429, JSON-RPC "limit exceeded" (-32005) and the texts public endpoints
// send with them. web3.js only gives a message ("429 Too Many Requests: …").
const RATE_LIMIT_CODES = new Set([429, -32005])
const RATE_LIMIT_TEXT = /\b429\b|rate.?limit|too many requests/i

function isRateLimit(error: unknown): boolean {
  // viem wraps errors several levels deep; check the whole cause chain
  for (let e = error, depth = 0; e && depth < 8; depth++) {
    if (typeof e !== "object") break
    const { status, code, message, cause } = e as {
      status?: unknown
      code?: unknown
      message?: unknown
      cause?: unknown
    }
    if (typeof status === "number" && RATE_LIMIT_CODES.has(status)) return true
    if (typeof code === "number" && RATE_LIMIT_CODES.has(code)) return true
    if (typeof message === "string" && RATE_LIMIT_TEXT.test(message))
      return true
    e = cause
  }
  return false
}

export function toChainError(error: unknown): ChainError {
  if (error instanceof ChainError) return error
  return isRateLimit(error)
    ? new ChainError("rate_limited", "The RPC is rate-limiting requests.", {
        cause: error,
      })
    : new ChainError("unavailable", "The RPC request failed.", {
        cause: error,
      })
}

/** Worth trying again: every ChainError is (a 429 or a network blip). */
export function isRetryableChainError(error: unknown): boolean {
  return error instanceof ChainError
}
