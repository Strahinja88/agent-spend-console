import { describe, expect, it } from "vitest"

import { createRng } from "./prng"

describe("createRng", () => {
  it("repeats the same sequence for the same seed", () => {
    const a = createRng(42)
    const b = createRng(42)
    const seqA = Array.from({ length: 5 }, () => a.next())
    const seqB = Array.from({ length: 5 }, () => b.next())
    expect(seqA).toEqual(seqB)
    expect(createRng(43).next()).not.toBe(seqA[0])
  })

  it("keeps values in range", () => {
    const rng = createRng(1)
    for (let i = 0; i < 1000; i++) {
      const value = rng.int(3, 7)
      expect(value).toBeGreaterThanOrEqual(3)
      expect(value).toBeLessThanOrEqual(7)
      expect(Number.isInteger(value)).toBe(true)
    }
  })

  it("picks from a list and builds hex ids", () => {
    const rng = createRng(7)
    expect(["a", "b"]).toContain(rng.pick(["a", "b"]))
    expect(rng.hex(8)).toMatch(/^[0-9a-f]{8}$/)
    expect(() => rng.pick([])).toThrow()
  })
})
