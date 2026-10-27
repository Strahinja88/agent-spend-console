import { describe, expect, it } from "vitest"

import { chainName } from "./chain"

describe("chainName", () => {
  it("uses short names by default and full network names on request", () => {
    expect(chainName("base")).toBe("Base")
    expect(chainName("solana", "full")).toBe("Solana Devnet")
  })
})
