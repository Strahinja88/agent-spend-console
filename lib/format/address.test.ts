import { describe, expect, it } from "vitest"

import { truncateMiddle } from "./address"

describe("truncateMiddle", () => {
  it("keeps 0x + 4 … 4 for EVM addresses", () => {
    expect(truncateMiddle("0x036CbD53842c5426634e7929541eC2318f3dCF7e")).toBe(
      "0x036C…CF7e",
    )
  })

  it("keeps 4 … 4 for Solana addresses", () => {
    expect(truncateMiddle("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU")).toBe(
      "4zMM…ncDU",
    )
  })

  it("leaves short values alone", () => {
    expect(truncateMiddle("0x1234abcd")).toBe("0x1234abcd")
    expect(truncateMiddle("abcdefghi")).toBe("abcdefghi")
  })
})
